/* main.js — boot, the fixed stage, and the one render pass that keeps all
   three screens in step. There is no network here on purpose: the prototype
   fakes the three-device setup on one screen so the room can see the whole
   conversation at once. The state machine (engine.js) never touches the DOM,
   so the three views are already independent of each other. */
(function (L) {
  'use strict';
  var U = L.util, E = L.engine, G = L.glyphs;

  /* ---- keep the whole stage on screen, whatever the room's laptop is ----
     The stage size is READ, not hard-coded. It used to say 1000 here while the
     stylesheet said something else, so shortening the stage bought no extra
     size on screen — the scale was still being computed against a height that
     no longer existed. Layout lives in one place now. */
  function fit() {
    var st = document.getElementById('stage');
    var s = Math.min(window.innerWidth / st.offsetWidth, window.innerHeight / st.offsetHeight);
    st.style.transform = 'scale(' + s + ')';
  }

  /* ---- render: scroll position is preserved so Benjamin does not lose his
          page in the manual every time Assane takes a step ---- */
  var toastTimer = null;
  function render() {
    var keep = {};
    ['#p1-screen', '#p2-screen'].forEach(function (sel) {
      var b = U.$(sel + ' .pbody');
      if (b) keep[sel] = b.scrollTop;
    });

    L.tv.render();
    L.p1.render();
    L.p2.render();

    Object.keys(keep).forEach(function (sel) {
      var b = U.$(sel + ' .pbody');
      if (b) b.scrollTop = keep[sel];
    });

    clearTimeout(toastTimer);
    if (E.S.toast) toastTimer = setTimeout(function () { L.tv.render(); }, 1200);

    /* the lights-out card clears itself */
    var since = E.S.blackoutAt ? Date.now() - E.S.blackoutAt : 9e9;
    if (since < 1800) setTimeout(function () { L.tv.render(); }, 1800 - since + 30);
  }

  function restart() {
    E.reset();
    L.p1.resetTyped();
    L.p2.reset();
    render();
  }

  function boot() {
    G.build();
    U.preloadArt(['venue-establishing', 'p1-role-assane', 'p2-role-benjamin', 'bureau-desk',
                  'assane-standing', 'guard-standing', 'jail-slam', 'blackout-cut', 'blackout-door']);
    U.hydrateStaticSlots();
    E.reset();

    U.on('render', render);
    U.on('restart', restart);
    /* Changing the contract is a full reset — a job is a map, a roster and six
       module payloads, and half of one job mixed into another is nonsense. */
    U.on('job', function (i) {
      L.content.loadJob(i);
      restart();
    });
    U.on('ready', function () {
      var S = E.S;
      if (S.ready.p1 && S.ready.p2) E.begin();
      render();
    });

    /* the clock ticks on its own, but only the clock re-draws —
       a full pass every second would fight with what the players are reading */
    setInterval(function () {
      if (!E.S.running) return;
      E.S.elapsed++;
      var c = U.$('#tv-clock');
      if (c) c.textContent = U.mmss(E.S.elapsed);
    }, 1000);

    /* keyboard is a convenience for testing alone; the real input is the pad */
    var KEYS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
                 w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], ' ': [0, 0] };
    window.addEventListener('keydown', function (ev) {
      var k = KEYS[ev.key];
      if (!k || E.S.phase !== 'play') return;
      ev.preventDefault();
      E.act(k[0], k[1]);
      render();
    });

    U.$('#btn-restart').addEventListener('click', restart);
    U.$('#btn-mute').addEventListener('click', function () {
      var m = !U.isMuted();
      U.setMuted(m);
      this.textContent = 'SOUND: ' + (m ? 'OFF' : 'ON');
    });
    U.$('#btn-art').addEventListener('click', function () {
      document.body.classList.toggle('hide-slots');
      this.textContent = 'SLOTS: ' + (document.body.classList.contains('hide-slots') ? 'OFF' : 'ON');
    });

    fit();
    window.addEventListener('resize', fit);
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.DC);
