# Publishing this under NDA

## The problem this solves

GitHub Pages is a static host. There is no server at request time, so a password
screen that hides a `<div>` protects nothing:

- the passphrase would be readable in the JavaScript,
- and a visitor could skip the page entirely and request `js/content.js` or
  `art/venue-establishing.png` directly.

Making the repository private does not close it either. **A Pages site built
from a private repository is still publicly readable** on every plan below
GitHub Enterprise Cloud, where per-site access control exists. On Free, Pro and
Team, the repo is private and the site is not.

An Actions secret does not help on its own. A secret used during a build ends up
baked into whatever that build publishes.

## What this repository does instead

It publishes **ciphertext**.

`tools/pack.py` encrypts every file of the prototype — markup, code, stylesheets
and all 35 images — with a key derived from the passphrase, and writes one
opaque blob per file. The passphrase is used at build time and never ships.

What GitHub stores and serves is: a login page, a salt, and fifty numbered
binary files. No filenames, no strings, no art, no title. If the URL leaks,
nothing leaks with it.

```
dist/index.html        the gate — the only readable page, and it names nothing
dist/boot.js           derives the key, decrypts in the browser, starts the game
dist/enc/params.json   salt + KDF cost (public by design; a salt is not secret)
dist/enc/index.bin     the encrypted manifest — every filename lives in here
dist/enc/NNNN.bin      one encrypted file each, in no meaningful order
```

**Crypto.** PBKDF2-HMAC-SHA256 at 310,000 iterations derives a 256-bit key;
each file is sealed with AES-256-GCM under its own random 96-bit IV. There is no
password hash anywhere on the client — a hash on a static host is just an
offline target. Instead the manifest is decrypted with the derived key, and
GCM's authentication tag fails when the key is wrong. A wrong passphrase raises
an exception rather than returning a wrong answer, and the page never learns
anything it could give away.

**Everything rests on the passphrase.** The KDF cost makes each guess expensive,
but that is all it does. Use a long one — four or five unrelated words. There is
no reset and no recovery: change it and every previously shared link stops
working until the next deploy, which is the intended behaviour.

## Setting it up

1. Push this repository to GitHub. It may be public or private — the protection
   does not depend on which, though private is still worth doing.
2. **Settings → Secrets and variables → Actions → New repository secret**
   Name it `PROTOTYPE_PASSWORD`. Paste a long passphrase.
3. **Settings → Pages → Source: GitHub Actions.**
4. Push to `main`. The workflow seals the build, refuses to continue if anything
   readable is in the output, and deploys.
5. Send the client the URL and the passphrase **through different channels** —
   the link by email, the passphrase by phone or signal. A single message
   carrying both is the weak point in this whole arrangement.

## The guard

`tools/verify.py` runs between the build and the upload, and fails the deploy if
dist/ holds anything but the gate, the loader and sealed blobs, or if any
published byte carries a marker string from the game or the brand. It exists so
the NDA does not depend on anybody remembering. If a future change starts
copying `art/` into `dist/` by mistake, the deploy stops rather than putting it
on the open web.

Run it by hand any time:

```
python tools/pack.py --password "..."
python tools/verify.py
```

## Working locally

Nothing above affects development. The prototype still runs unencrypted from the
repository root:

```
python serve.py
```

The one seam is `util.assetURL()`. Locally it hands image paths straight back;
in the sealed build the loader has already decrypted the art into memory and
filled `window.__ASSET`, so it returns blob URLs instead. Every image in the
build goes through it.

## What this does not do

- **It does not hide anything from someone who has the passphrase.** Once they
  are in, the decrypted source is in their browser. This controls who gets in,
  not what they can do afterwards.
- **It does not protect the git history.** This repository was started fresh
  with no ancestry for exactly that reason. Do not import the older history.
- **It is not a substitute for real access control.** If you would rather have
  server-side auth, Cloudflare Pages and Netlify both offer password protection
  at the HTTP layer on their paid tiers, and Vercel has it too. That is a
  stronger and simpler control than this — this exists because the requirement
  was GitHub Pages specifically.
