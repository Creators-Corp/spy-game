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
  /* THE LAYERS. The plan shows the people or the wiring, never both. Two
     things Benjamin has to hold in his head at once become two pages he has
     to flip between while Assane waits — which is exactly the load the
     dossier is supposed to put on him. */
  var layer = 'patrols';

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
    var S = E.S, t = E.threat(layer === 'patrols' ? 'guards' : 'cameras'), s = '';
    var W = C.MAP[0].length * TT, H = C.MAP.length * TT;

    /* IN THE DARK THE PLAN IS WHOLE OR IT IS GONE. It used to be quartered by
       camera zone, two boxes lit at a time — so most of the floor was missing
       most of the time and no single moment meant anything. The dropout is an
       event now: while the link holds he has all of it, and while it is down
       he has none of it and is not looking at this drawing at all. See
       advanceLink() in the engine, and deadLink() below. */
    var night = S.blackout;

    var EDGE = night ? 'var(--zinc)' : 'var(--map-edge)';
    function floorFill(x, y) {
      if (night) return 'var(--night-2)';
      var r = E.roomAt(x, y), tint = (r && r.tint) || 'neutral';
      return 'var(--floor-' + tint + ')';
    }

    function open(x, y) {
      var ch = E.charAt(x, y);
      if (ch === '#') return false;
      /* the beams belong to the wiring page. On the people page a laser
         square is drawn as plain floor, so the plan does not read as if the
         building had holes in it. */
      if (ch === 'L' && !(S.levers.laser > 0) && layer === 'electronics') return false;
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
        var px = x * TT, py = y * TT;
        floors += '<rect x="' + px + '" y="' + py + '" width="' + (TT + 0.5) + '" height="' + (TT + 0.5) +
                  '" fill="' + floorFill(x, y) + '"/>';
        if (t[x + ',' + y]) {
          cones += '<rect x="' + px + '" y="' + py + '" width="' + (TT + 0.5) + '" height="' + (TT + 0.5) +
                   '" fill="var(--red)" opacity=".55"/>';
        }
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (v) {
          if (open(x + v[0], y + v[1])) return;
          var x1 = px + (v[0] > 0 ? TT : 0), y1 = py + (v[1] > 0 ? TT : 0);
          var x2 = x1 + (v[0] === 0 ? TT : 0), y2 = y1 + (v[1] === 0 ? TT : 0);
          edges += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
                   '" stroke="' + EDGE + '" stroke-width="1.75" stroke-linecap="square" opacity=".9"/>';
        });
      }
    }
    s += floors + cones + edges;

    /* THE LASERS. Solid to anything that walks, and the only reason the middle
       of this floor is not a shortcut — so they have to be the most obvious
       thing on the plan after the guards. Benjamin sees all of them: he has the
       building's procedures, and knowing where they are is not the puzzle. */
    for (var ly = 0; ly < C.MAP.length; ly++) {
      for (var lx = 0; lx < C.MAP[ly].length; lx++) {
        if (C.MAP[ly][lx] !== 'L' || layer !== 'electronics') continue;
        var px2 = lx * TT, py2 = ly * TT, off = S.levers.laser > 0;
        if (!off) s += '<rect x="' + px2 + '" y="' + py2 + '" width="' + TT + '" height="' + TT +
             '" fill="var(--red)" opacity=".22"/>';
        s += '<line x1="' + px2 + '" y1="' + (py2 + TT / 2) + '" x2="' + (px2 + TT) +
             '" y2="' + (py2 + TT / 2) + '" stroke="var(--red)" stroke-width="2.5"' +
             (off ? ' stroke-dasharray="3 4" opacity=".4"' : '') + '/>';
      }
    }

    /* DOORS CARRY THE RELEASE MARK BENJAMIN HAS TO NAME, and that mark is the
       whole of his half of LE BUREAU: Assane reads four symbols off a screen
       and only Benjamin can say which one is La Réserve.

       It was unreadable. A locked door drew a grey bar and then drew its mark
       in the SAME grey on top of that bar, so the only mark you could make out
       on the whole plan was the one on the door that was already open — the
       one nobody needs. Gold is the players' business here, exactly as it is
       on the television, where a locked door is the gold one; so the mark on a
       locked door is gold, the bar sits under it, and a door already open
       keeps its mark quietly in grey.

       AND IT IS DRAWN BIGGER THAN ITS DOOR. Fitted inside the tile it was
       fourteen units of a five-hundred-unit plan — about five pixels on the
       phone, which is enough to see that a door has a mark and nowhere near
       enough to tell a trident from a bisect. Benjamin is asked to name it
       twice a contract, so it is drawn at one and a half tiles and allowed to
       spill into the wall it sits in. A door IS a hole in a wall; there is
       nothing there for it to cover up. */
    var MK = TT * 1.5, MKOFF = (TT - MK) / 2;
    S.doors.forEach(function (d) {
      var px = d.x * TT, py = d.y * TT;
      if (d.locked) {
        s += '<rect x="' + (px + 2) + '" y="' + (py + TT / 2 - 3) + '" width="' + (TT - 4) + '" height="6" rx="1.5" fill="' + EDGE + '" opacity=".45"/>';
        /* a disc under the glyph, so a gold line never has to be read against
           the gold-brown of a lit floor */
        s += '<circle cx="' + (px + TT / 2) + '" cy="' + (py + TT / 2) + '" r="' + (MK * 0.46) +
             '" fill="var(--map-void)" opacity=".82"/>';
      }
      var size = d.locked ? MK : TT - 6, off = d.locked ? MKOFF : 3;
      s += '<g color="' + (d.locked ? 'var(--gold)' : EDGE) + '" opacity="' + (d.locked ? 1 : 0.6) + '"' +
           ' transform="translate(' + (px + off) + ',' + (py + off) +
           ') scale(' + (size / 100) + ')">' + G.iconMarkup(d.mark) + '</g>';
    });

    /* gold is the player: objectives read as targets, not as furniture */
    C.MODULES.forEach(function (m) {
      var done = S.solved[m.id];
      s += '<rect x="' + (m.x * TT + 2) + '" y="' + (m.y * TT + 2) + '" width="' + (TT - 4) + '" height="' + (TT - 4) +
           '" rx="2" fill="' + (done ? 'var(--gold)' : 'var(--map-void)') + '" stroke="var(--gold)" stroke-width="1.5"/>' +
           '<g color="' + (done ? 'var(--on-gold)' : 'var(--gold)') + '" transform="translate(' + (m.x * TT + 4) + ',' + (m.y * TT + 4) +
           ') scale(' + ((TT - 8) / 100) + ')">' + G.iconMarkup(m.icon) + '</g>';
    });

    S.cameras.forEach(function (c) {
      if (night || layer !== 'electronics') return;
      var on = !!E.cameraDir(c);
      s += '<rect x="' + (c.x * TT + 4) + '" y="' + (c.y * TT + 4) + '" width="' + (TT - 8) + '" height="' + (TT - 8) +
           '" rx="1.5" fill="' + (on ? 'var(--red)' : 'var(--map-void)') + '" stroke="' + EDGE + '" stroke-width="1.5"/>';
      s += '<text x="' + (c.x * TT + TT / 2) + '" y="' + (c.y * TT + TT / 2 + 2.4) + '" font-size="6" font-weight="500" text-anchor="middle"' +
           ' font-family="var(--font)" fill="' + (on ? 'var(--on-color)' : EDGE) + '">' + c.id.replace('c', '') + '</text>';
    });

    /* the hatch: on both layers, because it is the way out */
    (function () {
      var h = E.hatchTile();
      if (!h) return;
      /* Not on the public plans — until Assane has stood where he can see it.
         The plan is the pair's shared map, so once one of them has found the
         way out it stops being a secret from the other; keeping it off forever
         meant the only record of it was in somebody's head. */
      if (C.PRIZE && C.PRIZE.hatchHidden && !S.seen[h.x + ',' + h.y]) return;
      s += '<g color="var(--gold)" transform="translate(' + (h.x * TT + 2.5) + ',' + (h.y * TT + 2.5) +
           ') scale(' + ((TT - 5) / 100) + ')">' + G.iconMarkup('hatch') + '</g>';
    })();

    S.guards.forEach(function (g) {
      if (layer !== 'patrols') return;
      var p = E.guardAt(g);
      var cx = p.x * TT + TT / 2, cy = p.y * TT + TT / 2;
      var v = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[g.facing];
      s += '<path d="M' + cx + ' ' + cy + ' L' + (cx + v[0] * 13) + ' ' + (cy + v[1] * 13) +
           '" stroke="var(--red)" stroke-width="3" stroke-linecap="round"/>';
      /* a guard who has stopped to look at something wears a dashed ring, so
         Benjamin can see his phone call landed */
      if (g.alert > 0) s += '<circle cx="' + cx + '" cy="' + cy + '" r="12" fill="none" stroke="var(--red)" stroke-width="1.5" stroke-dasharray="3 3"/>';
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="7.5" fill="var(--red)" stroke="var(--map-void)" stroke-width="1.5"/>';
      s += '<text x="' + cx + '" y="' + (cy + 2.6) + '" font-size="7" font-weight="500" text-anchor="middle"' +
           ' font-family="var(--font)" fill="var(--on-color)">' + g.badge + '</text>';
    });

    s += '<circle cx="' + (S.assane.x * TT + TT / 2) + '" cy="' + (S.assane.y * TT + TT / 2) +
         '" r="8" fill="var(--gold)" stroke="var(--map-void)" stroke-width="2"/>';

    /* Names on the rooms. The tints make them distinguishable; the labels make
       them sayable, which is what a callout actually needs. */
    {
      C.ROOMS.forEach(function (r) {
        s += '<text x="' + (r.x * TT + 3) + '" y="' + (r.y * TT + 9) + '" font-size="5.5" letter-spacing="0.6"' +
             ' font-weight="500" fill="var(--map-edge)" opacity=".75" font-family="var(--font)">' + r.name + '</text>';
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

  /* THE VAN'S PICTURE, WHEN IT IS GONE. The snow used to be on Assane's
     phone. It is the wrong man's screen to take: he is the one who has to
     walk, and the television has already gone near-black on him. This is what
     Benjamin gets instead, for the one or two moves a dropout lasts — no
     floor, no patrols, no gold dot, and no way to answer the only question
     Assane is asking. The pattern is drawn from the turn, so it moves. */
  function deadLink() {
    var S = E.S, ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 100 74');
    var bg = document.createElementNS(ns, 'rect');
    bg.setAttribute('width', '100'); bg.setAttribute('height', '74');
    bg.setAttribute('fill', 'var(--night)');
    svg.appendChild(bg);
    var seed = S.turn * 9301 + 49297;
    for (var i = 0; i < 58; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      var r = seed / 233280;
      var bar = document.createElementNS(ns, 'rect');
      bar.setAttribute('x', (r * 100).toFixed(1));
      bar.setAttribute('y', ((i * 1.29) % 74).toFixed(1));
      bar.setAttribute('width', (2 + r * 26).toFixed(1));
      bar.setAttribute('height', '1.4');
      bar.setAttribute('fill', i % 3 ? 'var(--zinc)' : 'var(--zinc-lt)');
      bar.setAttribute('opacity', (0.12 + r * 0.4).toFixed(2));
      svg.appendChild(bar);
    }
    var wrap = el('div', { class: 'deadscreen' });
    wrap.appendChild(svg);
    wrap.appendChild(el('span', { class: 'deadscreen__line',
      text: C.STATIC_LINES[S.turn % C.STATIC_LINES.length] }));
    return wrap;
  }

  /* whether he still has him, and for how much longer either way */
  function linkStrip() {
    var S = E.S, down = E.linkDown();
    return el('p', {
      class: 'signal' + (down ? '' : ' is-good'),
      text: down
        ? 'SIGNAL LOST · ' + down + (down === 1 ? ' MOVE' : ' MOVES') + ' · tell him to hold still'
        : 'CONTACT · you have him'
    });
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
    var people = layer === 'patrols';
    if (people && E.S.guards.length) {
      rows.push(keyRow('<path d="M10 10 L19 10" stroke="var(--red)" stroke-width="3"/>' +
                       '<circle cx="9" cy="10" r="7" fill="var(--red)"/>',
                       night ? '<b>Torch</b> A guard. The line is the way he faces.'
                             : '<b>Guard</b> Steps when Assane steps. The line is the way he faces.'));
    }
    rows.push(keyRow('<rect width="20" height="20" fill="var(--map-floor)"/><rect width="20" height="20" fill="var(--red)" opacity=".55"/>',
                     people ? '<b>Sightline</b> A guard can see this square now.'
                            : '<b>Sightline</b> A camera can see this square now.'));
    if (!people && hasChar('L')) {
      rows.push(keyRow('<rect x="0" y="7" width="20" height="6" fill="var(--red)" opacity=".9"/>',
                       '<b>Lasers</b> Sealed. Go around — unless you drop them from the van.'));
    }
    if (night) {
      rows.push(keyRow('<rect width="20" height="20" fill="var(--night-2)"/>',
                       '<b>Dark</b> The power is out. Nobody sees past arm’s length, guards included.'));
    } else {
      if (!people && C.CAMERAS && C.CAMERAS.length) {
        rows.push(keyRow('<rect x="4" y="4" width="12" height="12" rx="1.5" fill="var(--red)" stroke="var(--map-edge)" stroke-width="2"/>',
                         '<b>Camera</b> Filled means it is watching. You can loop one from the van — for a while.'));
      }
      if (!people && E.S.doors.some(function (d) { return d.locked; })) {
        rows.push(keyRow('<rect x="2" y="8" width="16" height="5" rx="1.5" fill="var(--map-edge)"/>',
                         '<b>Locked door</b> It needs a code or a mark.'));
      }
    }
    /* a hatch kept off the public plans is still keyed once he has found it,
       so the symbol that just appeared on the map has a line explaining it */
    var hx = E.hatchTile();
    var hatchFound = !!(hx && E.S.seen[hx.x + ',' + hx.y]);
    if (hasChar('X') && !(C.PRIZE && C.PRIZE.hatchHidden && !hatchFound)) {
      rows.push(keyRow('<g color="var(--gold)" transform="translate(2,2) scale(0.16)">' + G.iconMarkup('hatch') + '</g>',
                       '<b>Hatch</b> The way out, once he has it.'));
    }
    return el('div', { class: 'mapkey' }, rows);
  }

  function viewPlanTab() {
    var S = E.S, night = S.blackout, down = E.linkDown();
    /* Benjamin is the only one who can see all of them at once, so during an
       alarm he is the one who can say which way to run. The count is the
       number of moves before they turn round and walk back. */
    /* The same sentence the television is showing him, in the same words. The
       two screens had no shared vocabulary at all before this: one drew a lit
       fragment in a black field, the other drew the whole floor, and nothing
       said they were the same building. */
    var room = E.roomAt(S.assane.x, S.assane.y);
    var where = down
      ? 'The van has lost the floor. <b>Nothing on this screen is live.</b>'
      : night
      ? 'The lights are out. Assane is in <b>' + (room ? room.name : 'an unmarked square') +
        '</b>, square <b>' + E.coordOf(S.assane.x, S.assane.y) + '</b> — while you still have him.'
      : 'Assane is in <b>' + (room ? room.name : 'an unmarked square') +
        '</b>, square <b>' + E.coordOf(S.assane.x, S.assane.y) + '</b>. The television is showing him the same two words.';
    /* the building's state, said once, where the cones it changes are drawn */
    if (!night && S.alert) {
      where += ' The building is <b>' + C.ALERT[S.alert - 1].name + '</b>: every guard sees ' +
               (S.alert === 1 ? 'one square' : S.alert + ' squares') + ' further' +
               (S.alert >= 2 ? ', and a man who stops him will search him.' : '.');
    }
    return el('div', { class: night ? 'is-night' : '' }, [
      S.moduleId === 'grille' && C.GRILLE ? keyBoard() : null,
      el('p', { class: 'plan2__where', html: where }),
      S.alarm > 0 ? el('p', { class: 'warn warn--alarm', html:
        '<b>ALARM · ' + S.alarm + (S.alarm === 1 ? ' MOVE' : ' MOVES') + '</b>' +
        'He broke a beam. Every one of them has left his round and is walking straight at him — ' +
        'they are on this plan, off their lines. Call the way out; in ' + S.alarm +
        (S.alarm === 1 ? ' move' : ' moves') + ' they turn round and walk back.' }) : null,
      down ? null : layerBar(),
      down ? deadLink()
           : el('div', { class: 'plan2' + (night ? ' plan2--night' : ''), html: planSVG() }),
      night ? linkStrip() : (layer === 'electronics' ? camCycles() : null),
      night ? null : leversPanel(),
      down ? null : mapKey(night),
      night ? el('p', { class: 'note', style: 'margin-top:10px', text: down
        ? 'It comes back. Keep him still until it does, or walk him from memory and hope.'
        : 'The link drops for a move or two at a time. Say the next three squares while you have him.' }) : null
    ]);
  }

  /* one layer at a time. Not a filter — a page turn. */
  function layerBar() {
    var bar = el('div', { class: 'layers' });
    [['patrols', 'PATROLS', 'people'], ['electronics', 'ELECTRONICS', 'wiring']].forEach(function (L) {
      bar.appendChild(el('button', {
        class: layer === L[0] ? 'is-on' : '',
        onclick: function () { layer = L[0]; U.sfx.tap(); U.emit('render'); }
      }, [el('b', { text: L[1] }), el('span', { text: L[2] })]));
    });
    return bar;
  }

  /* ------------------------------------------------------------ LA GRILLE */
  /* Benjamin's half of the handshake: which symbol is which key. It sits on the
     plan, not on a tab of its own, because at this moment he has never seen a
     tab appear and the first exchange should cost him nothing to find. */
  function keyBoard() {
    var wrap = el('div', { class: 'keyboard' }, [
      el('p', { class: 'h', text: 'SERVICE GATE · KEYS' }),
      el('p', { class: 'note', style: 'margin:0 0 6px', text: 'Assane has the keys on a ring, and nothing is written on any of them. Ask what is stamped on the padlock’s tag, then describe the key beside it.' })
    ]);
    var rows = el('div', { class: 'keyboard__rows' });
    C.GRILLE.board.forEach(function (b) {
      /* symbol on the left, the key it opens on the right, both drawn. The
         row used to end in the words KEY 2, which Benjamin could read out
         without ever looking at the thing — and then Assane pressed the
         button marked 2 without looking either. */
      var ic = G.icon(b.sym); ic.style.color = 'var(--ink)';
      var kc = G.icon(b.shape || 'key'); kc.style.color = 'var(--ink)';
      rows.appendChild(el('div', { class: 'keyrow' }, [
        el('i', {}, [ic]),
        el('span', { class: 'keyrow__arrow', text: '→' }),
        el('i', { class: 'keyrow__key' }, [kc])
      ]));
    });
    wrap.appendChild(rows);
    return wrap;
  }

  /* -------------------------------------------------- BEING ASKED A THING */
  /* BENJAMIN WAS NEVER TOLD HE HAD BEEN ASKED A QUESTION.
     Assane's phone says "describe the four marks, he has the floor plan" and
     Benjamin's said nothing whatsoever — his screen carried on reporting which
     room Assane was standing in while Assane waited for an answer. Both halves
     of this module are lookups on pages he already has, and neither page
     announces itself: the badge is in STAFF, the mark is on the plan he is
     already looking at, and nothing anywhere connected either to the desk.

     So whatever has him stopped speaks up, on every tab, for exactly as long
     as it is open. It says he has been asked and what he has been asked for.
     It never says the answer.

     HOW MUCH IT POINTS AT IS PER MODULE, and the difference is deliberate. The
     desk names the page, because both its answers are ordinary lookups in a
     book he has been carrying all night and hunting for the index is not the
     puzzle. LE CLAVIER names nothing: the emergency procedures are filed under
     the safes, nowhere near the roster they need, and finding them at the
     moment the lights go out IS the module — see the note over the procedures
     in viewManuel(). Telling him he is being asked something is not the same
     as telling him where to look, and only the second one would spoil it. */
  function askBoard(id) {
    var S = E.S;

    if (id === 'clavier') {
      return el('div', { class: 'keyboard' }, [
        el('p', { class: 'h', text: 'SERVICE HATCH · LOCKED' }),
        el('p', { class: 'note', style: 'margin:0', text:
          'The way out shut itself when the power went, and he is standing at the keypad in the ' +
          'dark. He can see which three keys are worn smooth and he cannot see the order. ' +
          'Everything you need to give him the order is somewhere in this dossier — you have ' +
          'not needed it until now.' })
      ]);
    }

    var second = S.bureauStep === 1;
    return el('div', { class: 'keyboard' }, [
      el('p', { class: 'h', text: second ? 'SECURITY DESK · THE RELEASE' : 'SECURITY DESK · THE TERMINAL' }),
      el('p', { class: 'note', style: 'margin:0', html: second
        ? 'The terminal is open and showing him four marks. One of them releases <b>' +
          ((C.DOORS.filter(function (d) { return d.mark === C.BUREAU.doorMark; })[0] || {}).to || 'the locked room') +
          '</b>. That door is drawn on your plan, locked and gold, with its mark on it. ' +
          'Have him describe the four; tell him which one is on your door.'
        : 'He is at the desk and it wants four digits. Have him read you all of it — the badge, ' +
          'the post, and the note stuck to the screen. The note says which number the terminal is ' +
          'asking for. Whatever it turns out to be, it is in <b>STAFF</b>.' })
    ]);
  }

  /* ---------------------------------------------------------- LES LEVIERS */
  /* What Benjamin can DO. Until now his phone was a book: he looked things up
     and read them out. These are decisions — when to spend a thing that does
     not come back, knowing the building will notice — and Assane has to ask
     for them, which is the other half of a conversation. */
  function usePips(left, total) {
    var out = [];
    for (var i = 0; i < total; i++) out.push(el('i', { class: i < left ? 'is-on' : '' }));
    return out;
  }
  function leversPanel() {
    var S = E.S, list = C.LEVIERS || [];
    if (!list.length) return null;
    var live = S.phase === 'play';
    var wrap = el('div', { class: 'levers' }, [
      el('p', { class: 'h', style: 'margin:0 0 8px', text: 'FROM THE VAN' })
    ]);
    list.forEach(function (L) {
      var left = S.levers.uses[L.id] || 0;
      var active = L.id === 'lights' ? S.levers.lights : L.id === 'laser' ? S.levers.laser : 0;

      /* THE CAMERA LEVER SAYS TWO THINGS, AND NEITHER IS A QUESTION.
         The title names the box a tap would take — the one nearest Assane, so
         he can see what he is buying without being asked to choose it. The
         line under it reports the loop already running, if one is, because on
         a floor with two boxes he can be spending the second use while the
         first is still dark. They are separate facts and they get separate
         lines; showing only one of them is how you get a button that promises
         CAM 1 and loops CAM 2. */
      var target = null, dark = [];
      if (L.id === 'camera') {
        S.cameras.forEach(function (c) { if (S.levers.cams[c.id] > 0) dark.push(c); });
        /* soonest back leads: the useful fact is when a lens wakes up, not
           which one has been asleep longest */
        dark.sort(function (a, b) { return S.levers.cams[a.id] - S.levers.cams[b.id]; });
        if (live && left > 0) target = E.nearestCam();
      }
      var darkLine = dark.length
        ? dark.map(function (c) { return c.label + ' · ' + S.levers.cams[c.id]; }).join(', ') +
          ' MOVE' + (S.levers.cams[dark[dark.length - 1].id] > 1 || dark.length > 1 ? 'S' : '') + ' LEFT'
        : '';

      var ic = G.icon(L.icon);
      var b = el('button', {
        class: 'lever' + (active || dark.length ? ' is-live' : ''),
        disabled: (!live || left <= 0) && !active ? '' : null,
        onclick: function () {
          if (active) return;
          if (E.pullLever(L.id)) U.emit('render');
        }
      }, [
        el('i', { class: 'lever__ic' }, [ic]),
        el('span', { class: 'lever__txt' }, [
          el('b', { text: L.name + (target ? ' · ' + target.label : '') }),
          el('em', { text: darkLine ? darkLine
                        : active ? active + ' MOVE' + (active > 1 ? 'S' : '') + ' LEFT' : L.blurb })
        ]),
        el('span', { class: 'lever__side' }, [
          el('span', { class: 'lever__uses' }, usePips(left, L.uses)),
          el('span', { class: 'lever__cost', text: '+' + L.cost })
        ])
      ]);
      wrap.appendChild(b);
    });
    if (S.levers.last) {
      wrap.appendChild(el('p', { class: 'lever__last', text: 'LAST · ' + S.levers.last.note }));
    }
    return wrap;
  }

  /* ------------------------------------------------------------ LA PORTE */
  /* THE RING. The whole mechanic is "count round from the zero", and the page
     used to say RING and draw a table, so the wrap from the last symbol back
     to the first — the step everybody trips on — was invisible. It is a real
     ring, and Benjamin taps the symbol Assane describes to anchor it; every
     other symbol then labels itself with its digit.

     WHAT BENJAMIN NO LONGER HAS IS THE CODE. This page used to print the four
     code symbols at the top, so the moment he anchored the ring the whole
     four-digit code appeared on his screen at once and the conversation was
     over after one sentence: Assane named one mark and Benjamin read back four
     numbers he had never had to look for.

     The code sits on Assane's keypad now, as symbols. Benjamin holds the
     alphabet and nothing else, so the exchange is five sentences instead of
     one — the mark under the zero, and then each symbol in turn, with a number
     coming back for each. That is the module: neither of them can read the
     door alone. */
  var porteZero = null;

  function porteDigit(sym) {
    var ring = C.PORTE.ring, n = ring.length, zi = ring.indexOf(porteZero);
    if (zi < 0) return null;
    return ((ring.indexOf(sym) - zi) % n + n) % n;
  }

  function ringDial() {
    var ring = C.PORTE.ring, n = ring.length;
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 200 200');
    svg.setAttribute('class', 'ringdial');

    var band = document.createElementNS(ns, 'circle');
    band.setAttribute('cx', 100); band.setAttribute('cy', 100); band.setAttribute('r', 66);
    band.setAttribute('fill', 'none');
    band.setAttribute('stroke', 'var(--ink)');
    band.setAttribute('stroke-width', '1.5');
    band.setAttribute('stroke-dasharray', '2 5');
    band.setAttribute('opacity', '.5');
    svg.appendChild(band);

    ring.forEach(function (sym, i) {
      var a = (i / n) * Math.PI * 2 - Math.PI / 2;
      var x = 100 + Math.cos(a) * 66, y = 100 + Math.sin(a) * 66;
      var d = porteDigit(sym);

      var g = document.createElementNS(ns, 'g');
      g.setAttribute('class', 'ringdial__cell' + (porteZero === sym ? ' is-zero' : ''));
      var box = document.createElementNS(ns, 'rect');
      box.setAttribute('x', x - 16); box.setAttribute('y', y - 16);
      box.setAttribute('width', 32); box.setAttribute('height', 32); box.setAttribute('rx', 4);
      g.appendChild(box);
      var use = document.createElementNS(ns, 'use');
      use.setAttribute('href', '#g-' + sym);
      use.setAttribute('width', '100'); use.setAttribute('height', '100');
      use.setAttribute('transform', 'translate(' + (x - 11) + ',' + (y - 11) + ') scale(0.22)');
      g.appendChild(use);
      g.addEventListener('click', function () {
        porteZero = (porteZero === sym) ? null : sym;
        U.sfx.tap(); U.emit('render');
      });
      svg.appendChild(g);

      if (d !== null) {
        var t = document.createElementNS(ns, 'text');
        t.setAttribute('x', 100 + Math.cos(a) * 92);
        t.setAttribute('y', 100 + Math.sin(a) * 92 + 4);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('class', 'ringdial__n' + (d === 0 ? ' is-zero' : ''));
        t.textContent = d;
        svg.appendChild(t);
      }
    });
    return svg;
  }

  function viewPorteTab() {
    var K = C.PORTE;
    var wrap = el('div', {}, [
      el('p', { class: 'h', text: 'DOOR CODES · ' + K.sign }),
      U.howto([
        'Ask Assane what is engraved under the 0 on the door. Tap that symbol here — the ring numbers itself from it.',
        'He has four more symbols on his keypad. He describes each one; you find it on the ring and tell him its number.'
      ])
    ]);

    wrap.appendChild(el('p', { class: 'lbl lbl--c', style: 'margin:16px 0 0',
      text: porteZero ? 'ZERO SET · COUNTING CLOCKWISE' : 'TAP THE MARK HE DESCRIBES' }));
    wrap.appendChild(ringDial());

    if (!porteZero) {
      wrap.appendChild(el('p', { class: 'warn', html:
        '<b>The zero is not recorded.</b> The order is right, but the file does not ' +
        'say where to start counting. Assane has that, on the door.' }));
    } else {
      wrap.appendChild(el('p', { class: 'note', style: 'margin-top:10px',
        text: 'The code itself is not in this file. He is reading it off the keypad — take his symbols one at a time.' }));
    }
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

    if (C.ECOUTE) {
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
      tapped = []; queryResult = null; porteZero = null; U.emit('render');
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

    }

    if (C.FAUX) {
    /* Benjamin's authentication notes. Note 1 is true of both canvases and
       settles nothing — a pair who stops reading after it can still pick the
       forgery. Nothing on screen says which note tells. */
    wrap.appendChild(el('div', { class: 'rule' }));
    wrap.appendChild(el('p', { class: 'h', text: 'AUTHENTICATION · LOT 12' }));
    var notes = el('ol', { class: 'notes' });
    C.FAUX.notes.forEach(function (n) { notes.appendChild(el('li', { text: n.s })); });
    wrap.appendChild(notes);

    }

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
    /* Where he is going. The POST line on each file is only useful next to
       this — without it Benjamin is reading postings with nothing to compare
       them against, and the disguise comes down to a coin toss. Shown only
       while the cloakroom is open, because that is the only time it decides
       anything. */
    if (E.S.moduleId === 'deguisement' && C.DEGUISEMENT) {
      wrap.appendChild(el('p', { class: 'warn', style: 'margin:0 0 12px', html:
        'He is heading for <b>' + C.DEGUISEMENT.targetPost + '</b>. Find the one uniform ' +
        'he can actually build from that rack whose owner is posted there.' }));
    }
    C.PERSONNEL.forEach(function (p) {
      var open = openBadge === p.badge;
      var file = el('div', { class: 'file' + (open ? ' is-on' : '') });
      file.appendChild(el('button', {
        class: 'file__hd',
        onclick: function () { openBadge = open ? null : p.badge; U.sfx.tap(); U.emit('render'); }
      }, [
        C.FACES && C.FACES[p.badge] ? L.face.portrait(C.FACES[p.badge], 'file__face') : null,
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
          uni.appendChild(L.figures.uniformStack(C.UNIFORMS[p.badge], 'ustack--roster'));
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
    /* the van's link degrades once the building has gone dark: scanlines
       and the odd jump. Cosmetic — the plan is still the plan. */
    host.classList.toggle('is-degraded', !!(S.dark || S.blackout) && (S.phase === 'play' || S.phase === 'module'));
    if (S.phase === 'plan') { host.appendChild(viewRole()); return; }
    if (S.phase === 'rank' || S.phase === 'jail') { host.appendChild(viewEnd()); return; }

    var avail = availableTabs().map(function (t) { return t[0]; });
    if (avail.indexOf(tab) < 0) tab = 'plan';

    var inner = tab === 'plan' ? viewPlanTab()
              : tab === 'porte' ? viewPorteTab()
              : tab === 'manuel' ? viewManuel()
              : tab === 'personnel' ? viewPersonnel()
              : viewVisages();

    /* it asks from above the tabs, so it is there whichever page he happened
       to be reading when Assane walked into the thing */
    var asking = (S.moduleId === 'bureau' && C.BUREAU) || (S.moduleId === 'clavier' && C.CLAVIER)
      ? askBoard(S.moduleId) : null;

    host.appendChild(screen([
      head('THE DOSSIER'),
      tabBar(),
      body(asking ? [asking, inner] : [inner])
    ]));
  }

  L.p2 = { render: render, reset: function () {
    tab = 'plan'; openSerial = -1; openBadge = null; pickedFace = null;
    tapped = []; queryResult = null; layer = 'patrols';
  } };
})(window.DC);
