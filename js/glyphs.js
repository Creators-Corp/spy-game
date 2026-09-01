/* glyphs.js — the abstract symbol set.
   These are deliberately unnameable. Nothing in the UI ever labels them, because
   naming them would remove the reason to talk: the players invent the names
   ("a swirly circle", "a backwards Z", "a little elephant") and that improvised
   vocabulary IS the game. It is also why the puzzle needs no translation. */
(function (L) {
  'use strict';
  var el = L.util.el;

  /* id -> path data, drawn on a 100x100 field, stroke only, uniform weight */
  var G = {
    /* --- the safe-dial set (12) --- */
    spiral:  'M52 50 A2 2 0 1 1 48 50 A8 8 0 1 0 62 50 A16 16 0 1 1 34 50 A26 26 0 1 0 76 50',
    backz:   'M72 24 L28 24 L72 76 L28 76',
    tridot:  'M50 20 L80 76 L20 76 Z M50 62 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0',
    crescent:'M64 20 A32 32 0 1 0 64 80 A25 25 0 1 1 64 20 Z',
    star4:   'M50 16 L58 42 L84 50 L58 58 L50 84 L42 58 L16 50 L42 42 Z',
    ladder:  'M32 18 L32 82 M68 18 L68 82 M32 34 L68 34 M32 50 L68 50 M32 66 L68 66',
    bisect:  'M50 20 m-30 30 a30 30 0 1 0 60 0 a30 30 0 1 0 -60 0 M50 20 L50 80',
    hook:    'M26 22 L26 66 L72 66 M56 50 L72 66 L56 82',
    chevrons:'M28 40 L50 22 L72 40 M28 70 L50 52 L72 70',
    dbar:    'M50 18 L80 50 L50 82 L20 50 Z M28 50 L72 50',
    drop:    'M50 18 C74 44 76 64 63 74 A17 17 0 1 1 37 74 C24 64 26 44 50 18 Z',
    trident: 'M50 82 L50 28 M26 44 L26 22 M74 44 L74 22 M26 44 A24 24 0 0 0 74 44',

    /* --- UI --- */
    aup:     'M50 78 L50 24 M28 46 L50 24 L72 46',
    adown:   'M50 22 L50 76 M28 54 L50 76 L72 54',
    aleft:   'M78 50 L24 50 M46 28 L24 50 L46 72',
    aright:  'M22 50 L76 50 M54 28 L76 50 L54 72',
    cake:    'M22 78 L78 78 L78 54 L22 54 Z M22 62 C34 70 40 54 50 62 C60 70 66 54 78 62 M34 54 L34 40 M50 54 L50 36 M66 54 L66 40',
    eye:     'M12 50 C30 26 70 26 88 50 C70 74 30 74 12 50 Z M50 50 m-11 0 a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0',
    safe:    'M16 20 L84 20 L84 80 L16 80 Z M28 32 L72 32 L72 68 L28 68 Z M50 50 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 M50 41 L50 32 M50 68 L50 59',
    desk:    'M16 24 L84 24 L84 62 L16 62 Z M34 76 L66 76 M50 62 L50 76 M28 36 L58 36 M28 46 L48 46',
    talk:    'M14 22 L58 22 L58 56 L34 56 L22 68 L22 56 L14 56 Z M46 40 L86 40 L86 70 L78 70 L78 82 L66 70 L46 70 Z',
    lock:    'M28 48 L72 48 L72 84 L28 84 Z M36 48 L36 34 A14 14 0 0 1 64 34 L64 48',
    manu:    'M26 16 L62 16 L74 30 L74 84 L26 84 Z M62 16 L62 30 L74 30 M38 44 L62 44 M38 56 L62 56 M38 68 L54 68',
    coat:    'M36 24 L50 32 L64 24 L78 38 L70 45 L70 84 L30 84 L30 45 L22 38 Z M50 32 L50 84',
    frame:   'M16 20 L84 20 L84 80 L16 80 Z M26 30 L74 30 L74 70 L26 70 Z M26 60 L40 46 L52 58 L62 48 L74 58',
    wave:    'M8 50 L22 50 L28 30 L36 70 L44 38 L52 62 L60 44 L68 56 L74 50 L92 50',
    car:     'M14 62 L18 44 L34 34 L66 34 L82 44 L86 62 L86 72 L14 72 Z M30 44 L70 44 M50 34 L50 44 M32 72 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M68 72 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0',
    /* --- Benjamin's levers, and the gate --- */
    key:     'M30 50 m-14 0 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0 M44 50 L84 50 M74 50 L74 62 M64 50 L64 60',
    bell:    'M50 14 L50 22 M32 62 C32 36 40 26 50 26 C60 26 68 36 68 62 L78 72 L22 72 Z M42 80 A8 8 0 0 0 58 80',
    bulb:    'M50 14 C34 14 24 26 24 40 C24 52 32 56 36 64 L64 64 C68 56 76 52 76 40 C76 26 66 14 50 14 Z M38 74 L62 74 M42 84 L58 84',
    beam:    'M12 50 L36 50 M64 50 L88 50 M42 38 L58 62 M58 38 L42 62',
    hatch:   'M18 18 L82 18 L82 82 L18 82 Z M50 50 m-13 0 a13 13 0 1 0 26 0 a13 13 0 1 0 -26 0 M50 37 L50 26 M18 50 L30 50 M70 50 L82 50'
  };

  var sprite = null;
  function build() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    for (var id in G) {
      var sym = document.createElementNS(ns, 'symbol');
      sym.setAttribute('id', 'g-' + id);
      sym.setAttribute('viewBox', '0 0 100 100');
      var p = document.createElementNS(ns, 'path');
      p.setAttribute('d', G[id]);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', 'currentColor');
      p.setAttribute('stroke-width', '7');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      sym.appendChild(p);
      svg.appendChild(sym);
    }
    document.getElementById('glyph-sprite').appendChild(svg);
    sprite = true;
  }

  /* returns an <svg> element referencing a symbol */
  function icon(id, cls) {
    if (!sprite) build();
    var ns = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 100 100');
    if (cls) s.setAttribute('class', cls);
    s.setAttribute('aria-hidden', 'true');
    var u = document.createElementNS(ns, 'use');
    u.setAttribute('href', '#g-' + id);
    u.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#g-' + id);
    s.appendChild(u);
    return s;
  }

  /* Markup version, for building SVG strings inline.
     width/height are NOT optional. A <use> pointing at a <symbol> with no
     explicit size defaults to 100% of the VIEWPORT, not of the symbol's own
     viewBox — so every icon drawn this way was rendering at hundreds of pixels
     and then scaled, which put a module icon across a quarter of the map. */
  function iconMarkup(id, extra) {
    return '<use href="#g-' + id + '" width="100" height="100" ' + (extra || '') + '/>';
  }

  L.glyphs = { list: Object.keys(G), icon: icon, iconMarkup: iconMarkup, build: build };
})(window.DC);
