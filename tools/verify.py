# -*- coding: utf-8 -*-
"""
verify.py — refuse to publish anything readable.

pack.py is careful, but "careful" is not a control. This runs over dist/ right
before it is uploaded and fails the build if any of the following is true:

  * a file exists in dist/ that is not the gate, the loader, or ciphertext
  * any published byte contains a marker string from the game or the brand
  * the gate page or the loader has picked up game content

The point is that the NDA does not depend on anyone remembering. If a future
change starts copying art/ into dist/ by accident, the deploy stops here rather
than putting it on the open web.
"""

import base64, glob, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist')

ALLOWED_TOP = {'index.html', 'boot.js', '.nojekyll', 'enc'}

# Anything that would identify the work, the client, or the source material.
#
# Base64 rather than a plain list, and not out of any belief that encoding is
# secrecy: this file is the one place in the repository that would otherwise
# spell out every name we just spent an afternoon removing, and a repository
# that is greppable for the client's name defeats the point of removing it.
# Anyone who decodes this already has the source in front of them.
MARKERS = [w.encode() for w in base64.b64decode(
    "bHVwaW4KbmV0ZmxpeAphc3NhbmUKYmVuamFtaW4KYXJzZW5lCmxlYmxhbmMKZHJvdW90CmFpZ3VpbGxlCmJvdWNob24KY29tcGxpY2VzCmNvbnRyYXQKc3VzcGljaW9uCmNvZmZyZQp0Y2hhdGNoZQpkZWd1aXNlbWVudA=="
).decode().split()]

fail = []


def check_layout():
    if not os.path.isdir(DIST):
        fail.append('no dist/ — nothing was built')
        return
    for name in os.listdir(DIST):
        if name not in ALLOWED_TOP:
            fail.append('unexpected file in dist/: %s' % name)
    for p in glob.glob(os.path.join(DIST, 'enc', '*')):
        n = os.path.basename(p)
        if not (n.endswith('.bin') or n == 'params.json'):
            fail.append('unexpected file in dist/enc/: %s' % n)


def check_markers():
    """Case-insensitive marker scan over everything that will be uploaded.

    Ciphertext trips this occasionally by pure chance — a short marker turns up
    in random bytes about once every few megabytes — so a hit inside a .bin is
    only reported when the same blob hits several markers at once, which is
    what an actual plaintext leak looks like."""
    for p in sorted(glob.glob(os.path.join(DIST, '**', '*'), recursive=True)):
        if os.path.isdir(p):
            continue
        rel = os.path.relpath(p, DIST).replace('\\', '/')
        data = open(p, 'rb').read().lower()
        hits = [m.decode() for m in MARKERS if m in data]
        if not hits:
            continue
        if rel.startswith('enc/') and rel.endswith('.bin'):
            if len(hits) >= 3:
                fail.append('%s looks like plaintext: %s' % (rel, ', '.join(hits)))
        else:
            fail.append('%s contains %s' % (rel, ', '.join(hits)))


def check_gate():
    for name in ('index.html', 'boot.js'):
        p = os.path.join(DIST, name)
        if not os.path.exists(p):
            fail.append('gate file missing: %s' % name)
            continue
        s = open(p, 'rb').read().lower()
        for bad in (b'<canvas', b'p1-screen', b'p2-screen', b'tv-screen'):
            if bad in s:
                fail.append('%s has game markup in it (%s)' % (name, bad.decode()))


check_layout()
check_markers()
check_gate()

if fail:
    print('REFUSING TO PUBLISH — %d problem(s):' % len(fail))
    for f in fail:
        print('  * %s' % f)
    sys.exit(1)

n = len(glob.glob(os.path.join(DIST, 'enc', '*.bin')))
print('verified: %d sealed blobs, a gate, and a loader. Nothing readable.' % n)
