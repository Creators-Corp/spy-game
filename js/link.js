/* Two phones, one shared game. The main screen owns the engine; each phone
   claims a role, mirrors state, and sends acknowledged, role-scoped inputs. */
(function (L) {
  'use strict';
  var U = L.util, E = L.engine, C = L.content, N = L.net, R = L.recovery;
  var query = new URLSearchParams(window.location.search);
  var ROLE = query.has('join') || /^(p1|p2)$/.test(query.get('role')) ? 'guest' : 'host';
  var POLL = 220, TOKEN = query.get('t') || '';
  function saved(key) { try { return sessionStorage.getItem(key) || ''; } catch (e) { return ''; } }
  function save(key, value) { try { sessionStorage.setItem(key, value); } catch (e) {} }
  TOKEN = TOKEN || saved('dc-seat-token');
  function id() { return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2); }
  var client = saved('dc-phone-client') || id();
  save('dc-phone-client', client);
  function wire(path) { return path + (path.indexOf('?') >= 0 ? '&' : '?') + 't=' + encodeURIComponent(TOKEN); }
  var lease = '', owner = false;
  function headers() { return lease ? { 'X-Host-Lease': lease } : {}; }
  function get(path) { return N.request(wire(path), undefined, headers()); }
  function post(path, body) { return N.request(wire(path), body, headers()); }
  var P1 = { ready: 1, restart: 1, act: 1, declineModule: 1, takePrize: 1,
    porteTap: 1, porteUndo: 1, porteSubmit: 1, coffreTap: 1, coffreUndo: 1,
    bureauSubmit: 1, bureauDoor: 1, clavierSubmit: 1, grilleTry: 1,
    deguisementSubmit: 1, ecouteCut: 1, fauxChoose: 1, tchatchePick: 1 };
  var P2 = { ready: 1, restart: 1, selectJob: 1, pullLever: 1 };
  var seats = { p1: { taken: false, age: null }, p2: { taken: false, age: null } };
  var link = { role: ROLE, player: null, relay: false, wanted: false, panel: false,
    needsToken: false, join: '', seen: 0, sent: 0, session: null };
  link.taken = function (role) { return ROLE === 'host' && seats[role].taken; };
  link.paused = function () {
    if (ROLE === 'host' && (R.pending || R.blocked)) return true;
    return link.wanted && ['p1', 'p2'].some(function (role) {
      var seat = seats[role];
      return seat.taken && (!link.seen || Date.now() - link.seen > 5000 ||
        !link.sent || Date.now() - link.sent > 5000 || seat.age === null ||
        seat.age + (Date.now() - link.seen) / 1000 > 5);
    });
  };
  link.renderGuest = function () { if (link.player) L[link.player].render(); };
  function observe(r) {
    if (r.seats) seats = r.seats;
    link.seen = Date.now(); link.relay = true;
    paintHostUI();
  }

  function runHost() {
    var host = R.identity.client, page = R.id();
    function session() {
      link.session = R.sync().session;
      return link.session;
    }
    function hostError(error) {
      if (error.status === 403 || error.status === 409) {
        owner = false; lease = '';
        R.block(error.status === 409 ? 'Another page is hosting. If you just refreshed, your game will be available in a few seconds. Otherwise, keep the original main screen open. This page will wait until it closes.' :
          'Reconnecting to the main screen session…');
      }
      paintHostUI();
    }
    var push = N.loop(function () {
      if (!link.wanted || link.needsToken) return;
      return post('/link/host', { client: host, secret: R.identity.secret, page: page }).then(function (claim) {
        lease = claim.lease; owner = true; R.block('');
        if (R.pending) return;
        var run = session(), seq = ++R.meta.seq;
        R.save();
        return post('/link/state', { host: host, seq: seq, session: run,
          job: C.jobIndex, seed: E.S.seed, S: E.S }).then(function (r) {
            link.sent = Date.now(); observe(r);
          });
        });
    }, 1000, hostError);
    N.loop(function () {
      if (!link.wanted || link.needsToken || !owner || R.pending || R.blocked) return;
      return get('/link/intent').then(function (r) {
        observe(r);
        var current = session(), acknowledged = [];
        (r.intents || []).forEach(function (m) {
          if (!m || m.session !== session()) return;
          acknowledged.push(m.id);
          if (R.meta.applied.indexOf(m.id) >= 0) return;
          R.meta.applied.push(m.id);
          if (R.meta.applied.length > 512) R.meta.applied.shift();
          var allowed = m.role === 'p1' ? P1 : m.role === 'p2' ? P2 : {};
          if (!allowed[m.call]) return;
          var args = m.args || [];
          if (m.call === 'selectJob') {
            if (E.S.phase === 'plan' && !E.S.ready.p2 && Number.isInteger(args[0]) && C.JOBS[args[0]]) U.emit('job', args[0]);
          } else if (m.call === 'restart') {
            if (E.S.phase === 'rank' || E.S.phase === 'jail') U.emit('restart');
          } else if (typeof E[m.call] === 'function') {
            try { E[m.call].apply(null, m.call === 'ready' ? [m.role] : args); } catch (e) { /* malformed tap */ }
          }
        });
        if (!acknowledged.length) return;
        U.emit('render'); push.kick();
        R.save();
        return post('/link/ack', { session: current, ids: acknowledged });
      });
    }, POLL, hostError);
    U.on('render', push.kick);
    U.on('ready', push.kick);
  }

  function snapshot(S) {
    var copy = {};
    Object.keys(S).forEach(function (key) { if (key !== 'elapsed') copy[key] = S[key]; });
    return JSON.stringify(copy);
  }
  function note(message) {
    ['guest-note', 'guest-note-p2'].forEach(function (key) {
      var bar = document.getElementById(key);
      if (bar && bar.textContent !== message) bar.textContent = message;
    });
    document.body.classList.toggle('link-waiting', message !== 'CONNECTED');
  }
  function picker(message) {
    document.body.classList.toggle('is-picking', !link.player);
    var text = document.getElementById('join-message');
    if (text && message !== undefined) text.textContent = message;
    ['p1', 'p2'].forEach(function (role) {
      var button = document.getElementById('join-' + role);
      if (button) {
        button.disabled = seats[role].taken;
        button.querySelector('small').textContent = seats[role].taken ? 'Already connected' : role === 'p1' ? 'Move, unlock, escape' : 'Read the plans and guide Assane';
      }
    });
  }

  function runGuest() {
    document.body.classList.add('is-guest');
    var remembered = {};
    try { remembered = JSON.parse(saved('dc-phone-seat') || '{}'); } catch (e) {}
    var ticket = remembered.ticket || '', epoch = remembered.epoch || '', v = -1;
    var session = null, drawn = '', queue = [], serial = 0, connected = false, claiming = false;
    var suggested = remembered.ticket ? null : query.get('role');
    function layout(role) {
      link.player = role;
      document.body.classList.toggle('guest-p1', role === 'p1');
      document.body.classList.toggle('guest-p2', role === 'p2');
      picker(); window.dispatchEvent(new Event('resize'));
    }
    var connectionState = '';
    function connection(message) {
      if (message !== connectionState) {
        connectionState = message;
        N.event('connection_state', { state: message });
      }
      connected = message === 'CONNECTED'; note(message);
    }
    function remember() { save('dc-phone-seat', JSON.stringify({ role: link.player, ticket: ticket, epoch: epoch })); }
    function loseSeat(message) {
      suggested = null;
      queue = []; ticket = ''; session = null; drawn = ''; v = -1;
      connection('CHOOSE YOUR ROLE'); layout(null); save('dc-phone-seat', ''); picker(message);
    }
    function claim(role) {
      if (claiming) return Promise.resolve();
      claiming = true; picker('Connecting…');
      return post('/link/claim', { role: role, client: client }).then(function (r) {
        ticket = r.ticket; epoch = r.epoch; v = -1; session = null;
        layout(role); remember(); connection('CONNECTING…'); poller.kick();
      }).catch(function (error) {
        if (link.player) connection('RECONNECTING…');
        else picker(error.status === 409 ? 'That role was just taken. Choose the other player.' :
          error.status === 403 ? 'Scan the QR code on the main screen to join.' :
          'Keep the main screen open. We’ll reconnect when it is ready.');
        throw error;
      }).finally(function () { claiming = false; });
    }
    function enqueue(call, args) {
      var allowed = link.player === 'p1' ? P1 : P2;
      if (!connected || !session || !allowed[call] || queue.length >= 8) return false;
      queue.push({ id: client + ':' + id() + ':' + (++serial), role: link.player,
        client: client, ticket: ticket, session: session, call: call, args: args, at: Date.now() });
      send.kick(); return true;
    }
    // Both engines are mirrors; no phone may accidentally execute the other role.
    Object.keys(Object.assign({}, P1, P2)).forEach(function (name) {
      if (typeof E[name] === 'function') E[name] = function () { return enqueue(name, [].slice.call(arguments)); };
    });
    link.selectJob = function (i) { return enqueue('selectJob', [i]); };
    link.restart = function () { return enqueue('restart', []); };
    var send = N.loop(function () {
      if (!queue.length) return;
      var item = queue[0];
      if (item.session !== session || Date.now() - item.at > 8000) { queue.shift(); poller.kick(); return; }
      return post('/link/intent', item).then(function () {
        if (queue[0] === item) queue.shift();
        if (queue.length) send.kick();
        poller.kick();
      }).catch(function (error) {
        connection('RECONNECTING…');
        if (error.status === 409 || error.status === 410) { queue = []; v = -1; }
        poller.kick(); throw error;
      });
    }, POLL);
    var poller = N.loop(function () {
      if (!link.player || !ticket) return;
      var path = '/link/state?since=' + v + '&epoch=' + encodeURIComponent(epoch) +
        '&role=' + link.player + '&client=' + encodeURIComponent(client) + '&ticket=' + encodeURIComponent(ticket);
      return get(path).then(function (r) {
        if (r.seatLost) {
          if (r.epoch !== epoch) return claim(link.player); // new relay, same open game
          loseSeat('This role was returned to the main screen. Choose a free role to rejoin.');
          return;
        }
        epoch = r.epoch; v = r.v; remember();
        connection(r.hostAge === null || r.hostAge > 5 ? 'WAITING FOR THE MAIN SCREEN…' : 'CONNECTED');
        if (!r.payload) return;
        var p = r.payload;
        if (p.session !== session) {
          session = p.session; queue = []; drawn = '';
          U.silence(); C.loadJob(p.job); E.reset(p.seed);
          L.p1.resetTyped(); L.p2.reset();
        }
        E.adopt(p.S);
        var shot = snapshot(p.S);
        if (shot !== drawn) { drawn = shot; link.renderGuest(); }
        var P = C.PRESSURE, S = E.S;
        if (link.player === 'p1') L.p1.pressure(S.running && S.phase === 'play' && P
          ? { idle: Math.max(0, (Date.now() - S.lastActionAt) / 1000), grace: P.grace,
              ticking: (Date.now() - S.lastActionAt) / 1000 >= P.grace } : null);
      });
    }, POLL, function () { connection('RECONNECTING…'); });
    ['p1', 'p2'].forEach(function (role) {
      document.getElementById('join-' + role).addEventListener('click', function () { claim(role).catch(function () {}); });
    });
    document.getElementById('guest-change').addEventListener('click', function () {
      if (!link.player) return;
      post('/link/release', { role: link.player, client: client, ticket: ticket }).then(function () {
        loseSeat('Choose your role.'); lobby.kick();
      }).catch(function () { connection('RECONNECTING…'); });
    });
    if (remembered.role && ticket) { layout(remembered.role); connection('RECONNECTING…'); }
    else { layout(null); connection('CHOOSE YOUR ROLE'); }
    var lobby = N.loop(function () {
      if (link.player) return;
      return get('/link/status').then(function (r) {
        if (r.protocol !== 4) { picker('Update the main screen, then reload this page.'); return; }
        seats = r.seats || seats;
        picker(r.needsToken ? 'Scan the QR code on the main screen to join.' :
          !r.hostReady ? 'Waiting for the main screen. Keep it open.' :
          seats.p1.taken && seats.p2.taken ? 'Both players are connected. To switch phones, disconnect a player on the main screen.' :
          'Pick a different role on each phone.');
        ['p1', 'p2'].forEach(function (role) {
          document.getElementById('join-' + role).disabled = claiming || r.needsToken || !r.hostReady || seats[role].taken;
        });
        if (suggested && r.hostReady && !r.needsToken) {
          var role = suggested; suggested = null;
          if (!seats[role].taken) return claim(role);
        }
      });
    }, 1500, function () { picker('Reconnecting… Keep this page open.'); });
  }

  function paintHostUI() {
    if (ROLE !== 'host') return;
    var btn = document.getElementById('btn-seat'), panel = document.getElementById('seat-panel');
    if (!btn || !panel) return;
    var count = ['p1', 'p2'].filter(function (role) { return seats[role].taken; }).length;
    btn.textContent = count ? 'PHONES: ' + count + '/2 CONNECTED' : 'CONNECT PHONES';
    panel.classList.toggle('is-on', link.panel);
    panel.classList.toggle('is-locked', link.needsToken);
    document.getElementById('save-status').textContent = R.storageOK ? 'Progress is saved in this tab for refresh recovery.' : 'Browser storage is unavailable. Refresh recovery is unavailable in this tab.';
    ['p1', 'p2'].forEach(function (role) {
      var seat = seats[role], el = document.getElementById(role);
      if (el) el.classList.toggle('is-handed', seat.taken);
      var text = document.getElementById('seat-status-' + role);
      var stale = Date.now() - link.seen > 5000 || Date.now() - link.sent > 5000;
      var message = seat.taken ? (seat.age > 5 || stale ? 'Reconnecting…' : 'Connected ✓') : 'Waiting for phone';
      if (text && text.textContent !== message) text.textContent = message;
      var reclaim = document.getElementById('reclaim-' + role);
        if (reclaim) reclaim.disabled = !seat.taken || !owner;
    });
  }
  function checkStatus() {
    return get('/link/status').then(function (r) {
      if (!r.relay || r.protocol !== 4) { var error = new Error('Update required'); error.status = 426; throw error; }
      link.relay = true; link.needsToken = !!r.needsToken;
      observe(r);
      var join = r.join || '';
      if (join !== link.join) {
        link.join = join;
        document.getElementById('seat-url').value = join;
        if (join) document.getElementById('seat-qr').src = wire('/qr.svg?cb=' + Date.now());
      }
      return !link.needsToken;
    });
  }
  function boot() {
    var reportURL = null;
    document.getElementById('report-close').addEventListener('click', function () {
      document.getElementById('report-panel').hidden = true;
    });
    document.querySelectorAll('[data-diagnostics]').forEach(function (button) {
      button.addEventListener('click', function () {
        var panel = document.getElementById('report-panel'), output = document.getElementById('report-text');
        var download = document.getElementById('report-download');
        panel.hidden = false; output.value = 'Preparing connection report…'; download.hidden = true;
        var report = { protocol: 4, generatedAt: new Date().toISOString(), role: ROLE,
          player: link.player, recoveryAvailable: R.storageOK, client: N.diagnostics() };
        var server = owner ? get('/link/diagnostics').catch(function () { return { unavailable: true }; }) : Promise.resolve(null);
        server.then(function (data) {
          report.server = data;
          output.value = JSON.stringify(report, null, 2);
          if (reportURL) URL.revokeObjectURL(reportURL);
          reportURL = URL.createObjectURL(new Blob([output.value], { type: 'application/json' }));
          download.href = reportURL; download.hidden = false;
        });
      });
    });
    if (ROLE === 'guest') { runGuest(); return; }
    R.block('Checking the main screen connection…');
    var started = false;
    document.getElementById('btn-seat').addEventListener('click', function () {
      link.panel = !link.panel; paintHostUI();
      if (link.panel) checkStatus().catch(function () {});
    });
    document.getElementById('seat-close').addEventListener('click', function () { link.panel = false; paintHostUI(); });
    document.getElementById('seat-copy').addEventListener('click', function () {
      var button = this, input = document.getElementById('seat-url');
      if (navigator.clipboard && link.join) navigator.clipboard.writeText(link.join).then(function () {
        button.textContent = 'COPIED'; setTimeout(function () { button.textContent = 'COPY LINK'; }, 2000);
      }).catch(function () { input.focus(); input.select(); });
      else { input.focus(); input.select(); }
    });
    ['p1', 'p2'].forEach(function (role) {
      document.getElementById('reclaim-' + role).addEventListener('click', function () {
        post('/link/release', { role: role }).then(observe).catch(function () {});
      });
    });
    document.getElementById('seat-token-form').addEventListener('submit', function (event) {
      event.preventDefault();
      var input = document.getElementById('seat-token');
      TOKEN = input.value.trim(); save('dc-seat-token', TOKEN);
      checkStatus().then(function (ok) {
        if (!ok) { input.value = ''; input.placeholder = 'THAT TOKEN WAS REFUSED'; }
      }).catch(function () { input.placeholder = 'CONNECTION FAILED — TRY AGAIN'; });
    });
    var discovery = N.loop(function () {
      return checkStatus().then(function () {
        document.getElementById('btn-seat').hidden = false;
        if (link.needsToken) R.block('');
        if (!started) { started = true; link.wanted = true; runHost(); }
        discovery.stop();
      });
    }, 1000, function (error) {
      if (error.status === 404 || window.location.protocol === 'file:') { R.block(''); discovery.stop(); }
      else if (error.status === 426) { R.block('Update the main screen and reload this page to connect.'); discovery.stop(); }
      else R.block('Unable to reach the main screen service. Retrying…');
    });
  }
  L.link = link;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.DC);
