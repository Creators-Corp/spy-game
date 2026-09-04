/* util.js — tiny helpers. No dependencies, no build step, runs from file://  */
window.DC = window.DC || {};

(function (L) {
  'use strict';

  /* ---------- DOM ---------- */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (k === 'class') n.className = attrs[k];
        else if (k === 'html') n.innerHTML = attrs[k];
        else if (k === 'text') n.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
      }
    }
    (kids || []).forEach(function (c) {
      if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }
  /* A numbered "do this, and then this" strip.
     Four screens in this build ask a player to do one thing and then a
     different thing, and every one of them used to say so in a single run-on
     sentence that only parsed if you already knew the answer. Two numbered
     lines is the cheapest fix there is, and it costs six lines of layout. */
  function howto(steps) {
    return el('ol', { class: 'howto' }, steps.map(function (t, i) {
      return el('li', {}, [el('b', { text: String(i + 1) }), el('em', { text: t })]);
    }));
  }
  /* EVERY image in the build resolves through here.
     Running locally, window.__ASSET does not exist and this hands the path
     straight back, so development is unchanged. In the published build the
     loader has already decrypted the art into memory and filled __ASSET with
     blob URLs, so this returns one of those — and nothing the host serves is
     ever a readable PNG. */
  function assetURL(path) {
    var m = window.__ASSET;
    return (m && m[path]) || path;
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /* One illustrated header for every phone view. */
  function phoneHeader(player, title) {
    return el('header', { class: 'phead phone-heading' + (title.length > 12 ? ' phone-heading--long' : '') }, [
      el('img', { src: assetURL('art/ui/header-' + player + '.png'), alt: '', 'aria-hidden': 'true' }),
      el('h1', { text: title })
    ]);
  }

  /* ---------- art placeholder slots ----------
     Every image in the prototype is a named slot. If art/<name>.png exists it is
     used; if not, the slot draws itself as a labelled dashed box so the layout is
     final and the art is genuinely drop-in. See art/ART_PROMPTS.md. */
  /* Slot elements are cached and reused rather than rebuilt.
     The phones re-render on every single action, and creating a fresh <img>
     each time made the artwork re-decode and visibly flash — four times in a
     row while Player 1 types a keypad code. Reusing the node keeps the decoded
     image alive across renders. Each slot name appears in exactly one place at
     a time, so a single cached node per name is safe. */
  var slotCache = {};
  function artSlot(name, className) {
    var key = name + '|' + (className || '');
    if (slotCache[key]) return slotCache[key];
    var box = el('div', { class: 'artslot ' + (className || ''), 'data-slot': name });
    var img = el('img', { src: assetURL('art/' + name + '.png'), alt: '' });
    img.addEventListener('error', function () {
      img.remove();
      box.classList.add('is-empty');
    });
    box.appendChild(img);
    slotCache[key] = box;
    return box;
  }
  /* upgrade any artslot already written in index.html */
  function hydrateStaticSlots() {
    $$('.artslot[data-slot]').forEach(function (box) {
      if (box.querySelector('img')) return;
      var img = el('img', { src: assetURL('art/' + box.getAttribute('data-slot') + '.png'), alt: '' });
      img.addEventListener('error', function () { img.remove(); box.classList.add('is-empty'); });
      box.appendChild(img);
    });
  }

  /* ---------- event bus ---------- */
  var handlers = {};
  function on(evt, fn) { (handlers[evt] = handlers[evt] || []).push(fn); }
  function emit(evt, payload) { (handlers[evt] || []).forEach(function (fn) { fn(payload); }); }

  /* ---------- audio ----------
     Design law: no information is ever carried by sound alone. Every cue below
     has a synchronised visual, so the whole prototype is playable muted. */
  var ac = null, muted = false;
  function tone(freq, dur, type, gain) {
    if (muted) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      g.gain.value = 0;
      o.connect(g); g.connect(ac.destination);
      var t = ac.currentTime;
      g.gain.linearRampToValueAtTime(gain || 0.05, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* audio is optional, never load-bearing */ }
  }
  /* THE PHONES SHAKE. A fake vibration — the whole handset jolts for a third
     of a second — on anything that would make a real phone buzz: a wrong
     code, a guard turning round, the building going up a level. On a real
     device the motor runs too. Every buzz has a matching visual and a sound,
     so the cue survives a muted room and a phone lying on a table. */
  function buzz(who, long) {
    var ids = who === 'both' ? ['p1', 'p2'] : [who];
    ids.forEach(function (id) {
      var el = document.querySelector('#' + id + ' .phone__body');
      if (!el) return;
      el.classList.remove('is-buzz', 'is-buzz--long');
      void el.offsetWidth;                       /* restart the animation */
      el.classList.add('is-buzz');
      if (long) el.classList.add('is-buzz--long');
    });
    if (navigator.vibrate) { try { navigator.vibrate(long ? [120, 60, 160] : 40); } catch (e) {} }
  }

  /* THE HEARTBEAT. Runs while the building is on alert or the pressure clock
     is charging, faster the worse it gets. Synthesised here so it works with
     an empty art folder; drop a licensed loop at art/heartbeat.mp3 (Artlist
     or wherever) and it is used instead, sped up with the tension. */
  var heartTimer = null, heartRate = 0, heartFile = null, heartFileState = 0;
  function heartbeat(rate) {
    if (rate === heartRate) return;
    heartRate = rate;
    if (heartTimer) { clearInterval(heartTimer); heartTimer = null; }
    if (heartFile) heartFile.pause();
    if (!rate || muted) return;
    if (heartFileState === 0) {
      heartFileState = 1;
      var a = new Audio(assetURL('art/heartbeat.mp3'));
      a.loop = true;
      a.addEventListener('canplaythrough', function () { heartFileState = 2; heartFile = a; });
      a.addEventListener('error', function () { heartFileState = 3; });
    }
    if (heartFile) {
      heartFile.playbackRate = Math.min(2, Math.max(0.6, 1500 / rate));
      heartFile.volume = 0.5;
      heartFile.play().catch(function () {});
      return;
    }
    var thump = function () {
      tone(54, 0.12, 'sine', 0.10);
      setTimeout(function () { tone(46, 0.18, 'sine', 0.08); }, 150);
    };
    thump();
    heartTimer = setInterval(thump, rate);
  }

  /* ---------- THE SCORE ----------
     Two licensed tracks and one rule: SHADES loops for as long as the job is
     still a job, and the moment the prize is in his hands it becomes CHAPTER
     TWO and stays there until the rank card. The cut is the point — the pair
     hear the music change before either of them has said a word about it, and
     that is the building telling them the second half has started.

       art/music-infiltration.mp3   Ziv Moran — Shades
       art/music-escape.mp3         Monument Music — Chapter Two

     Both loop, because an escape can run longer than a track and silence
     halfway out reads as a bug. Under the sound effects at 0.34 so a wiretap
     pulse and a guard's footstep still cut through it.

     Everything here is optional: no file, no autoplay permission, no Audio at
     all, and the game is exactly as playable. It is never load-bearing — no
     cue in this prototype is carried by sound alone. */
  var SCORE = { infiltration: 'art/music-infiltration.mp3', escape: 'art/music-escape.mp3' };
  var scoreNow = null, scoreEl = null, scoreFade = null;
  function score(track) {
    if (track === scoreNow) { if (scoreEl && !muted && scoreEl.paused) scoreEl.play().catch(function () {}); return; }
    scoreNow = track;
    /* fade the old one out rather than cutting it — a hard stop under a hard
       start is two edits where the moment only wants one */
    if (scoreEl) {
      var old = scoreEl;
      clearInterval(scoreFade);
      scoreFade = setInterval(function () {
        old.volume = Math.max(0, old.volume - 0.08);
        if (old.volume <= 0.001) { clearInterval(scoreFade); old.pause(); }
      }, 40);
      scoreEl = null;
    }
    if (!track || !SCORE[track] || muted) return;
    try {
      var a = new Audio(assetURL(SCORE[track]));
      a.loop = true;
      a.volume = 0.34;
      /* a browser that has not seen a gesture yet simply refuses; the next
         tap re-enters here through render() and it starts then */
      a.play().then(function () { scoreEl = a; }).catch(function () { scoreNow = null; });
      a.addEventListener('error', function () { scoreNow = null; });
    } catch (e) { scoreNow = null; }
  }

  var sfx = {
    step:  function () { tone(190, 0.05, 'square', 0.03); },
    block: function () { tone(90, 0.10, 'sawtooth', 0.04); },
    good:  function () { tone(660, 0.09, 'triangle', 0.06); setTimeout(function () { tone(990, 0.14, 'triangle', 0.06); }, 90); },
    bad:   function () { tone(150, 0.22, 'sawtooth', 0.06); },
    spot:  function () { tone(320, 0.10, 'square', 0.07); setTimeout(function () { tone(210, 0.30, 'square', 0.07); }, 100); },
    unlock:function () { tone(440, 0.07, 'triangle', 0.05); setTimeout(function () { tone(590, 0.07, 'triangle', 0.05); }, 70); setTimeout(function () { tone(880, 0.20, 'triangle', 0.06); }, 140); },
    jail:  function () { tone(70, 0.60, 'sawtooth', 0.10); },
    tap:   function () { tone(520, 0.03, 'sine', 0.03); },
    /* the wiretap. Long and short differ in DURATION and in pitch, so the
       two are distinguishable by ear, on screen, and through a phone speaker
       that has been compressed to death. */
    pulse: function (long) { tone(long ? 380 : 720, long ? 0.30 : 0.09, 'square', 0.05); }
  };
  function setMuted(v) {
    muted = v;
    if (v) {
      if (heartTimer) { clearInterval(heartTimer); heartTimer = null; }
      if (heartFile) heartFile.pause();
      heartRate = 0;
      if (scoreEl) { scoreEl.pause(); scoreEl = null; }
      scoreNow = null;                 /* so unmuting starts it again */
    }
  }
  function isMuted() { return muted; }

  /* ---------- misc ---------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mmss(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function shuffle(arr, seed) {
    var a = arr.slice(), s = seed || 1;
    for (var i = a.length - 1; i > 0; i--) {
      s = (s * 9301 + 49297) % 233280;
      var j = Math.floor((s / 233280) * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* warm the browser cache before the first render asks for anything */
  function preloadArt(names) {
    names.forEach(function (n) { var i = new Image(); i.src = assetURL('art/' + n + '.png'); });
  }

  L.util = {
    el: el, howto: howto, assetURL: assetURL, $: $, $$: $$, clear: clear, preloadArt: preloadArt,
    phoneHeader: phoneHeader, artSlot: artSlot, hydrateStaticSlots: hydrateStaticSlots,
    on: on, emit: emit,
    sfx: sfx, setMuted: setMuted, isMuted: isMuted, buzz: buzz, heartbeat: heartbeat, score: score,
    clamp: clamp, mmss: mmss, shuffle: shuffle
  };
})(window.DC);
