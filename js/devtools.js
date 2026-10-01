/* devtools.js — skip buttons for level work, drawn in the corner of the TV.
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

  /* La Tchatche: give the right line until the guard stands down */
  function skipTalk() {
    var S = E.S;
    while (S.phase === 'tchatche' && S.tchatche) {
      E.tchatchePick(C.DIRT[S.tchatche.badge][S.tchatche.round].t);
    }
  }

  function openDoors() {
    E.S.doors.forEach(function (d) { d.locked = false; });
  }

  var ACTIONS = [
    ['SKIP PUZZLE', skipPuzzle, function (S) { return S.phase === 'module'; }],
    ['SKIP TALK', skipTalk, function (S) { return S.phase === 'tchatche'; }],
    ['OPEN DOORS', openDoors, function (S) { return S.doors.some(function (d) { return d.locked; }); }]
  ];

  function build() {
    var screen = document.getElementById('tv-screen');
    if (!screen) return;
    var box = document.createElement('div');
    box.className = 'devtools';
    box.innerHTML = '<b>DEV</b>';
    var buttons = ACTIONS.map(function (a) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = a[0];
      b.addEventListener('click', function () {
        if (isGuest()) return;
        a[1]();
        U.emit('render');
      });
      box.appendChild(b);
      return b;
    });
    screen.appendChild(box);

    function paint() {
      box.hidden = isGuest();
      ACTIONS.forEach(function (a, i) { buttons[i].disabled = !E.S || !a[2](E.S); });
    }
    U.on('render', paint);
    paint();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})(window.DC);
