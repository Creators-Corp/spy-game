/* p2.js — PLAYER 2, BENJAMIN, "THE BRAIN".
   The dossier: floor plan, patrol cones, the safe manual, the staff roster,
   the faces. Deliberately TOO MUCH information — the skill is finding the right
   page while your partner whispers descriptions at you.
   Note what this file never does: it never switches tabs for the player. The
   game will not tell Benjamin which page he needs. That is the game. */
(function (L) {
  'use strict';
  var U = L.util, C = L.content, E = L.engine, G = L.glyphs;
  var el = U.el, $ = U.$;

  var tab = 'plan';
  var openSerial = -1, openBadge = null, pickedFace = null;
  var tapped = [], queryResult = null;      /* the soundboard, L'Écoute */

  function head(now) {
    return el('header', { class: 'phead' }, [
      el('span', { class: 'phead__who', text: 'P2 · BENJAMIN' }),
      el('span', { class: 'phead__now', text: now })
    ]);
  }
  function screen(kids) { return el('div', { class: 'pscreen' }, kids); }
  function body(kids) { return el('div', { class: 'pbody' }, kids); }
  function foot(kids) { return el('div', { class: 'pfoot' }, kids); }

  /* ---------------------------------------------------------- LE PLAN */
  function viewRole() {
    var S = E.S;
    return screen([
      head('LE PLAN'),
      body([
        el('div', { class: 'contracts' }, [
          el('p', { class: 'h', style: 'margin-bottom:6px', text: 'TONIGHT’S CONTRACT' })
        ].concat(C.JOBS.map(function (j, i) {
          return el('button', {
            class: 'contract' + (C.jobIndex === i ? ' is-on' : ''),
            disabled: S.ready.p2 ? '' : null,
            onclick: function () { U.sfx.tap(); U.emit('job', i); }
          }, [
            el('b', { text: j.contract }),
            el('span', { text: j.venue }),
            /* only the chosen contract explains itself. Two full descriptions
               pushed Benjamin's own role card off the bottom of the very first
               screen he sees, which is a bad trade for text he has read once. */
            C.jobIndex === i ? el('em', { text: j.blurb }) : null
          ]);
        }))),
        el('div', { class: 'role' }, [
          U.artSlot('p2-role-benjamin'),
          el('h2', { class: 'role__name', text: 'BENJAMIN' }),
          el('div', { class: 'role__job', text: 'THE BRAIN' }),
          el('ul', { class: 'role__list' }, [
            el('li', { text: 'You are in the van. You see the whole floor — guards, cameras, cones, doors.' }),
            el('li', { text: 'You touch nothing. Assane is your hands, and he cannot see what you can.' }),
            el('li', { text: 'You have four tabs and far too much paper. Nobody will tell you which page you need.' })
          ])
        ])
      ]),
      foot([
        el('button', {
          class: 'btn ' + (S.ready.p2 ? '' : 'btn--go'),
          text: S.ready.p2 ? 'WAITING FOR ASSANE…' : 'READY',
          disabled: S.ready.p2 ? '' : null,
          onclick: function () { S.ready.p2 = true; U.sfx.tap(); U.emit('ready'); }
        })
      ])
    ]);
  }

  /* ------------------------------------------------------------- tabs */
  /* Only the pages this job has, and only once the job has asked for them.
     The plan is always there because it is the conversation; everything else
     arrives the first time it is needed. Note that nothing here ever SWITCHES
     the tab for him — finding the right page is still his job. */
  function availableTabs() {
    var S = E.S, u = S.unlocked || {}, list = [['plan', 'PLAN']];
    if (C.PORTE && u.porte) list.push(['porte', 'DOOR']);
    if (C.COFFRE && u.manuel) list.push(['manuel', 'MANUAL']);
    if (u.personnel) list.push(['personnel', 'STAFF']);
    if (u.visages) list.push(['visages', 'FACES']);
    return list;
  }
  function tabBar() {
    var bar = el('div', { class: 'tabs' });
    availableTabs().forEach(function (t) {
      bar.appendChild(el('button', {
        class: tab === t[0] ? 'is-on' : '', text: t[1],
        onclick: function () { tab = t[0]; U.sfx.tap(); U.emit('render'); }
      }));
    });
    return bar;
  }

  /* ---------------------------------------------------- the floor plan */
  var TT = 20;
  /* Same floor-plan treatment as the TV: fill the floor, outline its boundary,
     and put nothing inside it. Benjamin's map carries far more than Assane's —
     every cone, every camera, every patrol — so the architecture underneath has
     to be quiet or the threat on top of it cannot be read at a glance. */
  function planSVG() {
    var S = E.S, t = E.threat(), s = '';
    var W = C.MAP[0].length * TT, H = C.MAP.length * TT;

    var night = S.blackout;
    var live = night ? E.liveZones() : null;
    function feed(x, y) { return !night || live.indexOf(E.zoneOf(x, y)) >= 0; }

    var EDGE = night ? 'var(--zinc)' : 'var(--map-edge)';
    function floorFill(x, y) {
      if (night) return 'var(--night-2)';
      var r = E.roomAt(x, y), tint = (r && r.tint) || 'neutral';
      return 'var(--floor-' + tint + ')';
    }

    function open(x, y) {
      var ch = E.charAt(x, y);
      if (ch === '#' || ch === 'L') return false;
      var d = E.doorAt(x, y);
      return !(d && d.locked);
    }

    /* A gutter outside the map, for the ruler. */
    var GUT = 13;
    s += '<svg viewBox="' + (-GUT) + ' ' + (-GUT) + ' ' + (W + GUT) + ' ' + (H + GUT) + '" width="100%">';
    s += '<rect width="' + W + '" height="' + H + '" fill="var(--map-void)"/>';

    var floors = '', edges = '', cones = '';
    for (var y = 0; y < C.MAP.length; y++) {
      for (var x = 0; x < C.MAP[y].length; x++) {
        if (!open(x, y)) continue;
        var onFeed = feed(x, y), px = x * TT, py = y * TT;
        floors += '<rect x="' + px + '" y="' + py + '" width="' + (TT + 0.5) + '" height="' + (TT + 0.5) +
                  '" fill="' + floorFill(x, y) + '" opacity="' + (onFeed ? 1 : 0.25) + '"/>';
        if (onFeed && t[x + ',' + y]) {
          cones += '<rect x="' + px + '" y="' + py + '" width="' + (TT + 0.5) + '" height="' + (TT + 0.5) +
                   '" fill="var(--red)" opacity=".55"/>';
        }
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (v) {
          if (open(x + v[0], y + v[1])) return;
          var x1 = px + (v[0] > 0 ? TT : 0), y1 = py + (v[1] > 0 ? TT : 0);
          var x2 = x1 + (v[0] === 0 ? TT : 0), y2 = y1 + (v[1] === 0 ? TT : 0);
          edges += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
                   '" stroke="' + EDGE + '" stroke-width="1.75" stroke-linecap="square" opacity="' +
                   (onFeed ? 0.9 : 0.28) + '"/>';
        });
      }
    }
    s += floors + cones + edges;

    /* doors carry the release mark Benjamin has to name */
    S.doors.forEach(function (d) {
      if (!feed(d.x, d.y)) return;
      var px = d.x * TT, py = d.y * TT;
      if (d.locked) {
        s += '<rect x="' + (px + 2) + '" y="' + (py + TT / 2 - 3) + '" width="' + (TT - 4) + '" height="6" rx="1.5" fill="' + EDGE + '"/>';
      }
      s += '<g color="' + (d.locked ? EDGE : 'var(--gold)') + '" transform="translate(' + (px + 3) + ',' + (py + 3) +
           ') scale(' + ((TT - 6) / 100) + ')">' + G.iconMarkup(d.mark) + '</g>';
    });

    /* gold is the player: objectives read as targets, not as furniture */
    C.MODULES.forEach(function (m) {
      if (!feed(m.x, m.y)) return;
      var done = S.solved[m.id];
      s += '<rect x="' + (m.x * TT + 2) + '" y="' + (m.y * TT + 2) + '" width="' + (TT - 4) + '" height="' + (TT - 4) +
           '" rx="2" fill="' + (done ? 'var(--gold)' : 'var(--map-void)') + '" stroke="var(--gold)" stroke-width="1.5"/>' +
           '<g color="' + (done ? 'var(--on-gold)' : 'var(--gold)') + '" transform="translate(' + (m.x * TT + 4) + ',' + (m.y * TT + 4) +
           ') scale(' + ((TT - 8) / 100) + ')">' + G.iconMarkup(m.icon) + '</g>';
    });

    S.cameras.forEach(function (c) {
      if (night) return;
      var on = !!E.cameraDir(c);
      s += '<rect x="' + (c.x * TT + 4) + '" y="' + (c.y * TT + 4) + '" width="' + (TT - 8) + '" height="' + (TT - 8) +
           '" rx="1.5" fill="' + (on ? 'var(--red)' : 'var(--map-void)') + '" stroke="' + EDGE + '" stroke-width="1.5"/>';
    });

    S.guards.forEach(function (g) {
      var p = g.path[g.at];
      if (!feed(p.x, p.y)) return;
      var cx = p.x * TT + TT / 2, cy = p.y * TT + TT / 2;
      var v = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[g.facing];
      s += '<path d="M' + cx + ' ' + cy + ' L' + (cx + v[0] * 13) + ' ' + (cy + v[1] * 13) +
           '" stroke="var(--red)" stroke-width="3" stroke-linecap="round"/>';
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="7.5" fill="var(--red)" stroke="var(--map-void)" stroke-width="1.5"/>';
      s += '<text x="' + cx + '" y="' + (cy + 2.6) + '" font-size="7" font-weight="500" text-anchor="middle"' +
           ' font-family="var(--font)" fill="var(--on-color)">' + g.badge + '</text>';
    });

    if (feed(S.assane.x, S.assane.y)) {
      s += '<circle cx="' + (S.assane.x * TT + TT / 2) + '" cy="' + (S.assane.y * TT + TT / 2) +
           '" r="8" fill="var(--gold)" stroke="var(--map-void)" stroke-width="2"/>';
    }

    /* Names on the rooms. The tints make them distinguishable; the labels make
       them sayable, which is what a callout actually needs. */
    if (!night) {
      C.ROOMS.forEach(function (r) {
        s += '<text x="' + (r.x * TT + 3) + '" y="' + (r.y * TT + 9) + '" font-size="5.5" letter-spacing="0.6"' +
             ' font-weight="500" fill="var(--map-edge)" opacity=".75" font-family="var(--font)">' + r.name + '</text>';
      });
    }
    if (night) {
      C.BLACKOUT.zones.forEach(function (z) {
        if (live.indexOf(z.id) < 0) return;
        s += '<text x="' + (z.x * TT + 3) + '" y="' + (z.y * TT + 11) + '" font-size="8" letter-spacing="1.5"' +
             ' font-weight="500" fill="var(--zinc-lt)" font-family="var(--font)">' + z.id + '</text>';
      });
    }
    /* THE RULER. Both displays count squares the same way — letters across,
       numbers down — so a square has one name in the room and on the plan. The
       television prints Assane's, which is what makes the two pictures line up
       in words rather than by eye. */
    for (var cx = 0; cx < C.MAP[0].length; cx++) {
      s += '<text x="' + (cx * TT + TT / 2) + '" y="-4.5" text-anchor="middle" font-size="6"' +
           ' letter-spacing="0.4" font-family="var(--font)" fill="var(--map-edge)" opacity=".6">' +
           String.fromCharCode(65 + cx) + '</text>';
    }
    for (var ry = 0; ry < C.MAP.length; ry++) {
      s += '<text x="-6.5" y="' + (ry * TT + TT / 2 + 2.2) + '" text-anchor="middle" font-size="6"' +
           ' font-family="var(--font)" fill="var(--map-edge)" opacity=".6">' + (ry + 1) + '</text>';
    }
    s += '</svg>';
    return s;
  }

  /* which feeds are live this turn, and whether Benjamin still has him */
  function feedStrip() {
    var S = E.S, live = E.liveZones(), has = E.seesAssane();
    var wrap = el('div', { style: 'margin-top:10px' });
    var row = el('div', { class: 'feeds' });
    C.BLACKOUT.zones.forEach(function (z) {
      var on = live.indexOf(z.id) >= 0;
      row.appendChild(el('span', { class: 'feed' + (on ? ' is-live' : '') }, [
        el('b', { text: z.id }), el('em', { text: z.name })
      ]));
    });
    wrap.appendChild(row);
    wrap.appendChild(el('p', {
      class: 'signal' + (has ? ' is-good' : ''),
      text: has ? 'CONTACT · you have him' : 'SIGNAL LOST · tell him to hold still'
    }));
    return wrap;
  }

  function camCycles() {
    var S = E.S, wrap = el('div', { style: 'margin-top:10px' });
    S.cameras.forEach(function (c) {
      var row = el('div', { style: 'display:flex;align-items:center;gap:7px;margin-bottom:6px' }, [
        el('span', { style: 'font-size:10px;letter-spacing:.16em;width:46px', text: c.label })
      ]);
      c.cycle.forEach(function (d, i) {
        var isNow = (S.camPhase % c.cycle.length) === i;
        row.appendChild(el('i', {
          style: 'width:14px;height:14px;border:2px solid var(--ink);border-radius:99px;display:block;' +
                 'background:' + (d ? 'var(--red)' : 'var(--paper)') + ';' +
                 (isNow ? 'outline:2px solid var(--ink);outline-offset:2px' : 'opacity:.45')
        }));
      });
      row.appendChild(el('span', { style: 'font-size:10px;color:var(--ink-soft);letter-spacing:.1em',
        text: E.cameraDir(c) ? 'WATCHING' : 'BLIND' }));
      wrap.appendChild(row);
    });
    return wrap;
  }

  /* THE KEY.
     Every symbol on the plan gets a swatch drawn the same way it is drawn on
     the map, and a sentence in plain words. The old legend had three entries
     for six symbols, and the very first one read "ASSANE / OBJECTIVE" — which
     put the player and the thing he is walking towards on one line, in the
     same colour, so you could not tell which gold mark was the man. Anyone who
     does not already play games was being asked to guess. */
  function swatch(inner) {
    var i = el('i', { class: 'key__sw' });
    i.innerHTML = '<svg viewBox="0 0 20 20" width="100%" height="100%">' + inner + '</svg>';
    return i;
  }
  function keyRow(inner, label) {
    return el('span', { class: 'key' }, [swatch(inner), el('em', { html: label })]);
  }
  /* THE KEY, cut down to what this contract actually contains.
     It used to explain six symbols on every map whether or not the map had
     them — a camera row on a contract with no cameras is pure reading. Each
     row below is gated on the thing existing, and the wording is a label and
     a short line rather than a sentence to parse. */
  function hasChar(ch) {
    for (var y = 0; y < C.MAP.length; y++) if (C.MAP[y].indexOf(ch) >= 0) return true;
    return false;
  }
  function mapKey(night) {
    var rows = [
      keyRow('<circle cx="10" cy="10" r="7" fill="var(--gold)" stroke="var(--map-void)" stroke-width="2"/>',
             '<b>Assane</b> Your partner. Tell him where to go.')
    ];
    if (C.MODULES && C.MODULES.length) {
      rows.push(keyRow('<rect x="3" y="3" width="14" height="14" rx="2" fill="var(--map-void)" stroke="var(--gold)" stroke-width="2"/>' +
                       '<circle cx="10" cy="10" r="3" fill="var(--gold)"/>',
                       '<b>Objective</b> Something he has to reach.'));
    }
    if (E.S.guards.length) {
      rows.push(keyRow('<path d="M10 10 L19 10" stroke="var(--red)" stroke-width="3"/>' +
                       '<circle cx="9" cy="10" r="7" fill="var(--red)"/>',
                       night ? '<b>Torch</b> A guard. The line is the way he faces.'
                             : '<b>Guard</b> Steps when Assane steps. The line is the way he faces.'));
    }
    rows.push(keyRow('<rect width="20" height="20" fill="var(--map-floor)"/><rect width="20" height="20" fill="var(--red)" opacity=".55"/>',
                     '<b>Sightline</b> Somebody can see this square now.'));
    if (hasChar('L')) {
      rows.push(keyRow('<rect x="0" y="7" width="20" height="6" fill="var(--red)" opacity=".9"/>',
                       '<b>Lasers</b> Sealed. There is no way through — go around.'));
    }
    if (night) {
      rows.push(keyRow('<rect width="20" height="20" fill="var(--night-2)" opacity=".45"/>',
                       '<b>No feed</b> You are blind here.'));
    } else {
      if (C.CAMERAS && C.CAMERAS.length) {
        rows.push(keyRow('<rect x="4" y="4" width="12" height="12" rx="1.5" fill="var(--red)" stroke="var(--map-edge)" stroke-width="2"/>',
                         '<b>Camera</b> Filled means it is watching.'));
      }
      if (E.S.doors.some(function (d) { return d.locked; })) {
        rows.push(keyRow('<rect x="2" y="8" width="16" height="5" rx="1.5" fill="var(--map-edge)"/>',
                         '<b>Locked door</b> It needs a code or a mark.'));
      }
    }
    return el('div', { class: 'mapkey' }, rows);
  }

  function viewPlanTab() {
    var S = E.S, night = S.blackout;
    /* The same sentence the television is showing him, in the same words. The
       two screens had no shared vocabulary at all before this: one drew a lit
       fragment in a black field, the other drew the whole floor, and nothing
       said they were the same building. */
    var room = E.roomAt(S.assane.x, S.assane.y);
    var where = night
      ? 'The lights are out. He is only where a live feed shows him.'
      : 'Assane is in <b>' + (room ? room.name : 'an unmarked square') +
        '</b>, square <b>' + E.coordOf(S.assane.x, S.assane.y) + '</b>. The television is showing him the same two words.';
    return el('div', { class: night ? 'is-night' : '' }, [
      el('p', { class: 'plan2__where', html: where }),
      el('div', { class: 'plan2' + (night ? ' plan2--night' : ''), html: planSVG() }),
      night ? feedStrip() : camCycles(),
      mapKey(night),
      night ? el('p', { class: 'note', style: 'margin-top:10px', text:
        'Two feeds at a time. Call the route for where the torches will be, not where they are.' }) : null
    ]);
  }

  /* ------------------------------------------------------------ LA PORTE */
  /* The code, as symbols, above the ring they belong to — and a line saying
     the ring's zero is not recorded, because without that sentence a player
     assumes the top of the ring is zero and reads out four wrong digits with
     total confidence. The ring is useless until Assane describes the mark on
     the sign. That is the point of it. */
  function viewPorteTab() {
    var K = C.PORTE;
    var wrap = el('div', {}, [
      el('p', { class: 'h', text: 'DOOR CODES · CHAMBRE 302' }),
      U.howto([
        'Ask Assane what is engraved under the 0 of the room number. It is small, and it is the only thing that makes this page work.',
        'Find that mark on the ring below — it is the zero. Count round from it to read the four symbols as digits, and give him the number.'
      ])
    ]);

    wrap.appendChild(el('p', { class: 'lbl', style: 'margin:14px 0 6px', text: 'THE CODE FOR THIS DOOR' }));
    var code = el('div', { class: 'symrow' });
    E.porteCodeSymbols().forEach(function (sym) {
      var cell = el('div', { class: 'symrow__cell' });
      var ic = G.icon(sym); ic.style.color = 'var(--ink)';
      cell.appendChild(ic);
      code.appendChild(cell);
    });
    wrap.appendChild(code);

    wrap.appendChild(el('p', { class: 'lbl', style: 'margin:16px 0 6px', text: 'THE RING · IN ORDER' }));
    var ring = el('div', { class: 'symring' });
    K.ring.forEach(function (sym) {
      var cell = el('div', { class: 'symring__cell' });
      var ic = G.icon(sym); ic.style.color = 'var(--ink)';
      cell.appendChild(ic);
      ring.appendChild(cell);
    });
    wrap.appendChild(ring);

    wrap.appendChild(el('p', { class: 'warn', html:
      '<b>The zero is not recorded.</b> This ring is in the right order, but the ' +
      'file does not say which symbol is 0 — and every symbol is a different digit ' +
      'depending on where you start. Assane has that, on the door.' }));
    return wrap;
  }

  /* ---------------------------------------------------------- LE MANUEL */
  function viewManuel() {
    var wrap = el('div', {}, [
      el('p', { class: 'h', text: 'SAFES · OPENING SEQUENCES' }),
      U.howto([
        'Ask Assane for the number on the safe door and the colour of the ring around the dial. The same number is in here more than once — only the colour separates them.',
        'Open the matching row and describe its four symbols to him, in order. They have no names. Invent them.'
      ])
    ]);
    C.COFFRE.manual.forEach(function (m, i) {
      var row = el('button', {
        class: 'manual__row' + (openSerial === i ? ' is-on' : ''),
        onclick: function () { openSerial = openSerial === i ? -1 : i; U.sfx.tap(); U.emit('render'); }
      }, [
        el('span', { class: 'manual__serial', text: m.serial }),
        el('span', { class: 'manual__ringname', text: m.ring }),
        el('span', { class: 'manual__ring', style: 'background:' + C.RING_COLOUR[m.ring] })
      ]);
      wrap.appendChild(row);
      if (openSerial === i) {
        var seq = el('div', { class: 'manual__seq' }, [
          el('p', { class: 'lbl lbl--c', style: 'margin:0 0 8px', text: 'READ THESE FOUR TO HIM IN THIS ORDER' }),
          el('div', { class: 'steps' })
        ]);
        var steps = seq.querySelector('.steps');
        m.seq.forEach(function (gl, n) {
          var fig = el('figure', {}, [el('i'), el('figcaption', { text: String(n + 1) })]);
          var ic = G.icon(gl); ic.style.color = 'var(--ink)';
          fig.querySelector('i').appendChild(ic);
          steps.appendChild(fig);
        });
        wrap.appendChild(seq);
      }
    });

    /* THE LINE CODES.
       The book has no browsable list of patterns on purpose. If the six
       rhythms were printed here, Benjamin could eyeball a match and the board
       would be decoration. It only answers a QUERY, so he has to reproduce
       what Assane read him before it will tell him anything — which is the
       one place in the build where Player 2's input is load-bearing.
       He taps a SEQUENCE, not a tempo. There is no timing anywhere in here. */
    wrap.appendChild(el('div', { class: 'rule' }));
    wrap.appendChild(el('p', { class: 'h', text: 'LINE CODES · QUERY ONLY' }));

    var slots = el('div', { class: 'board__slots' });
    for (var q = 0; q < 5; q++) {
      slots.appendChild(el('i', { text: tapped[q] ? (tapped[q] === 'l' ? '—' : '·') : '' }));
    }
    wrap.appendChild(slots);

    var keys = el('div', { class: 'board__keys' });
    keys.appendChild(el('button', { class: 'board__short', text: '·  SHORT', onclick: function () {
      if (tapped.length < 5) { tapped.push('s'); U.sfx.pulse(false); queryResult = null; U.emit('render'); }
    } }));
    keys.appendChild(el('button', { class: 'board__long', text: '—  LONG', onclick: function () {
      if (tapped.length < 5) { tapped.push('l'); U.sfx.pulse(true); queryResult = null; U.emit('render'); }
    } }));
    keys.appendChild(el('button', { class: 'board__clear', text: 'CLEAR', onclick: function () {
      tapped = []; queryResult = null; U.emit('render');
    } }));
    wrap.appendChild(keys);

    wrap.appendChild(el('button', {
      class: 'btn ' + (tapped.length === 5 ? 'btn--go' : ''),
      style: 'margin-top:8px',
      disabled: tapped.length === 5 ? null : '',
      text: tapped.length === 5 ? 'QUERY THE BOOK' : 'FIVE PULSES',
      onclick: function () {
        var hit = C.ECOUTE.book.filter(function (r) {
          return r.p.every(function (v, i) { return v === tapped[i]; });
        })[0];
        queryResult = hit ? hit.c : 'NO MATCH';
        U.sfx.tap();
        U.emit('render');
      }
    }));
    if (queryResult) {
      wrap.appendChild(el('p', {
        class: 'board__result' + (queryResult === 'NO MATCH' ? ' is-none' : ''),
        text: queryResult === 'NO MATCH' ? 'NO MATCH · that rhythm is not in the book' : 'CIRCUIT ' + queryResult
      }));
    }

    /* Benjamin's authentication notes. Note 1 is true of both canvases and
       settles nothing — a pair who stops reading after it can still pick the
       forgery. Nothing on screen says which note tells. */
    wrap.appendChild(el('div', { class: 'rule' }));
    wrap.appendChild(el('p', { class: 'h', text: 'AUTHENTICATION · LOT 12' }));
    var notes = el('ol', { class: 'notes' });
    C.FAUX.notes.forEach(function (n) { notes.appendChild(el('li', { text: n.s })); });
    wrap.appendChild(notes);

    /* The emergency procedures live down here, under the safes, nowhere near
       the roster they need. Finding this at the moment the lights go out is
       the job — the game will not point at it. */
    wrap.appendChild(el('div', { class: 'rule' }));
    wrap.appendChild(el('p', { class: 'h', text: 'EMERGENCY PROCEDURES' }));
    var dl = el('dl', { class: 'proc' });
    C.PROCEDURES.forEach(function (r) {
      dl.appendChild(el('dt', { text: r.k }));
      dl.appendChild(el('dd', { text: r.v }));
    });
    wrap.appendChild(dl);
    return wrap;
  }

  /* ------------------------------------------------------- LE PERSONNEL */
  function viewPersonnel() {
    var wrap = el('div', {}, [
      el('p', { class: 'h', text: 'STAFF · NIGHT SHIFT' })
    ]);
    C.PERSONNEL.forEach(function (p) {
      var open = openBadge === p.badge;
      var file = el('div', { class: 'file' + (open ? ' is-on' : '') });
      file.appendChild(el('button', {
        class: 'file__hd',
        onclick: function () { openBadge = open ? null : p.badge; U.sfx.tap(); U.emit('render'); }
      }, [
        el('span', { class: 'file__badge', text: p.badge }),
        el('span', { class: 'file__name', text: p.name })
      ]));
      if (open) {
        var dl = el('dl');
        dl.appendChild(el('dt', { text: 'POST' }));
        dl.appendChild(el('dd', { text: p.post }));
        dl.appendChild(el('dt', { text: 'VEHICLE' }));
        dl.appendChild(el('dd', { text: p.plate || '—' }));
        dl.appendChild(el('dt', { text: 'CHILDREN' }));
        dl.appendChild(el('dd', { text: p.kids.length
          ? p.kids.map(function (k) { return k.n + ' (' + k.y + ')'; }).join(' · ')
          : '—' }));
        var bd = el('div', { class: 'file__bd' }, [dl]);
        /* the uniform, drawn. Benjamin can see whose is whose; only Assane can
           see which of these are actually hanging in the cloakroom. */
        if (C.UNIFORMS[p.badge]) {
          var uni = el('div', { class: 'uniform' });
          uni.innerHTML = L.figures.figureSVG(C.UNIFORMS[p.badge]);
          bd.appendChild(el('div', { class: 'uniformwrap' }, [
            el('span', { class: 'h', style: 'margin:0', text: 'UNIFORM' }), uni
          ]));
        }
        file.appendChild(bd);
      }
      wrap.appendChild(file);
    });
    return wrap;
  }

  /* ---------------------------------------------------------- LES VISAGES */
  function viewVisages() {
    var S = E.S, t = S.tchatche;
    var wrap = el('div', {}, [
      el('p', { class: 'h', text: 'FACES · NIGHT SHIFT' }),
      U.howto([
        'Assane describes the guard standing in front of him. Tap that face.',
        'His file opens underneath. Read Assane the one fact that is lit up, and he will find something to say about it.'
      ])
    ]);
    var grid = el('div', { class: 'faces' });
    Object.keys(C.FACES).forEach(function (badge) {
      var b = el('button', {
        class: pickedFace === badge ? 'is-on' : '',
        onclick: function () { pickedFace = badge; U.sfx.tap(); U.emit('render'); }
      });
      b.appendChild(L.face.portrait(C.FACES[badge], 'faces__portrait'));
      b.appendChild(el('span', { text: 'BADGE ' + badge }));
      grid.appendChild(b);
    });
    wrap.appendChild(grid);

    if (pickedFace) {
      var per = C.PERSONNEL.filter(function (p) { return p.badge === pickedFace; })[0];
      var round = t ? t.round : 0;
      var dirt = el('div', { class: 'dirt' }, [
        el('p', { class: 'h', style: 'margin-bottom:2px', text: per ? per.name : pickedFace })
      ]);
      var ul = el('ul');
      /* Three facts arrived as three bare sentences in three silent styles, and
         nothing said the gold one was the thing to read out loud — or that
         reading it out was the move at all. The locked ones just said
         "— sealed —", which explains nothing and looks like a bug. */
      C.DIRT[pickedFace].forEach(function (d, i) {
        var state = !t ? 'idle' : i < round ? 'used' : i === round ? 'key' : 'locked';
        var tag = state === 'key'    ? 'TELL HIM THIS NOW'
                : state === 'used'   ? 'ALREADY USED'
                : state === 'locked' ? 'NOT YET' : null;
        ul.appendChild(el('li', {
          class: state === 'key' ? 'is-key' : state === 'locked' ? 'is-locked' : ''
        }, [
          tag ? el('em', { class: 'dirt__tag', text: tag }) : null,
          document.createTextNode(state === 'locked' ? 'Opens after the next exchange.' : d.s)
        ]));
      });
      dirt.appendChild(ul);
      if (!t) dirt.appendChild(el('p', { class: 'note', style: 'margin-top:8px',
        text: 'Nothing opens until somebody stops him.' }));
      wrap.appendChild(dirt);
    }
    return wrap;
  }

  /* --------------------------------------------------------------- ends */
  function viewEnd() {
    var S = E.S, done = S.phase === 'rank';
    return screen([
      head(done ? 'LA SORTIE' : 'PRIS'),
      body([
        el('div', { class: 'waiting' }, [
          el('span', { class: 'waiting__dot' }),
          el('p', { class: 'note', text: done
            ? 'He is out. Close the dossier.'
            : 'They have him. Get the van moving.' })
        ])
      ]),
      foot([ el('button', { class: 'btn btn--brand', text: 'RECOMMENCER',
        onclick: function () { U.emit('restart'); } }) ])
    ]);
  }

  function render() {
    var S = E.S, host = $('#p2-screen');
    U.clear(host);
    if (S.phase === 'plan') { host.appendChild(viewRole()); return; }
    if (S.phase === 'rank' || S.phase === 'jail') { host.appendChild(viewEnd()); return; }

    var avail = availableTabs().map(function (t) { return t[0]; });
    if (avail.indexOf(tab) < 0) tab = 'plan';

    var inner = tab === 'plan' ? viewPlanTab()
              : tab === 'porte' ? viewPorteTab()
              : tab === 'manuel' ? viewManuel()
              : tab === 'personnel' ? viewPersonnel()
              : viewVisages();

    host.appendChild(screen([
      head('THE DOSSIER'),
      tabBar(),
      body([inner])
    ]));
  }

  L.p2 = { render: render, reset: function () {
    tab = 'plan'; openSerial = -1; openBadge = null; pickedFace = null;
    tapped = []; queryResult = null;
  } };
})(window.DC);
