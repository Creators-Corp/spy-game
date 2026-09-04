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
    paintRoster();

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

  /* which phone is live: 'p1', 'p2', or 'both'. Held here rather than in the
     engine because it is about the room the prototype is being shown in, not
     about the heist. */
  var live = 'both';
  function setLive(next) {
    live = next;
    ['p1', 'p2'].forEach(function (who) {
      U.$('#' + who).classList.toggle('is-blocked', live !== 'both' && live !== who);
    });
    U.$$('#phone-swap button').forEach(function (b) {
      b.classList.toggle('is-on', b.getAttribute('data-live') === live);
    });
    U.$('#btn-both').classList.toggle('is-on', live === 'both');
  }

  /* THE PINNED ROSTER.
     Guards start somewhere new every run, which is the point — but a rehearsed
     walkthrough needs the run it was written against, and until now the only
     way to ask for one was to hand-edit the URL, while RESTART threw it away
     again. Pin a number here and every restart, and every change of contract,
     plays those guards. NEW goes back to a fresh roster each time. */
  var pinned = null;
  function paintRoster() {
    var box = U.$('#roster'), input = U.$('#roster-num');
    if (!box) return;
    box.classList.toggle('is-pinned', pinned !== null);
    if (document.activeElement !== input) input.value = E.S.seed;
    U.$('#roster-pin').textContent = pinned === null ? 'PIN' : 'PINNED';
  }

  function restart() {
    /* a new job silences the old one: without this a catch sting or a victory
       cue plays on over the plan screen of the next run */
    U.silence();
    E.reset(pinned);
    L.p1.resetTyped();
    L.p2.reset();
    render();
    paintRoster();
  }

  function boot() {
    G.build();
    U.preloadArt(['ui/control-bttn-idle', 'ui/control-bttn-pressed', 'ui/control-bttn-disabled',
                  'ui/header-p1', 'ui/flourish-left', 'ui/flourish-right']);
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
      /* THE PRESSURE. The one thing that moves between inputs. The television
         redraws so the ring round Assane fills; Player 1's strip is updated in
         place rather than re-rendered, because swapping the d-pad out from
         under a finger once a second would eat taps. Player 2 is never
         redrawn by the clock — he is reading. */
      var p = E.tick(Date.now());
      if (E.S.phase === 'play') { L.tv.render(); L.p1.pressure(p); }
      if (p && p.ticking) U.buzz('p1');   /* the phone nags while the clock charges */
    }, 1000);

    /* keyboard is a convenience for testing alone; the real input is the pad */
    var KEYS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
                 w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], ' ': [0, 0] };
    window.addEventListener('keydown', function (ev) {
      var k = KEYS[ev.key];
      if (!k || E.S.phase !== 'play') return;
      if (live === 'p2') return;          /* Assane's phone is blocked; so are his keys */
      ev.preventDefault();
      if (E.isWall(E.S.assane.x + k[0], E.S.assane.y + k[1])) return;
      E.act(k[0], k[1]);
      render();
      var id = k[1] < 0 ? 'aup' : k[1] > 0 ? 'adown' : k[0] < 0 ? 'aleft' : k[0] > 0 ? 'aright' : null;
      var button = U.$('#p1 .dpad ' + (id ? '[aria-label="' + id + '"]' : '.dpad__wait'));
      if (button && !button.disabled) button.classList.add('is-pressed');
    });
    function releaseControls() {
      U.$$('#p1 .dpad .is-pressed').forEach(function (button) { button.classList.remove('is-pressed'); });
    }
    window.addEventListener('keyup', releaseControls);
    window.addEventListener('blur', releaseControls);

    U.$('#btn-restart').addEventListener('click', restart);
    /* a seed in the URL arrives already pinned, so a link still works */
    if (/[?&]seed=\d+/.test(window.location.search)) pinned = E.S.seed;
    U.$('#roster-pin').addEventListener('click', function () {
      var v = U.$('#roster-num').value.replace(/\D/g, '');
      pinned = v === '' ? E.S.seed : Number(v);
      restart();
    });
    U.$('#roster-new').addEventListener('click', function () {
      pinned = null;
      restart();
    });
    U.$('#roster-num').addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') U.$('#roster-pin').click();
    });
    paintRoster();
    U.$('#btn-mute').addEventListener('click', function () {
      var m = !U.isMuted();
      U.setMuted(m);
      this.textContent = 'SOUND: ' + (m ? 'OFF' : 'ON');
    });
    /* ---- ONE PHONE AT A TIME ----
       The switch hands the stage to one player and BLOCKS the other; BOTH
       PHONES puts them back side by side for a walkthrough, which is the
       default because it is how the prototype has always demonstrated. */
    U.$$('#phone-swap button').forEach(function (b) {
      b.addEventListener('click', function () { setLive(b.getAttribute('data-live')); });
    });
    U.$('#btn-both').addEventListener('click', function () { setLive('both'); });
    setLive('both');

    U.$('#btn-art').addEventListener('click', function () {
      document.body.classList.toggle('hide-slots');
      this.textContent = 'SLOTS: ' + (document.body.classList.contains('hide-slots') ? 'OFF' : 'ON');
    });

    fit();
    window.addEventListener('resize', fit);
    /* the wall sheet arrives over the wire, and ready() fires straight away if
       it is already in. Painting the room first shows the floor drawn from the
       bare rules and then visibly correcting itself. */
    L.tiles.ready(render);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.DC);
