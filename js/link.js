/* link.js — THE SECOND SEAT.

   The prototype fakes three devices on one screen. That is right for a room
   with one laptop, and wrong the moment somebody in the room should actually
   be playing: Assane's whole half is deciding what to do with information he
   does not have, and it is not the same decision when the person making it can
   see Benjamin's plan by glancing left.

   So: open the game as usual and it is exactly what it was. Press SECOND SEAT
   and a QR code appears. Somebody scans it on their own machine, and from that
   moment Assane is theirs — the presenter keeps the television and Benjamin,
   and the P1 phone on the presenter's screen goes dark with a note saying who
   has it. Close the guest tab and it comes back. Nothing about the game is
   different in either mode, which is the point of doing it this way.

   HOW LITTLE THIS TOUCHES THE GAME. The presenter's browser is still the only
   place the game exists — engine.js runs there and nowhere else, and every
   rule, roll and roster is decided there. Two things cross the wire:

       presenter -> guest    { job, seed, S }
       guest -> presenter    { call: 'act', args: [0, 1] }

   The state is the engine's own S, 3 KB of JSON. The seed is what lets the
   guest rebuild the CONTENT without being sent it: reset(seed) is
   deterministic, so the guest rolling the same seed gets the same door code,
   the same safe, the same roster, the same everything. Sending a seed instead
   of a content payload is the whole reason this is small.

   WHY THE GUEST NEVER RUNS THE RULES. It adopts the state it is given and its
   engine is a mirror — every intent p1.js raises is intercepted here and
   posted instead. That means no prediction, no rollback, no divergence, and no
   second copy of the rules to keep in step. It also means a tap costs one
   round trip, which on a LAN is nothing and is anyway a turn-based game where
   the guards do not move until Assane does.

   WHAT THIS IS NOT. The guest is served the same javascript as everybody else,
   so a guest who opens devtools can read Benjamin's answers. Closing that means
   splitting content.js by role and projecting per player, which is a real piece
   of work and the right one if this ever stops being a demo. Said plainly here
   so nobody discovers it in front of an audience. */
(function (L) {
  'use strict';
  var U = L.util, E = L.engine, C = L.content;

  var ROLE = /[?&]role=p1\b/.test(window.location.search) ? 'guest' : 'host';
  var POLL = 220;                    /* ms between polls; turn-based, so plenty */

  /* THE TOKEN, WHEN THERE IS ONE. Hosted somewhere public, serve.py can be
     given a SEAT_TOKEN and will then refuse any relay call without it — or the
     first stranger to find the address is Assane. It rides in the page's own
     URL, so the presenter and the guest both already carry it and neither has
     to type anything. Locally there is no token and this appends nothing. */
  var TOKEN = (/[?&]t=([^&]+)/.exec(window.location.search) || [])[1] || '';
  try { TOKEN = TOKEN || sessionStorage.getItem('dc-seat-token') || ''; } catch (e) {}
  function setToken(t) {
    TOKEN = t || '';
    try { sessionStorage.setItem('dc-seat-token', TOKEN); } catch (e) {}
  }
  function wire(path) {
    if (!TOKEN) return path;
    return path + (path.indexOf('?') >= 0 ? '&' : '?') + 't=' + encodeURIComponent(TOKEN);
  }

  /* the only things a guest may ask the presenter's engine to do. Benjamin's
     verbs are deliberately absent: the levers are the presenter's half, and a
     whitelist here is the difference between a second seat and a second
     keyboard on somebody else's game. */
  var ALLOWED = {
    ready: 1,
    act: 1, declineModule: 1, takePrize: 1,
    porteTap: 1, porteUndo: 1, porteSubmit: 1,
    coffreTap: 1, coffreUndo: 1,
    bureauSubmit: 1, bureauDoor: 1,
    clavierSubmit: 1, grilleTry: 1,
    deguisementSubmit: 1, ecouteCut: 1, fauxChoose: 1,
    tchatchePick: 1
  };

  var link = {
    role: ROLE,
    relay: false,        /* is there a relay behind this page at all */
    wanted: false,       /* has the presenter asked for a second seat */
    guest: false,        /* is somebody actually holding it */
    join: '',
    needsToken: false,   /* hosted with a SEAT_TOKEN, and this page has not got it */
    seen: 0
  };

  function post(path, body) {
    return fetch(wire(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); });
  }

  /* ------------------------------------------------------------ the presenter */
  /* Pushes Assane's screen after every render and drains whatever he tapped.
     Both are cheap and neither blocks the game: if the relay is not there —
     opened from a file, or from the sealed build — everything below quietly
     does nothing and the prototype is what it always was. */
  function runHost() {
    var lastSent = '';

    function pushState() {
      if (!link.wanted) return;
      var payload = { job: C.jobIndex, seed: E.S.seed, S: E.S };
      var wire = JSON.stringify(payload);
      if (wire === lastSent) return;
      lastSent = wire;
      post('/link/state', payload).then(function (r) {
        setGuest(!!(r && r.guest));
      }).catch(function () { link.relay = false; });
    }

    function pullIntents() {
      if (!link.wanted) return;
      fetch(wire('/link/intent')).then(function (r) { return r.json(); }).then(function (r) {
        setGuest(!!(r && r.guest));
        (r.intents || []).forEach(function (m) {
          if (!m || !ALLOWED[m.call] || typeof E[m.call] !== 'function') return;
          var args = m.args || [];
          /* a guest holds ONE seat. Without this it could tap Benjamin ready
             from the other side of the room and start the job on its own. */
          if (m.call === 'ready') args = ['p1'];
          try { E[m.call].apply(null, args); } catch (e) { /* a bad tap is not a crash */ }
        });
        if ((r.intents || []).length) { lastSent = ''; U.emit('render'); }
      }).catch(function () { link.relay = false; });
    }

    U.on('render', pushState);
    setInterval(pullIntents, POLL);
    setInterval(pushState, 1000);     /* a heartbeat, so a late guest catches up */
  }

  /* ---------------------------------------------------------------- the guest */
  /* Adopts the presenter's state and sends taps back. p1.js is not modified and
     does not know: the intents it calls are swapped underneath it. */
  function runGuest() {
    document.body.classList.add('is-guest');
    /* THE STAGE JUST CHANGED SIZE, SO IT HAS TO BE MEASURED AGAIN.
       main.js fits the stage once, on DOMContentLoaded, and at that moment
       this page still looked like a presenter's: a 1680px row of television
       and two phones, which on a handset fits at about 0.22. The class above
       throws away everything but Assane's phone, so the stage becomes 360px
       wide — but the scale stayed where it was, and the guest got a phone
       drawn at a fifth of its size. It went unnoticed because a guest on a
       laptop is legible either way, and the second seat is precisely the seat
       most likely to be a phone: it is what the QR code is for. */
    window.dispatchEvent(new Event('resize'));
    var v = 0, started = false;

    Object.keys(ALLOWED).forEach(function (name) {
      var real = E[name];
      if (typeof real !== 'function') return;
      E[name] = function () {
        post('/link/intent', { call: name, args: [].slice.call(arguments) }).catch(function () {});
        /* p1.js reads a return value from a few of these to flash a field red.
           Saying "fine" and letting the next state say otherwise keeps the
           screen honest without guessing at the rules. */
        return true;
      };
    });

    function poll() {
      fetch(wire('/link/state?since=' + v)).then(function (r) { return r.json(); }).then(function (r) {
        if (!r || r.payload === undefined || r.payload === null) return;
        v = r.v;
        var p = r.payload;
        if (!started) {
          started = true;
          C.loadJob(p.job);
          E.reset(p.seed);            /* deterministic: same codes, same roster */
        }
        E.adopt(p.S);
        L.p1.render();
        paintGuestBar();
      }).catch(function () { paintGuestBar(true); });
    }
    setInterval(poll, POLL);
    poll();
  }

  function paintGuestBar(lost) {
    var bar = document.getElementById('guest-note');
    if (!bar) return;
    bar.textContent = lost ? 'LOST THE VAN — RECONNECTING' : 'CONNECTED';
    bar.classList.toggle('is-lost', !!lost);
  }

  /* ------------------------------------------------------------------- the UI */
  function setGuest(on) {
    if (on === link.guest) return;
    link.guest = on;
    paintHostUI();
    U.emit('render');
  }

  function paintHostUI() {
    var btn = document.getElementById('btn-seat');
    var panel = document.getElementById('seat-panel');
    if (!btn || !panel) return;
    btn.classList.toggle('is-on', link.wanted);
    btn.textContent = link.guest ? 'SECOND SEAT: TAKEN' : link.wanted ? 'SECOND SEAT: WAITING' : 'SECOND SEAT';
    panel.classList.toggle('is-on', link.wanted && !link.guest);
    /* hosted behind a token this page has not been given: ask for it once
       rather than making somebody rebuild the address by hand */
    panel.classList.toggle('is-locked', link.needsToken);
    var p1 = document.getElementById('p1');
    if (p1) p1.classList.toggle('is-handed', link.guest);
  }

  /* re-ask now that a token has been typed; a good one comes back with the
     join address attached and the panel turns into the QR code */
  function checkStatus() {
    return fetch(wire('/link/status')).then(function (r) { return r.json(); }).then(function (r) {
      link.relay = !!(r && r.relay);
      link.needsToken = !!(r && r.needsToken);
      link.join = (r && r.join) || '';
      var url = document.getElementById('seat-url');
      if (url) url.textContent = link.join || '';
      var img = document.getElementById('seat-qr');
      /* cache-buster FIRST, so it is the one that brings the "?" along. Built
         the other way round this reads /qr.svg&cb=... on any copy without a
         token — no question mark anywhere, a 404, and no QR on screen. Which
         is every demo run from a laptop in a room. */
      if (img && link.join) img.setAttribute('src', wire('/qr.svg?cb=' + Date.now()));
      paintHostUI();
      return link.relay && !link.needsToken;
    });
  }

  function openSeat() {
    link.wanted = !link.wanted;
    if (link.wanted) {
      checkStatus();
    } else {
      /* TAKING THE SEAT BACK HAS TO TAKE THE PHONE BACK. Both pollers stop
         when the seat is closed, and they are the only things that ever
         cleared link.guest — so closing it while somebody held Assane left
         HANDED OVER across a phone nothing would ever un-grey. */
      link.guest = false;
    }
    paintHostUI();
    U.emit('render');
  }

  /* ----------------------------------------------------------------- the boot */
  function boot() {
    var form = document.getElementById('seat-token-form');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var box = document.getElementById('seat-token');
      setToken(box ? box.value.trim() : '');
      checkStatus().then(function (ok) {
        if (!ok && box) { box.value = ''; box.placeholder = 'THAT TOKEN WAS REFUSED'; }
      });
    });

    checkStatus().then(function () {
      if (!link.relay) return;
      var btn = document.getElementById('btn-seat');
      if (btn) { btn.hidden = false; btn.addEventListener('click', openSeat); }
      if (ROLE === 'guest') { link.wanted = true; runGuest(); } else { runHost(); }
    }).catch(function () {
      /* no relay: a file:// open or the sealed build. Nothing to do, and the
         prototype behaves exactly as it did before any of this existed. */
      link.relay = false;
      if (ROLE === 'guest') {
        var note = document.getElementById('guest-note');
        if (note) note.textContent = 'NO RELAY — RUN python serve.py ON THE PRESENTER’S MACHINE';
      }
    });
  }

  L.link = link;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.DC);
