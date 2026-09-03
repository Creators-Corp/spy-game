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
  /* the escape hatch, if this floor has one — then it is the only way out */
  function hatchTile() {
    for (var y = 0; y < C.MAP.length; y++) {
      var x = C.MAP[y].indexOf('X');
      if (x >= 0) return { x: x, y: y };
    }
    return null;
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

  function leverUses() {
    var u = {};
    (C.LEVIERS || []).forEach(function (l) { u[l.id] = l.uses; });
    return u;
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
      grille: { tried: {} },
      /* Benjamin's levers: how many pulls each has left, and how many of
         Assane's moves the lights and the lasers stay down for */
      levers: { uses: leverUses(), lights: 0, laser: 0, cams: {}, last: null },
      lastActionAt: Date.now(),  /* the pressure clock */
      pressure: 0,             /* suspicion the clock has added and a walk can earn back */
      pressureAdded: 0,
      dark: false,             /* the monitors are dead: TV shows nothing, phones carry it all */
      alert: 0,                /* the building's alert level, 0-2. Only ever rises. */
      alertNote: null,
      flash: 0,                /* the television flares red for a beat */
      lastBrush: -1,           /* the turn a sightline last passed within arm's reach */
      jailLine: null,
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
    if (c === '#') return true;
    if (c === 'L') return !(S && S.levers.laser > 0);   /* a laser line is a wall until Benjamin drops it */
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
    if (S.cutCameras[cam.id] || S.levers.cams[cam.id] > 0) return null;
    return cam.cycle[S.camPhase % cam.cycle.length];
  }

  /* ---------------------------------------------------------------- vision */
  /* WHAT A GUARD SEES: everything within arm's reach, whichever way he is
     facing, plus a straight line ahead of him.

     It used to be a fan that widened by one tile a side per step, so a guard
     four squares away covered nine of them. That is why a corridor could seal
     itself and why solving a module left Assane with nowhere to stand — the
     fan reached round corners it had no business reaching round. A body and a
     sightline is both easier to draw and far easier to read across a room:
     "he is looking north, so do not be north of him, and do not be next to
     him." */
  function cone(x, y, dir, depth) {
    var out = [], ax, ay;
    for (ax = -1; ax <= 1; ax++) {
      for (ay = -1; ay <= 1; ay++) {
        if (!ax && !ay) continue;
        if (!isWall(x + ax, y + ay)) out.push((x + ax) + ',' + (y + ay));
      }
    }
    if (!dir) return out;
    var v = DIRV[dir];
    for (var d = 2; d <= depth + 1; d++) {
      var cx = x + v.x * d, cy = y + v.y * d;
      if (isWall(cx, cy)) break;          /* a wall stops the line dead */
      out.push(cx + ',' + cy);
    }
    return out;
  }

  /* WHAT A CAMERA SEES: a straight line, and nothing beside it. A guard has a
     body and glances sideways; a box on a wall looks where it points. Same
     reach as the guard's line — the square in front of it counts — but no
     ring, because a ring under a camera that switches on every other beat
     made the three squares beneath it a trap: nowhere to step the turn before
     it woke. The scan found sixteen dead states there; a line has none. */
  function sightline(x, y, dir, depth) {
    var out = [], v = DIRV[dir];
    for (var d = 1; d <= depth + 1; d++) {
      var cx = x + v.x * d, cy = y + v.y * d;
      if (isWall(cx, cy)) break;
      out.push(cx + ',' + cy);
    }
    return out;
  }

  /* In the dark a guard carries a torch: it reaches further than an idle
     glance, and further still when he has heard something. */
  /* Out of uniform, every guard looks one tile further — you read as someone
     who should not be here. Wearing the right thing does not make the building
     easier than normal, it stops you making it harder. */
  /* ...and the building's alert level adds a square per step. With the lights
     down nobody sees past arm's length, whatever the alert. */
  function coneDepth(g) {
    /* the power cut is a lights-out, and reads like one: nobody sees past
       arm's length in the dark, whatever the alert level says */
    if (S.levers.lights > 0 || S.blackout) return 0;
    return g.depth + S.alert + (S.disguised ? 0 : C.DEGUISEMENT.conePenalty);
  }

  /* EVERY point of suspicion goes through here, so the building's alert level
     can never drift out of step with the number on the bar. */
  function alertOf(v) {
    var lv = 0;
    C.ALERT.forEach(function (a, i) { if (v >= a.at) lv = i + 1; });
    return lv;
  }
  function raise(n) {
    S.suspicion = U.clamp(S.suspicion + n, 0, 100);
    var lv = alertOf(S.suspicion);
    if (lv > S.alert) {
      S.alert = lv;
      var a = C.ALERT[lv - 1];
      toast('ALERT · ' + a.name, 'bad');
      S.sense = a.line;
      S.alertNote = a.line;   /* read out by the next sense line, whatever else is happening */
      S.flash = Date.now();
      U.sfx.spot();
      U.buzz('both', true);
    }
  }

  /* every tile currently watched, and by whom — this is what P2's phone draws
     and what the TV must never show */
  /* `kind` picks a layer: 'guards' or 'cameras'. Benjamin's plan draws one
     at a time; the engine always checks both. */
  function threat(kind) {
    var map = {};
    if (kind !== 'cameras') S.guards.forEach(function (g) {
      var p = g.path[g.at];
      cone(p.x, p.y, g.facing, coneDepth(g)).forEach(function (k) { (map[k] = map[k] || []).push(g.id); });
    });
    /* the cameras are down in a blackout — emergency power runs the feeds on
       P2's phone for looking, not for catching */
    if (!S.blackout && kind !== 'guards') {
      S.cameras.forEach(function (c) {
        /* A camera that is off, looped or cut sees NOTHING — not even the
           squares under it. cone() always returns the ring round its origin,
           which is a guard's body and has no meaning for a box on a wall; left
           in, every camera watched three tiles permanently whatever its cycle
           said, and the scan flagged them as tiles no phase ever cleared. */
        var d = cameraDir(c);
        if (!d) return;
        sightline(c.x, c.y, d, c.depth).forEach(function (k) { (map[k] = map[k] || []).push(c.id); });
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

  function nearestGuard() {
    var best = null, bd = 99;
    S.guards.forEach(function (g) {
      var p = g.path[g.at], d = Math.abs(p.x - S.assane.x) + Math.abs(p.y - S.assane.y);
      if (d < bd) { bd = d; best = g; }
    });
    return best;
  }

  /* ---------------------------------------------------------------- levers */
  /* Benjamin's verbs. Each is a state change that lands on the board at once
     and then wears off on Assane's moves. Only live during the infiltration:
     with a module open the world is stopped, and a lever pulled into a stopped
     world would be a wasted use with no way to know it. */
  function leverDef(id) {
    return (C.LEVIERS || []).filter(function (l) { return l.id === id; })[0];
  }
  function roomCentre(r) {
    return { x: r.x + Math.floor((r.w - 1) / 2), y: r.y + Math.floor((r.h - 1) / 2) };
  }
  function pullLever(id, roomName) {
    var L = leverDef(id);
    if (!L || S.phase !== 'play' || !(S.levers.uses[id] > 0)) return false;
    var note = L.name;
    if (id === 'lights') {
      S.levers.lights = L.turns;
      note = 'LIGHTS OUT';
      S.sense = 'The corridor lights die. <em>Everything is arm’s length now.</em>';
    } else if (id === 'laser') {
      S.levers.laser = L.turns;
      note = 'LASERS DOWN';
      S.sense = 'A hum in the walls stops. <em>Somewhere, a corridor just opened.</em>';
      markSeen();
    } else if (id === 'camera') {
      var cam = S.cameras.filter(function (c) { return c.id === roomName; })[0];
      if (!cam) return false;
      S.levers.cams[cam.id] = L.turns;
      note = 'LOOPED · ' + cam.label;
      S.sense = 'Somewhere above you a servo stops turning. <em>A camera has gone quiet.</em>';
    }
    S.levers.uses[id]--;
    S.levers.last = { id: id, note: note, at: Date.now() };
    toast(note, 'good');
    U.sfx.good();
    U.buzz('p2');
    raise(L.cost);
    return true;
  }

  function senseLine() {
    /* In the blackout his phone has stopped telling him anything at all.
       These lines are flavour, never information — that is the sequence. */
    if (S.blackout) return C.STATIC_LINES[S.turn % C.STATIC_LINES.length];
    if (S.alertNote) { var note = S.alertNote; S.alertNote = null; return note; }
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
    if (S.levers.lights > 0) return 'The corridor lights are still down. <em>Nobody sees past arm’s length.</em>';
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
    touch();

    var crossed = [];
    if (dx || dy) {
      var n1 = { x: S.assane.x + dx, y: S.assane.y + dy };
      if (isWall(n1.x, n1.y)) {
        var d = doorAt(n1.x, n1.y);
        toast(d ? 'LOCKED' : 'WALL', 'bad');
        U.sfx.block(); U.buzz('p1');
        return { ok: false, blocked: true };
      }
      crossed.push(n1);
      if (opts.run) {
        var n2 = { x: n1.x + dx, y: n1.y + dy };
        if (!isWall(n2.x, n2.y)) crossed.push(n2);
      }
      S.assane = crossed[crossed.length - 1];
      U.sfx.step();
      if (opts.run) { toast('NOISE', 'bad'); U.sfx.block(); U.buzz('p1'); }
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
    if (caught && opts.freeze) raise(3);

    /* Near miss: a cone passed within arm's reach. Orthogonal only, and only
       +1 — in a two-tile corridor a diagonal test fires nearly every turn, which
       made an S rank ("ghost: never seen, nothing tripped") unreachable even on
       a flawless run. Suspicion has to stay a score for sloppiness, not a tax
       on being in the building. */
    var brush = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (v) {
      return !!t[(S.assane.x + v[0]) + ',' + (S.assane.y + v[1])];
    });
    if (brush) { raise(1); S.lastBrush = S.turn; }

    /* a step nobody saw earns back a point the clock added — never more */
    if (crossed.length && S.pressure > 0) {
      S.pressure--;
      /* the alert levels are gates: once the building has crossed one it does
         not uncross it, and the number cannot dip back under the line */
      var floor = S.alert ? C.ALERT[S.alert - 1].at : 0;
      S.suspicion = Math.max(floor, S.suspicion - 1);
    }

    /* Benjamin's levers run on Assane's clock, and they tick AFTER this move
       has been judged — so a lever bought for three moves covers three, and
       the number on Benjamin's phone is exactly the number of moves left.
       Ticking before the check made "three" mean two. The lasers coming back
       on with him standing in the beam is the one way a lever can hurt him,
       and it is the reason that countdown has to be said out loud. */
    if (S.levers.lights > 0) S.levers.lights--;
    if (S.levers.laser > 0) {
      S.levers.laser--;
      if (S.levers.laser === 0) {
        toast('LASERS BACK ON', 'bad');
        U.buzz('both');
        if (charAt(S.assane.x, S.assane.y) === 'L') { getSpotted(nearestGuard().id); return { ok: true, spotted: true }; }
      }
    }
    for (var cid in S.levers.cams) if (S.levers.cams[cid] > 0) S.levers.cams[cid]--;


    S.sense = senseLine();

    /* stepping off a module you walked past re-arms it */
    for (var id in S.declined) {
      var mm = C.MODULES.filter(function (x) { return x.id === id; })[0];
      if (mm && (mm.x !== S.assane.x || mm.y !== S.assane.y)) delete S.declined[id];
    }

    var m = moduleAt(S.assane.x, S.assane.y);
    if (m && !S.solved[m.id] && !S.declined[m.id]) { openModule(m.id); return { ok: true, module: m.id }; }

    /* the way out: the hatch if this floor has one, otherwise the way he came */
    var here = charAt(S.assane.x, S.assane.y), hatch = hatchTile();
    if (S.hasManuscript && (hatch ? here === 'X' : here === 'E')) {
      /* the way out locked itself when the power went */
      if (S.blackout && !S.solved.clavier) { openModule('clavier'); return { ok: true, module: 'clavier' }; }
      finish();
      return { ok: true, done: true };
    }

    return { ok: true };
  }

  function toast(text, kind) { S.toast = { text: text, kind: kind, at: Date.now() }; }

  /* ---------------------------------------------------------------- pressure */
  /* any input restarts the clock */
  function touch() { S.lastActionAt = Date.now(); S.pressureAdded = 0; }
  /* called once a second from the clock. Returns what the displays need:
     how long he has stood still, and whether the building has started to
     charge for it. Only during the infiltration. */
  function tick(now) {
    if (!S.running || S.phase !== 'play') return null;
    var P = C.PRESSURE, idle = (now - S.lastActionAt) / 1000;
    if (idle < P.grace) return { idle: idle, grace: P.grace, ticking: false };
    var due = Math.floor((idle - P.grace) / P.every);
    while (S.pressureAdded < due) { S.pressureAdded++; S.pressure++; raise(1); }
    return { idle: idle, grace: P.grace, ticking: true };
  }

  /* ---------------------------------------------------------------- modules */
  /* A page of the dossier opens when the job needs it and not before.
     Benjamin used to start with every tab in the book, which is four screens
     of reference for a player who has not yet been asked a question. */
  function unlock(k) { S.unlocked[k] = true; }

  /* Which page of the dossier each module needs open.
     A table, not a run of ifs — the run of ifs is exactly how LE DEGUISEMENT,
     L'ECOUTE and LE FAUX each came to open with nothing on Benjamin's phone
     that could answer them. If a module is added and forgotten here, it is
     visible as a blank line rather than as a player staring at one tab. */
  var MODULE_PAGE = {
    deguisement: 'personnel',   /* whose uniform is whose, and who is posted where */
    bureau:      'personnel',   /* the staff files */
    clavier:     'personnel',   /* badge numbers, for the release code */
    coffre:      'manuel',      /* the safe manual */
    ecoute:      'manuel',      /* the line-code board lives on that page */
    faux:        'manuel',      /* the notes on the genuine canvas */
    porte:       'porte'        /* the ring */
  };

  function openModule(id) {
    if (MODULE_PAGE[id]) unlock(MODULE_PAGE[id]);
    S.moduleId = id;
    S.phase = 'module';
    U.buzz('p1');   /* something is in front of him */
    S.coffreEntry = [];
    S.clavierEntry = '';
    /* Fresh attempt on every approach. Two bad codes send you to La Tchatche;
       surviving that and coming back must not leave you primed to be caught
       again on the next mistake. Grade, don't fail — the cost is in suspicion
       and the spotted count, which is what the rank card reads. */
    S.coffreFails = 0;
    S.objective = id === 'grille' ? 'P1 has a padlock and three keys. P2 knows which key is which.'
      : id === 'coffre' ? 'P1 has the dial. P2 has the manual.'
      : id === 'clavier' ? 'P1 can see the worn keys. P2 has the procedure.'
      : id === 'deguisement' ? 'P1 can see the rack. P2 knows whose is whose.'
      : id === 'faux' ? 'P1 has both canvases. P2 has Benjamin\u2019s notes.'
      : id === 'ecoute' ? 'P1 has the line. P2 has to reproduce it before the book will answer.'
      : id === 'porte' ? 'P1 has the keypad. P2 has the code, but not where the ring starts.'
      : id === 'prize' ? 'It is on the desk.'
      : 'P1 reads the desk. P2 digs the staff files.';
  }
  function closeModule(solvedIt) {
    if (solvedIt) S.solved[S.moduleId] = true;
    S.moduleId = null;
    S.phase = 'play';
    touch();
    setObjective();
  }

  /* walk away from an optional module without solving it */
  function declineModule() {
    S.declined[S.moduleId] = true;
    S.moduleId = null;
    S.phase = 'play';
    touch();
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
      setTimeout(function () { closeModule(true); if (C.PRIZE && C.PRIZE.dark) darken(); else startBlackout(); U.emit('render'); }, 900);
    } else {
      U.sfx.bad(); U.buzz('p1');
      S.coffreFails++;
      raise(15);
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
    U.sfx.bad(); U.buzz('p1');
    raise(10);
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
    U.sfx.bad(); U.buzz('p1');
    raise(10);
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
    U.sfx.bad(); U.buzz('p1');
    raise(8);
    return false;
  }

  /* One decision, no retry. Take the wrong canvas and you have carried a
     forgery out of the building — you find out on the rank card. */
  function fauxChoose(pickedGenuine) {
    if (pickedGenuine) {
      U.sfx.unlock();
      S.loot.tableau = true;
    } else {
      U.sfx.bad(); U.buzz('p1');
      raise(15);
    }
    setTimeout(function () { closeModule(true); U.emit('render'); }, 900);
    return pickedGenuine;
  }

  /* LA GRILLE. One symbol, one lookup, one tap. A wrong key is not a fail —
     the gate rattles and the building notices a little — and there is no
     limit, so the pair can get it wrong and still be taught the shape. */
  function grilleTry(key) {
    var K = C.GRILLE, hit = K.board.filter(function (b) { return b.key === key; })[0];
    if (!hit || S.grille.tried[key]) return false;
    if (hit.sym === K.lock) {
      U.sfx.unlock();
      unlockDoorAt(K.door);
      setTimeout(function () { closeModule(true); U.emit('render'); }, 800);
      return true;
    }
    U.sfx.block(); U.buzz('p1');
    S.grille.tried[key] = true;
    raise(K.rattle || 3);
    return false;
  }
  /* a lock releases its own door. Without an address it releases every door
     on the floor, which is what the single-door contracts always did. */
  function unlockDoorAt(p) {
    if (!p) { S.doors.forEach(function (d) { d.locked = false; }); return; }
    var d = doorAt(p.x, p.y);
    if (d) d.locked = false;
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
      unlockDoorAt(C.PORTE.door);
      setTimeout(function () { closeModule(true); U.emit('render'); }, 900);
      return true;
    }
    U.sfx.bad(); U.buzz('p1');
    S.porteFails++;
    raise(8);
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
  /* the monitors die with the prize. The room on the television goes black
     and the run out is played on the two phones alone. */
  function darken() { S.dark = true; toast('MONITORS DEAD', 'bad'); }

  function takePrize() {
    U.sfx.unlock();
    S.hasManuscript = true;
    S.loot.dossier = true;
    if (C.PRIZE && C.PRIZE.dark) darken();
    setTimeout(function () { closeModule(true); U.emit('render'); }, 800);
  }

  function bureauSubmit(code) {
    if (code === C.BUREAU.answer) { U.sfx.unlock(); S.bureauStep = 1; return true; }
    U.sfx.bad(); U.buzz('p1');
    raise(10);
    return false;
  }
  function bureauDoor(mark) {
    if (mark === C.BUREAU.doorMark) {
      U.sfx.unlock();
      S.doors.forEach(function (d) { if (d.mark === mark) d.locked = false; });
      setTimeout(function () { closeModule(true); U.emit('render'); }, 800);
      return true;
    }
    U.sfx.bad(); U.buzz('p1');
    raise(10);
    return false;
  }

  /* ---------------------------------------------------------------- spotted */
  function getSpotted(byId) {
    unlock('visages'); unlock('personnel');   /* a face to find means the roster matters now */
    var badge = byId;
    var g = S.guards.filter(function (x) { return x.id === byId; })[0];
    if (g) badge = g.badge;
    if (byId === 'c1' || byId === 'c2') badge = '6620';   /* the desk answers the camera */
    /* ...if this contract employs them. Falling back to a hard-coded badge was
       safe only while every contract shared one roster. Contract three has
       neither 6620 nor 5195 on staff, and looking up a badge that is not there
       throws inside rollOptions and takes the whole module out. Land on
       somebody who actually works here. */
    if (!C.DIRT[badge]) badge = Object.keys(C.DIRT)[0];

    S.spotted++;
    raise(20);
    /* Twice, a guard can be talked round. The third time the building knows
       his face, and there is nothing left to say. It is the one rule about
       being seen that both players can hold in their heads: three and out. */
    if (S.spotted >= 3) { S.jailLine = 'THIRD TIME. THEY KNOW HIS FACE.'; jail(); return; }
    S.phase = 'tchatche';
    S.tchatche = { badge: badge, round: 0, strikes: 0, pick: null, options: rollOptions(badge, 0) };
    S.objective = 'P1 describes the face. P2 finds the crack.';
    S.flash = Date.now();
    U.sfx.spot();
    U.buzz('both', true);
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
        touch();
        S.tchatche = null;
        setObjective();
        return { win: true, done: true };
      }
      t.options = rollOptions(t.badge, t.round);
      return { win: true };
    }
    U.sfx.bad(); U.buzz('both');
    t.last = 'bad';
    t.strikes++;
    raise(10);
    if (t.strikes >= maxStrikes()) { S.jailLine = maxStrikes() === 1 ? 'ON ALERT. ONE SLIP WAS ENOUGH.' : null; jail(); return { win: false, jail: true }; }
    return { win: false };
  }

  /* on full alert a stopped man is searched, not chatted to */
  function maxStrikes() { return S.alert >= 2 ? 1 : 2; }

  function jail() { S.phase = 'jail'; S.running = false; U.sfx.jail(); U.buzz('both', true); }

  /* ---------------------------------------------------------------- end */
  /* Written against what the contract HAS, not against contract one. The old
     version told a pair in contract three to find a security desk it does not
     contain. */
  function setObjective() {
    var hasCloak = C.MODULES.some(function (m) { return m.id === 'deguisement'; }), O = C.OBJ || {};
    if (S.blackout) S.objective = 'Lights out. His phone is dead. Talk him to the vestibule.';
    else if (S.hasManuscript) S.objective = O.out ? O.out
                                         : hatchTile() ? 'He has it and the monitors are dead. The hatch in the west wall — ' + coordOf(hatchTile().x, hatchTile().y) + ' — is the only way out.'
                                         : C.PORTE ? 'He has it. Back round the ring and down the stairs.'
                                                     : 'La Sortie. He has the manuscript. Get him out through the vestibule.';
    else if (hasCloak && !S.disguised && !S.solved.deguisement) S.objective = 'The cloakroom first — or go in as you are, and be seen from further away.';
    else if (C.PORTE && !S.solved.porte) S.objective = O.door || 'A locked door at the top of the cloakroom. P1 has the keypad; P2 has the code.';
    else if (C.PORTE) S.objective = O.after || 'Through the door and round the ring. The desk is in the room at the top.';
    else if (S.solved.bureau) S.objective = 'La Réserve is open. The safe is waiting.';
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
    touch();
    setObjective();
    /* a module on the starting square opens the moment the job starts — the
       gate in contract three, so the first thing anyone does is talk */
    var m = moduleAt(S.assane.x, S.assane.y);
    if (m && !S.solved[m.id]) openModule(m.id);
  }

  L.engine = {
    get S() { return S; },
    reset: reset, begin: begin, act: act,
    charAt: charAt, isWall: isWall, doorAt: doorAt, moduleAt: moduleAt, roomAt: roomAt,
    coordOf: coordOf,
    coffreUndo: coffreUndo,
    cone: cone, sightline: sightline, threat: threat, visibleSet: visibleSet, cameraDir: cameraDir,
    zoneOf: zoneOf, liveZones: liveZones, seesAssane: seesAssane,
    startBlackout: startBlackout, clavierSubmit: clavierSubmit,
    openModule: openModule, closeModule: closeModule, declineModule: declineModule,
    deguisementSubmit: deguisementSubmit, fauxChoose: fauxChoose, ecouteCut: ecouteCut,
    coffreTap: coffreTap, bureauSubmit: bureauSubmit, bureauDoor: bureauDoor,
    porteTap: porteTap, porteUndo: porteUndo, porteSubmit: porteSubmit,
    porteDigitOf: porteDigitOf, porteSymbolFor: porteSymbolFor,
    porteCodeSymbols: porteCodeSymbols, takePrize: takePrize,
    tchatchePick: tchatchePick, rank: rank, setObjective: setObjective,
    grilleTry: grilleTry, pullLever: pullLever, maxStrikes: maxStrikes,
    tick: tick, hatchTile: hatchTile
  };
})(window.DC);
