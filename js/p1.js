/* p1.js — PLAYER 1, ASSANE, "THE HANDS".
   Everything Assane can see and touch up close. Private because it is diegetic:
   you are the one holding the object.
   DESIGN LAW #2: every input here is an answer, never a feat of dexterity.
   No swipes, no timing windows, no gestures — anywhere. */
(function (L) {
  'use strict';
  var U = L.util, C = L.content, E = L.engine, G = L.glyphs;
  var el = U.el, $ = U.$;

  /* ===================================================================
     Procedural ligne-claire faces.
     Faces are DRAWN FROM DATA, not from art files, which is why La Tchatche
     is playable before a single asset exists — and why one module can hold
     an endless roster of guards. Art slots sit behind these as an upgrade.
     =================================================================== */
  function faceSVG(t, size) {
    var s = '<svg viewBox="0 0 100 100" width="100%" height="100%" style="display:block">';
    s += '<rect x="0" y="0" width="100" height="100" fill="var(--sky)"/>';
    var head =
      t.head === 'round'  ? '<ellipse cx="50" cy="52" rx="30" ry="32"' :
      t.head === 'long'   ? '<ellipse cx="50" cy="52" rx="25" ry="37"' :
                            '<rect x="21" y="18" width="58" height="66" rx="13"';
    s += head + ' fill="' + t.skin + '" stroke="var(--ink)" stroke-width="3"/>';
    /* ears */
    s += '<circle cx="20" cy="54" r="6" fill="' + t.skin + '" stroke="var(--ink)" stroke-width="3"/>';
    s += '<circle cx="80" cy="54" r="6" fill="' + t.skin + '" stroke="var(--ink)" stroke-width="3"/>';
    /* hair */
    if (t.hair === 'short') s += '<path d="M22 40 C28 18 72 18 78 40 C70 30 30 30 22 40 Z" fill="var(--ink)"/>';
    if (t.hair === 'swept') s += '<path d="M20 42 C24 16 70 12 80 34 C66 26 44 30 34 44 C30 38 24 38 20 42 Z" fill="var(--ink)"/>';
    if (t.hair === 'cap')   s += '<path d="M20 38 C24 16 76 16 80 38 Z" fill="var(--denim)" stroke="var(--ink)" stroke-width="3"/>' +
                                 '<path d="M16 38 L84 38 L84 44 L16 44 Z" fill="var(--denim)" stroke="var(--ink)" stroke-width="3"/>';
    if (t.hair === 'bald')  s += '<path d="M34 30 C40 25 50 24 58 27" fill="none" stroke="var(--ink)" stroke-width="2"/>';
    /* brows + eyes */
    s += '<path d="M34 44 L45 44 M55 44 L66 44" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/>';
    s += '<circle cx="39" cy="52" r="3.4" fill="var(--ink)"/><circle cx="61" cy="52" r="3.4" fill="var(--ink)"/>';
    /* nose + mouth */
    s += '<path d="M50 54 L50 62 L45 63" fill="none" stroke="var(--ink)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
    if (!t.beard) s += '<path d="M42 72 C46 76 54 76 58 72" fill="none" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/>';
    if (t.moustache) s += '<path d="M38 67 C44 63 56 63 62 67 C56 71 44 71 38 67 Z" fill="var(--ink)"/>';
    if (t.beard) s += '<path d="M28 60 C30 84 70 84 72 60 C66 78 34 78 28 60 Z" fill="var(--ink)"/>' +
                      '<path d="M42 73 C46 76 54 76 58 73" fill="none" stroke="var(--paper)" stroke-width="2.5" stroke-linecap="round"/>';
    if (t.glasses) s += '<circle cx="39" cy="52" r="10" fill="none" stroke="var(--ink)" stroke-width="3"/>' +
                        '<circle cx="61" cy="52" r="10" fill="none" stroke="var(--ink)" stroke-width="3"/>' +
                        '<path d="M49 52 L51 52 M29 50 L21 47 M71 50 L79 47" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/>';
    if (t.scar) s += '<path d="M33 38 L44 58" stroke="var(--red)" stroke-width="3" stroke-linecap="round"/>' +
                     '<path d="M35 43 L40 41 M38 50 L43 48" stroke="var(--red)" stroke-width="2" stroke-linecap="round"/>';
    s += '</svg>';
    return s;
  }
  /* A portrait is the artwork if it exists and the drawing if it does not.
     The drawn version was carrying this module on its own and it looked like
     clip art beside the real illustration — fine as a safety net, not fine as
     the thing a client sees. It stays as the fallback so La Tchatche is still
     playable with an empty art folder, and so a missing file degrades quietly
     instead of leaving a labelled placeholder box where a face should be. */
  var portraitCache = {};
  function facePortrait(traits, cls) {
    var key = (traits.art || 'x') + '|' + (cls || '');
    if (portraitCache[key]) return portraitCache[key];
    var box = el('div', { class: 'artslot ' + (cls || '') });
    if (traits.art) {
      var img = el('img', { src: U.assetURL('art/' + traits.art + '.png'), alt: '' });
      img.addEventListener('error', function () { box.innerHTML = faceSVG(traits); });
      box.appendChild(img);
    } else {
      box.innerHTML = faceSVG(traits);
    }
    portraitCache[key] = box;
    return box;
  }

  L.face = { svg: faceSVG, portrait: facePortrait };

  /* =================================================================== */
  function head(now) { return U.phoneHeader('p1', now); }
  function screen(kids) { return el('div', { class: 'pscreen' }, kids); }
  function body(kids) { return el('div', { class: 'pbody' }, kids); }
  function foot(kids) { return el('div', { class: 'pfoot' }, kids); }

  /* ------------------------------------------------------------ LE PLAN */
  function viewPlan() {
    var S = E.S;
    var view = screen([
      head('LE PLAN'),
      body([
        el('div', { class: 'role' }, [
          U.artSlot('p1-role-assane'),
          el('h2', { class: 'role__name', text: 'ASSANE' }),
          el('div', { class: 'role__job' }, [
            el('img', { src: U.assetURL('art/ui/callout-frame.png'), alt: '', 'aria-hidden': 'true', draggable: 'false' }),
            el('span', { text: 'THE HANDS' })
          ]),
          el('ul', { class: 'role__list' }, [
            el('li', { text: 'You are inside the building. You move, you touch, you talk your way out.' }),
            el('li', { text: 'You see close and you see narrow. You will not see the guard until he is on you.' }),
            el('li', { text: 'Benjamin has the whole floor. Describe everything. Ask for everything.' })
          ])
        ])
      ]),
      foot([
        el('button', {
          class: 'btn plan-ready' + (S.ready.p1 ? ' is-waiting' : ''),
          disabled: S.ready.p1 ? '' : null,
          onclick: function () { S.ready.p1 = true; U.sfx.tap(); U.emit('ready'); }
        }, [
          el('img', { class: 'plan-ready__art plan-ready__art--light', src: U.assetURL('art/ui/van-action-light.png'), alt: '', 'aria-hidden': 'true', draggable: 'false' }),
          el('img', { class: 'plan-ready__art plan-ready__art--dark', src: U.assetURL('art/ui/van-action-dark.png'), alt: '', 'aria-hidden': 'true', draggable: 'false' }),
          el('span', { text: S.ready.p1 ? 'WAITING FOR BENJAMIN…' : 'READY' })
        ])
      ])
    ]);
    view.classList.add('pscreen--plan');
    return view;
  }

  /* ------------------------------------------------------ L'INFILTRATION */
  /* His screen has given up. This panel carries no information at all — that
     is the point of the sequence, and it is why it is generated rather than
     drawn: it must never accidentally become readable. */
  /* NOTHING HAPPENS ON HIS PHONE IN THE DARK.
     There was a LE BLACKOUT screen here — a panel of snow, a d-pad, RUN and
     FREEZE — on the reading that a power cut should take something from both
     of them. It took it from the wrong man. Assane's phone is his only reading
     of the building once the television goes near-black, and cutting it to
     static left him pressing arrows at a wall while the screen that mattered
     stayed lit. The picture that goes is the VAN'S, in bursts, and it is drawn
     on Benjamin's phone now — deadLink() in p2.js, the snow included.

     So the infiltration view simply carries on: the same readout, the same
     d-pad, the same sense line. What changes for him is the television, which
     is exactly what a man walking a dark building would notice.

     COURIR and FIGE-TOI went with the screen. act() still takes {run} and
     {freeze} and they still work; nothing on either phone offers them any
     more. If they come back they belong on the ordinary d-pad, in the dark or
     out of it. */

  /* ---------------------------------------------------------- LE CLAVIER */
  function viewClavier() {
    var S = E.S, K = C.CLAVIER;

    var readout = el('div', { class: 'readout readout--night',
      text: S.clavierEntry ? S.clavierEntry.split('').join(' ') : '· · · ·' });

    var pad = el('div', { class: 'keypad keypad--night' });
    function key(n) {
      var worn = K.worn.indexOf(n) >= 0;
      return el('button', { class: worn ? 'is-worn' : '', text: n, onclick: function () {
        if (S.clavierEntry.length < 4) { S.clavierEntry += n; U.sfx.tap(); U.emit('render'); }
      } });
    }
    ['1','2','3','4','5','6','7','8','9'].forEach(function (n) { pad.appendChild(key(n)); });
    pad.appendChild(el('button', { class: 'k-clear', text: 'CLR', onclick: function () {
      S.clavierEntry = ''; U.emit('render');
    } }));
    pad.appendChild(key('0'));
    pad.appendChild(el('button', { class: 'k-ok', text: 'OK', onclick: function () {
      if (S.clavierEntry.length !== 4) return;
      var ok = E.clavierSubmit(S.clavierEntry);
      if (!ok) { readout.classList.add('is-bad'); S.clavierEntry = ''; setTimeout(function () { U.emit('render'); }, 500); }
      else U.emit('render');
    } }));

    var door = el('div', { class: 'desk desk--night' }, [
      U.artSlot('blackout-door'),
      el('div', { class: 'desk__props' }, [
        el('div', { class: 'prop prop--wear', html:
          '<b>' + K.worn.join(' &nbsp;') + '</b><span>worn keys</span>' })
      ])
    ]);

    return screen([
      head('LE CLAVIER'),
      body([
        door,
        readout,
        pad
      ]),
      foot([ el('p', { class: 'note', text: 'Tell him which keys are worn. He has the procedure — and he has to find who is posted here tonight.' }) ])
    ]);
  }

  /* ------------------------------------------------------------ LA GRILLE */
  /* The handshake. A padlock with a tag, three numbered keys, and one line of
     copy. Everything Assane can see is here; nothing that says which key is
     right is anywhere on this phone. */
  function viewGrille() {
    var S = E.S, K = C.GRILLE;

    /* THE PADLOCK, AS HE IS LOOKING AT IT — and that is the whole of it. The
       mark is engraved on the body in the artwork, so a gold chip repeating it
       beside the picture was the same symbol twice and made the screen look
       like a diagram of a padlock rather than a padlock.

       Which means the artwork is now the ONLY place this contract's mark
       appears on Assane's phone. GRILLE.lock still decides which key opens the
       gate; if it is ever changed, grille-padlock.png has to be redrawn with
       it or the picture will be quietly lying. content.js says so where the
       lock is set. */
    var padlock = el('div', { class: 'padlock' }, [
      U.artSlot('grille-padlock', 'padlock__plate')
    ]);

    /* THREE KEYS ON ONE RING, and they are one picture because that is how
       they hang off his finger. The blades fan out and overlap, so they cannot
       be cut into three sprites — instead three invisible plates sit over the
       lower half of the photograph, one per blade, and that is what he taps.
       Nothing is numbered and nothing is labelled: the only way in is for
       Benjamin to describe a shape and for Assane to recognise it. */
    var ring = el('div', { class: 'keyring' }, [U.artSlot('grille-keys', 'keyring__art')]);
    var hits = el('div', { class: 'keyring__hits' });
    K.board.slice().sort(function (x, y) { return (x.at || 0) - (y.at || 0); }).forEach(function (bd) {
      var btn = el('button', {
        class: 'keyring__hit' + (S.grille.tried[bd.key] ? ' is-tried' : ''),
        style: 'left:' + (bd.at * 100) + '%;width:' + (bd.wide * 100) + '%',
        'aria-label': 'key',
        onclick: function () {
          var ok = E.grilleTry(bd.key);
          if (!ok) { btn.classList.add('is-bad'); setTimeout(function () { U.emit('render'); }, 300); }
          else U.emit('render');
        }
      });
      hits.appendChild(btn);
    });
    ring.appendChild(hits);

    return screen([
      head('LA GRILLE'),
      body([
        U.howto([
          'Describe the mark stamped on the padlock to Benjamin.',
          'He has the three keys drawn on his card and will describe the one that fits. Tap it on the ring.'
        ]),
        padlock,
        el('p', { class: 'lbl lbl--c', style: 'margin:10px 0 6px', text: 'TAP THE KEY HE DESCRIBES' }),
        ring
      ]),
      foot([ el('p', { class: 'note', text: 'The wrong key rattles the gate. Nothing worse.' }) ])
    ]);
  }

  function viewPorte() {
    var S = E.S, K = C.PORTE;

    /* THE CODE IS ON THIS SCREEN, AND IT IS UNREADABLE FROM HERE.
       It used to be four dots: Assane named the one mark under the zero and
       Benjamin read four numbers straight off his own page, which made the
       module one sentence long and gave Assane nothing to do but type.

       The four symbols of the code are engraved on the keypad instead. Assane
       can see them and cannot turn them into numbers — the ring that does that
       is in the dossier. So he describes one, Benjamin answers with a digit,
       he taps it, and they do that four times. The digit he taps lands under
       the symbol it answered, so the pair can see how far along they are
       without either of them counting out loud. */
    var codeSyms = E.porteCodeSymbols();
    var readout = el('div', { class: 'symrow symrow--code' });
    codeSyms.forEach(function (sym, i) {
      var typedD = S.porteEntry.charAt(i);
      var cell = el('div', { class: 'symrow__cell'
        + (typedD ? ' is-read' : '')
        + (i === S.porteEntry.length ? ' is-next' : '') });
      var ic = G.icon(sym); ic.style.color = 'var(--ink)';
      cell.appendChild(ic);
      cell.appendChild(el('b', { text: typedD || '·' }));
      readout.appendChild(cell);
    });
    if (S.porteFails > 0 && !S.porteEntry) readout.classList.add('is-bad');

    var pad = el('div', { class: 'keypad' });
    function key(n) {
      return el('button', { text: n, onclick: function () { E.porteTap(n); U.emit('render'); } });
    }
    ['1','2','3','4','5','6','7','8','9'].forEach(function (n) { pad.appendChild(key(n)); });
    pad.appendChild(el('button', { class: 'k-clear', text: 'CLR',
      onclick: function () { S.porteEntry = ''; U.emit('render'); } }));
    pad.appendChild(key('0'));
    pad.appendChild(el('button', { class: 'k-ok', text: 'OK', onclick: function () {
      if (S.porteEntry.length < K.code.length) return;
      E.porteSubmit(); U.emit('render');
    } }));

    /* The plate. The zero carries a mark under it, drawn at the size a real
       engraver would have put it: small enough to ignore, big enough to
       describe. Everything Benjamin needs is in that one shape. */
    var digits = K.sign.replace(/[^0-9]/g, '');
    var zeroAt = digits.indexOf('0');
    var plate = el('div', { class: 'plate' }, [
      el('span', { class: 'plate__word', text: K.sign.replace(/[0-9].*$/, '').trim() })
    ]);
    var row = el('span', { class: 'plate__digits' });
    digits.split('').forEach(function (d, i) {
      var cell = el('span', { class: 'plate__d' }, [el('b', { text: d })]);
      if (i === zeroAt) {
        var g = G.icon(K.zero);
        g.style.color = 'var(--ink)';
        cell.appendChild(el('i', { class: 'plate__mark' }, [g]));
      }
      row.appendChild(cell);
    });
    plate.appendChild(row);

    var left = (K.fails || 3) - S.porteFails;
    return screen([
      head('LA PORTE'),
      body([
        U.howto([
          'Describe the mark under the 0 to Benjamin. It tells him where the ring starts.',
          'Then describe the four symbols on the keypad, one at a time. He answers each with a number — tap it.'
        ]),
        plate,
        readout,
        pad
      ]),
      foot([
        el('p', { class: 'note', text: left > 1
          ? 'A wrong code is loud. ' + left + ' tries before somebody comes.'
          : 'One try left. The next wrong code brings somebody to the door.' })
      ])
    ]);
  }

  /* ------------------------------------------------------------ LE DOSSIER */
  function viewPrize() {
    var S = E.S;
    return screen([
      head('LE BUREAU'),
      body([
        el('div', { class: 'waiting' }, [
          (function () { var i = G.icon('manu'); i.style.width = '54px'; i.style.color = 'var(--ink)'; return i; })(),
          el('p', { class: 'note', text: 'It is on the desk, exactly where he said it would be. Take it and get back to the stairs.' })
        ])
      ]),
      foot([ el('button', { class: 'btn btn--go', text: 'TAKE IT',
        onclick: function () { E.takePrize(); U.emit('render'); } }) ])
    ]);
  }

  /* ---------------------------------------------------- LE DÉGUISEMENT */
  var outfit = { head: null, torso: null, legs: null };

  /* A garment is the artwork if it exists and the drawing if it does not —
     the same deal the guard portraits struck, and for the same reason: the
     drawn version is legible but it reads as clip art next to real
     illustration, and this rack is nine tiles of it at once.
     The FALLBACK IS LOAD-BEARING here, not decoration. This module is Player 1
     describing nine garments out loud while Player 2 matches them against a
     roster, so a missing file has to degrade to a rough garment rather than to
     a labelled empty box — an empty box is not describable, and the puzzle
     would simply stop. With no art at all the rack looks exactly as it does
     today, down to the tile height. */
  function viewDeguisement() {
    var S = E.S, F = L.figures;

    var mirror = F.uniformStack(outfit, 'mirror');

    var racks = el('div', { class: 'disguise__racks' });
    [['head', 'HEAD'], ['torso', 'TORSO'], ['legs', 'LEGS']].forEach(function (pair) {
      var slot = pair[0];
      var category = el('section', { class: 'disguise__category', 'aria-label': pair[1] }, [
        el('h2', { class: 'h', text: pair[1] })
      ]);
      var row = el('div', { class: 'rack' });
      C.RACK[slot].forEach(function (id) {
        var b = el('button', {
          class: outfit[slot] === id ? 'is-on' : '',
          'aria-pressed': outfit[slot] === id ? 'true' : 'false',
          onclick: function () {
            outfit[slot] = outfit[slot] === id ? null : id;
            U.sfx.tap(); U.emit('render');
          }
        });
        b.appendChild(L.figures.garmentTile(slot, id, 'gtile--rack'));
        row.appendChild(b);
      });
      category.appendChild(row);
      racks.appendChild(category);
    });

    var complete = outfit.head && outfit.torso && outfit.legs;
    var view = screen([
      head('LE DÉGUISEMENT'),
      body([
        el('div', { class: 'mirrorwrap' }, [
          mirror,
          el('p', { class: 'note', style: 'margin:0', text:
            'The staff cloakroom. Describe all nine to him — he knows whose is whose, and who is posted where you are going.' })
        ]),
        racks
      ]),
      foot([
        el('button', {
          class: 'btn disguise__confirm',
          text: complete ? 'GET DRESSED' : 'PICK THREE PIECES',
          disabled: complete ? null : '',
          onclick: function () {
            var ok = E.deguisementSubmit(outfit);
            if (!ok) { mirror.classList.add('is-bad'); setTimeout(function () { U.emit('render'); }, 500); }
            else U.emit('render');
          }
        }),
        el('button', { class: 'btn disguise__confirm', text: 'GO IN AS YOU ARE',
          onclick: function () { E.declineModule(); U.emit('render'); } })
      ])
    ]);
    view.classList.add('pscreen--disguise');
    U.$$('.disguise__confirm', view).forEach(function (button) {
      var label = button.textContent;
      button.textContent = '';
      button.appendChild(el('span', { text: label }));
      ['light', 'dark'].forEach(function (state) {
        button.appendChild(el('img', {
          class: 'disguise__button-art disguise__button-art--' + state,
          src: U.assetURL('art/ui/van-action-' + state + '.png'),
          alt: '', 'aria-hidden': 'true', draggable: 'false'
        }));
      });
    });
    return view;
  }

  /* ---------------------------------------------------------- LE FAUX */
  function viewFaux() {
    var S = E.S, F = L.figures;

    function canvas(feat, label, isGenuine) {
      var wrap = el('div', { class: 'canvas' });
      var art = el('div', { class: 'canvas__art' });
      art.innerHTML = F.paintingSVG(feat);
      wrap.appendChild(art);
      wrap.appendChild(el('button', {
        class: 'btn btn--go', text: 'TAKE ' + label,
        onclick: function () { E.fauxChoose(isGenuine); U.emit('render'); }
      }));
      return wrap;
    }

    var left = S.fauxLeftIsGenuine;
    return screen([
      head('LE FAUX'),
      body([
        el('p', { class: 'note', style: 'margin:0 0 10px', text:
          'Two canvases, one crate. Describe them both to him — everything, not just what you think matters. He has the authentication notes.' }),
        el('div', { class: 'canvases' }, [
          canvas(left ? C.FAUX.genuine : C.FAUX.forgery, 'A', left),
          canvas(left ? C.FAUX.forgery : C.FAUX.genuine, 'B', !left)
        ])
      ]),
      foot([
        el('button', { class: 'btn', text: 'LEAVE BOTH',
          onclick: function () { E.declineModule(); U.emit('render'); } })
      ])
    ]);
  }

  /* ---------------------------------------------------------- L'ÉCOUTE */
  var pulsePlaying = false;

  function viewEcoute() {
    var S = E.S, K = C.ECOUTE;

    var train = el('div', { class: 'pulses' });
    var cells = K.transmission.map(function (p) {
      var cell = el('i', { class: 'pulse pulse--' + p });
      /* The symbol stays on screen after playback. Unlimited replays, nothing
         to catch, nothing to remember — the work is relaying it, not hearing
         it, and that keeps the module playable muted and playable slowly. */
      cell.appendChild(el('b', { text: p === 'l' ? '—' : '·' }));
      train.appendChild(cell);
      return cell;
    });

    function play() {
      if (pulsePlaying) return;
      pulsePlaying = true;
      var i = 0;
      (function step() {
        if (i >= K.transmission.length) { pulsePlaying = false; return; }
        var isLong = K.transmission[i] === 'l', cell = cells[i], ms = isLong ? 330 : 110;
        cell.classList.add('is-on');
        U.sfx.pulse(isLong);
        if (navigator.vibrate) { try { navigator.vibrate(isLong ? 300 : 90); } catch (e) {} }
        setTimeout(function () {
          cell.classList.remove('is-on');
          i++;
          setTimeout(step, 150);
        }, ms);
      })();
    }

    var circuits = el('div', { class: 'circuits' });
    K.circuits.forEach(function (c) {
      var b = el('button', { class: 'btn', text: 'CUT ' + c, onclick: function () {
        var ok = E.ecouteCut(c);
        if (!ok) { b.classList.add('is-wrong'); setTimeout(function () { U.emit('render'); }, 450); }
        else U.emit('render');
      } });
      circuits.appendChild(b);
    });

    return screen([
      head('L’ÉCOUTE'),
      body([
        el('p', { class: 'note', style: 'margin:0 0 10px', text:
          'Hold it to your ear. The line repeats the same five pulses. Read them to him — short and long, in order.' }),
        train,
        el('button', { class: 'btn btn--go', style: 'margin-top:10px',
          text: 'PLAY THE LINE AGAIN', onclick: play }),
        el('div', { class: 'rule' }),
        el('p', { class: 'h', style: 'margin-bottom:6px', text: 'CUT A CIRCUIT' }),
        el('p', { class: 'note', style: 'margin:0 0 10px', text:
          'He has the code book, and it will only answer him if he can reproduce the rhythm.' }),
        circuits
      ]),
      foot([
        el('button', { class: 'btn', text: 'LEAVE THE LINE',
          onclick: function () { E.declineModule(); U.emit('render'); } })
      ])
    ]);
  }

  /* THE DARK RUN. With the monitors dead the television shows nothing, so the
     seven squares around him move onto his phone: floor he can see, walls that
     bound it, a guard if one is in view, the hatch if he has found it. Drawn
     from the same visibleSet the television used, so it can never show more
     than the room did. */
  function localMap() {
    var S = E.S, vis = E.visibleSet(), Rn = 3, T = 36, N = Rn * 2 + 1;
    var ax = S.assane.x, ay = S.assane.y, s = '';
    s += '<svg viewBox="0 0 ' + (N * T) + ' ' + (N * T) + '">';
    s += '<rect width="' + (N * T) + '" height="' + (N * T) + '" fill="var(--map-void)"/>';
    for (var dy = -Rn; dy <= Rn; dy++) {
      for (var dx = -Rn; dx <= Rn; dx++) {
        var x = ax + dx, y = ay + dy, k = x + ',' + y, px = (dx + Rn) * T, py = (dy + Rn) * T;
        if (!vis[k]) continue;
        var ch = E.charAt(x, y), d = E.doorAt(x, y);
        if (E.isWall(x, y)) {
          s += '<rect x="' + px + '" y="' + py + '" width="' + T + '" height="' + T + '" fill="var(--stone-dk)"/>';
          if (ch === 'L') s += '<line x1="' + px + '" y1="' + (py + T / 2) + '" x2="' + (px + T) + '" y2="' + (py + T / 2) + '" stroke="var(--red)" stroke-width="3"/>';
          if (d) s += '<rect x="' + (px + 4) + '" y="' + (py + T / 2 - 3) + '" width="' + (T - 8) + '" height="6" rx="1.5" fill="var(--map-edge)"/>';
          continue;
        }
        s += '<rect x="' + px + '" y="' + py + '" width="' + (T + 0.5) + '" height="' + (T + 0.5) + '" fill="var(--floor-neutral-lit)"/>';
        if (ch === 'X') s += '<g color="var(--gold)" transform="translate(' + (px + 5) + ',' + (py + 5) + ') scale(' + ((T - 10) / 100) + ')">' + G.iconMarkup('hatch') + '</g>';
        var m = E.moduleAt(x, y);
        if (m) s += '<rect x="' + (px + 7) + '" y="' + (py + 7) + '" width="' + (T - 14) + '" height="' + (T - 14) + '" rx="2" fill="none" stroke="var(--gold)" stroke-width="2"/>';
      }
    }
    S.guards.forEach(function (g) {
      var p = E.guardAt(g);
      if (!vis[p.x + ',' + p.y]) return;
      var cx = (p.x - ax + Rn) * T + T / 2, cy = (p.y - ay + Rn) * T + T / 2;
      var v = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[g.facing];
      s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + v[0] * 16) + '" y2="' + (cy + v[1] * 16) + '" stroke="var(--red)" stroke-width="4" stroke-linecap="round"/>';
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="9" fill="var(--red)" stroke="var(--ink)" stroke-width="2"/>';
    });
    s += '<circle cx="' + (Rn * T + T / 2) + '" cy="' + (Rn * T + T / 2) + '" r="10" fill="var(--gold)" stroke="var(--ink)" stroke-width="2"/>';
    s += '</svg>';
    var box = el('div', { class: 'p1map' });
    box.innerHTML = s;
    return box;
  }

  /* the strip under WHAT YOU SENSE that fills while he stands still. Updated
     in place by the clock — see pressure() below — never by a re-render. */
  function pressureStrip() {
    return el('div', { class: 'pressure', id: 'p1-pressure' }, [el('i'), el('span')]);
  }
  /* THE PRESSURE VIGNETTE. Same three steps the strip reads out, as light on
     the glass, so the nag lands even when he is not reading the words. It is
     here and not on the television because standing still is his problem
     alone and the shared screen is already carrying the building's suspicion. */
  function paintStill() {
    var sec = $('#p1');
    if (!sec) return;
    var S = E.S, lv = 0;
    if (S.running && S.phase === 'play' && !S.blackout) {
      var idle = (Date.now() - S.lastActionAt) / 1000, g = C.PRESSURE.grace;
      lv = idle >= g ? 3 : idle >= g * 0.6 ? 2 : idle >= 3 ? 1 : 0;
    }
    [1, 2, 3].forEach(function (n) { sec.classList.toggle('is-still-' + n, lv === n); });
  }

  function pressure(p) {
    paintStill();
    var box = $('#p1-pressure');
    if (!box) return;
    if (!p) { box.className = 'pressure'; return; }
    box.className = 'pressure is-on' + (p.ticking ? ' is-hot' : '');
    box.firstChild.style.width = Math.min(p.idle / p.grace, 1) * 100 + '%';
    box.lastChild.textContent = p.ticking
      ? 'IDLE · +1 SUSPICION EVERY ' + C.PRESSURE.every + 'S — MOVE'
      : 'IDLE FOR ' + Math.floor(p.idle) + ' SECONDS';
  }

  function viewPlay() {
    var S = E.S;
    /* The pad itself shows which ways are shut. This replaced an abstract
       four-dot "within reach" diagram that meant nothing unless you already
       play games — and this audience does not. */
    function arrow(id, dx, dy) {
      var shut = E.isWall(S.assane.x + dx, S.assane.y + dy);
      var b = el('button', {
        'aria-label': id,
        class: shut ? 'is-shut' : '',
        disabled: shut ? '' : null,
        onclick: function () {
          var r = E.act(dx, dy);
          if (r.blocked) { b.classList.add('is-blocked'); setTimeout(function () { b.classList.remove('is-blocked'); }, 240); }
          U.emit('render');
        }
      });
      var ic = G.icon(id); ic.style.color = '#FFEFCC';
      b.appendChild(ic);
      return b;
    }
    var pad = el('div', { class: 'dpad' }, [
      el('div', { class: 'spacer' }), arrow('aup', 0, -1), el('div', { class: 'spacer' }),
      arrow('aleft', -1, 0),
      el('button', { class: 'dpad__wait', text: 'HOLD STILL', onclick: function () { E.act(0, 0); U.emit('render'); } }),
      arrow('aright', 1, 0),
      el('div', { class: 'spacer' }), arrow('adown', 0, 1), el('div', { class: 'spacer' })
    ]);

    var view = screen([
      head(S.hasManuscript ? 'LA SORTIE' : 'INFILTRATION'),
      body([
        S.dark ? localMap() : null,
        el('div', { class: 'nav__sense' }, [
          el('h2', { class: 'h' }, [
            el('img', { src: U.assetURL('art/ui/flourish-left.png'), alt: '' }),
            el('span', { text: 'SENSES' }),
            el('img', { src: U.assetURL('art/ui/flourish-right.png'), alt: '' })
          ]),
          el('p', { class: 'nav__senseline', html: S.sense || '…' })
        ]),
        pressureStrip(),
        S.hasManuscript ? el('div', { class: 'tag tag--gold', text: ((C.PRIZE && C.PRIZE.name) || 'MANUSCRIPT') + ' · ON YOU', style: 'margin-top:12px' }) : null,
        /* the lights he can see for himself; the laser count is Benjamin's to say */
        S.levers.lights > 0 ? el('div', { class: 'tag tag--gold', text: 'LIGHTS DOWN · ' + S.levers.lights + ' MORE MOVE' + (S.levers.lights > 1 ? 'S' : ''), style: 'margin-top:12px' }) : null,
        el('p', { class: 'note', text: S.dark
          ? 'The monitors are dead. This is everything you can see. Benjamin still has the plan.'
          : 'One tap is one step, for both you and the guards.\nTry not to linger, or you’ll raise suspicion.' })
      ]),
      foot([el('div', { class: 'nav__controls' }, [pad])])
    ]);
    view.classList.add('pscreen--infiltration');
    // Image sources resolve from the document, including file:// demos and
    // the encrypted build's asset map, rather than from styles/phone.css.
    U.$$('button', pad).forEach(function (button) {
      if (button.classList.contains('dpad__wait')) {
        button.textContent = '';
        button.appendChild(el('span', { class: 'dpad__label', text: 'HOLD STILL' }));
      }
      ['idle', 'pressed', 'disabled'].forEach(function (state) {
        button.appendChild(el('img', {
          class: 'dpad__art dpad__art--' + state,
          src: U.assetURL('art/ui/control-bttn-' + state + '.png'),
          alt: '', 'aria-hidden': 'true', draggable: 'false', width: '120', height: '100'
        }));
      });
    });
    return view;
  }

  /* ---------------------------------------------------------- LE COFFRE */
  /* Dial geometry is matched to art/coffre-door.png rather than to the square.
     That artwork puts its empty recess at about (49%, 44%) of the frame with an
     inner radius near 26%, so the working dial is built to sit INSIDE it — a
     dial drawn to fill the whole tile would have sat on top of the rivets and
     the handle and looked pasted on.

     RING and DISC are also constrained against each other: eight discs around a
     circle of radius R have their centres 0.765R apart, so DISC has to stay
     under 0.383 * RING or neighbours overlap. At these values a disc lands at
     about 42px on a phone, which is still a comfortable tap target.
     If the safe door art is ever regenerated, these five numbers are the only
     thing that needs revisiting. */
  var DIAL = { vb: 200, cx: 98, cy: 89, ring: 38, disc: 12.8, hub: 16, seat: 51 };

  function viewCoffre() {
    var S = E.S, K = C.COFFRE, D = DIAL;
    var svgns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgns, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + D.vb + ' ' + D.vb);

    /* seats the dial into the recess and keeps the glyphs readable on steel */
    var seat = document.createElementNS(svgns, 'circle');
    seat.setAttribute('cx', D.cx); seat.setAttribute('cy', D.cy); seat.setAttribute('r', D.seat);
    seat.setAttribute('fill', 'rgba(6,9,13,.38)');
    svg.appendChild(seat);

    /* the ring colour is half the index into P2's manual — it has to be the
       most obvious thing on this screen after the plate */
    var hub = document.createElementNS(svgns, 'circle');
    hub.setAttribute('cx', D.cx); hub.setAttribute('cy', D.cy); hub.setAttribute('r', D.hub);
    hub.setAttribute('fill', C.RING_COLOUR[K.ring]);
    hub.setAttribute('stroke', 'var(--ink)'); hub.setAttribute('stroke-width', '2.5');
    svg.appendChild(hub);

    K.dial.forEach(function (gl, i) {
      var ang = (i / K.dial.length) * Math.PI * 2 - Math.PI / 2;
      var gx = D.cx + Math.cos(ang) * D.ring, gy = D.cy + Math.sin(ang) * D.ring;
      var g = document.createElementNS(svgns, 'g');
      g.setAttribute('class', 'dial__cell' + (S.coffreEntry.indexOf(gl) >= 0 ? ' is-used' : ''));
      g.setAttribute('style', 'cursor:pointer');
      var d = document.createElementNS(svgns, 'circle');
      d.setAttribute('class', 'dial__disc');
      d.setAttribute('cx', gx); d.setAttribute('cy', gy); d.setAttribute('r', D.disc);
      d.setAttribute('fill', 'var(--paper)');
      d.setAttribute('stroke', 'var(--ink)'); d.setAttribute('stroke-width', '2');
      g.appendChild(d);
      var use = document.createElementNS(svgns, 'use');
      use.setAttribute('href', '#g-' + gl);
      use.setAttribute('width', '100'); use.setAttribute('height', '100');
      use.setAttribute('transform', 'translate(' + (gx - 9) + ',' + (gy - 9) + ') scale(0.18)');
      use.setAttribute('color', 'var(--ink)');
      g.appendChild(use);
      g.addEventListener('click', function () { E.coffreTap(gl); U.emit('render'); });
      svg.appendChild(g);
    });

    /* The slots are numbered 1-4 the same way Benjamin's manual numbers its
       four figures, so the two screens read as one instruction. That is also
       cheaper in height than a caption sentence, and this screen has no height
       to spare: the entry row is the only feedback a tap produces, and it was
       sitting under the fold. */
    var entry = el('div', { class: 'entry' });
    for (var i = 0; i < 4; i++) {
      var slot = el('i');
      if (S.coffreEntry[i]) { var ic = G.icon(S.coffreEntry[i]); ic.style.color = 'var(--ink)'; slot.appendChild(ic); }
      entry.appendChild(el('figure', {}, [slot, el('figcaption', { text: String(i + 1) })]));
    }
    if (S.coffreEntry.length === 4 && !S.coffreEntry.every(function (g, i2) { return g === K.code[i2]; })) {
      U.$$('i', entry).forEach(function (n) { n.classList.add('is-bad'); });
    }

    var dial = el('div', { class: 'dial' });
    dial.appendChild(U.artSlot('coffre-door', 'dial__plate'));
    dial.appendChild(svg);

    /* The old screen printed DR-1187 with no label beside a note that said
       "read him the plate" — a word that appeared nowhere on it — and showed the
       ring as a bare swatch. Benjamin's book lists this same number three times
       and only the colour tells them apart, so a player who cannot put a WORD to
       the colour cannot use the book: amber and camel are both tan. The swatch
       is now captioned. */
    var undo = el('button', {
      class: 'undo', text: 'UNDO LAST TAP',
      disabled: (S.coffreEntry.length === 0 || S.coffreEntry.length >= 4) ? '' : null,
      onclick: function () { E.coffreUndo(); U.emit('render'); }
    });

    return screen([
      head('LE COFFRE'),
      body([
        U.howto([
          'Read Benjamin the number and the colour below. He needs both — his book lists this safe more than once.',
          'He will describe four symbols. Tap them on the door, in the order he gives them.'
        ]),
        el('div', { class: 'safe__plate' }, [
          el('span', {}, [
            el('em', { class: 'lbl', text: 'NUMBER ON THE DOOR' }),
            el('span', { class: 'safe__serial', text: K.serial })
          ]),
          el('span', {}, [
            el('em', { class: 'lbl', text: 'RING AROUND THE DIAL' }),
            el('span', { class: 'safe__ring' }, [
              el('i', { style: 'background:' + C.RING_COLOUR[K.ring] }),
              el('b', { text: K.ring })
            ])
          ])
        ]),
        dial,
        entry
      ]),
      /* Undo lives in the foot because the foot never scrolls. Put in the body
         it sat below the fold on a phone pane, which is the exact failure it
         exists to prevent. */
      foot([
        undo,
        el('p', { class: 'note', style: 'margin-top:10px', text: 'A wrong four is loud. Twice and somebody comes.' })
      ])
    ]);
  }

  /* ---------------------------------------------------------- LE BUREAU */
  var typed = '';
  function viewBureau() {
    var S = E.S;

    if (S.bureauStep === 1) {
      var grid = el('div', { class: 'doorgrid' });
      C.DOOR_MARKS.forEach(function (mk) {
        var b = el('button', { onclick: function () {
          var ok = E.bureauDoor(mk);
          if (!ok) { b.style.background = 'var(--red)'; setTimeout(function () { b.style.background = ''; }, 400); }
          U.emit('render');
        } });
        var ic = G.icon(mk); ic.style.color = 'var(--ink)';
        b.appendChild(ic);
        b.appendChild(el('span', { text: 'RELEASE' }));
        grid.appendChild(b);
      });
      return screen([
        head('LE BUREAU'),
        body([
          el('div', { class: 'mod__head' }, [ el('span', { class: 'tag tag--gold', text: 'ACCESS OPEN' }) ]),
          el('p', { class: 'note', text: 'The computer is open. Four doors on the release schedule, four marks. Only one of them is La Réserve — and only Benjamin can see which.' }),
          grid
        ]),
        foot([ el('p', { class: 'note', text: 'Describe the four marks. He has the floor plan.' }) ])
      ]);
    }

    var readout = el('div', { class: 'readout', text: typed || '· · · ·' });
    var pad = el('div', { class: 'keypad' });
    ['1','2','3','4','5','6','7','8','9'].forEach(function (n) {
      pad.appendChild(el('button', { text: n, onclick: function () {
        if (typed.length < 4) { typed += n; U.sfx.tap(); U.emit('render'); }
      } }));
    });
    pad.appendChild(el('button', { class: 'k-clear', text: 'CLR', onclick: function () { typed = ''; U.emit('render'); } }));
    pad.appendChild(el('button', { text: '0', onclick: function () { if (typed.length < 4) { typed += '0'; U.sfx.tap(); U.emit('render'); } } }));
    pad.appendChild(el('button', { class: 'k-ok', text: 'OK', onclick: function () {
      if (typed.length !== 4) return;
      var ok = E.bureauSubmit(typed);
      if (!ok) { readout.classList.add('is-bad'); }
      typed = '';
      setTimeout(function () { U.emit('render'); }, ok ? 200 : 500);
    } }));

    /* The desk. The photo, the note and the badge are set live over the art —
       never generated inside it. No generated text, ever. */
    var owner = C.PERSONNEL.filter(function (p) { return p.badge === C.BUREAU.badge; })[0];
    var kidsHTML = (owner ? owner.kids.slice().sort(function (a, b) { return a.y - b.y; }) : [])
      .map(function (k, i) { return '<div class="kid' + (i % 2 ? ' b' : '') + '" style="height:' + Math.max(26, 52 - i * 18) + 'px"></div>'; })
      .join('');
    var desk = el('div', { class: 'desk' }, [
      U.artSlot('bureau-desk'),
      el('div', { class: 'desk__props' }, [
        /* the badge and the photo read from the roster, so the desk can belong
           to anyone. The children stand tallest-first, eldest on the left —
           which is not the order the file lists them in. */
        el('div', { class: 'prop prop--badge', html: '<b>' + C.BUREAU.badge + '</b><span>post · ' + (owner ? owner.post.toLowerCase() : '') + '</span>' }),
        el('div', { class: 'prop prop--photo', html:
          '<div class="kids">' + kidsHTML + '</div>' +
          '<span class="cap">' + (C.BUREAU.photo || 'the children') + '</span>' }),
        /* The note is the question, and the question is per-job data. Job 1
           asks for the eldest child's year, job 2 for the officer's plate —
           same desk, same screen, a different thing to work out. */
        el('div', { class: 'prop prop--postit' }, [
          (function () {
            var i = G.icon(C.BUREAU.mode === 'plate' ? 'car' : 'cake');
            i.style.color = 'var(--on-gold)'; return i;
          })(),
          el('b', { text: C.BUREAU.mode === 'plate' ? 'his plate no.' : 'birthday — eldest' })
        ])
      ])
    ]);

    return screen([
      head('LE BUREAU'),
      body([ desk, readout, pad ]),
      foot([ el('p', { class: 'note', text: 'Tell him what is on the desk. All of it. He has the staff files.' }) ])
    ]);
  }

  /* -------------------------------------------------------- LA TCHATCHE */
  function viewTchatche() {
    var S = E.S, t = S.tchatche, tr = C.FACES[t.badge];

    var max = E.maxStrikes();
    var strikes = el('div', { class: 'strikes' });
    for (var i = 0; i < max; i++) strikes.appendChild(el('i', { class: i < t.strikes ? 'is-lost' : '' }));

    var lines = el('div', { class: 'lines' });
    t.options.forEach(function (topic) {
      lines.appendChild(el('button', { class: 'btn', text: C.LINES[topic], onclick: function () {
        E.tchatchePick(topic); U.emit('render');
      } }));
    });

    var face = L.face.portrait(tr, 'tchp1__face');

    /* "Describe him" was the whole instruction, and then the screen offered
       three sentences about football and night classes. Nothing said that
       describing the face is step one, that Benjamin answers with a fact about
       the man, or that the buttons are how you say that fact back. A player who
       does not already know how a co-op game works was being asked to guess the
       verb. The two dots were unlabelled as well — they read as decoration
       until the first one turns red, which is exactly too late. */
    var view = screen([
      head('LA TCHATCHE'),
      body([
        /* Portrait beside the situation rather than above it, and the count and
           the strikes on one line. The explanations added here are worth their
           height only if the three answers are still on screen underneath them,
           and at full width they were not — all three sat below the fold. */
        el('div', { class: 'tchp1__top' }, [
          face,
          el('div', { class: 'tchp1__desc', html:
            '<b>He has stopped you</b>You cannot run and you cannot fight. You have to be somebody he already knows.' })
        ]),
        U.howto([
          'Describe this face out loud — head, hair, glasses, any marks. Benjamin has the night shift on file.',
          'He finds the man and tells you one thing about his life. Tap the line that brings it up.'
        ]),
        el('div', { class: 'tch__meter' }, [
          el('span', { class: 'lbl', text: 'EXCHANGE ' + (t.round + 1) + ' OF 3' }),
          el('span', { class: 'tch__meter__r' }, [el('span', { class: 'lbl', text: 'MISTAKES' }), strikes])
        ]),
        t.last ? el('p', { class: 'tch__verdict' + (t.last === 'bad' ? ' is-bad' : ''), text:
          t.last === 'good' ? 'That landed. He is still talking.'
                            : 'Wrong man, or wrong subject. He is looking at you harder now.' }) : null,
        lines
      ]),
      foot([ el('p', { class: 'note', text: max === 1
        ? 'The building is on alert. One mistake and he searches you. Nothing here is timed.'
        : 'A second mistake ends the job. Nothing here is timed — take as long as you need.' }) ])
    ]);
    view.classList.add('pscreen--tchatche');
    U.$$('.lines .btn', view).forEach(function (button) {
      var label = button.textContent;
      button.textContent = '';
      button.appendChild(el('span', { text: label }));
      ['light', 'dark'].forEach(function (state) {
        button.appendChild(el('img', {
          class: 'tchatche__button-art tchatche__button-art--' + state,
          src: U.assetURL('art/ui/van-action-' + state + '.png'),
          alt: '', 'aria-hidden': 'true', draggable: 'false'
        }));
      });
    });
    return view;
  }

  /* --------------------------------------------------------------- ends */
  function viewEnd() {
    var S = E.S, done = S.phase === 'rank';
    return screen([
      head(done ? 'LA SORTIE' : 'PRIS'),
      body([
        el('div', { class: 'waiting' }, [
          (function () { var i = G.icon(done ? 'manu' : 'lock'); i.style.width = '54px'; i.style.color = 'var(--ink)'; return i; })(),
          el('p', { class: 'note', text: done
            ? 'You are on the street. Look at the television.'
            : 'The door goes. Five seconds, and you go again.' })
        ])
      ]),
      foot([ el('button', { class: 'btn btn--brand', text: done ? 'PLAY AGAIN' : 'BACK OUT OF THE VAN',
        onclick: function () { U.emit('restart'); } }) ])
    ]);
  }

  function render() {
    var S = E.S, host = $('#p1-screen');
    U.clear(host);
    var v;
    if (S.phase === 'plan') v = viewPlan();
    else if (S.phase === 'play') v = viewPlay();
    else if (S.phase === 'module') v = S.moduleId === 'coffre' ? viewCoffre()
                                    : S.moduleId === 'grille' ? viewGrille()
                                    : S.moduleId === 'porte' ? viewPorte()
                                    : S.moduleId === 'prize' ? viewPrize()
                                    : S.moduleId === 'clavier' ? viewClavier()
                                    : S.moduleId === 'deguisement' ? viewDeguisement()
                                    : S.moduleId === 'faux' ? viewFaux()
                                    : S.moduleId === 'ecoute' ? viewEcoute()
                                    : viewBureau();
    else if (S.phase === 'tchatche') v = viewTchatche();
    else v = viewEnd();
    host.appendChild(v);
    if (S.phase === 'play' && S.running) {
      var idle = Math.max(0, (Date.now() - S.lastActionAt) / 1000);
      pressure({ idle: idle, grace: C.PRESSURE.grace, ticking: idle >= C.PRESSURE.grace });
    }
    paintStill();
  }

  L.p1 = { render: render, pressure: pressure, resetTyped: function () {
    typed = ''; outfit = { head: null, torso: null, legs: null };
  } };
})(window.DC);
