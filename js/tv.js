/* tv.js — "THE ROOM".
   DESIGN LAW #1: the TV keeps no secrets, it holds consequences.
   It draws only what Assane himself can perceive — so Player 2 reading the
   shared screen learns nothing Player 1 could not already tell them, and the
   asymmetry survives. Everyone on the couch can watch it safely. */
(function (L) {
  'use strict';
  var U = L.util, C = L.content, E = L.engine, G = L.glyphs;
  var $ = U.$;

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
  function roomToast() {
    var S = E.S, t = $('#room-toast');
    if (S.toast && Date.now() - S.toast.at < 1100) {
      t.textContent = S.toast.text;
      t.className = 'room__toast is-on' + (S.toast.kind === 'bad' ? ' is-bad' : S.toast.kind === 'good' ? ' is-good' : '');
    } else {
      t.className = 'room__toast';
    }
  }

  /* THE ROOM, IN THE TILE SET.
     The same renderer the artist's bench uses, asked for Assane's view: fog of
     war, guards drawn only where he can actually see them, and no sightlines
     at all — those are Benjamin's and they never appear on the shared screen.
     DESIGN LAW #1 is unchanged by the new art; it is enforced inside the
     renderer, by the view name.

     THE TWO SCREENS ARE ONE GRID. tiles.js names a cell letter + row and so
     does engine.coordOf, so the square under Assane on the television and the
     square Benjamin is reading on his plan are the same string. That is the
     whole alignment: nothing is scaled, offset or re-projected between them,
     and the logical map stays the one in content.js that governs both.

     The floor costs several hundred image tags, so it is rebuilt only when
     something on it has moved. The clock ticks once a second and wants only
     the ring, which lives in the HUD above it. */
  var TW = 300, TH = 290;          /* the tile, in the art's own pixels */
  var floorSig = null, tilesIn = false;
  L.tiles.ready(function () { tilesIn = true; });

  function signature() {
    var S = E.S;
    return [C.id, S.assane.x, S.assane.y, S.facing, S.turn, S.blackout ? 1 : 0,
            Object.keys(S.seen).length,
            S.guards.map(function (g) { return g.at + g.facing; }).join(''),
            S.doors.map(function (d) { return d.locked ? 1 : 0; }).join(''),
            C.MODULES.map(function (m) { return S.solved[m.id] ? 1 : 0; }).join('')].join('|');
  }

  /* what the floor underneath does not carry: the beam he has found, the
     camera in front of him, the name of the room he is in, the clock on him */
  function hudMarkup() {
    var S = E.S, vis = E.visibleSet(), night = !!S.blackout, s = '';
    var EDGE = night ? 'var(--zinc)' : 'var(--map-edge)';

    /* THE FOOTPRINT OF THE BUILDING, faint, and the one thing on this screen
       Assane has not walked. Without it the explored fragment floats in an
       empty field with nothing to register it against, and you cannot tell
       from the picture whether he is in the north wing or the south. It gives
       away the outside dimensions of a building he is standing inside, and
       nothing else: no rooms, no walls, no guards, no contents. */
    var cols = C.MAP[0].length, rows = C.MAP.length;
    s += '<rect x="0" y="0" width="' + (cols * TW) + '" height="' + (rows * TH) + '" rx="26" fill="none"' +
         ' stroke="' + EDGE + '" stroke-opacity="' + (night ? 0.12 : 0.22) + '" stroke-width="10"/>';

    /* NO BEAMS ON THIS SCREEN. They were drawn here once he had stood next to
       one, on the reasoning that he would have heard the hum — but a laser is
       wiring, and wiring is Benjamin's half of the floor. Putting it on the
       television handed the man with the plan a second copy of his own layer
       and took away the reason to ask. He still learns a beam the way the
       building teaches him: by the alarm, if he walks into it. */

    /* the camera he is looking at, and never one across the building */
    if (!night) S.cameras.forEach(function (c) {
      if (!vis[c.x + ',' + c.y]) return;
      var live = !!E.cameraDir(c);
      s += '<circle cx="' + (c.x * TW + TW / 2) + '" cy="' + (c.y * TH + TH / 2) + '" r="' + (TW * 0.15) +
           '" fill="' + (live ? 'var(--red)' : 'var(--map-void)') + '" stroke="' + EDGE + '" stroke-width="11"/>';
    });

    var ax = S.assane.x * TW + TW / 2, ay = S.assane.y * TH + TH * 0.86;

    /* THE PRESSURE, drawn on him. A ring fills over the thirty seconds he is
       allowed to stand still; when it closes it goes red and throbs, and the
       number on the bar starts climbing. It is on the television because the
       television is where the room looks when nothing is happening. */
    if (S.running && S.phase === 'play') {
      var idle = (Date.now() - S.lastActionAt) / 1000, P = C.PRESSURE;
      if (idle >= 3) {
        var r = TW * 0.3, circ = 2 * Math.PI * r, frac = Math.min(idle / P.grace, 1), hot = idle >= P.grace;
        s += '<circle class="pring' + (hot ? ' is-hot' : '') + '" cx="' + ax + '" cy="' + ay + '" r="' + r +
             '" fill="none" stroke="' + (hot ? 'var(--red)' : 'var(--gold)') + '" stroke-width="16" stroke-linecap="round"' +
             ' stroke-dasharray="' + (frac * circ).toFixed(1) + ' ' + circ.toFixed(1) + '"' +
             ' transform="rotate(-90 ' + ax + ' ' + ay + ')"/>';
      }
    }
    if (S.grace > 0) {
      s += '<circle cx="' + ax + '" cy="' + ay + '" r="' + (TW * 0.36) + '" fill="none" stroke="var(--gold)"' +
           ' stroke-width="9" stroke-dasharray="20 16"/>';
    }
    if (S.hasManuscript) {
      s += '<g color="var(--gold)" transform="translate(' + (S.assane.x * TW + TW * 0.6) + ',' + (S.assane.y * TH + 10) +
           ') scale(1.05)">' + G.iconMarkup('manu') + '</g>';
    }

    /* WHERE HE IS, on him. Those two words — the room's name and the square —
       are exactly what Benjamin's plan is labelled and ruled with, so this
       label is the one place the two screens are visibly the same map.
       Not in the blackout: not knowing which room he is standing in is the
       whole point of that sequence, and there the feeds are the anchor. */
    if (!night) {
      var room = E.roomAt(S.assane.x, S.assane.y);
      var here = (room ? room.name : 'UNMARKED') + '  ·  ' + E.coordOf(S.assane.x, S.assane.y);
      var lw = here.length * 60 + 150;
      var lx = Math.max(lw / 2, Math.min(cols * TW - lw / 2, S.assane.x * TW + TW / 2));
      var ly = S.assane.y * TH - 45;
      if (ly < TH * 0.7) ly = S.assane.y * TH + TH + 155;
      s += '<rect x="' + (lx - lw / 2) + '" y="' + (ly - 105) + '" width="' + lw + '" height="146" rx="28"' +
           ' fill="var(--map-void)" fill-opacity=".92" stroke="' + EDGE + '" stroke-opacity=".55" stroke-width="9"/>' +
           '<text x="' + lx + '" y="' + ly + '" text-anchor="middle" font-size="84" letter-spacing="14"' +
           ' font-weight="500" font-family="var(--font)" fill="var(--map-edge)">' + here + '</text>';
    }
    return s;
  }

  /* THE CAMERA. How many tiles tall the window is; the width follows the
     television's shape. Small enough to read faces at couch distance, large
     enough that a corridor's far end is on screen when he steps into it. */
  var CAM_ROWS = 8;
  function frame() {
    var cam = $('#room-cam'), world = $('#room-world');
    var bw = cam.clientWidth, bh = cam.clientHeight;
    if (!bw || !bh) return;
    var cols = C.MAP[0].length, rows = C.MAP.length;
    /* the tile renderer pads the board with one cell all round, so the world
       is two cells bigger than the map in each direction and Assane sits one
       cell in from where his coordinate says */
    var th = bh / CAM_ROWS, tw = th * (TW / TH);
    var ww = (cols + 2) * tw, wh = (rows + 2) * th;
    /* A CUT, NOT A PAN, on the first placement and whenever the board changes
       size: the world starts at the origin, and letting it slide from there is
       a swoop across the building every time the room opens or a contract is
       loaded. Only a step should slide. */
    var jump = world.style.transform === '' || world.style.width !== ww + 'px';
    world.style.width = ww + 'px';
    world.style.height = wh + 'px';
    if (jump) world.style.transition = 'none';
    function place(centre, world_, box) {
      if (world_ <= box) return (box - world_) / 2;        /* it all fits: centre it */
      return Math.max(box - world_, Math.min(0, box / 2 - centre));
    }
    world.style.transform =
      'translate(' + place((E.S.assane.x + 1.5) * tw, ww, bw).toFixed(1) + 'px,' +
                     place((E.S.assane.y + 1.5) * th, wh, bh).toFixed(1) + 'px)';
    if (jump) { void world.offsetWidth; world.style.transition = ''; }
  }
  window.addEventListener('resize', function () { if (E.S) frame(); });

  function renderRoom() {
    var S = E.S, night = !!S.blackout;
    var floor = $('#room-floor'), hud = $('#room-hud');

    /* the monitors are dead. The frame stays — clock, objective, suspicion —
       and the room itself is gone until he is out. */
    $('#room-dead').classList.toggle('is-on', !!S.dark);
    view('room').classList.toggle('is-night', night);
    /* nothing is painted before the wall sheet lands, or the floor draws once
       from the bare rules and visibly corrects itself a moment later */
    if (S.dark || !tilesIn) {
      floor.innerHTML = ''; hud.innerHTML = ''; floorSig = null;
      roomToast();
      return;
    }

    var sig = signature();
    if (sig !== floorSig) {
      floorSig = sig;
      L.tiles.render(floor, { view: 'assane', layers: { vision: false, ui: false, grid: false } });
    }
    /* one viewBox for both, read off the floor rather than recomputed, so the
       HUD cannot drift out of register with the tiles if a map changes size */
    var svg = floor.querySelector('svg');
    if (svg) hud.setAttribute('viewBox', svg.getAttribute('viewBox'));
    hud.innerHTML = hudMarkup();
    frame();

    roomToast();
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
      $('#plan-target').textContent = C.target;
    }
    /* THE ROSTER NUMBER, on the briefing where both players can see it before
       anything starts. The guards stand somewhere else every run; this is the
       number that says which somewhere, and ?seed=<n> plays that one again. */
    /* the eyebrow is one line or it wraps into the title. The venue is already
       in the top bar and the target sits under the title, so all this line has
       to carry is which contract and which shift. */
    $('#plan-job').textContent = C.contract.split(' — ')[0] + '  ·  ROSTER ' + S.seed;
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
    } else if (S.moduleId === 'grille') {
      pips.appendChild(U.el('i', { class: S.solved.grille ? 'is-set' : '' }));
      line = S.solved.grille ? 'The gate swings open.'
           : 'A service gate, padlocked. Three keys on a ring.';
    } else if (S.moduleId === 'clavier') {
      for (var d = 0; d < 4; d++) {
        pips.appendChild(U.el('i', { class: d < S.clavierEntry.length ? 'is-set' : '' }));
      }
      line = S.solved.clavier ? 'The door opens onto the street.'
           : 'A fire door. Three keys worn smooth.';
    } else {
      for (var j = 0; j < 2; j++) pips.appendChild(U.el('i', { class: j < S.bureauStep ? 'is-set' : '' }));
      line = S.moduleId === 'porte'
             ? (S.solved.porte ? 'The lock gives.' : 'A keypad, and a room number beside it.')
           : S.moduleId === 'prize' ? 'The desk. Whatever is on it is what they came for.'
           : S.solved.bureau ? 'Somewhere, a lock gives.'
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
     ['ALERT REACHED', S.alert ? C.ALERT[S.alert - 1].name : 'NEVER'],
     /* out of two only where there is a canvas to be greedy about */
     ['TAKE', butin + ' / ' + (C.FAUX ? 2 : 1) + (S.solved.faux && !S.loot.tableau ? '  (the forgery)' : '')]
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
    /* A BROKEN BEAM OWNS THE SCREEN while it lasts. It is the one event where
       the building is actively coming to him, and it has to read from the
       sofa without anybody looking at the suspicion bar. */
    $('#tv-phase').textContent = S.alarm > 0 && S.phase === 'play' ? 'ALARME · ' + S.alarm
      : inDark ? 'LE BLACKOUT'
      : S.hasManuscript && S.phase === 'play' ? 'LA SORTIE'
      : PHASE_LABEL[S.phase];
    $('#tv-phase').classList.toggle('is-night', inDark);
    $('#tv-venue').textContent = C.job.venue;

    /* TENSION. One overlay across the whole television, red at the edges,
       pulsing — faint and slow at ATTENTIVE, harder and faster at ALERT,
       fastest when the pressure clock is charging or he has been stopped. A
       near miss flares it for a beat; a level change or a spotting flashes it
       full. The heartbeat follows the same number. */
    /* SUSPICION ONLY. The pressure clock used to add a level here, which put
       Assane's private problem on the screen the whole room is watching and
       left the two cues indistinguishable. It has its own vignette on his
       phone now; this one answers to the building. */
    var live = S.phase === 'play' || S.phase === 'module';
    var level = S.phase === 'tchatche' ? 3 : live ? Math.max(S.alarm > 0 ? 3 : 0, Math.min(3, S.alert)) : 0;
    var scr = $('#tv-screen');
    scr.className = 'tv__screen tension-' + level +
      (S.flash && Date.now() - S.flash < 900 ? ' is-flash' : '') +
      (live && S.lastBrush === S.turn && S.turn > 0 ? ' is-near' : '');
    U.heartbeat([0, 1800, 1100, 700][level]);
    /* THE SCORE FOLLOWS THE PRIZE, not the phase: a module is still the job,
       and the tchatche is still whichever half of the night you were in when
       he got stopped. Only having the thing in his hands moves it. */
    U.score(S.phase === 'plan' || S.phase === 'rank' || S.phase === 'jail' ? null
          : S.hasManuscript ? 'escape' : 'infiltration');
    /* fetch the stinger while nothing needs it yet */
    if (S.running) U.warmup();
    $('#tv-clock').textContent = U.mmss(S.elapsed);
    $('#tv-objective').textContent = S.objective;
    $('#suspicion-fill').style.width = S.suspicion + '%';
    $('#suspicion-num').textContent = S.suspicion;
    /* the bar carries the two lines the building changes its behaviour at, and
       the label says which side of them it is on */
    var track = $('.suspicion__track');
    if (!track.querySelector('.suspicion__tick')) {
      C.ALERT.forEach(function (a) {
        track.appendChild(U.el('u', { class: 'suspicion__tick', style: 'left:' + a.at + '%' }));
      });
    }
    var st = $('#suspicion-state');
    var still = S.running && S.phase === 'play' && (Date.now() - S.lastActionAt) / 1000 >= C.PRESSURE.grace;
    st.textContent = still ? 'STANDING STILL · +1 / ' + C.PRESSURE.every + 'S'
                   : S.alert ? C.ALERT[S.alert - 1].name : 'SUSPICION';
    st.classList.toggle('is-alert', S.alert > 0 || still);
    $('#jail-line').textContent = S.jailLine || 'ASSANE IS CAUGHT.';

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
