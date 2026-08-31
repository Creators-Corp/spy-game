/* figures.js — things that are drawn from data rather than loaded as art.
   Same argument as the guard faces: a module whose content is generated is a
   module that can hold endless variants, and it is playable before a single
   asset exists. Uniforms and canvases are both just feature lists. */
(function (L) {
  'use strict';

  /* ============================ THE FIGURE ============================
     One standing body, drawn on a 100 x 160 field. Player 1 assembles an
     outfit onto it; Player 2 sees the same renderer used for every face on
     the staff roster. Both halves of the conversation, one drawing. */

  var SKIN = 'var(--camel)';
  var INK = 'var(--ink)';

  function head(id) {
    var s = '';
    /* the head itself */
    s += '<circle cx="50" cy="26" r="15" fill="' + SKIN + '" stroke="' + INK + '" stroke-width="3"/>';
    s += '<circle cx="34" cy="28" r="4" fill="' + SKIN + '" stroke="' + INK + '" stroke-width="3"/>';
    s += '<circle cx="66" cy="28" r="4" fill="' + SKIN + '" stroke="' + INK + '" stroke-width="3"/>';
    s += '<circle cx="45" cy="26" r="2" fill="' + INK + '"/><circle cx="55" cy="26" r="2" fill="' + INK + '"/>';

    if (id === 'nu') {
      /* bare head — just hair */
      s += '<path d="M36 18 C40 8 60 8 64 18 C58 13 42 13 36 18 Z" fill="' + INK + '"/>';
    }
    if (id === 'casquette') {
      /* flat cap: low round crown and a peak pushed forward */
      s += '<path d="M34 16 C38 4 62 4 66 16 Z" fill="var(--olive)" stroke="' + INK + '" stroke-width="3"/>';
      s += '<path d="M28 16 L68 16 L66 21 L30 21 Z" fill="var(--olive)" stroke="' + INK + '" stroke-width="3"/>';
    }
    if (id === 'beret') {
      /* beret: soft, wider than the head, with a nub */
      s += '<path d="M31 16 C33 3 67 3 69 16 C60 20 40 20 31 16 Z" fill="var(--denim)" stroke="' + INK + '" stroke-width="3"/>';
      s += '<circle cx="50" cy="4" r="3" fill="var(--denim)" stroke="' + INK + '" stroke-width="2.5"/>';
    }
    if (id === 'calot') {
      /* side cap: angular wedge, no peak at all */
      s += '<path d="M33 17 L50 5 L67 17 L64 20 L36 20 Z" fill="var(--zinc)" stroke="' + INK + '" stroke-width="3"/>';
    }
    return s;
  }

  function torso(id) {
    var s = '';
    /* neck and the body underneath whatever is worn */
    s += '<rect x="44" y="38" width="12" height="10" fill="' + SKIN + '" stroke="' + INK + '" stroke-width="3"/>';
    s += '<path d="M30 52 L70 52 L72 100 L28 100 Z" fill="var(--paper)" stroke="' + INK + '" stroke-width="3"/>';
    /* arms */
    s += '<path d="M30 54 L20 96" stroke="' + INK + '" stroke-width="3" fill="none" stroke-linecap="round"/>';
    s += '<path d="M70 54 L80 96" stroke="' + INK + '" stroke-width="3" fill="none" stroke-linecap="round"/>';

    if (id === 'tablier') {
      /* long apron: a bib and two straps over the shoulders */
      s += '<path d="M38 56 L62 56 L66 100 L34 100 Z" fill="var(--stone)" stroke="' + INK + '" stroke-width="3"/>';
      s += '<path d="M40 56 L45 48 M60 56 L55 48" stroke="' + INK + '" stroke-width="3" fill="none"/>';
    }
    if (id === 'gilet') {
      /* waistcoat: short, deep V, buttons */
      s += '<path d="M34 52 L44 52 L50 68 L56 52 L66 52 L68 84 L32 84 Z" fill="var(--olive)" stroke="' + INK + '" stroke-width="3"/>';
      s += '<circle cx="50" cy="74" r="2" fill="' + INK + '"/><circle cx="50" cy="81" r="2" fill="' + INK + '"/>';
    }
    if (id === 'veste') {
      /* jacket: lapels, full length, closed */
      s += '<path d="M30 52 L70 52 L72 100 L28 100 Z" fill="var(--denim)" stroke="' + INK + '" stroke-width="3"/>';
      s += '<path d="M44 52 L50 70 L56 52" fill="none" stroke="' + INK + '" stroke-width="3"/>';
      s += '<path d="M50 70 L50 100" stroke="' + INK + '" stroke-width="3"/>';
    }
    if (id === 'blouse') {
      /* smock: loose, buttons straight down, no lapel */
      s += '<path d="M28 52 L72 52 L74 100 L26 100 Z" fill="var(--paper)" stroke="' + INK + '" stroke-width="3"/>';
      s += '<path d="M50 52 L50 100" stroke="' + INK + '" stroke-width="3"/>';
      s += '<circle cx="44" cy="64" r="2" fill="' + INK + '"/><circle cx="44" cy="76" r="2" fill="' + INK + '"/>';
    }
    return s;
  }

  function legs(id) {
    var fill = id === 'jean' ? 'var(--denim)' : id === 'salopette' ? 'var(--olive)' : 'var(--ink-soft)';
    var s = '';
    s += '<path d="M32 100 L46 100 L44 150 L32 150 Z" fill="' + fill + '" stroke="' + INK + '" stroke-width="3"/>';
    s += '<path d="M54 100 L68 100 L68 150 L56 150 Z" fill="' + fill + '" stroke="' + INK + '" stroke-width="3"/>';
    if (id === 'raye') {
      /* pinstripes — the one detail you have to say out loud */
      s += '<path d="M36 102 L36 148 M40 102 L40 148 M58 102 L58 148 M62 102 L62 148"' +
           ' stroke="var(--paper)" stroke-width="2" fill="none"/>';
    }
    if (id === 'salopette') {
      /* overalls: the bib climbs back up over the chest */
      s += '<path d="M38 100 L62 100 L62 72 L38 72 Z" fill="var(--olive)" stroke="' + INK + '" stroke-width="3"/>';
      s += '<path d="M40 72 L44 54 M60 72 L56 54" stroke="' + INK + '" stroke-width="3" fill="none"/>';
    }
    if (id === 'jean') {
      s += '<path d="M34 108 L42 108 M58 108 L66 108" stroke="var(--paper)" stroke-width="2" fill="none"/>';
    }
    /* shoes */
    s += '<path d="M30 150 L46 150 L46 156 L28 156 Z" fill="' + INK + '"/>';
    s += '<path d="M54 150 L70 150 L72 156 L54 156 Z" fill="' + INK + '"/>';
    return s;
  }

  /* full figure. Pass a partial outfit and the empty slots simply stay bare. */
  function figureSVG(outfit, viewBox) {
    outfit = outfit || {};
    var s = '<svg viewBox="' + (viewBox || '0 0 100 160') + '" width="100%" height="100%" style="display:block">';
    s += legs(outfit.legs);
    s += torso(outfit.torso);
    s += head(outfit.head);
    s += '</svg>';
    return s;
  }

  /* the same renderer, cropped to one slot — so an option button shows the
     garment on a body rather than floating in space */
  var CROP = { head: '20 -2 60 52', torso: '14 38 72 66', legs: '20 66 60 94' };
  function garmentSVG(slot, id) {
    var o = {};
    o[slot] = id;
    return figureSVG(o, CROP[slot]);
  }

  /* ============================ THE CANVAS ============================
     A landscape built from five features. Player 1 sees two of them side by
     side; Player 2 has Benjamin's notes on which values are genuine. Neither
     of them can tell which canvas leaves the wall on their own. */
  function paintingSVG(f) {
    var horizon = f.horizon === 'low' ? 58 : 40;
    var s = '<svg viewBox="0 0 120 92" width="100%" height="100%" style="display:block">';
    /* frame */
    s += '<rect x="1.5" y="1.5" width="117" height="89" fill="var(--ochre)" stroke="var(--ink)" stroke-width="3"/>';
    s += '<rect x="8" y="8" width="104" height="76" fill="var(--sky)" stroke="var(--ink)" stroke-width="2.5"/>';
    /* ground */
    s += '<path d="M8 ' + horizon + ' L112 ' + horizon + ' L112 84 L8 84 Z" fill="var(--olive)" stroke="var(--ink)" stroke-width="2.5"/>';
    /* sun */
    if (f.sun) {
      s += '<circle cx="94" cy="22" r="8" fill="var(--ochre)" stroke="var(--ink)" stroke-width="2.5"/>';
    }
    /* tree */
    var tx = f.tree === 'left' ? 28 : 92;
    s += '<path d="M' + tx + ' ' + horizon + ' L' + tx + ' ' + (horizon - 18) + '" stroke="var(--ink)" stroke-width="3"/>';
    s += '<circle cx="' + tx + '" cy="' + (horizon - 26) + '" r="11" fill="var(--camel)" stroke="var(--ink)" stroke-width="2.5"/>';
    /* birds — small flat chevrons, countable at a glance */
    var spots = [[46, 22], [58, 17], [70, 24], [52, 30]];
    for (var i = 0; i < f.birds && i < spots.length; i++) {
      var b = spots[i];
      s += '<path d="M' + (b[0] - 5) + ' ' + b[1] + ' L' + b[0] + ' ' + (b[1] - 4) + ' L' + (b[0] + 5) + ' ' + b[1] + '"' +
           ' fill="none" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round"/>';
    }
    /* the mark in the corner — an abstract dash, never a letterform */
    var mx = f.sig === 'BL' ? 18 : 96;
    s += '<path d="M' + mx + ' 78 L' + (mx + 8) + ' 78 M' + (mx + 1) + ' 74 L' + (mx + 6) + ' 74"' +
         ' stroke="var(--ink)" stroke-width="2" stroke-linecap="round"/>';
    s += '</svg>';
    return s;
  }

  L.figures = { figureSVG: figureSVG, garmentSVG: garmentSVG, paintingSVG: paintingSVG };
})(window.DC);
