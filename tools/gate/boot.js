/* boot.js — the loader.
 *
 * The host holds nothing but ciphertext. This file takes a passphrase, derives
 * the key the build was sealed with, decrypts the site into memory, and starts
 * it. Nothing is ever written back, so the only readable copy of the prototype
 * exists in the tab of somebody who knew the passphrase.
 *
 * There is no password hash here to check against, and that is on purpose: a
 * hash on a static host is an offline target. Instead the manifest is decrypted
 * with the derived key, and AES-GCM's authentication tag fails if the key is
 * wrong. A wrong passphrase produces an exception, not a wrong answer, and the
 * page learns nothing it could leak.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var form = $('f'), input = $('pw'), go = $('go'), msg = $('msg'),
      bar = $('bar'), fill = $('fill');

  function say(text, bad) {
    msg.textContent = text;
    msg.className = 'msg' + (bad ? ' bad' : '');
  }
  function progress(done, total) {
    bar.classList.add('on');
    fill.style.width = Math.round((done / total) * 100) + '%';
  }

  if (!window.crypto || !window.crypto.subtle) {
    say('This browser cannot decrypt the build. It needs WebCrypto over HTTPS.', true);
    go.disabled = true;
    return;
  }

  /* ---------------------------------------------------------------- crypto */
  function deriveKey(pass, salt, iterations) {
    return crypto.subtle
      .importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      });
  }

  /* Every blob is iv (12 bytes) followed by ciphertext and tag. */
  function open_(key, buf) {
    var b = new Uint8Array(buf);
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.subarray(0, 12) }, key, b.subarray(12));
  }

  function getBuf(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' -> ' + r.status);
      return r.arrayBuffer();
    });
  }

  var dec = new TextDecoder();

  /* ------------------------------------------------------------------ boot */
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var pass = input.value;
    if (!pass) return;

    go.disabled = true; input.disabled = true;
    say('Deriving key…');

    var key, manifest;

    getBuf('enc/params.json')
      .then(function (buf) {
        var p = JSON.parse(dec.decode(buf));
        var salt = Uint8Array.from(atob(p.salt), function (c) { return c.charCodeAt(0); });
        return deriveKey(pass, salt, p.iter);
      })
      .then(function (k) {
        key = k;
        say('Opening…');
        return getBuf('enc/index.bin');
      })
      /* The manifest is the password check. A wrong key throws here. */
      .then(function (buf) { return open_(key, buf); })
      .catch(function (e) {
        if (String(e).indexOf('operation-specific') >= 0 || e.name === 'OperationError') {
          throw new Error('WRONG_PASSPHRASE');
        }
        throw e;
      })
      .then(function (plain) {
        manifest = JSON.parse(dec.decode(plain));
        var paths = Object.keys(manifest.files);
        say('Decrypting ' + paths.length + ' files…');

        var done = 0, store = {};
        return Promise.all(paths.map(function (p) {
          var f = manifest.files[p];
          return getBuf('enc/' + f.b)
            .then(function (buf) { return open_(key, buf); })
            .then(function (plainBuf) {
              store[p] = { bytes: plainBuf, mime: f.m };
              progress(++done, paths.length);
            });
        })).then(function () { return store; });
      })
      .then(function (store) {
        say('Starting…');
        return start(manifest, store);
      })
      .catch(function (e) {
        go.disabled = false; input.disabled = false;
        bar.classList.remove('on');
        input.value = ''; input.focus();
        if (e && e.message === 'WRONG_PASSPHRASE') {
          say('That passphrase does not open this build.', true);
        } else {
          say('Could not load: ' + (e && e.message ? e.message : e), true);
        }
      });
  });

  /* --------------------------------------------------------------- launch */
  function start(manifest, store) {
    /* Images become blob URLs held only by this tab. The game asks for them by
       their original path through util.assetURL, which reads this map. */
    var assets = {};
    Object.keys(store).forEach(function (p) {
      if (p.indexOf('art/') !== 0) return;
      assets[p] = URL.createObjectURL(new Blob([store[p].bytes], { type: store[p].mime }));
    });
    window.__ASSET = assets;

    var text = function (p) { return dec.decode(store[p].bytes); };

    /* Stylesheets first, in the order the page declared them, so the markup
       never renders unstyled. */
    manifest.css.forEach(function (p) {
      var el = document.createElement('style');
      el.textContent = text(p);
      document.head.appendChild(el);
    });

    document.title = 'Prototype';
    document.body.className = '';
    document.body.innerHTML = manifest.body;

    /* Scripts run in declaration order. textContent rather than a blob URL so
       that a syntax error still points somewhere useful in the console. */
    manifest.js.forEach(function (p) {
      var el = document.createElement('script');
      el.textContent = text(p);
      document.body.appendChild(el);
    });
  }
})();
