/* engine.js — game state and rules.
   DESIGN LAW #3: movement is discrete and turn-based. Guards move when you move.
   Board state N -> player acts -> patrols advance -> board state N+1.
   Nothing happens between inputs, which is also why a game shaped like this
   cannot stutter on a stream. */
(function (L) {
  'use strict';
  var C = L.content, U = L.util;

  var DIRV = { N: { x: 0, y: -1 }, S: { x: 0, y: 1 }, E: { x: 1, y: 0 }, W: { x: -1, y: 0 } };
  var PERP = { N: { x: 1, y: 0 }, S: { x: 1, y: 0 }, E: { x: 0, y: 1 }, W: { x: 0, y: 1 } };

  var S = null;

  /* ---------------------------------------------------------------- setup */
  function entryTile() {
    for (var y = 0; y < C.MAP.length; y++) {
      var x = C.MAP[y].indexOf('E');
      if (x >= 0) return { x: x, y: y };
    }
    return { x: 1, y: 1 };
  }

  /* Two patrol shapes. from/to is a straight beat walked back and forth —
     job 1's corridor guards. waypoints + loop is a closed circuit walked one
     way forever, which is job 2's ring: predictable enough for Benjamin to
     count him out, and it always comes back round. */
  function guardPath(g) {
    var pts = [], x, y, dx, dy, i, a, b;
    if (g.waypoints) {
      var w = g.waypoints, segs = g.loop ? w.length : w.length - 1;
      for (i = 0; i < segs; i++) {
        a = w[i]; b = w[(i + 1) % w.length];
        dx = Math.sign(b.x - a.x); dy = Math.sign(b.y - a.y);
        x = a.x; y = a.y;
        while (x !== b.x || y !== b.y) { pts.push({ x: x, y: y }); x += dx; y += dy; }
      }
      if (!g.loop) pts.push({ x: w[w.length - 1].x, y: w[w.length - 1].y });
      return pts;
    }
    dx = Math.sign(g.to.x - g.from.x); dy = Math.sign(g.to.y - g.from.y);
    x = g.from.x; y = g.from.y;
    pts.push({ x: x, y: y });
    while (x !== g.to.x || y !== g.to.y) { x += dx; y += dy; pts.push({ x: x, y: y }); }
    return pts;
  }

  function reset() {
    S = {
      phase: 'plan',
      ready: { p1: false, p2: false },
      assane: entryTile(),
      guards: C.GUARDS.map(function (g) {
        return { id: g.id, badge: g.badge, depth: g.depth, path: guardPath(g),
                 at: g.at, dir: g.dir, loop: !!g.loop, facing: 'E', alert: 0 };
      }),
      cameras: C.CAMERAS.map(function (c) { return { id: c.id, x: c.x, y: c.y, depth: c.depth, cycle: c.cycle, label: c.label }; }),
      doors: C.DOORS.map(function (d) { return { x: d.x, y: d.y, locked: d.locked, mark: d.mark, to: d.to }; }),
      camPhase: 0,
      turn: 0,
      elapsed: 0,
      running: false,
      suspicion: 0,
      spotted: 0,
      grace: 0,
      seen: {},
      hasManuscript: false,
      moduleId: null,
      solved: { bureau: false, coffre: false, clavier: false, deguisement: false, faux: false, ecoute: false },
      cutCameras: {},          /* circuits Benjamin talked him through cutting */
      porteEntry: '', porteFails: 0,
      unlocked: {},            /* which dossier tabs Benjamin has earned */
      declined: {},            /* optional modules he has chosen to walk past */
      disguised: false,        /* out of uniform every cone reaches further */
      loot: { manuscrit: false, tableau: false },
      outfit: { head: null, torso: null, legs: null },
      fauxLeftIsGenuine: Math.random() < 0.5,   /* re-rolled every job */
      blackout: false,         /* Le Twist. Set when the safe opens. */
      noise: null,             /* where the last run was heard */
      clavierEntry: '',
      bureauStep: 0,           /* 0 = keypad, 1 = door release */
      coffreEntry: [],
      coffreFails: 0,
      tchatche: null,
      sense: '',
      toast: null,
      objective: 'Study the plan. Both players ready up.'
    };
    S.guards.forEach(function (g) { g.facing = faceOf(g); });
    markSeen();
    return S;
  }

  function faceOf(g) {
    var a = g.path[g.at], b;
    if (g.loop) b = g.path[(g.at + 1) % g.path.length];
    else b = g.path[g.at + g.dir] || g.path[g.at - g.dir];
    if (!b) return 'E';
    if (b.x > a.x) return 'E'; if (b.x < a.x) return 'W';
    if (b.y > a.y) return 'S'; return 'N';
  }

  /* ---------------------------------------------------------------- board */
  function charAt(x, y) {
    if (y < 0 || y >= C.MAP.length) return '#';
    if (x < 0 || x >= C.MAP[y].length) return '#';
    return C.MAP[y][x];
  }
  function doorAt(x, y) {
    for (var i = 0; i < S.doors.length; i++) if (S.doors[i].x === x && S.doors[i].y === y) return S.doors[i];
    return null;
  }
  /* a locked door is a wall — for walking AND for line of sight */
  function isWall(x, y) {
    var c = charAt(x, y);
    if (c === '#' || c === 'L') return true;   /* L is a laser line: solid, and never opens */
    var d = doorAt(x, y);
    if (d) return d.locked;
    return false;
  }
  /* ONE ADDRESS FOR A SQUARE, shared by both displays.
     Columns A-O across, rows 1-N down, counted from the outer wall so the
     letter is just the x index and no arithmetic happens anywhere. Benjamin's
     plan is ruled with it and the television prints Assane's square, which
     makes it the only literal thing the two screens have in common: "he is at
     G9" instead of "he is by the doorway — no, the other doorway". */
  function coordOf(x, y) { return String.fromCharCode(65 + x) + (y + 1); }
  function roomAt(x, y) {
    for (var i = 0; i < C.ROOMS.length; i++) {
      var r = C.ROOMS[i];
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r;
    }
    return null;
  }
  function moduleAt(x, y) {
    for (var i = 0; i < C.MODULES.length; i++) if (C.MODULES[i].x === x && C.MODULES[i].y === y) return C.MODULES[i];
    return null;
  }
  /* A cut camera is dead everywhere at once — it stops watching AND it shows
     as dark on Player 2's plan, because both read through this one function. */
  function cameraDir(cam) {
    if (S.cutCameras[cam.id]) return null;
    return cam.cycle[S.camPhase % cam.cycle.length];
  }

  /* ---------------------------------------------------------------- vision */
  function cone(x, y, dir, depth) {
    var out = [];
    if (!dir) return out;
    var v = DIRV[dir], p = PERP[dir];
    for (var d = 1; d <= depth; d++) {
      var cx = x + v.x * d, cy = y + v.y * d;
      if (isWall(cx, cy)) break;
      for (var s = -(d - 1); s <= (d - 1); s++) {
        var tx = cx + p.x * s, ty = cy + p.y * s;
        if (!isWall(tx, ty)) out.push(tx + ',' + ty);
      }
    }
    return out;
  }

  /* In the dark a guard carries a torch: it reaches further than an idle
     glance, and further still when he has heard something. */
  /* Out of uniform, every guard looks one tile further — you read as someone
     who should not be here. Wearing the right thing does not make the building
     easier than normal, it stops you making it harder. */
  function coneDepth(g) {
    var base = S.blackout ? C.BLACKOUT.torchDepth + (g.alert > 0 ? 1 : 0) : g.depth;
    return base + (S.disguised ? 0 : C.DEGUISEMENT.conePenalty);
  }

  /* every tile currently watched, and by whom — this is what P2's phone draws
     and what the TV must never show */
  function threat() {
    var map = {};
    S.guards.forEach(function (g) {
      var p = g.path[g.at];
      cone(p.x, p.y, g.facing, coneDepth(g)).forEach(function (k) { (map[k] = map[k] || []).push(g.id); });
    });
    /* the cameras are down in a blackout — emergency power runs the feeds on
       P2's phone for looking, not for catching */
    if (!S.blackout) {
      S.cameras.forEach(function (c) {
        cone(c.x, c.y, cameraDir(c), c.depth).forEach(function (k) { (map[k] = map[k] || []).push(c.id); });
      });
    }
    return map;
  }

  /* ------------------------------------------------- blackout camera feeds */
  function zoneOf(x, y) {
    var zs = C.BLACKOUT.zones;
    for (var i = 0; i < zs.length; i++) {
      var z = zs[i];
      if (x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h) return z.id;
    }
    return null;
  }
  /* two of four, cycling every turn — so Benjamin loses him too */
  function liveZones() {
    var c = C.BLACKOUT.feedCycle;
    return c[S.camPhase % c.length];
  }
  function seesAssane() {
    return liveZones().indexOf(zoneOf(S.assane.x, S.assane.y)) >= 0;
  }

  /* what Assane can see: flood fill through open tiles, plus the walls that
     bound them, so the TV shows the shape of the room he is standing in */
  function visibleSet(range) {
    range = range || 3;
    var out = {}, q = [{ x: S.assane.x, y: S.assane.y, d: 0 }], seenq = {};
    seenq[S.assane.x + ',' + S.assane.y] = true;
    while (q.length) {
      var n = q.shift();
      out[n.x + ',' + n.y] = true;
      if (n.d >= range) continue;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (v) {
        var nx = n.x + v[0], ny = n.y + v[1], k = nx + ',' + ny;
        if (seenq[k]) return;
        seenq[k] = true;
        if (isWall(nx, ny)) { out[k] = true; return; }   /* see the wall, stop there */
        q.push({ x: nx, y: ny, d: n.d + 1 });
      });
    }
    return out;
  }
  function markSeen() {
    var v = visibleSet();
    for (var k in v) S.seen[k] = true;
  }

  /* ---------------------------------------------------------------- turn */
  function dirToward(a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'E' : 'W';
    return dy >= 0 ? 'S' : 'N';
  }

  function advanceGuards() {
    S.guards.forEach(function (g) {
      /* a guard who has heard something stops walking and turns to look —
         which is exactly why running is expensive */
      if (g.alert > 0) {
        g.alert--;
        if (S.noise) g.facing = dirToward(g.path[g.at], S.noise);
        return;
      }
      if (g.loop) {
        g.at = (g.at + 1) % g.path.length;   /* a circuit never turns back */
      } else {
        var next = g.at + g.dir;
        if (next < 0 || next >= g.path.length) { g.dir *= -1; next = g.at + g.dir; }
        g.at = next;
      }
      g.facing = faceOf(g);
    });
    S.camPhase++;
  }

  /* Walking is silent. Running is not. */
  function makeNoise() {
    S.noise = { x: S.assane.x, y: S.assane.y };
    var best = null, bd = 99;
    S.guards.forEach(function (g) {
      var p = g.path[g.at], d = Math.abs(p.x - S.assane.x) + Math.abs(p.y - S.assane.y);
      if (d < bd) { bd = d; best = g; }
    });
    if (best && bd <= 8) best.alert = 2;
  }

  function senseLine() {
    /* In the blackout his phone has stopped telling him anything at all.
       These lines are flavour, never information — that is the sequence. */
    if (S.blackout) return C.STATIC_LINES[S.turn % C.STATIC_LINES.length];
    var a = S.assane, best = null, bestD = 99;
    S.guards.forEach(function (g) {
      var p = g.path[g.at], d = Math.abs(p.x - a.x) + Math.abs(p.y - a.y);
      if (d < bestD) { bestD = d; best = { p: p, kind: 'guard' }; }
    });
    var t = threat(), adjacent = false;
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      if (t[(a.x + dx) + ',' + (a.y + dy)]) adjacent = true;
    }
    if (adjacent) return 'The hair goes up on the back of your neck. <em>Something is looking this way.</em>';
    if (best && bestD <= 3) return 'Footsteps. <em>Close.</em> ' + bearing(best.p, a) + ' of you.';
    if (best && bestD <= 6) return 'Footsteps somewhere ' + bearing(best.p, a).toLowerCase() + '. Unhurried.';
    var near = S.cameras.some(function (c) {
      return cameraDir(c) && Math.abs(c.x - a.x) + Math.abs(c.y - a.y) <= 4;
    });
    if (near) return 'A servo turning. <em>Small, dry, above you.</em>';
    return C.AMBIENT[S.turn % C.AMBIENT.length];
  }
  function bearing(p, a) {
    var dx = p.x - a.x, dy = p.y - a.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'RIGHT' : 'LEFT';
    return dy > 0 ? 'BEHIND' : 'AHEAD';
  }

  /* one action = one tick. Move, run, or hold still — all three are real moves.

     RUN and FIGE-TOI exist only in the blackout, and neither is a skill check:
     running is a decision with a cost (noise), and freezing is a decision with
     a cost (a turn). No timing window, no gesture, nothing to fumble. */
  function act(dx, dy, opts) {
    opts = opts || {};
    if (S.phase !== 'play') return { ok: false };

    var crossed = [];
    if (dx || dy) {
      var n1 = { x: S.assane.x + dx, y: S.assane.y + dy };
      if (isWall(n1.x, n1.y)) {
        var d = doorAt(n1.x, n1.y);
        toast(d ? 'LOCKED' : 'WALL', 'bad');
        U.sfx.block();
        return { ok: false, blocked: true };
      }
      crossed.push(n1);
      if (opts.run) {
        var n2 = { x: n1.x + dx, y: n1.y + dy };
        if (!isWall(n2.x, n2.y)) crossed.push(n2);
      }
      S.assane = crossed[crossed.length - 1];
      U.sfx.step();
      if (opts.run) { toast('NOISE', 'bad'); U.sfx.block(); }
    } else {
      toast(opts.freeze ? 'FROZEN' : 'HOLD', null);
      U.sfx.tap();
    }

    S.turn++;
    advanceGuards();
    markSeen();
    if (S.grace > 0) S.grace--;
    if (opts.run) makeNoise();

    var t = threat();

    /* a run crosses two tiles, and both of them count — that is the risk */
    var caught = null;
    (crossed.length ? crossed : [S.assane]).forEach(function (k) {
      if (!caught && t[k.x + ',' + k.y]) caught = t[k.x + ',' + k.y][0];
    });

    if (caught && S.grace === 0 && !opts.freeze) { getSpotted(caught); return { ok: true, spotted: true }; }
    /* frozen, with the beam going straight over him. Not caught. Not nothing. */
    if (caught && opts.freeze) S.suspicion = U.clamp(S.suspicion + 3, 0, 100);

    /* Near miss: a cone passed within arm's reach. Orthogonal only, and only
       +1 — in a two-tile corridor a diagonal test fires nearly every turn, which
       made an S rank ("ghost: never seen, nothing tripped") unreachable even on
       a flawless run. Suspicion has to stay a score for sloppiness, not a tax
       on being in the building. */
    var brush = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (v) {
      return !!t[(S.assane.x + v[0]) + ',' + (S.assane.y + v[1])];
    });
    if (brush) S.suspicion = U.clamp(S.suspicion + 1, 0, 100);

    S.sense = senseLine();

    /* stepping off a module you walked past re-arms it */
    for (var id in S.declined) {
      var mm = C.MODULES.filter(function (x) { return x.id === id; })[0];
      if (mm && (mm.x !== S.assane.x || mm.y !== S.assane.y)) delete S.declined[id];
    }

    var m = moduleAt(S.assane.x, S.assane.y);
    if (m && !S.solved[m.id] && !S.declined[m.id]) { openModule(m.id); return { ok: true, module: m.id }; }

    if (charAt(S.assane.x, S.assane.y) === 'E' && S.hasManuscript) {
      /* the way out locked itself when the power went */
      if (S.blackout && !S.solved.clavier) { openModule('clavier'); return { ok: true, module: 'clavier' }; }
      finish();
      return { ok: true, done: true };
    }

    return { ok: true };
  }

  function toast(text, kind) { S.toast = { text: text, kind: kind, at: Date.now() }; }

  /* ---------------------------------------------------------------- modules */
  /* A page of the dossier opens when the job needs it and not before.
     Benjamin used to start with every tab in the book, which is four screens
     of reference for a player who has not yet been asked a question. */
  function unlock(k) { S.unlocked[k] = true; }

  function openModule(id) {
    if (id === 'porte') unlock('porte');
    if (id === 'coffre') unlock('manuel');
    if (id === 'bureau' || id === 'clavier') unlock('personnel');
    S.moduleId = id;
    S.phase = 'module';
    S.coffreEntry = [];
    S.clavierEntry = '';
    /* Fresh attempt on every approach. Two bad codes send you to La Tchatche;
       surviving that and coming back must not leave you primed to be caught
       again on the next mistake. Grade, don't fail — the cost is in suspicion
       and the spotted count, which is what the rank card reads. */
    S.coffreFails = 0;
    S.objective = id === 'coffre' ? 'P1 has the dial. P2 has the manual.'
      : id === 'clavier' ? 'P1 can see the worn keys. P2 has the procedure.'
      : id === 'deguisement' ? 'P1 can see the rack. P2 knows whose is whose.'
      : id === 'faux' ? 'P1 has both canvases. P2 has Benjamin\u2019s notes.'
      : id === 'ecoute' ? 'P1 has the line. P2 has to reproduce it before the book will answer.'
      : 'P1 reads the desk. P2 digs the staff files.';
  }
  function closeModule(solvedIt) {
    if (solvedIt) S.solved[S.moduleId] = true;
    S.moduleId = null;
    S.phase = 'play';
    setObjective();
  }

  /* walk away from an optional module without solving it */
  function declineModule() {
    S.declined[S.moduleId] = true;
    S.moduleId = null;
    S.phase = 'play';
    setObjective();
  }

  /* Undo exists because the punishment for a mis-tap was a completed wrong
     sequence: +15 suspicion, and on the second one a guard walks in. That is a
     dexterity penalty in a build whose second design law says every input is an
     answer and never a feat of dexterity. It is only live mid-entry, so it can
     never race the resolve timers. */
  function coffreUndo() {
    if (!S.coffreEntry.length || S.coffreEntry.length >= 4) return;
    S.coffreEntry.pop();
    U.sfx.tap();
  }
  function coffreTap(glyph) {
    if (S.coffreEntry.length >= 4) return;
    S.coffreEntry.push(glyph);
    U.sfx.tap();
    if (S.coffreEntry.length < 4) return;
    var ok = S.coffreEntry.every(function (g, i) { return g === C.COFFRE.code[i]; });
    if (ok) {
      U.sfx.unlock();
      S.hasManuscript = true;
      S.loot.manuscrit = true;
      setTimeout(function () { closeModule(true); startBlackout(); U.emit('render'); }, 900);
    } else {
      U.sfx.bad();
      S.coffreFails++;
      S.suspicion = U.clamp(S.suspicion + 15, 0, 100);
      if (S.coffreFails >= 2) {
        setTimeout(function () { getSpotted('1184'); U.emit('render'); }, 700);
      } else {
        setTimeout(function () { S.coffreEntry = []; U.emit('render'); }, 900);
      }
    }
  }

  /* LE TWIST. The safe opens and the building answers. */
  function startBlackout() {
    S.blackout = true;
    S.blackoutAt = Date.now();
    S.guards.forEach(function (g) { g.alert = 0; });
    /* Cut his screen on the same beat as the lights. Without this the last
       pre-blackout reading ("footsteps, close, left of you") survives into the
       dark and hands him exactly the information the sequence takes away. */
    S.sense = C.STATIC_LINES[0];
    toast('POWER CUT', 'bad');
    U.sfx.jail();
    setObjective();
  }

  function clavierSubmit(code) {
    if (code === C.CLAVIER.code) {
      U.sfx.unlock();
      S.solved.clavier = true;
      setTimeout(function () { S.moduleId = null; finish(); U.emit('render'); }, 900);
      return true;
    }
    U.sfx.bad();
    S.suspicion = U.clamp(S.suspicion + 10, 0, 100);
    return false;
  }

  /* Cutting the wrong circuit is survivable and repeatable — it is a switch,
     not a one-shot — but every wrong guess is paid for in suspicion, so
     brute-forcing all four costs more than listening properly. */
  function ecouteCut(circuit) {
    if (circuit === C.ECOUTE.answer) {
      U.sfx.unlock();
      S.cutCameras[C.ECOUTE.kills] = true;
      setTimeout(function () { closeModule(true); U.emit('render'); }, 900);
      return true;
    }
    U.sfx.bad();
    S.suspicion = U.clamp(S.suspicion + 10, 0, 100);
    return false;
  }

  function deguisementSubmit(outfit) {
    var want = C.UNIFORMS[C.DEGUISEMENT.answerBadge];
    if (outfit.head === want.head && outfit.torso === want.torso && outfit.legs === want.legs) {
      U.sfx.unlock();
      S.disguised = true;
      S.outfit = { head: outfit.head, torso: outfit.torso, legs: outfit.legs };
      setTimeout(function () { closeModule(true); U.emit('render'); }, 900);
      return true;
    }
    U.sfx.bad();
    S.suspicion = U.clamp(S.suspicion + 8, 0, 100);
    return false;
  }

  /* One decision, no retry. Take the wrong canvas and you have carried a
     forgery out of the building — you find out on the rank card. */
  function fauxChoose(pickedGenuine) {
    if (pickedGenuine) {
      U.sfx.unlock();
      S.loot.tableau = true;
    } else {
      U.sfx.bad();
      S.suspicion = U.clamp(S.suspicion + 15, 0, 100);
    }
    setTimeout(function () { closeModule(true); U.emit('render'); }, 900);
    return pickedGenuine;
  }

  /* LA PORTE.
     The ring is a cipher with ten rotations and Benjamin holds nine wrong
     ones. Assane holds the tenth without knowing it, as a mark under the 0 of
     a room number. Everything below is derived from PORTE.zero rather than
     stored, so the puzzle cannot drift out of agreement with itself. */
  function porteRingIndex(sym) { return C.PORTE.ring.indexOf(sym); }
  function porteDigitOf(sym) {
    var n = C.PORTE.ring.length;
    return ((porteRingIndex(sym) - porteRingIndex(C.PORTE.zero)) % n + n) % n;
  }
  function porteSymbolFor(digit) {
    var n = C.PORTE.ring.length;
    return C.PORTE.ring[(porteRingIndex(C.PORTE.zero) + Number(digit)) % n];
  }
  /* what Benjamin's dossier prints: the code, as symbols, in order */
  function porteCodeSymbols() {
    return C.PORTE.code.split('').map(porteSymbolFor);
  }
  function porteTap(d) {
    if (S.porteEntry.length >= C.PORTE.code.length) return;
    S.porteEntry += d;
    U.sfx.tap();
  }
  function porteUndo() {
    if (!S.porteEntry.length) return;
    S.porteEntry = S.porteEntry.slice(0, -1);
    U.sfx.tap();
  }
  function porteSubmit() {
    if (S.porteEntry.length < C.PORTE.code.length) return false;
    if (S.porteEntry === C.PORTE.code) {
      U.sfx.unlock();
      S.doors.forEach(function (d) { if (d.y === 12 || d.mark === 'dbar') d.locked = false; });
      setTimeout(function () { closeModule(true); U.emit('render'); }, 900);
      return true;
    }
    U.sfx.bad();
    S.porteFails++;
    S.suspicion = U.clamp(S.suspicion + 8, 0, 100);
    /* three wrong codes and somebody comes to see who is standing at the door */
    if (S.porteFails >= (C.PORTE.fails || 3)) {
      setTimeout(function () { getSpotted('g1'); U.emit('render'); }, 700);
    } else {
      setTimeout(function () { S.porteEntry = ''; U.emit('render'); }, 900);
    }
    return false;
  }

  /* The object of the whole contract. One confirmation, no puzzle: the lock
     was the door, and the walk back out is the rest of the job. */
  function takePrize() {
    U.sfx.unlock();
    S.hasManuscript = true;
    S.loot.dossier = true;
    setTimeout(function () { closeModule(true); U.emit('render'); }, 800);
  }

  function bureauSubmit(code) {
    if (code === C.BUREAU.answer) { U.sfx.unlock(); S.bureauStep = 1; return true; }
    U.sfx.bad();
    S.suspicion = U.clamp(S.suspicion + 10, 0, 100);
    return false;
  }
  function bureauDoor(mark) {
    if (mark === C.BUREAU.doorMark) {
      U.sfx.unlock();
      S.doors.forEach(function (d) { if (d.mark === mark) d.locked = false; });
      setTimeout(function () { closeModule(true); U.emit('render'); }, 800);
      return true;
    }
    U.sfx.bad();
    S.suspicion = U.clamp(S.suspicion + 10, 0, 100);
    return false;
  }

  /* ---------------------------------------------------------------- spotted */
  function getSpotted(byId) {
    unlock('visages'); unlock('personnel');   /* a face to find means the roster matters now */
    var badge = byId;
    var g = S.guards.filter(function (x) { return x.id === byId; })[0];
    if (g) badge = g.badge;
    if (byId === 'c1' || byId === 'c2') badge = '6620';   /* the desk answers the camera */
    if (!C.DIRT[badge]) badge = '5195';

    S.spotted++;
    S.suspicion = U.clamp(S.suspicion + 20, 0, 100);
    S.phase = 'tchatche';
    S.tchatche = { badge: badge, round: 0, strikes: 0, pick: null, options: rollOptions(badge, 0) };
    S.objective = 'P1 describes the face. P2 finds the crack.';
    U.sfx.spot();
  }

  function rollOptions(badge, round) {
    var correct = C.DIRT[badge][round].t;
    var pool = C.TOPICS.filter(function (t) { return t !== correct; });
    var picks = U.shuffle(pool, S.turn + round * 7 + badge.charCodeAt(3)).slice(0, 2);
    return U.shuffle(picks.concat([correct]), S.turn + round * 3 + 5);
  }

  function tchatchePick(topic) {
    var t = S.tchatche, correct = C.DIRT[t.badge][t.round].t;
    if (topic === correct) {
      U.sfx.good();
      t.last = 'good';   /* the only report either player gets on an exchange */
      t.round++;
      if (t.round >= 3) {
        S.phase = 'play';
        S.grace = 3;                 /* he backs away — two clean beats */
        S.tchatche = null;
        setObjective();
        return { win: true, done: true };
      }
      t.options = rollOptions(t.badge, t.round);
      return { win: true };
    }
    U.sfx.bad();
    t.last = 'bad';
    t.strikes++;
    S.suspicion = U.clamp(S.suspicion + 10, 0, 100);
    if (t.strikes >= 2) { jail(); return { win: false, jail: true }; }
    return { win: false };
  }

  function jail() { S.phase = 'jail'; S.running = false; U.sfx.jail(); }

  /* ---------------------------------------------------------------- end */
  function setObjective() {
    if (S.blackout) S.objective = 'Lights out. His phone is dead. Talk him to the vestibule.';
    else if (S.hasManuscript) S.objective = 'La Sortie. He has the manuscript. Get him out through the vestibule.';
    else if (S.solved.bureau) S.objective = 'La Réserve is open. The safe is waiting.';
    else if (!S.disguised && !S.solved.deguisement) S.objective = 'The cloakroom first — or go in as you are, and be seen from further away.';
    else S.objective = 'Find the security desk. Open La Réserve.';
  }
  function finish() { S.phase = 'rank'; S.running = false; U.sfx.good(); }

  function rank() {
    for (var i = 0; i < C.RANKS.length; i++) if (C.RANKS[i].test(S)) return C.RANKS[i];
    return C.RANKS[C.RANKS.length - 1];
  }

  function begin() {
    S.phase = 'play';
    S.running = true;
    S.sense = senseLine();
    setObjective();
  }

  L.engine = {
    get S() { return S; },
    reset: reset, begin: begin, act: act,
    charAt: charAt, isWall: isWall, doorAt: doorAt, moduleAt: moduleAt, roomAt: roomAt,
    coordOf: coordOf,
    coffreUndo: coffreUndo,
    cone: cone, threat: threat, visibleSet: visibleSet, cameraDir: cameraDir,
    zoneOf: zoneOf, liveZones: liveZones, seesAssane: seesAssane,
    startBlackout: startBlackout, clavierSubmit: clavierSubmit,
    openModule: openModule, closeModule: closeModule, declineModule: declineModule,
    deguisementSubmit: deguisementSubmit, fauxChoose: fauxChoose, ecouteCut: ecouteCut,
    coffreTap: coffreTap, bureauSubmit: bureauSubmit, bureauDoor: bureauDoor,
    porteTap: porteTap, porteUndo: porteUndo, porteSubmit: porteSubmit,
    porteDigitOf: porteDigitOf, porteSymbolFor: porteSymbolFor,
    porteCodeSymbols: porteCodeSymbols, takePrize: takePrize,
    tchatchePick: tchatchePick, rank: rank, setObjective: setObjective
  };
})(window.DC);
