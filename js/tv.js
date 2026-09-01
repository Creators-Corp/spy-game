/* tv.js — "THE ROOM".
   DESIGN LAW #1: the TV keeps no secrets, it holds consequences.
   It draws only what Assane himself can perceive — so Player 2 reading the
   shared screen learns nothing Player 1 could not already tell them, and the
   asymmetry survives. Everyone on the couch can watch it safely. */
(function (L) {
  'use strict';
  var U = L.util, C = L.content, E = L.engine, G = L.glyphs;
  var $ = U.$, T = 40;

  /* The tile size is derived from the map, not hardcoded, so a job can be any
     shape it wants. Job 2 needed an extra row the moment its chamber turned
     out to be too small to be patrolled, and a renderer that only knew 15x10
     would have made that a code change instead of a data one. */
  function metrics() {
    var cols = C.MAP[0].length, rows = C.MAP.length;
    var t = Math.min(600 / cols, 400 / rows);
    return { t: t, ox: (600 - cols * t) / 2, oy: (400 - rows * t) / 2 };
  }

  var views = {};
  function view(name) {
    if (!views[name]) views[name] = $('#tv-view-' + name);
    return views[name];
  }
  function show(name) {
    ['plan', 'room', 'module', 'tchatche', 'rank', 'jail'].forEach(function (v) {
      view(v).classList.toggle('is-on', v === name);
    });
  }

  /* ------------------------------------------------------------ the room */
  function figure(x, y, fill, facing) {
    var cx = x * T + T / 2, cy = y * T + T / 2, s = '';
    if (facing) {
      var v = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[facing];
      var p = [v[1], v[0]];
      s += '<path d="M' + (cx + v[0] * 20) + ' ' + (cy + v[1] * 20) +
           ' L' + (cx + v[0] * 11 + p[0] * 8) + ' ' + (cy + v[1] * 11 + p[1] * 8) +
           ' L' + (cx + v[0] * 11 - p[0] * 8) + ' ' + (cy + v[1] * 11 - p[1] * 8) + ' Z"' +
           ' fill="' + fill + '" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/>';
    }
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="11" fill="' + fill + '" stroke="var(--ink)" stroke-width="2"/>';
    s += '<circle cx="' + cx + '" cy="' + (cy - 3) + '" r="4" fill="var(--ink)"/>';
    return s;
  }

  /* FLOOR-PLAN RENDERING.
     The first version drew every wall as its own bordered square, which gave a
     dense lattice of outlines — at couch distance that reads as noise, not as
     a building. What you actually need to see is the SHAPE of the rooms, so
     the floor is filled and the walls are drawn only as edges on the boundary
     of that floor: one continuous outline per room and nothing inside it.

     Three tones carry the fog: unseen is the bare field, walked-and-remembered
     is a flat mid, and what he can see this instant is clearly brighter. */
  function renderRoom() {
    var S = E.S, vis = E.visibleSet(), M = metrics();
    T = M.t;
    var night = S.blackout;
    var EDGE = night ? 'var(--zinc)' : 'var(--map-edge)';
    /* Rooms carry their own floor tone. In the blackout they do not — the night
       exception is absolute, and a tinted floor would say "this is the vault"
       at the exact moment the sequence is about him not knowing where he is. */
    function floorFill(x, y, lit) {
      if (night) return lit ? '#18222E' : 'var(--night-2)';
      var r = E.roomAt(x, y), tint = (r && r.tint) || 'neutral';
      return 'var(--floor-' + tint + (lit ? '-lit' : '') + ')';
    }
    view('room').classList.toggle('is-night', night);

    /* part of the walkable shape he knows about. A locked door is wall. */
    function open(x, y) {
      if (!S.seen[x + ',' + y]) return false;
      var ch = E.charAt(x, y);
      if (ch === '#' || ch === 'L') return false;
      var d = E.doorAt(x, y);
      return !(d && d.locked);
    }

    var floors = '', dots = '', edges = '';
    for (var y = 0; y < C.MAP.length; y++) {
      for (var x = 0; x < C.MAP[y].length; x++) {
        if (!open(x, y)) continue;
        var lit = !!vis[x + ',' + y], px = x * T, py = y * T;
        floors += '<rect x="' + px + '" y="' + py + '" width="' + (T + 0.5) + '" height="' + (T + 0.5) +
                  '" fill="' + floorFill(x, y, lit) + '"/>';
        if (lit) {
          dots += '<circle cx="' + (px + T / 2) + '" cy="' + (py + T / 2) + '" r="1.6" fill="' + EDGE + '" opacity=".35"/>';
        }
        /* an edge wherever the floor stops — that is the wall */
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (v) {
          if (open(x + v[0], y + v[1])) return;
          var x1 = px + (v[0] > 0 ? T : 0), y1 = py + (v[1] > 0 ? T : 0);
          var x2 = x1 + (v[0] === 0 ? T : 0), y2 = y1 + (v[1] === 0 ? T : 0);
          edges += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
                   '" stroke="' + EDGE + '" stroke-width="2.5" stroke-linecap="square" opacity="' +
                   (lit ? 0.95 : 0.5) + '"/>';
        });
      }
    }
    /* THE FOOTPRINT OF THE BUILDING, faint, and the one thing on this screen
       Assane has not walked. The television draws only what he perceives, so
       the explored fragment used to float in an empty black field with nothing
       to register it against — you could not tell from the picture whether he
       was in the north wing or the south. The fragment was always at its true
       position; there was simply no frame to read it in, and Benjamin's plan
       has a border while this had none.
       It gives away the outside dimensions of a building he is standing inside,
       and nothing else: no rooms, no walls, no guards, no contents. */
    var cols = C.MAP[0].length, rows = C.MAP.length;
    var shell = '<rect x="0" y="0" width="' + (cols * T) + '" height="' + (rows * T) + '" rx="3"' +
                ' fill="var(--map-edge)" fill-opacity="' + (night ? 0.02 : 0.04) + '"' +
                ' stroke="' + EDGE + '" stroke-opacity="' + (night ? 0.14 : 0.26) + '" stroke-width="2"/>';

    var svg = shell + floors + dots + edges;

    /* doors: a locked one is a bar across the gap, an open one a swing arc */
    S.doors.forEach(function (d) {
      if (!S.seen[d.x + ',' + d.y]) return;
      var px = d.x * T, py = d.y * T, lit = !!vis[d.x + ',' + d.y];
      if (d.locked) {
        svg += '<rect x="' + (px + 4) + '" y="' + (py + T / 2 - 4) + '" width="' + (T - 8) + '" height="8" rx="2"' +
               ' fill="' + EDGE + '" opacity="' + (lit ? 0.95 : 0.5) + '"/>';
      } else {
        svg += '<path d="M' + (px + 5) + ' ' + (py + T - 5) + ' A' + (T - 10) + ' ' + (T - 10) + ' 0 0 1 ' +
               (px + T - 5) + ' ' + (py + 5) + '" fill="none" stroke="' + EDGE +
               '" stroke-width="2" opacity="' + (lit ? 0.7 : 0.3) + '"/>';
      }
    });

    /* what is worth crossing a room for */
    C.MODULES.forEach(function (m) {
      if (!S.seen[m.x + ',' + m.y]) return;
      var lit = !!vis[m.x + ',' + m.y], done = S.solved[m.id];
      var px = m.x * T, py = m.y * T, pad = 6;
      svg += '<rect x="' + (px + pad) + '" y="' + (py + pad) + '" width="' + (T - pad * 2) + '" height="' + (T - pad * 2) +
             '" rx="3" fill="' + (done ? 'var(--gold)' : 'var(--map-void)') +
             '" stroke="' + (done ? 'var(--gold)' : EDGE) + '" stroke-width="2" opacity="' + (lit ? 1 : 0.55) + '"/>' +
             '<g opacity="' + (lit ? 1 : 0.55) + '" color="' + (done ? 'var(--on-gold)' : EDGE) +
             '" transform="translate(' + (px + pad + 2) + ',' + (py + pad + 2) + ') scale(' + ((T - pad * 2 - 4) / 100) + ')">' +
             G.iconMarkup(m.icon) + '</g>';
    });

    /* the way out */
    (function () {
      for (var y = 0; y < C.MAP.length; y++) {
        var x = C.MAP[y].indexOf('E');
        if (x < 0) continue;
        if (!S.seen[x + ',' + y]) return;
        var lit = !!vis[x + ',' + y];
        svg += '<path d="M' + (x * T + 10) + ' ' + (y * T + T - 7) + ' L' + (x * T + 10) + ' ' + (y * T + 17) +
               ' A' + (T / 2 - 10) + ' ' + (T / 2 - 10) + ' 0 0 1 ' + (x * T + T - 10) + ' ' + (y * T + 17) +
               ' L' + (x * T + T - 10) + ' ' + (y * T + T - 7) + '"' +
               ' fill="none" stroke="var(--gold)" stroke-width="2.5" opacity="' + (lit ? 1 : 0.55) + '"/>';
      }
    })();

    /* Cameras and guards appear ONLY where Assane can see them, and never in
       the dark. Their cones never appear here at all — those are P2's. */
    S.cameras.forEach(function (c) {
      if (night) return;
      if (!vis[c.x + ',' + c.y]) return;
      var on = !!E.cameraDir(c);
      svg += '<circle cx="' + (c.x * T + T / 2) + '" cy="' + (c.y * T + T / 2) + '" r="7" fill="' +
             (on ? 'var(--red)' : 'var(--map-void)') + '" stroke="' + EDGE + '" stroke-width="2"/>';
    });
    S.guards.forEach(function (g) {
      if (night) return;
      var p = g.path[g.at];
      if (!vis[p.x + ',' + p.y]) return;
      svg += figure(p.x, p.y, 'var(--red)', g.facing);
    });

    svg += figure(S.assane.x, S.assane.y, 'var(--gold)', null);
    if (S.grace > 0) {
      svg += '<circle cx="' + (S.assane.x * T + T / 2) + '" cy="' + (S.assane.y * T + T / 2) +
             '" r="17" fill="none" stroke="var(--gold)" stroke-width="2" stroke-dasharray="4 4"/>';
    }
    if (S.hasManuscript) {
      svg += '<g color="var(--gold)" transform="translate(' + (S.assane.x * T + T - 16) + ',' + (S.assane.y * T + 2) +
             ') scale(0.14)">' + G.iconMarkup('manu') + '</g>';
    }

    /* WHERE HE IS, on him.
       This used to be printed at x=12 y=26 — the corner of the screen, pinned
       outside the map group, as far from the man it described as the frame
       allows. It read as a title for the television rather than as a label for
       the room, and it was the ONLY link between this screen and Benjamin's.
       It rides with Assane now and it carries his square as well, because
       those two words — the room name and the coordinate — are exactly what
       the plan on Benjamin's phone is labelled and ruled with.
       Not in the blackout. Not knowing which room he is standing in is the
       whole point of that sequence; there, the feeds are the anchor. */
    var label = '';
    if (!night) {
      var room = E.roomAt(S.assane.x, S.assane.y);
      var here = (room ? room.name : 'UNMARKED') + '  ·  ' + E.coordOf(S.assane.x, S.assane.y);
      var lw = here.length * 8.4 + 22;
      var lx = Math.max(lw / 2 + 2, Math.min(cols * T - lw / 2 - 2, S.assane.x * T + T / 2));
      var ly = S.assane.y * T - 15;
      if (ly < 16) ly = S.assane.y * T + T + 25;
      label =
        '<rect x="' + (lx - lw / 2) + '" y="' + (ly - 15) + '" width="' + lw + '" height="21" rx="4"' +
        ' fill="var(--map-void)" fill-opacity=".92" stroke="' + EDGE + '" stroke-opacity=".55" stroke-width="1.5"/>' +
        '<text x="' + lx + '" y="' + ly + '" text-anchor="middle" font-size="12" letter-spacing="2.2"' +
        ' font-weight="500" font-family="var(--font)" fill="var(--map-edge)">' + here + '</text>';
    }

    $('#room-svg').innerHTML =
      '<g transform="translate(' + M.ox + ',' + M.oy + ')">' + svg + label + '</g>';

    var t = $('#room-toast');
    if (S.toast && Date.now() - S.toast.at < 1100) {
      t.textContent = S.toast.text;
      t.className = 'room__toast is-on' + (S.toast.kind === 'bad' ? ' is-bad' : S.toast.kind === 'good' ? ' is-good' : '');
    } else {
      t.className = 'room__toast';
    }
  }

  /* ------------------------------------------------------------ other views */
  var planArtShown = null;
  function renderPlan() {
    var S = E.S, ol = $('#plan-beats');
    /* rebuilt on every job change, not just once — the venue, the briefing and
       the establishing shot all belong to the contract */
    if (planArtShown !== C.venueArt) {
      planArtShown = C.venueArt;
      var bg = $('#plan-bg');
      U.clear(bg);
      bg.appendChild(U.artSlot(C.venueArt));
      U.clear(ol);
      C.BEATS.forEach(function (b) { ol.appendChild(U.el('li', { text: b })); });
      $('#plan-job').textContent = C.contract;
      $('#plan-target').textContent = C.target;
    }
    $('#lamp-p1').classList.toggle('is-ready', S.ready.p1);
    $('#lamp-p2').classList.toggle('is-ready', S.ready.p2);
  }

  var CLAVIER_TILE = { id: 'clavier', name: 'LE CLAVIER', icon: 'lock' };

  function renderModule() {
    var S = E.S;
    var m = S.moduleId === 'clavier' ? CLAVIER_TILE
          : C.MODULES.filter(function (x) { return x.id === S.moduleId; })[0];
    if (!m) return;
    view('module').classList.toggle('is-night', S.moduleId === 'clavier');
    var icon = $('#modstate-icon');
    U.clear(icon); icon.appendChild(G.icon(m.icon));
    $('#modstate-name').textContent = m.name;

    var pips = $('#modstate-pips'); U.clear(pips);
    var line = '';
    if (S.moduleId === 'coffre') {
      var wrong = S.coffreEntry.length === 4 && !S.coffreEntry.every(function (g, i) { return g === C.COFFRE.code[i]; });
      for (var i = 0; i < 4; i++) {
        pips.appendChild(U.el('i', { class: i < S.coffreEntry.length ? (wrong ? 'is-bad' : 'is-set') : '' }));
      }
      line = S.solved.coffre ? 'The safe swings open.'
           : wrong ? 'Nothing. The mechanism resets itself.'
           : 'The dial turns. Four notches.';
    } else if (S.moduleId === 'deguisement') {
      ['head', 'torso', 'legs'].forEach(function (k) {
        pips.appendChild(U.el('i', { class: S.outfit && S.outfit[k] ? 'is-set' : '' }));
      });
      line = S.solved.deguisement ? 'He looks like somebody who works here.'
           : 'A rack. Nine pieces. Nothing is labelled.';
    } else if (S.moduleId === 'ecoute') {
      C.ECOUTE.transmission.forEach(function (p, i) {
        pips.appendChild(U.el('i', { class: S.solved.ecoute ? 'is-set' : '' }));
      });
      line = S.solved.ecoute ? 'A camera somewhere stops seeing.'
           : 'A line, live. Five pulses, over and over.';
    } else if (S.moduleId === 'faux') {
      pips.appendChild(U.el('i', { class: S.solved.faux ? 'is-set' : '' }));
      line = !S.solved.faux ? 'Two canvases. One crate. Only one leaves.'
           : S.loot.tableau ? 'The real one goes with him.'
           : 'He takes the forgery. He does not know it yet.';
    } else if (S.moduleId === 'clavier') {
      for (var d = 0; d < 4; d++) {
        pips.appendChild(U.el('i', { class: d < S.clavierEntry.length ? 'is-set' : '' }));
      }
      line = S.solved.clavier ? 'The door opens onto the street.'
           : 'A fire door. Three keys worn smooth.';
    } else {
      for (var j = 0; j < 2; j++) pips.appendChild(U.el('i', { class: j < S.bureauStep ? 'is-set' : '' }));
      line = S.solved.bureau ? 'Somewhere, a lock gives.'
           : S.bureauStep ? 'The computer is open. One door to release.'
           : 'A security post. It wants a code.';
    }
    $('#modstate-line').textContent = line;
  }

  function renderTchatche() {
    var S = E.S, t = S.tchatche;
    if (!t) return;
    var r = $('#tch-rounds'); U.clear(r);
    for (var i = 0; i < 3; i++) {
      r.appendChild(U.el('i', { class: i < t.round ? 'is-won' : '' }));
    }
    var s = $('#tch-line');
    s.textContent = t.strikes === 0
      ? 'He is not moving. He is waiting to hear what you say.'
      : 'He is looking at you differently now. One more slip and it is over.';
    $('#tch-spark').style.opacity = t.strikes ? 0.4 : 1;
  }

  function renderRank() {
    var S = E.S, r = E.rank();
    $('#rank-grade').textContent = r.g;
    $('.rankcard__foot').textContent = C.contract + '  ·  ' + C.venue;
    $('#rank-title').textContent = r.t;
    var dl = $('#rank-stats'); U.clear(dl);
    /* The letter is stealth and only stealth. Greed is scored separately, on
       its own line — taking the canvas costs turns and risk, and the pair
       decides whether that trade was worth it. */
    var butin = (S.loot.manuscrit ? 1 : 0) + (S.loot.tableau ? 1 : 0);
    [['TIME', U.mmss(S.elapsed)],
     ['MOVES', S.turn],
     ['SUSPICION', S.suspicion + ' / 100'],
     ['SPOTTED', S.spotted + '×'],
     ['DISGUISED', S.disguised ? 'YES' : 'NO'],
     ['TAKE', butin + ' / 2' + (S.solved.faux && !S.loot.tableau ? '  (the forgery)' : '')]
    ].forEach(function (row) {
      dl.appendChild(U.el('dt', { text: row[0] }));
      dl.appendChild(U.el('dd', { text: String(row[1]) }));
    });
  }

  /* ------------------------------------------------------------ frame */
  var PHASE_LABEL = { plan: 'LE PLAN', play: 'L’INFILTRATION', module: 'LES MODULES',
                      tchatche: 'LA TCHATCHE', rank: 'LA SORTIE', jail: 'CAUGHT' };

  function render() {
    var S = E.S;
    var inDark = !!S.blackout && S.phase !== 'rank' && S.phase !== 'jail';
    $('#tv-phase').textContent = inDark ? 'LE BLACKOUT'
      : S.hasManuscript && S.phase === 'play' ? 'LA SORTIE'
      : PHASE_LABEL[S.phase];
    $('#tv-phase').classList.toggle('is-night', inDark);
    $('#tv-venue').textContent = C.job.venue;
    $('#tv-clock').textContent = U.mmss(S.elapsed);
    $('#tv-objective').textContent = S.objective;
    $('#suspicion-fill').style.width = S.suspicion + '%';
    $('#suspicion-num').textContent = S.suspicion;

    /* Hold on the cut for a beat before revealing the dark room. This is the
       twist landing, and in a room full of people it needs a moment to breathe. */
    var cutting = !!S.blackoutAt && (Date.now() - S.blackoutAt) < 1800;
    $('#tv-cut').classList.toggle('is-on', cutting);

    if (S.phase === 'plan') { show('plan'); renderPlan(); }
    else if (S.phase === 'play') { show('room'); renderRoom(); }
    else if (S.phase === 'module') { show('module'); renderModule(); }
    else if (S.phase === 'tchatche') { show('tchatche'); renderTchatche(); }
    else if (S.phase === 'rank') { show('rank'); renderRank(); }
    else if (S.phase === 'jail') { show('jail'); }
  }

  L.tv = { render: render };
})(window.DC);
