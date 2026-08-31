# -*- coding: utf-8 -*-
"""
pack.py — build the published site.

WHY THIS EXISTS
    GitHub Pages is a static host. It has no server at request time, so a
    password screen that merely hides a <div> protects nothing: the visitor
    can read the password out of the JavaScript, or skip the page entirely and
    request js/content.js or art/venue-establishing.png directly. A Pages site
    built from a *private* repository is still publicly readable on every plan
    below Enterprise Cloud, so making the repo private does not close it either.

    The only thing that actually works on a host like this is to publish
    ciphertext. This script encrypts every file of the game — markup, code,
    stylesheets and all 35 images — with a key derived from a password, and
    writes out an opaque blob per file. The password is used here, at build
    time, and never ships. What GitHub stores and serves is noise.

    Anyone who fetches the site without the password gets: a login page, a
    salt, and a few dozen numbered binary files. No filenames, no strings, no
    art, no title. Nothing to leak.

WHAT IT PRODUCES
    dist/index.html      the gate — the only readable page
    dist/boot.js         derives the key, decrypts, starts the game
    dist/enc/params.json salt + KDF cost (public by design; a salt is not secret)
    dist/enc/index.bin   the encrypted manifest — filenames live in here
    dist/enc/NNNN.bin    one encrypted file each, in no meaningful order

CRYPTO
    PBKDF2-HMAC-SHA256 -> 32-byte key -> AES-256-GCM, one random 96-bit IV per
    file, stored as iv || ciphertext||tag. GCM's authentication tag is what
    tells a wrong password from a right one: decryption of the manifest fails
    loudly rather than returning garbage, so the gate needs no password hash
    on the client and therefore publishes nothing to attack offline.

    Strength rests on the passphrase. The KDF cost below makes each guess
    expensive, but a four-letter password is a four-letter password. Use
    something long.

USAGE
    PROTOTYPE_PASSWORD=... python tools/pack.py
    python tools/pack.py --password "..."        (local testing)
"""

import argparse, base64, hashlib, io, json, mimetypes, os, re, secrets, shutil, sys

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
except ImportError:
    sys.exit("needs 'cryptography':  pip install cryptography")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist')
GATE = os.path.join(ROOT, 'tools', 'gate')

# Cost per guess. Raise it and offline attacks get proportionally slower; the
# only person who pays it honestly is the one visitor who types the password.
ITERATIONS = 310000

# Everything under these is encrypted and published. Nothing else is.
INCLUDE_DIRS = ('js', 'styles', 'art')
INCLUDE_FILES = ('index.html',)


def collect():
    out = []
    for f in INCLUDE_FILES:
        p = os.path.join(ROOT, f)
        if os.path.exists(p):
            out.append(f.replace('\\', '/'))
    for d in INCLUDE_DIRS:
        base = os.path.join(ROOT, d)
        if not os.path.isdir(base):
            continue
        for dirpath, _dirs, files in os.walk(base):
            for f in sorted(files):
                if f.startswith('.') or f.endswith('.md'):
                    continue           # the prompt pack is not part of the game
                rel = os.path.relpath(os.path.join(dirpath, f), ROOT)
                out.append(rel.replace('\\', '/'))
    return out


def load_order(html):
    """The gate has to re-run the stylesheets and scripts in the order the page
    declared them, so read that order out of index.html rather than hard-coding
    a list here that would silently rot the first time a file is added."""
    css = re.findall(r'<link[^>]+href="([^"]+\.css)"', html)
    js = re.findall(r'<script[^>]+src="([^"]+\.js)"', html)
    body = re.search(r'<body[^>]*>(.*)</body>', html, re.S)
    if not body:
        sys.exit('index.html has no <body>')
    inner = re.sub(r'<script[^>]*src="[^"]+"[^>]*>\s*</script>', '', body.group(1))
    return css, js, inner


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--password', default=os.environ.get('PROTOTYPE_PASSWORD'))
    ap.add_argument('--out', default=DIST)
    args = ap.parse_args()

    pw = args.password
    if not pw:
        sys.exit('no password: set PROTOTYPE_PASSWORD or pass --password')
    if len(pw) < 12:
        print('WARNING: %d-character password. Everything here rests on it; '
              'use a long passphrase.' % len(pw), file=sys.stderr)

    out = args.out
    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(os.path.join(out, 'enc'))

    salt = secrets.token_bytes(16)
    key = hashlib.pbkdf2_hmac('sha256', pw.encode('utf-8'), salt, ITERATIONS, 32)
    aes = AESGCM(key)

    def seal(data):
        iv = secrets.token_bytes(12)
        return iv + aes.encrypt(iv, data, None)

    files = collect()
    html = io.open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    css_order, js_order, body_inner = load_order(html)

    manifest = {'css': css_order, 'js': js_order, 'body': body_inner, 'files': {}}
    total_in = total_out = 0

    for i, rel in enumerate(files):
        raw = open(os.path.join(ROOT, rel), 'rb').read()
        blob = '%04d.bin' % i
        sealed = seal(raw)
        open(os.path.join(out, 'enc', blob), 'wb').write(sealed)
        mime = mimetypes.guess_type(rel)[0] or 'application/octet-stream'
        manifest['files'][rel] = {'b': blob, 'm': mime}
        total_in += len(raw)
        total_out += len(sealed)

    # The manifest carries every filename, so it is sealed like everything else.
    # It is also the password check: if AES-GCM cannot authenticate this one
    # blob, the password is wrong, and the gate never learns anything more.
    open(os.path.join(out, 'enc', 'index.bin'), 'wb').write(
        seal(json.dumps(manifest, separators=(',', ':')).encode('utf-8')))

    json.dump({'salt': base64.b64encode(salt).decode(), 'iter': ITERATIONS, 'v': 1},
              open(os.path.join(out, 'enc', 'params.json'), 'w'))

    for f in ('index.html', 'boot.js'):
        shutil.copy(os.path.join(GATE, f), os.path.join(out, f))
    open(os.path.join(out, '.nojekyll'), 'w').close()   # Pages must not process this

    print('sealed %d files  %.1f MB -> %.1f MB' % (len(files), total_in / 1e6, total_out / 1e6))
    print('output: %s' % out)
    print('the published site contains no readable game file.')


if __name__ == '__main__':
    main()
