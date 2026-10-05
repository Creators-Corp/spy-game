/* devtools.js — skip buttons for level work, in the chrome row above the screens.
   Never part of the game. It shows only on a local copy (localhost, 127.0.0.1
   or file://), or anywhere with ?dev in the URL, and never on a joined phone.

   Every skip goes through the engine's own answer path with the right answer,
   so a skipped door unlocks the same door, a skipped safe starts the same
   blackout, and nothing here has to know what solving a module does. */
(function (L) {
  'use strict';
  var U = L.util, E = L.engine, C = L.content;

  var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:';
  if (!local && !/[?&]dev\b/.test(location.search)) return;

  function isGuest() { return !!(L.link && L.link.role === 'guest'); }

  /* the right answer, given to whichever module is open */
  var SOLVE = {
    grille: function () {
      var hit = C.GRILLE.board.filter(function (b) { return b.sym === C.GRILLE.lock; })[0];
      if (hit) E.grilleTry(hit.key);
    },
    porte: function () { E.S.porteEntry = C.PORTE.code; E.porteSubmit(); },
    deguisement: function () { E.deguisementSubmit(C.UNIFORMS[C.DEGUISEMENT.answerBadge]); },
    bureau: function () { E.S.bureauStep = 1; E.bureauDoor(C.BUREAU.doorMark); },
    ecoute: function () { E.ecouteCut(C.ECOUTE.answer); },
    faux: function () { E.fauxChoose(true); },
    coffre: function () {
      E.S.coffreEntry = [];
      C.COFFRE.code.forEach(function (g) { E.coffreTap(g); });
    },
    clavier: function () { E.clavierSubmit(C.CLAVIER.code); },
    prize: function () { E.takePrize(); }
  };

  function skipPuzzle() {
    var S = E.S;
    if (S.phase !== 'module' || S.codeFeedback || S.transitions.length) return;
    var solve = SOLVE[S.moduleId];
    if (solve) solve();
  }

  /* La Tchatche: give the right line until the guard stands down. The first
     beam conversation is the tutorial, answered by button index, and a wrong
     answer there costs nothing, so a mismatch would never end the talk: the
     cap stops that from hanging the page. */
  function skipTalk() {
    var S = E.S;
    for (var i = 0; i < 10 && S.phase === 'tchatche' && S.tchatche; i++) {
      var t = S.tchatche;
      E.tchatchePick(t.tag === 'first-beam-g1'
        ? C.FIRST_BEAM_TUTORIAL[t.round].correct - 1
        : C.DIRT[t.badge][t.round].t);
    }
  }

  function openDoors() {
    E.S.doors.forEach(function (d) { d.locked = false; });
  }

  /* ---- GO TO: a save state for every puzzle on the floor ----
     The level's puzzles in the order they have to be played: a module that
     `needs` another comes after it, and the keypad on the way out, if this
     floor has one, comes last. */
  function route() {
    var out = [];
    function byId(id) { return C.MODULES.filter(function (m) { return m.id === id; })[0]; }
    function add(m) {
      if (!m || out.indexOf(m) >= 0) return;
      if (m.needs) add(byId(m.needs));
      out.push(m);
    }
    C.MODULES.forEach(add);
    if (C.CLAVIER) out.push({ id: 'clavier', name: 'LE CLAVIER' });
    return out;
  }

  /* where a puzzle is stood on: its own square, or for the keypad the way out */
  function spotOf(m) {
    if (m.x !== undefined) return { x: m.x, y: m.y };
    var h = E.hatchTile();
    if (h) return h;
    for (var y = 0; y < C.MAP.length; y++) {
      var x = C.MAP[y].indexOf('E');
      if (x >= 0) return { x: x, y: y };
    }
    return E.S.assane;
  }

  function standAndOpen(m) {
    var p = spotOf(m);
    E.S.assane = { x: p.x, y: p.y };
    delete E.S.solved[m.id];
    delete E.S.declined[m.id];
    E.openModule(m.id);
  }

  /* As if the run had been played up to here: the same roster from the top,
     every required puzzle before this one solved through its own answer path
     (so doors, the uniform, the safe and the blackout all land as they would),
     then Assane stood on this one with it open. Optional puzzles on the way
     are left alone. */
  function jumpTo(id) {
    var order = route(), at = order.map(function (m) { return m.id; }).indexOf(id);
    if (at < 0) return;
    U.silence();
    E.reset(E.S.seed);
    L.p1.resetTyped();
    L.p2.reset();
    E.ready('p1'); E.ready('p2');
    order.slice(0, at).forEach(function (m) {
      if (m.optional || !SOLVE[m.id]) return;
      standAndOpen(m);
      SOLVE[m.id]();
      E.flushTransitions();
    });
    standAndOpen(order[at]);
  }

  var ACTIONS = [
    ['PUZZLE', skipPuzzle, function (S) { return S.phase === 'module'; }, 'Solve the open puzzle'],
    ['TALK', skipTalk, function (S) { return S.phase === 'tchatche'; }, 'Talk past the guard'],
    ['DOORS', openDoors, function (S) { return S.doors.some(function (d) { return d.locked; }); }, 'Unlock every door']
  ];

  function build() {
    var row = document.querySelector('.stage__chrome');
    if (!row) return;
    var box = document.createElement('span');
    box.className = 'chip devtools';
    box.innerHTML = '<b>DEV</b>';
    /* the row is full without it: the tagline chip gives up its place */
    document.body.classList.add('has-devtools');
    var buttons = ACTIONS.map(function (a) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = a[0];
      b.title = a[3];
      b.addEventListener('click', function () {
        if (isGuest()) return;
        a[1]();
        U.emit('render');
      });
      box.appendChild(b);
      return b;
    });

    /* GO TO ▾ drops the level's puzzles under the row; rebuilt on every open
       because changing the contract changes the list */
    var go = document.createElement('button');
    go.type = 'button';
    go.textContent = 'GO TO \u25BE';
    go.title = 'Jump to a puzzle, as if the run had reached it';
    var menu = document.createElement('div');
    menu.className = 'devtools__menu';
    menu.hidden = true;
    go.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (!menu.hidden) { menu.hidden = true; return; }
      menu.innerHTML = '';
      route().forEach(function (m, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = (i + 1) + '. ' + (m.name || m.id.toUpperCase()) + (m.optional ? ' (optional)' : '');
        b.addEventListener('click', function () {
          menu.hidden = true;
          if (isGuest()) return;
          jumpTo(m.id);
          U.emit('render');
        });
        menu.appendChild(b);
      });
      menu.hidden = false;
    });
    document.addEventListener('click', function (ev) {
      if (!menu.contains(ev.target)) menu.hidden = true;
    });
    box.appendChild(go);
    box.appendChild(menu);

    /* CAM: the room camera's settle time, to tune by walking, and a test shake */
    var cam = L.tv && L.tv.cam;
    if (cam) {
      var lab = document.createElement('label');
      lab.className = 'devtools__cam';
      lab.title = 'Camera settle time (ms) — 0 is welded to Assane';
      var slider = document.createElement('input');
      slider.type = 'range'; slider.min = 0; slider.max = 600; slider.step = 10;
      slider.value = cam.smooth;
      var read = document.createElement('i');
      read.textContent = 'CAM ' + cam.smooth;
      slider.addEventListener('input', function () {
        cam.smooth = slider.value;
        read.textContent = 'CAM ' + cam.smooth;
      });
      lab.appendChild(read);
      lab.appendChild(slider);
      box.appendChild(lab);
      var jolt = document.createElement('button');
      jolt.type = 'button';
      jolt.textContent = 'SHAKE';
      jolt.title = 'Shake the room camera (the alarm strength)';
      jolt.addEventListener('click', function () { cam.shake(0.12, 520); });
      box.appendChild(jolt);
    }
    row.appendChild(box);

    function paint() {
      box.hidden = isGuest();
      ACTIONS.forEach(function (a, i) { buttons[i].disabled = !E.S || !a[2](E.S); });
    }
    U.on('render', paint);
    /* Not every redraw goes through the 'render' event — the keyboard, the
       clock and a restart call main's render() directly — so a puzzle or a
       stop could open with these still greyed out. Re-check on a short beat. */
    setInterval(paint, 250);
    paint();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})(window.DC);
