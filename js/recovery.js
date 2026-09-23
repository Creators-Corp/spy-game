/* Per-tab checkpoints preserve a run across reloads without sharing host keys
   with phones or unrelated tabs. Schema changes deliberately invalidate saves. */
(function (L) {
  'use strict';
  var E = L.engine, C = L.content, U = L.util, key = 'dc-checkpoint-v1';
  var candidate = null, current = null;
  function id() {
    var bytes = new Uint8Array(24);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  function read(key) { try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (e) { return null; } }
  var identity = read('dc-host-identity');
  if (!identity || typeof identity.client !== 'string' || typeof identity.secret !== 'string') {
    identity = { client: id(), secret: id() };
    try { sessionStorage.setItem('dc-host-identity', JSON.stringify(identity)); } catch (e) {}
  }
  var R = { pending: false, blocked: false, identity: identity, id: id,
    meta: { session: id(), seq: 0, applied: [] }, storageOK: true };
  function valid(p) {
    return p && p.schema === 1 && Number.isFinite(p.at) && Number.isInteger(p.job) && C.JOBS[p.job] && p.S &&
      Number.isFinite(p.S.seed) && ['plan', 'play', 'module', 'tchatche', 'rank', 'jail'].indexOf(p.S.phase) >= 0 &&
      p.S.assane && p.S.ready && p.S.levers && Array.isArray(p.S.transitions) &&
      p.meta && typeof p.meta.session === 'string' && Number.isInteger(p.meta.seq) && Array.isArray(p.meta.applied);
  }
  R.sync = function () {
    if (current !== E.S) {
      current = E.S; R.meta.session = id(); R.meta.applied = [];
    }
    return R.meta;
  };
  R.save = function () {
    if (R.pending || R.blocked || (L.link && L.link.role === 'guest') || !E.S) return;
    R.sync();
    try {
      sessionStorage.setItem(key, JSON.stringify({ schema: 1, at: Date.now(), job: C.jobIndex, S: E.S, meta: R.meta }));
      R.storageOK = true;
    } catch (e) { R.storageOK = false; }
  };
  R.paint = function () {
    document.getElementById('recovery-panel').hidden = !R.pending || R.blocked;
    document.getElementById('host-notice').hidden = !R.blocked;
    var stage = document.querySelector('.stage-fit');
    if (stage) stage.inert = R.pending || R.blocked;
  };
  R.block = function (message) {
    R.blocked = !!message;
    document.getElementById('host-message').textContent = message || '';
    R.paint();
  };
  R.boot = function () {
    if (L.link && L.link.role === 'guest') return;
    candidate = read(key);
    if (!valid(candidate)) candidate = null;
    current = E.S;
    if (candidate) { R.pending = true; R.meta = candidate.meta; }
    document.getElementById('resume-game').addEventListener('click', function () {
      if (!candidate || R.blocked) return;
      U.silence(); C.loadJob(candidate.job); E.reset(candidate.S.seed);
      E.restore(candidate.S, candidate.at); current = E.S;
      L.p1.resetTyped(); L.p2.reset();
      R.pending = false; candidate = null; R.paint();
      U.emit('render'); R.save();
      if (L.net) L.net.event('game_resumed');
    });
    document.getElementById('new-game').addEventListener('click', function () {
      if (R.blocked) return;
      R.pending = false; candidate = null; current = null;
      R.paint(); U.emit('restart'); R.save();
    });
    U.on('render', R.save);
    U.on('ready', R.save);
    window.addEventListener('pagehide', R.save);
    document.addEventListener('visibilitychange', function () { if (document.hidden) R.save(); });
    setInterval(R.save, 1000);
    R.paint();
  };
  L.recovery = R;
})(window.DC);
