/* route.js — THE ROUTE FINDER, and the proof that a shuffled roster is fair.

   Load it on index.html:
     fetch('tools/route.js').then(r=>r.text()).then(eval)

   Then:
     DC.route.solve({ job: 1, seed: 0 })   the cleanest way through one roster
     DC.route.script(DC.route.solve(...))  the same thing as instructions
     DC.route.audit(40, 1)                 forty random rosters, each solved —
                                           the check that shuffling where the
                                           guards start never seals a contract

   HOW IT SEARCHES.
   Guards advance one step per action and never react to a walk, so the roster
   is periodic in the turn count: every round and every camera cycle divides
   one number, 48 on both contracts. The world is therefore a function of
   `turn % P`, and the threat map for each phase can be built once, from the
   engine's own cone() and sightline(). The search runs over
   (square, phase, alert) — no snapshots, no cloning.

   AND WHY IT IS COMPLETE ACROSS THE LEGS.
   A contract is a sequence of squares he must stand on: the door, the desk,
   the vault, the way out. Taking the cheapest route to each in turn is NOT
   enough — arriving cheaply at the wrong phase can leave the next leg with no
   way through at all, which is exactly how a third of the rosters looked
   unwinnable when they were not. So each leg carries a FRONTIER: the best
   arrival at that square for every (phase, alert), and the next leg starts
   from all of them at once.

   IT IS STILL A MODEL, so the route it finds is REPLAYED through the real
   engine, key for key, and the grade reported is the one the engine's own rank
   card gives. The model is deliberately pessimistic — it charges for a brush
   the engine sometimes forgives — and solve() flags the dangerous direction,
   the engine coming out worse than the model, rather than the safe one.

   IT NEVER RUNS. Running crosses two squares, makes noise and turns heads: an
   escape, not a route. Holding still is free — the pressure clock is real time
   and every press of HOLD STILL restarts it.

   The modules are not searched. A player solves those by reading Benjamin's
   dossier; the walkthrough says which answer at which square. */
(function (L) {
  'use strict';
  var E = L.engine, C = L.content;
  var CAP = 60;                       /* stop exploring past a hopeless score */

  /* ------------------------------------------------------ the world's period */
  function lcm(a, b) { var x = a, y = b, t; while (y) { t = y; y = x % y; x = t; } return a / x * b; }
  function worldPeriod() {
    var p = 1;
    E.S.guards.forEach(function (g) { p = lcm(p, g.loop ? g.path.length : 2 * (g.path.length - 1)); });
    C.CAMERAS.forEach(function (c) { p = lcm(p, c.cycle.length); });
    return p;
  }

  /* Walk the roster forward P turns and write down where everybody is. The
     advance rule is the engine's, minus the branch for a guard who has heard
     something — nothing in a clean route makes a noise. */
  function rosterFrames(P) {
    var men = E.S.guards.map(function (g) {
      return { path: g.path, at: g.at, dir: g.dir, loop: g.loop, depth: g.depth, facing: g.facing };
    });
    function face(m) {
      var a = m.path[m.at], b = m.loop ? m.path[(m.at + 1) % m.path.length]
                                       : (m.path[m.at + m.dir] || m.path[m.at - m.dir]);
      if (!b) return 'E';
      if (b.x > a.x) return 'E'; if (b.x < a.x) return 'W';
      if (b.y > a.y) return 'S'; return 'N';
    }
    var frames = [];
    for (var t = 0; t < P; t++) {
      frames.push(men.map(function (m) {
        return { x: m.path[m.at].x, y: m.path[m.at].y, facing: m.facing, depth: m.depth };
      }));
      men.forEach(function (m) {
        if (m.loop) m.at = (m.at + 1) % m.path.length;
        else {
          var nx = m.at + m.dir;
          if (nx < 0 || nx >= m.path.length) { m.dir *= -1; nx = m.at + m.dir; }
          m.at = nx;
        }
        m.facing = face(m);
      });
    }
    return frames;
  }

  /* The threat map for one phase, at one alert level, dressed or not — built
     from the engine's own cone() and sightline(), so a cone here is the cone
     the engine will judge him by. `mute` names cameras Benjamin has looped. */
  /* camOff: the beat the cameras are already on. The guards' phase and the
     cameras' phase are two different clocks — reset() now starts the cameras
     somewhere random too — and assuming they were the same clock is what had
     the model walking cleanly onto the desk while the engine watched him do
     it. Seed 0 hid it, because there the two happen to line up. */
  function threatTables(P, frames, mute, camOff) {
    var pen = C.DEGUISEMENT ? C.DEGUISEMENT.conePenalty : 0;
    var off = {}; (mute || []).forEach(function (id) { off[id] = 1; });
    camOff = camOff || 0;
    var T = [];
    for (var t = 0; t < P; t++) {
      T[t] = [];
      for (var a = 0; a <= 2; a++) {
        T[t][a] = [];
        for (var d = 0; d <= 1; d++) {
          var map = {};
          frames[t].forEach(function (m) {
            E.cone(m.x, m.y, m.facing, m.depth + a + (d ? 0 : pen)).forEach(function (k) { map[k] = 1; });
          });
          C.CAMERAS.forEach(function (c) {
            if (off[c.id]) return;
            var dir = c.cycle[(camOff + t) % c.cycle.length];
            if (!dir) return;
            E.sightline(c.x, c.y, dir, c.depth).forEach(function (k) { map[k] = 1; });
          });
          T[t][a][d] = map;
        }
      }
    }
    return T;
  }

  /* A SQUARE NO PHASE EVER CLEARS.
     CAM 1 over the vault never blinks — that is the point of it, and the
     dossier says so in words. There is no timing answer to a camera like that;
     the only way onto the square is Benjamin looping it, which is the moment
     the contract is asking the two of them to work together. */
  function alwaysWatchedBy(cell, P) {
    var ids = [];
    C.CAMERAS.forEach(function (c) {
      var every = true;
      for (var t = 0; t < P && every; t++) {
        var dir = c.cycle[t % c.cycle.length];
        if (!dir) { every = false; break; }
        if (E.sightline(c.x, c.y, dir, c.depth).indexOf(cell.x + ',' + cell.y) < 0) every = false;
      }
      if (every) ids.push(c.id);
    });
    return ids;
  }

  /* --------------------------------------------------------------- the search */
  /* THE ORDER THESE ARE TRIED IN IS THE ORDER THE ROUTE PREFERS.
     Every one costs the same turn, and the frontier is first-come-wins, so
     among equally long routes the order decides which one gets written down.

     Waiting is unavoidable on a floor this narrow — about forty of contract
     four's turns are spent letting a patrol go by, whatever route you take.
     What is avoidable is where they land and what they look like:

       · hold first  →  every wait piles up on the first square, and the
                        walkthrough opens with HOLD STILL x21;
       · hold last   →  no waits at all, and the route paces UP DOWN UP DOWN
                        in the stairwell instead, which reads like a mistake.

     So: carry on in any direction first, then hold still, and turn back the
     way you came only if nothing else works. A turn spent in place is then a
     hold — which is what it is — and it lands where it is actually needed. */
  /* A LIVE BEAM IS A WALL TO THIS SEARCH, though it is not one to the engine.
     Walking through a beam sets off the alarm, and an alarm takes every guard
     off his round — which is exactly the assumption this whole model rests on.
     A route that trips one cannot be reasoned about here at all, so it is not
     looked for: what solve() prints is always a route through the building
     that nobody hears. Benjamin dropping the beams first is a different
     matter, and also not modelled. */
  function shut(x, y) {
    return E.isWall(x, y) || (E.charAt(x, y) === 'L' && !(E.S.levers.laser > 0));
  }

  var STEPS = [[0, -1, 'N'], [0, 1, 'S'], [-1, 0, 'W'], [1, 0, 'E'], [0, 0, '.']];
  var BACK = { N: 'S', S: 'N', E: 'W', W: 'E' };
  /* Keep going the way you were going, then turn, then wait, and only turn
     back the way you came if nothing else works. Straight runs collapse into
     one instruction — RIGHT x18 rather than eighteen lines — and a turn spent
     in place comes out as HOLD STILL, which is what it is, instead of a step
     and a step back that reads like a misprint. */
  function order(last) {
    if (!last) return STEPS;
    var undo = BACK[last], same = null, back = null, turns = [], hold = null;
    for (var i = 0; i < STEPS.length; i++) {
      var st = STEPS[i];
      if (st[2] === '.') hold = st;
      else if (st[2] === last) same = st;
      else if (st[2] === undo) back = st;
      else turns.push(st);
    }
    /* carry on · wait · turn · double back, in that order. Waiting comes
       BEFORE turning because when a route has a turn to spare it will take a
       step sideways and a step back to spend it, and two steps that go nowhere
       read like a misprint where HOLD STILL reads like what it is. */
    var out = [];
    if (same) out.push(same);
    if (hold) out.push(hold);
    out = out.concat(turns);
    if (back) out.push(back);
    return out;
  }

  /* Multi-source, multi-target Dijkstra, in one of two moods.

     QUIET minimises suspicion. It is the right answer to "how clean can this
     be", and it produced a route that waits twenty-eight turns at the door for
     a patrol window worth one point.

     QUICK minimises MOVES with suspicion capped — the right answer to "how do
     we play this in front of somebody". A rank is a threshold, not a score:
     under the cap, a point of suspicion costs nothing at all, and spending
     three of them to save fifty presses is free.

     Returns the best arrival at each target for every (phase, alert), which is
     the frontier the next leg starts from. */
  function sweep(sources, targets, P, T, disguised, maxMoves, mode, budget) {
    var quick = mode === 'quick';
    var want = {};
    targets.forEach(function (c) { want[c.x + ',' + c.y] = 1; });
    var best = {}, bucket = [], found = {};
    function costOf(n) { return quick ? n.d : n.susp; }
    function push(n) {
      var c = costOf(n);
      (bucket[c] || (bucket[c] = [])).push(n);
    }
    function better(k, n) {
      var b = best[k];
      if (!b) return true;
      var c = costOf(n);
      return c < b.c || (c === b.c && (quick ? n.susp < b.s : n.d < b.d));
    }
    function record(k, n) { best[k] = { c: costOf(n), s: n.susp, d: n.d }; }
    sources.forEach(function (s) {
      var k = s.x + ',' + s.y + '|' + (s.turn % P) + '|' + s.alert;
      /* d counts moves TAKEN SO FAR, not moves in this leg. Restarting it at
         each objective made the search minimise four legs separately, which
         is not the same as minimising the route: it would happily burn ten
         turns on one leg to save one on the next. d0 remembers where this
         leg began, because maxMoves — the four moves a looped camera buys —
         is a budget for the leg and not for the journey. */
      var here = (s.path || []).length;
      var n0 = { x: s.x, y: s.y, turn: s.turn, susp: s.susp, alert: s.alert,
                 path: s.path || [], d: here, d0: here };
      if (!better(k, n0)) return;
      record(k, n0);
      push(n0);
    });
    var ceiling = quick ? 500 : CAP;
    for (var cost = 0; cost <= ceiling; cost++) {
      var b = bucket[cost];
      if (!b) continue;
      for (var qi = 0; qi < b.length; qi++) {
        var n = b[qi];
        var nk = n.x + ',' + n.y + '|' + (n.turn % P) + '|' + n.alert;
        if (best[nk] && best[nk].c < costOf(n)) continue;   /* superseded */
        if (want[n.x + ',' + n.y]) {
          var fk = n.x + ',' + n.y + '|' + (n.turn % P) + '|' + n.alert;
          if (found[fk] === undefined) found[fk] = n;
        }
        if (maxMoves !== undefined && n.d - n.d0 >= maxMoves) continue;
        if (n.path.length > 400) continue;
        var tries = order(n.path.length ? n.path[n.path.length - 1] : null);
        for (var si = 0; si < tries.length; si++) {
          var st = tries[si], nx = n.x + st[0], ny = n.y + st[1];
          if ((st[0] || st[1]) && shut(nx, ny)) continue;
          var turn = n.turn + 1, tm = T[turn % P][Math.min(2, n.alert)][disguised ? 1 : 0];
          if (tm[nx + ',' + ny]) continue;                 /* seen: not a route */
          var susp = n.susp;
          if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (v) { return tm[(nx + v[0]) + ',' + (ny + v[1])]; })) susp++;
          if (susp > (quick ? budget : CAP)) continue;
          var alert = n.alert;
          for (var a = 0; a < C.ALERT.length; a++) if (susp >= C.ALERT[a].at) alert = a + 1;
          var k = nx + ',' + ny + '|' + (turn % P) + '|' + alert;
          var nn = { x: nx, y: ny, turn: turn, susp: susp, alert: alert, path: n.path.concat(st[2]), d: n.d + 1, d0: n.d0 };
          if (!better(k, nn)) continue;
          record(k, nn);
          push(nn);
        }
      }
    }
    return Object.keys(found).map(function (k) { return found[k]; });
  }

  /* --------------------------------------------------------------------- plan */
  function leverDef(id) { return (C.LEVIERS || []).filter(function (l) { return l.id === id; })[0]; }
  function entry() {
    for (var y = 0; y < C.MAP.length; y++) { var x = C.MAP[y].indexOf('E'); if (x >= 0) return { x: x, y: y }; }
    return { x: 1, y: 1 };
  }
  function stagesFor(withDisguise) {
    var m = {};
    C.MODULES.forEach(function (x) { m[x.id] = { x: x.x, y: x.y }; });
    var list = [];
    if (withDisguise && m.deguisement) list.push({ id: 'deguisement', at: m.deguisement });
    if (m.porte) list.push({ id: 'porte', at: m.porte });
    if (m.bureau) list.push({ id: 'bureau', at: m.bureau });
    if (m.coffre) list.push({ id: 'coffre', at: m.coffre });
    if (m.prize) list.push({ id: 'prize', at: m.prize });
    var h = E.hatchTile();
    list.push({ id: 'out', at: h ? { x: h.x, y: h.y } : entry() });
    return list;
  }

  /* THE MODULE ANSWERS, so a leg can end with the door actually open. Every
     one of them is something Benjamin reads out; none is a search. */
  function answer(id) {
    var S = E.S;
    if (id === 'porte') { C.PORTE.code.split('').forEach(function (d) { E.porteTap(d); }); E.porteSubmit(); }
    else if (id === 'bureau') { E.bureauSubmit(C.BUREAU.answer); E.bureauDoor(C.BUREAU.doorMark); }
    else if (id === 'coffre') { C.COFFRE.code.forEach(function (g) { E.coffreTap(g); }); }
    else if (id === 'clavier') { E.clavierSubmit(C.CLAVIER.code); }
    else if (id === 'deguisement') { E.deguisementSubmit(C.UNIFORMS[C.DEGUISEMENT.answerBadge]); }
    else if (id === 'grille') { for (var i = 1; i <= 3; i++) if (E.grilleTry(i)) break; }
    else if (id === 'prize') { E.takePrize(); }
    else { E.declineModule(); return; }
    /* the television holds each of these for most of a second before the room
       comes back; a replay cannot wait, so land the same end state now */
    if (S.phase === 'module') {
      /* THE SAME FORK THE ENGINE TAKES A BEAT LATER, TAKEN NOW. A prize marked
         dark kills the monitors; anything else cuts the power. Before this the
         replay only ever set S.dark, and the engine's own 900ms timer fired
         the blackout long after the replay had finished running — so the walk
         out was scored against lit cones and LE CLAVIER was answered on a
         floor that had never gone dark. Pessimistic rather than wrong, but it
         meant the one leg the twist exists for was the one leg never tested. */
      if (id === 'coffre' && S.hasManuscript) {
        S.moduleId = null; S.phase = 'play';
        if (C.PRIZE && C.PRIZE.dark) E.darken(); else E.startBlackout();
      }
      else if (id === 'clavier' && S.solved.clavier) { S.moduleId = null; S.phase = 'rank'; S.running = false; }
      else { S.solved[id] = true; S.moduleId = null; S.phase = 'play'; }
      E.setObjective();
    }
  }

  function plan(withDisguise, mode, budget) {
    var S = E.S, camOff = S.camPhase;
    var P = worldPeriod(), frames = rosterFrames(P), T = threatTables(P, frames, null, camOff);
    var frontier = [{ x: S.assane.x, y: S.assane.y, turn: S.turn, susp: S.suspicion, alert: S.alert, path: [] }];
    var stages = stagesFor(withDisguise);

    for (var i = 0; i < stages.length; i++) {
      var g = stages[i], dressed = withDisguise && i > 0;
      var watchers = alwaysWatchedBy(g.at, P), arrivals;

      if (watchers.length) {
        /* THE DOORSTEP, THEN ONE STEP IN ON THE LOOP. Walk to a square beside
           it that the same camera does not cover, have Benjamin loop the
           camera — no turn, only suspicion — and step in. The loop runs four
           moves: in, the module, and back out past the lens. */
        var steps = [];
        [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(function (v) {
          var d = { x: g.at.x + v[0], y: g.at.y + v[1] };
          if (!shut(d.x, d.y) && !alwaysWatchedBy(d, P).length) steps.push(d);
        });
        if (!steps.length) return null;
        var doorstep = sweep(frontier, steps, P, T, dressed, undefined, mode, budget);
        if (!doorstep.length) return null;
        var cost = (leverDef('camera') || { cost: 0 }).cost;
        var muted = threatTables(P, frames, watchers, camOff);
        var sources = doorstep.map(function (n) {
          return { x: n.x, y: n.y, turn: n.turn, susp: n.susp + cost, alert: n.alert,
                   path: n.path.concat(watchers.map(function (id) { return '*' + id; })) };
        });
        arrivals = sweep(sources, [g.at], P, muted, dressed, 2, mode, budget);
      } else {
        arrivals = sweep(frontier, [g.at], P, T, dressed, undefined, mode, budget);
      }
      if (!arrivals.length) return null;

      frontier = arrivals;

      /* a door a module opens changes what is a wall, and the tables were
         built against the old one */
      if (g.id === 'porte' && C.PORTE) { var pd = E.doorAt(C.PORTE.door.x, C.PORTE.door.y); if (pd) pd.locked = false; T = threatTables(P, frames, null, camOff); }
      if (g.id === 'bureau' && C.BUREAU) { S.doors.forEach(function (d) { if (d.mark === C.BUREAU.doorMark) d.locked = false; }); T = threatTables(P, frames, null, camOff); }
    }
    var end = frontier.reduce(function (a, b) {
      if (mode === 'quick') return (a.path.length < b.path.length || (a.path.length === b.path.length && a.susp < b.susp)) ? a : b;
      return (a.susp < b.susp || (a.susp === b.susp && a.path.length < b.path.length)) ? a : b;
    });
    return { path: end.path, modelSusp: end.susp };
  }

  /* Play the route on the real engine and report what IT says. */
  function replay(path) {
    var S = E.S, log = [];
    for (var i = 0; i < path.length; i++) {
      /* a token beginning with * is Benjamin's, not Assane's: pulling a lever
         costs suspicion and no turn, so nothing on the floor moves for it */
      if (path[i].charAt(0) === '*') {
        /* no id: the lever takes the box nearest him, the same as a player's
           tap. The token still names the camera the plan meant, and the replay
           checks that is the one that went dark. */
        var wantCam = path[i].slice(1), gotCam = E.nearestCam();
        if (!E.pullLever('camera')) return { ok: false, why: 'lever refused at token ' + (i + 1) };
        if (gotCam && gotCam.id !== wantCam) return { ok: false, why: 'looped ' + gotCam.id + ', the plan wanted ' + wantCam };
        log.push({ token: i + 1, at: E.coordOf(S.assane.x, S.assane.y), lever: path[i].slice(1) });
        continue;
      }
      var d = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0], '.': [0, 0] }[path[i]];
      var r = E.act(d[0], d[1]);
      if (r.blocked) return { ok: false, why: 'blocked at token ' + (i + 1) + ' (' + E.coordOf(S.assane.x, S.assane.y) + ' ' + path[i] + ')' };
      if (r.spotted) return { ok: false, why: 'spotted at token ' + (i + 1) + ' (' + E.coordOf(S.assane.x, S.assane.y) + ')' };
      if (r.module) { log.push({ token: i + 1, at: E.coordOf(S.assane.x, S.assane.y), module: r.module }); answer(r.module); }
      if (r.done || S.phase === 'rank') return { ok: true, log: log, tokens: i + 1 };
    }
    return { ok: false, why: 'route ran out at ' + E.coordOf(S.assane.x, S.assane.y) };
  }

  /* how much suspicion a named grade allows, read off the rank card rather
     than written down here twice */
  function rankBudget(g) {
    for (var v = 0; v <= 100; v++) {
      var probe = { spotted: 0, suspicion: v };
      var got = null;
      for (var i = 0; i < C.RANKS.length; i++) if (C.RANKS[i].test(probe)) { got = C.RANKS[i].g; break; }
      if ('SABCD'.indexOf(got) > 'SABCD'.indexOf(g)) return v - 1;
    }
    return 100;
  }
  function gradeOf(s) {
    for (var i = 0; i < C.RANKS.length; i++) if (C.RANKS[i].test(s)) return C.RANKS[i];
    return C.RANKS[C.RANKS.length - 1];
  }

  function start(opts) {
    if (opts.job !== undefined) C.loadJob(opts.job);
    E.reset(opts.seed);
    var S = E.S;
    S.ready.p1 = true; S.ready.p2 = true;
    E.begin();
    if (S.phase === 'module') answer(S.moduleId);    /* a gate on the first square */
    return S;
  }

  function solve(opts) {
    opts = opts || {};
    var t0 = Date.now(), tries = [];
    var budget = opts.budget !== undefined ? opts.budget : rankBudget(opts.want || 'A');
    var moods = opts.mode ? [opts.mode] : ['quick', 'quiet'];
    moods.forEach(function (mode) {
      [false, true].forEach(function (dress) {
        if (dress && !C.MODULES.some(function (m) { return m.id === 'deguisement'; })) return;
        start(opts);
        var p = plan(dress, mode, budget);
        if (!p) { tries.push({ mode: mode, dress: dress, ok: false, why: 'no clean route' }); return; }
        /* planning moved the state it planned from — start clean and replay */
        var S = start(opts);
        var rp = replay(p.path);
        if (!rp.ok) { tries.push({ mode: mode, dress: dress, ok: false, why: rp.why }); return; }
        var g = gradeOf(S);
        tries.push({ mode: mode, dress: dress, ok: true, grade: g.g, title: g.t, suspicion: S.suspicion,
                     spotted: S.spotted, moves: rp.tokens, path: p.path.slice(0, rp.tokens),
                     modelSusp: p.modelSusp, events: rp.log });
      });
    });
    /* the one to hand somebody: it must clear the grade they asked for, and
       then it should be the shortest that does */
    var good = tries.filter(function (t) { return t.ok && t.suspicion <= budget; })
                    .sort(function (a, b) { return a.moves - b.moves || a.suspicion - b.suspicion; });
    if (!good.length) good = tries.filter(function (t) { return t.ok; })
                                  .sort(function (a, b) { return a.suspicion - b.suspicion || a.moves - b.moves; });
    if (!good.length) return { ok: false, seed: E.S.seed, job: C.contract, tries: tries, ms: Date.now() - t0 };
    var w = good[0];
    w.ok = true; w.seed = E.S.seed; w.job = C.contract; w.ms = Date.now() - t0;
    /* the model charges for brushes the engine sometimes forgives, so it
       coming out HIGHER is fine; it coming out lower would mean the model let
       something through that the engine will not, and that is worth shouting */
    w.modelOptimistic = w.suspicion > w.modelSusp;
    w.alternatives = tries;
    return w;
  }

  /* THE CHECK. Shuffling where the guards start can only ever have broken one
     thing: a roster with no clean way through. Solve a pile of them. */
  function audit(n, job) {
    n = n || 25;
    var rows = [], fails = 0, worst = 0, tally = {}, bad = [];
    for (var i = 0; i < n; i++) {
      var seed = 1000 + Math.floor(Math.random() * 9000);
      var r = solve({ job: job, seed: seed });
      if (!r.ok) { fails++; bad.push(seed); rows.push(seed + '   NO CLEAN ROUTE   ' + r.tries.map(function (t) { return t.why; }).join(' / ')); continue; }
      tally[r.grade] = (tally[r.grade] || 0) + 1;
      worst = Math.max(worst, r.suspicion);
      rows.push(seed + '   ' + r.grade + '   susp ' + r.suspicion + '   ' + r.moves + ' moves' +
                (r.dress ? '   (disguised)' : '') + (r.modelOptimistic ? '   MODEL WAS OPTIMISTIC' : ''));
    }
    return { n: n, failures: fails, failedSeeds: bad, grades: tally, worstSuspicion: worst, rows: rows };
  }

  /* the route as something you can read out to a person */
  function script(r) {
    if (!r.ok) return 'no route';
    var NAME = { N: 'UP', S: 'DOWN', W: 'LEFT', E: 'RIGHT', '.': 'HOLD STILL' };
    /* marked from the REPLAY's own log, so a label sits on the move that
       actually opened the module rather than on wherever the planner happened
       to think the leg ended */
    var mark = {}; (r.events || []).forEach(function (e) { if (e.module) mark[e.token] = e.module; });
    var out = [], run = 1;
    for (var i = 1; i <= r.path.length; i++) {
      var here = r.path[i - 1];
      /* he does not choose one — the lever takes the box nearest Assane, and
         from this square that is the box named here. The name is written down
         so the instruction can be checked, not so it can be picked. */
      if (here.charAt(0) === '*') { out.push('P2 · LOOP A CAMERA  (takes ' + here.slice(1).toUpperCase() + ')'); run = 1; continue; }
      if (r.path[i] === here && !mark[i]) { run++; continue; }
      out.push(NAME[here] + (run > 1 ? ' ×' + run : '') + (mark[i] ? '        ⟵ ' + mark[i].toUpperCase() : ''));
      run = 1;
    }
    return out.join('\n');
  }

  L.route = { solve: solve, audit: audit, script: script, answer: answer, replay: replay, start: start };
})(window.DC);
