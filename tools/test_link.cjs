const assert = require('node:assert/strict');
const { test } = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = name => fs.readFileSync(path.join(__dirname, '..', 'js', name), 'utf8');
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

function clock() {
  let now = 100000, serial = 0;
  const timers = new Map();
  return {
    Date: class extends Date { static now() { return now; } },
    setTimeout(fn, ms) { const id = ++serial; timers.set(id, { fn, at: now + ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    async advance(ms) {
      const target = now + ms;
      for (;;) {
        await flush();
        const next = [...timers].sort((a, b) => a[1].at - b[1].at).find(x => x[1].at <= target);
        if (!next) break;
        now = next[1].at; timers.delete(next[0]); next[1].fn();
      }
      now = target; await flush();
    }
  };
}
function events() {
  const listeners = {};
  return {
    addEventListener(name, fn) { (listeners[name] ||= new Set()).add(fn); },
    removeEventListener(name, fn) { listeners[name]?.delete(fn); },
    dispatchEvent(event) { for (const fn of listeners[event.type] || []) fn(event); }
  };
}
function transport(fetch) {
  const time = clock(), window = { ...events(), DC: {} }, document = { ...events(), hidden: false };
  const ctx = vm.createContext({ window, document, fetch, AbortController, ...time, Math });
  vm.runInContext(source('net.js'), ctx);
  return { net: window.DC.net, time, window, document };
}

test('slow requests never overlap, even when render/online events kick the loop', async () => {
  const { net, time, window } = transport();
  let calls = 0, release;
  const loop = net.loop(() => { calls++; return new Promise(resolve => { release = resolve; }); }, 220);
  await time.advance(0);
  for (let i = 0; i < 20; i++) loop.kick();
  window.dispatchEvent({ type: 'online' });
  await time.advance(3000);
  assert.equal(calls, 1);
  release(); await time.advance(0);
  assert.equal(calls, 2);
  loop.stop(); release(); await time.advance(10000);
  assert.equal(calls, 2);
});

test('request deadline aborts a hung fetch; non-2xx responses reject', async () => {
  let aborted = false;
  const { net, time } = transport((url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); });
  }));
  const result = net.request('/slow').catch(e => e.message);
  await time.advance(8000);
  assert.equal(await result, 'aborted'); assert.equal(aborted, true);
  const other = transport(async () => ({ ok: false, status: 503 }));
  await assert.rejects(other.net.request('/busy'), e => e.status === 503);
});

test('stalled state reads abort after three seconds and report their stage without credentials', async () => {
  for (const stage of ['waiting_for_headers', 'reading_body']) {
    const p = transport((url, options) => {
      const hung = new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted'))));
      return stage === 'reading_body' ? Promise.resolve({ ok: true, json: () => hung }) : hung;
    });
    const result = p.net.request('/link/state?ticket=PRIVATE&t=SECRET').catch(e => e);
    await p.time.advance(2999);
    const active = p.net.diagnostics();
    assert.equal(active.inFlight[0].stage, stage);
    assert.equal(active.inFlight[0].ageMs, 2999);
    assert.equal(JSON.stringify(active).includes('PRIVATE'), false);
    await p.time.advance(1);
    assert.equal((await result).transport, true);
    const report = p.net.diagnostics();
    assert.equal(report.timeouts, 1);
    assert.equal(report.inFlight.length, 0);
    assert.equal(report.events[0].durationMs, 3000);
    assert.equal(report.events[0].stage, stage);
  }
});

test('failed polls back off and foregrounding retries immediately', async () => {
  const { net, time, document } = transport();
  let calls = 0;
  const loop = net.loop(() => { calls++; return Promise.reject(new Error('offline')); }, 220);
  await time.advance(0); assert.equal(calls, 1);
  await time.advance(499); assert.equal(calls, 1);
  await time.advance(251); assert.equal(calls, 2);
  document.dispatchEvent({ type: 'visibilitychange' });
  await time.advance(0); assert.equal(calls, 3);
  loop.stop();
});

function peer(role, remember = true, storage = new Map(), room = 'test-room-123456789') {
  const loops = [], handlers = {}, nodes = new Map(), calls = [];
  const classList = () => ({ add() {}, toggle() {} });
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, { classList: classList(), textContent: '',
      addEventListener(event, fn) { handlers[id + ':' + event] = fn; }, setAttribute() {}, querySelector() { return {}; } });
    return nodes.get(id);
  }
  const E = { S: { seed: 1, phase: 'plan', ready: { p1: false, p2: false }, turn: 0 },
    porteTap() {}, porteUndo() {}, porteClear() {}, porteSubmit() {}, coffreTap() {}, coffreUndo() {}, clavierTap() {}, clavierClear() {}, clavierSubmit() {}, bureauTap() {}, bureauClear() {},
    pullLever(...args) { calls.push(['lever', ...args]); }, ready(who) { calls.push(['ready', who]); }, act(...args) { calls.push(['act', ...args]); },
    reset(seed) { calls.push(['reset', seed]); E.S = { seed }; }, adopt(s) { E.S = s; } };
  const L = { engine: E, content: { jobIndex: 0, PORTE: { code: '1234' }, JOBS: [{}, {}], loadJob(i) { calls.push(['job', i]); } },
    recovery: { identity: { client: 'presenter', secret: 'secret' }, id: () => 'page',
      pending: false, blocked: false, storageOK: true, meta: { session: 'run-a', seq: 0, applied: [] },
      sync() { return this.meta; }, save() {}, block(message) { this.blocked = !!message; } },
    p1: { resetTyped() {}, render() { calls.push(['render']); }, pressure() {} },
    p2: { reset() {}, render() { calls.push(['p2-render']); } },
    util: { silence() {}, on(name, fn) { handlers[name] = fn; }, emit(name) { handlers[name]?.(); } },
    net: { event() {}, request: async () => { throw new Error('Set a mock response'); },
      loop(work, interval, onError) {
        const control = { work, onError, kicks: 0, kick() { this.kicks++; }, stop() {} };
        loops.push(control); return control;
      } } };
  const window = { ...events(), DC: L, location: { search: role !== 'host' ? '?join=1&room=' + room + '&t=a%2Bb' : '', protocol: 'https:' } };
  const document = { ...events(), readyState: 'complete', body: { classList: classList() }, getElementById: node, querySelectorAll() { return []; } };
  let now = 100000;
  vm.runInNewContext(source('link.js'), { window, document, sessionStorage: { getItem(key) { return storage.has(key) ? storage.get(key) : key === 'dc-phone-seat:test-room-123456789' && role !== 'host' && remember ? JSON.stringify({ role: role === 'p2' ? 'p2' : 'p1', ticket: 'ticket', epoch: 'server-a' }) : ''; }, setItem(key, value) { storage.set(key, value); } },
    URLSearchParams, Set, Event, Math, setTimeout, navigator: {}, Date: class extends Date { static now() { return now; } } });
  return { L, E, loops, handlers, nodes, calls, window, storage, setTime(t) { now = t; } };
}

test('refresh carries the departing host lease once and clears it after claiming', async () => {
  const storage = new Map();
  async function claim(p, expected, lease) {
    p.L.net.request = async () => ({ relay: true, protocol: 7 });
    await p.loops[0].work();
    p.L.net.request = async (url, body) => {
      if (url.startsWith('/link/host')) {
        assert.deepEqual(JSON.parse(JSON.stringify(body.resume)), expected);
        return { lease };
      }
      return {};
    };
    await p.loops[1].work();
  }
  const first = peer('host', true, storage);
  await claim(first, null, 'lease-one');
  assert.equal(storage.get('dc-host-handoff'), '');
  first.window.dispatchEvent({ type: 'pagehide' });
  assert.deepEqual(JSON.parse(storage.get('dc-host-handoff')), { page: 'page', lease: 'lease-one' });
  const refreshed = peer('host', true, storage);
  await claim(refreshed, { page: 'page', lease: 'lease-one' }, 'lease-two');
  assert.equal(storage.get('dc-host-handoff'), '');
  const duplicate = peer('host', true, new Map(storage));
  await claim(duplicate, null, 'duplicate-lease');
  refreshed.window.dispatchEvent({ type: 'pagehide' });
  assert.equal(JSON.parse(storage.get('dc-host-handoff')).lease, 'lease-two');
});
const state = (session = 'run-a', epoch = 'server-a', turn = 0) => ({ epoch, v: 1, hostAge: 0,
  payload: { session, job: 0, seed: 1, S: { seed: 1, turn, phase: 'plan' } } });

test('session rejection resyncs immediately and ignores an older in-flight poll', async () => {
  const p = peer('guest');
  p.L.net.request = async () => state(); await p.loops[1].work();
  p.E.ready('p1');
  let release;
  p.L.net.request = () => new Promise(resolve => { release = resolve; });
  const oldPoll = p.loops[1].work();
  p.L.net.request = async () => { throw Object.assign(new Error('new game'), { status: 409 }); };
  await p.loops[0].work();
  assert.equal(p.nodes.get('guest-note').textContent, 'SYNCING GAME…');
  release(state()); await oldPoll;
  assert.equal(p.nodes.get('guest-note').textContent, 'SYNCING GAME…');
  p.L.net.request = async url => {
    assert.equal(new URL(url, 'https://test').searchParams.get('since'), '-1');
    return state('run-b');
  };
  await p.loops[1].work();
  assert.equal(p.nodes.get('guest-note').textContent, 'CONNECTED');
});

test('late rejection from an old run cannot discard new-run input', async () => {
  const p = peer('guest');
  p.L.net.request = async () => state(); await p.loops[1].work();
  p.E.ready('p1');
  let reject;
  p.L.net.request = () => new Promise((resolve, fail) => { reject = fail; });
  const oldSend = p.loops[0].work();
  p.L.net.request = async () => state('run-b'); await p.loops[1].work();
  p.E.ready('p1');
  reject(Object.assign(new Error('old run'), { status: 409 })); await oldSend;
  p.L.net.request = async (url, input) => { assert.equal(input.session, 'run-b'); return {}; };
  await p.loops[0].work();
  assert.equal(p.nodes.get('guest-note').textContent, 'SENDING…');
});

test('phone retries a failed guard or door render instead of calling it a network disconnection', async () => {
  for (const phase of ['tchatche', 'module']) {
    const p = peer('guest'), r = state();
    r.payload.job = 1; r.payload.S.phase = phase; r.payload.S.moduleId = 'bureau';
    const logged = [];
    p.L.net.event = (kind, details) => logged.push({ kind, ...details });
    p.L.net.request = async () => r;
    p.L.p1.render = () => { throw new TypeError('private content'); };
    await assert.rejects(p.loops[1].work(), error => {
      p.loops[1].onError(error); return error.view;
    });
    assert.equal(p.nodes.get('guest-note').textContent, 'SCREEN ERROR — RELOAD THIS PHONE');
    assert.equal(logged.find(e => e.kind === 'view_failed').contract, 2);
    assert.equal(JSON.stringify(logged).includes('private content'), false);
    let rendered = false;
    p.L.p1.render = () => { rendered = true; };
    await p.loops[1].work();
    assert.equal(rendered, true);
    assert.equal(p.nodes.get('guest-note').textContent, 'CONNECTED');
  }
});

test('phone connection reports request room diagnostics with its own seat credentials', async () => {
  const p = peer('guest');
  p.L.net.request = async url => {
    const parsed = new URL(url, 'https://test');
    assert.equal(parsed.pathname, '/link/diagnostics');
    assert.equal(parsed.searchParams.get('role'), 'p1');
    assert.equal(parsed.searchParams.get('ticket'), 'ticket');
    assert.equal(parsed.searchParams.get('room'), 'test-room-123456789');
    return { queuedInputs: 0 };
  };
  assert.equal((await p.L.link.serverReport()).queuedInputs, 0);
});

test('keypad taps and clear stay immediate through delayed and partially acknowledged snapshots', async () => {
  const p = peer('guest'), sent = [];
  async function update(entry, applied = []) {
    const r = state();
    Object.assign(r.payload.S, { phase: 'module', moduleId: 'porte', porteEntry: entry });
    r.payload.applied = applied;
    p.L.net.request = async () => r;
    await p.loops[1].work();
  }
  async function send() {
    p.L.net.request = async (url, item) => { sent.push(item); return {}; };
    await p.loops[0].work();
  }
  await update('');
  p.E.porteTap('1'); assert.equal(p.E.S.porteEntry, '1');
  await send(); // Received by relay, but host has not applied it yet.
  await update(''); assert.equal(p.E.S.porteEntry, '1');
  p.E.porteClear(); assert.equal(p.E.S.porteEntry, '');
  p.E.porteTap('2'); assert.equal(p.E.S.porteEntry, '2');
  await send(); await send();
  assert.deepEqual(sent.map(m => m.call), ['porteTap', 'porteClear', 'porteTap']);
  await update('1', [sent[0].id]); assert.equal(p.E.S.porteEntry, '2');
  await update('', sent.slice(0, 2).map(m => m.id)); assert.equal(p.E.S.porteEntry, '2');
  await update('2', sent.map(m => m.id)); assert.equal(p.E.S.porteEntry, '2');
  await update('2', sent.map(m => m.id)); assert.equal(p.E.S.porteEntry, '2');
  p.E.porteTap('3'); p.E.porteTap('4'); p.E.porteTap('5'); p.E.porteSubmit();
  assert.equal(p.E.S.porteEntry, '2345');
  for (let i = 0; i < 4; i++) await send();
  assert.deepEqual(sent.slice(-4).map(m => m.call), ['porteTap', 'porteTap', 'porteTap', 'porteSubmit']);
});

test('automatic phone submissions cannot be cleared or edited while their result is in flight', async () => {
  for (const module of ['porte', 'bureau', 'clavier']) {
    const p = peer('guest'), r = state(), sent = [];
    Object.assign(r.payload.S, { phase: 'module', moduleId: module, bureauStep: 0, [module + 'Entry']: '' });
    p.L.net.request = async () => r; await p.loops[1].work();
    for (const digit of '1234') p.E[module + 'Tap'](digit);
    p.E[module + 'Clear'](); p.E[module + 'Tap']('9');
    if (module === 'porte') p.E.porteUndo();
    assert.equal(p.E.S[module + 'Entry'], '1234');
    p.L.net.request = async (url, input) => { sent.push(input); return {}; };
    for (let i = 0; i < 6; i++) await p.loops[0].work();
    assert.equal(sent.length, 4);
    // A partial host acknowledgement must still show the complete submission.
    r.payload.S[module + 'Entry'] = '12'; r.payload.applied = sent.slice(0, 2).map(m => m.id);
    p.L.net.request = async () => r; await p.loops[1].work();
    assert.equal(p.E.S[module + 'Entry'], '1234');
    // After failed-code feedback finishes, a new attempt works normally.
    r.payload.S[module + 'Entry'] = ''; r.payload.applied = sent.map(m => m.id);
    await p.loops[1].work();
    p.E[module + 'Tap']('9'); p.E[module + 'Clear'](); p.E[module + 'Tap']('2');
    assert.equal(p.E.S[module + 'Entry'], '2');
  }
});

test('lost keypad response retries once without duplicating its local preview', async () => {
  const p = peer('guest'), r = state();
  Object.assign(r.payload.S, { phase: 'module', moduleId: 'porte', porteEntry: '' });
  p.L.net.request = async () => r; await p.loops[1].work();
  p.E.porteTap('7');
  let id;
  p.L.net.request = async (url, item) => { id = item.id; throw new Error('response lost'); };
  await assert.rejects(p.loops[0].work());
  assert.equal(p.E.S.porteEntry, '7');
  p.L.net.request = async (url, item) => { assert.equal(item.id, id); return {}; };
  await p.loops[0].work();
  r.payload.S.porteEntry = '7'; r.payload.applied = [id];
  p.L.net.request = async () => r; await p.loops[1].work();
  assert.equal(p.E.S.porteEntry, '7');
});

test('pending keypad preview is discarded on expiry, puzzle exit, and a new run', async () => {
  const p = peer('guest');
  async function update(session = 'run-a', phase = 'module') {
    const r = state(session);
    Object.assign(r.payload.S, { phase, moduleId: phase === 'module' ? 'porte' : null, porteEntry: '' });
    p.L.net.request = async () => r; await p.loops[1].work();
  }
  await update(); p.E.porteTap('1');
  p.setTime(109000); await p.loops[0].work();
  assert.equal(p.E.S.porteEntry, '');
  p.E.porteTap('2'); await update('run-a', 'play');
  assert.equal(p.E.S.porteEntry, '');
  await update(); assert.equal(p.E.S.porteEntry, '');
  p.E.porteTap('3'); await update('run-b');
  assert.equal(p.E.S.porteEntry, '');
});

test('safe previews glyphs and undo without predicting a puzzle result', async () => {
  const p = peer('guest'), r = state();
  Object.assign(r.payload.S, { phase: 'module', moduleId: 'coffre', coffreEntry: [], coffreFails: 0, hasManuscript: false });
  p.L.net.request = async () => r; await p.loops[1].work();
  p.E.coffreTap('sun'); p.E.coffreUndo(); p.E.coffreTap('moon');
  assert.equal(JSON.stringify(p.E.S.coffreEntry), '["moon"]');
  p.E.coffreTap('key'); p.E.coffreTap('eye'); p.E.coffreTap('star');
  assert.equal(p.E.S.coffreEntry.length, 4);
  assert.equal(p.E.S.coffreFails, 0); assert.equal(p.E.S.hasManuscript, false);
  assert.equal(r.payload.S.coffreEntry.length, 0);
});

test('exit keypad retains its draft through snapshots and clears in order', async () => {
  const p = peer('guest'), r = state(), sent = [];
  Object.assign(r.payload.S, { phase: 'module', moduleId: 'clavier', clavierEntry: '' });
  p.L.net.request = async () => r; await p.loops[1].work();
  p.E.clavierTap('1'); p.E.clavierClear(); p.E.clavierTap('2');
  assert.equal(p.E.S.clavierEntry, '2');
  p.L.net.request = async (url, item) => { sent.push(item); return {}; };
  for (let i = 0; i < 3; i++) await p.loops[0].work();
  r.payload.S.clavierEntry = '1'; r.payload.applied = [sent[0].id];
  p.L.net.request = async () => r; await p.loops[1].work();
  assert.equal(p.E.S.clavierEntry, '2');
  r.payload.S.clavierEntry = '2'; r.payload.applied = sent.map(m => m.id);
  await p.loops[1].work(); assert.equal(p.E.S.clavierEntry, '2');
});

test('host publishes confirmed inputs without another ownership round trip', async () => {
  const p = peer('host');
  p.L.net.request = async () => ({ relay: true, protocol: 7 }); await p.loops[0].work();
  let claims = 0, publishes = 0;
  p.L.net.request = async (url, body) => {
    if (url.startsWith('/link/host')) { claims++; return { lease: 'lease' }; }
    if (url.startsWith('/link/state')) { publishes++; assert.deepEqual([...body.applied], ['confirmed']); }
    return {};
  };
  p.L.recovery.meta.applied = ['confirmed'];
  await p.loops[1].work(); await p.loops[1].work();
  assert.equal(claims, 1); assert.equal(publishes, 2);
});

test('phone requests and remembered seats are scoped to the invited room', async () => {
  const storage = new Map();
  const first = peer('guest', true, storage);
  first.L.net.request = async url => {
    assert.equal(new URLSearchParams(url.split('?')[1]).get('room'), 'test-room-123456789');
    return state();
  };
  await first.loops[1].work();
  assert.ok(storage.has('dc-phone-seat:test-room-123456789'));
  const second = peer('guest', false, storage, 'second-room-123456789');
  assert.equal(second.L.link.player, null);
  const original = peer('guest', false, storage);
  assert.equal(original.L.link.player, 'p1');
});

test('missing room waits for its host and a new epoch reclaims the phone role', async () => {
  const p = peer('guest');
  p.L.net.request = async () => state(); await p.loops[1].work();
  p.L.net.request = async () => ({ roomMissing: true }); await p.loops[1].work();
  assert.equal(p.L.link.player, 'p1');
  assert.equal(p.nodes.get('guest-note').textContent, 'WAITING FOR THE MAIN SCREEN…');
  let claimed = false;
  p.L.net.request = async (url, body) => {
    if (url.startsWith('/link/claim')) { claimed = true; assert.equal(body.role, 'p1'); return { ticket: 'new', epoch: 'new-epoch' }; }
    return { seatLost: true, epoch: 'new-epoch' };
  };
  await p.loops[1].work(); assert.equal(claimed, true);
});

test('old invitations without a room explain that a new QR is needed', () => {
  const p = peer('guest', false, new Map(), '');
  assert.equal(p.L.link.player, null);
  assert.match(p.nodes.get('join-message').textContent, /Scan a new QR/);
  assert.equal(p.nodes.get('join-p1').disabled, true);
  assert.equal(p.loops.length, 0);
});

test('other controls show pending feedback until the host confirms the action', async () => {
  const p = peer('guest'), r = state();
  p.L.net.request = async () => r; await p.loops[1].work();
  p.E.act(1, 0);
  assert.equal(p.nodes.get('guest-note').textContent, 'SENDING…');
  let id;
  p.L.net.request = async (url, item) => { id = item.id; return {}; };
  await p.loops[0].work();
  assert.equal(p.nodes.get('guest-note').textContent, 'SENDING…');
  r.payload.applied = [id];
  p.L.net.request = async () => r; await p.loops[1].work();
  assert.equal(p.nodes.get('guest-note').textContent, 'CONNECTED');
});

test('guest retries a lost tap response with the same ID and decoded token', async () => {
  const p = peer('guest'), sent = [];
  p.L.net.request = async () => state();
  await p.loops[1].work();
  p.E.act(0, 1);
  p.L.net.request = async (url, item) => {
    assert.ok(url.includes('t=a%2Bb'));
    sent.push(item.id);
    if (sent.length === 1) throw new Error('response lost');
    return { ok: true };
  };
  await assert.rejects(p.loops[0].work());
  await p.loops[0].work();
  assert.equal(sent.length, 2); assert.equal(sent[0], sent[1]);
});

test('unchanged state clears reconnecting and restarts resync even on same seed', async () => {
  const p = peer('guest');
  p.L.net.request = async () => state(); await p.loops[1].work();
  p.loops[1].onError(new Error('offline'));
  assert.equal(p.nodes.get('guest-note').textContent, 'RECONNECTING…');
  p.L.net.request = async () => ({ epoch: 'server-a', v: 1, hostAge: 0 });
  await p.loops[1].work();
  assert.equal(p.nodes.get('guest-note').textContent, 'CONNECTED');
  p.L.net.request = async () => state('run-b', 'server-b', 9);
  await p.loops[1].work();
  assert.equal(p.E.S.turn, 9);
  assert.equal(p.calls.filter(x => x[0] === 'reset').length, 2);
});

test('guest drops unsent old movement after a long interruption or new run', async () => {
  const p = peer('guest');
  p.L.net.request = async () => state(); await p.loops[1].work();
  p.E.act(0, 1); p.setTime(109000);
  let sent = 0;
  p.L.net.request = async () => { sent++; return {}; };
  await p.loops[0].work(); assert.equal(sent, 0);
  p.E.act(1, 0);
  p.L.net.request = async () => state('run-b'); await p.loops[1].work();
  p.L.net.request = async () => { sent++; return {}; };
  await p.loops[0].work(); assert.equal(sent, 0);
});

test('host applies a tap once when acknowledgements are lost, and republishes unchanged state', async () => {
  const p = peer('host');
  p.L.net.request = async () => ({ relay: true, protocol: 7 });
  await p.loops[0].work();
  p.L.link.wanted = true;
  let publishes = 0, loseAck = true;
  p.L.net.request = async (url, body) => {
    url = url.split('?')[0];
    if (url === '/link/state') { publishes++; return { seats: { p1: { taken: true, age: 0 }, p2: { taken: false, age: null } } }; }
    if (url === '/link/intent') return { seats: { p1: { taken: true, age: 0 }, p2: { taken: false, age: null } },
      intents: [{ id: 'phone:1', role: 'p1', session: p.L.link.session, call: 'act', args: [0, 1] }] };
    if (url === '/link/ack' && loseAck) { loseAck = false; throw new Error('ack lost'); }
    return { ok: true };
  };
  await p.loops[1].work();
  await assert.rejects(p.loops[2].work());
  await p.loops[2].work();
  assert.equal(p.calls.filter(x => x[0] === 'act').length, 1);
  await p.loops[1].work(); assert.equal(publishes, 2);
  assert.equal(p.L.link.paused(), false);
  p.setTime(106000); assert.equal(p.L.link.paused(), true);
});


test('P2 phone renders the dossier, forwards support controls and blocks movement', async () => {
  const p = peer('p2'), sent = [];
  p.L.net.request = async () => state(); await p.loops[1].work();
  assert.equal(p.L.link.player, 'p2');
  assert.equal(p.calls.filter(x => x[0] === 'p2-render').length, 1);
  assert.equal(p.E.act(1, 0), false);
  assert.equal(p.E.pullLever('lights'), true);
  p.L.net.request = async (url, item) => { sent.push(item); return { ok: true }; };
  await p.loops[0].work();
  assert.equal(sent[0].role, 'p2'); assert.equal(sent[0].call, 'pullLever');
  assert.equal(p.calls.filter(x => x[0] === 'lever').length, 0);
});

test('join picker disables taken role and claims the other role', async () => {
  const p = peer('guest', false);
  p.L.net.request = async (url, body) => {
    if (url.startsWith('/link/status')) return { protocol: 7, hostReady: true,
      seats: { p1: { taken: true, age: 0 }, p2: { taken: false, age: null } } };
    assert.equal(body.role, 'p2');
    return { role: 'p2', ticket: 'second-ticket', epoch: 'server-a' };
  };
  await p.loops[2].work();
  assert.equal(p.nodes.get('join-p1').disabled, true);
  assert.equal(p.nodes.get('join-p2').disabled, false);
  p.handlers['join-p2:click'](); await flush();
  assert.equal(p.L.link.player, 'p2');
});

test('relay restart reclaims the same role but manual reclaim returns to picker', async () => {
  const p = peer('p2');
  p.L.net.request = async url => url.startsWith('/link/state')
    ? { seatLost: true, epoch: 'server-b' } : { ticket: 'new-ticket', epoch: 'server-b' };
  await p.loops[1].work();
  assert.equal(p.L.link.player, 'p2');
  p.L.net.request = async () => ({ seatLost: true, epoch: 'server-b' });
  await p.loops[1].work();
  assert.equal(p.L.link.player, null);
  p.L.net.request = async url => {
    assert.ok(url.startsWith('/link/status'), 'a released phone must not automatically reclaim the role');
    return { protocol: 7, hostReady: true, seats: { p1: { taken: false }, p2: { taken: false } } };
  };
  await p.loops[2].work();
  assert.equal(p.L.link.player, null);
});

test('competing host never publishes state or reads inputs while ownership is rejected', async () => {
  const p = peer('host');
  p.L.net.request = async () => ({ relay: true, protocol: 7 });
  await p.loops[0].work();
  const paths = [];
  p.L.net.request = async url => { paths.push(url.split('?')[0]); const e = new Error('occupied'); e.status = 409; throw e; };
  await p.loops[1].work().catch(p.loops[1].onError);
  await p.loops[2].work();
  assert.deepEqual(paths, ['/link/host']);
  assert.equal(p.L.recovery.blocked, true);
});

test('host receives a QR automatically even when public discovery requires a phone invitation', async () => {
  const p = peer('host');
  p.L.net.request = async () => ({ relay: true, protocol: 7, joinRequired: true });
  await p.loops[0].work();
  p.L.net.request = async (url, body) => url.startsWith('/link/host')
    ? { lease: 'lease', join: 'https://game.example/?join=1&room=presenter&t=phone-invitation' } : {};
  await p.loops[1].work();
  assert.equal(p.nodes.get('seat-qr').src, '/qr.svg?room=presenter&t=phone-invitation');
  assert.equal(p.nodes.get('seat-url').value, 'https://game.example/?join=1&room=presenter&t=phone-invitation');
  assert.equal(p.L.recovery.blocked, false);
  assert.equal(p.handlers['seat-token-form:submit'], undefined);
});

test('pending recovery renews ownership without publishing the blank initial game', async () => {
  const p = peer('host');
  p.L.net.request = async () => ({ relay: true, protocol: 7 });
  await p.loops[0].work();
  p.L.recovery.pending = true;
  const paths = [];
  p.L.net.request = async url => { paths.push(url.split('?')[0]); return { lease: 'private-lease' }; };
  await p.loops[1].work(); await p.loops[2].work();
  assert.deepEqual(paths, ['/link/host']);
});

test('restored applied input IDs prevent replay after refresh with a lost acknowledgment', async () => {
  const p = peer('host');
  p.L.net.request = async () => ({ relay: true, protocol: 7 }); await p.loops[0].work();
  p.L.recovery.meta.applied = ['already-applied'];
  let ack;
  p.L.net.request = async (url, body, headers) => {
    if (url.startsWith('/link/host')) return { lease: 'private-lease' };
    assert.equal(headers['X-Host-Lease'], 'private-lease');
    if (url.startsWith('/link/intent')) return { intents: [{ id: 'already-applied', session: 'run-a', role: 'p1', call: 'act', args: [1, 0] }] };
    if (url.startsWith('/link/ack')) ack = body;
    return {};
  };
  await p.loops[1].work(); await p.loops[2].work();
  assert.equal(p.calls.filter(x => x[0] === 'act').length, 0);
  assert.equal(ack.ids[0], 'already-applied');
});

test('diagnostics record outage duration and latency without query credentials', async () => {
  let ok = false;
  const p = transport(async () => ({ ok, status: 503, json: async () => ({}) }));
  await p.net.request('/link/state?t=SECRET&ticket=PRIVATE').catch(() => {});
  await p.time.advance(2345); ok = true;
  await p.net.request('/link/state?t=SECRET&ticket=PRIVATE');
  const report = p.net.diagnostics();
  assert.equal(report.failures, 1);
  assert.equal(report.events.find(x => x.event === 'recovered').durationMs, 2345);
  assert.equal(JSON.stringify(report).includes('SECRET'), false);
  assert.equal(JSON.stringify(report).includes('PRIVATE'), false);
  for (let i = 0; i < 110; i++) p.net.event('offline');
  assert.equal(p.net.diagnostics().events.length, 100);
});

function recoveredGame(storage = new Map()) {
  const time = clock(), handlers = {}, nodes = new Map();
  const node = id => { if (!nodes.has(id)) nodes.set(id, { hidden: false, addEventListener(e, fn) { handlers[id + ':' + e] = fn; } }); return nodes.get(id); };
  const listeners = {};
  const L = { util: { silence() {}, sfx: new Proxy({}, { get: () => () => {} }), buzz() {}, shuffle: a => a.slice(), clamp: (n, lo, hi) => Math.max(lo, Math.min(hi, n)),
    on(n, fn) { (listeners[n] ||= []).push(fn); }, emit(n) { for (const fn of listeners[n] || []) fn(); } },
    p1: { resetTyped() {} }, p2: { reset() {} }, net: { event() {} }, link: { role: 'host' } };
  const window = { ...events(), DC: L, crypto: require('node:crypto').webcrypto, location: { search: '', reload() { this.reloaded = true; } } };
  const document = { ...events(), getElementById: node, querySelector: () => node('stage') };
  const ctx = vm.createContext({ window, document, Uint8Array, sessionStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    ...time, setInterval() {}, Math });
  for (const file of ['content.js', 'engine.js', 'recovery.js']) vm.runInContext(source(file), ctx);
  L.engine.reset(1234); L.recovery.boot();
  return { L, time, storage, handlers, window, nodes };
}

test('door clear also clears the authoritative engine before the next digit', () => {
  const p = recoveredGame(), E = p.L.engine;
  E.S.phase = 'module'; E.S.moduleId = 'porte';
  E.porteTap('1'); E.porteClear(); E.porteTap('2');
  assert.equal(E.S.porteEntry, '2');
});

test('a copied host tab can start separately without modifying the original tab storage', () => {
  const original = recoveredGame(); original.L.recovery.save();
  const copied = recoveredGame(new Map(original.storage));
  copied.L.recovery.block('Another tab is hosting this room');
  copied.handlers['new-room:click'](); copied.window.dispatchEvent({ type: 'pagehide' });
  assert.equal(copied.window.location.reloaded, true);
  assert.equal(copied.storage.has('dc-host-identity'), false);
  assert.equal(copied.storage.has('dc-checkpoint-v1'), false);
  assert.equal(original.storage.has('dc-host-identity'), true);
  assert.equal(original.storage.has('dc-checkpoint-v1'), true);
  const fresh = recoveredGame(copied.storage);
  assert.notEqual(fresh.L.recovery.identity.client, original.L.recovery.identity.client);
  assert.equal(fresh.L.recovery.pending, false);
});

test('door failure holds its entry for feedback, then accepts a fresh entry', async () => {
  const p = recoveredGame(), E = p.L.engine;
  E.S.phase = 'module'; E.S.moduleId = 'porte';
  E.S.porteEntry = p.L.content.PORTE.code === '0000' ? '1111' : '0000';
  E.porteSubmit(); E.porteClear(); E.porteTap('2');
  assert.equal(E.S.codeFeedback.ok, false);
  assert.equal(E.S.porteEntry.length, 4);
  await p.time.advance(1000);
  E.porteTap('2');
  await p.time.advance(1000);
  assert.equal(E.S.porteEntry, '2');
});

test('exit keypad clears a failed submission after feedback on the host', async () => {
  const p = recoveredGame(), E = p.L.engine;
  p.L.content.loadJob(1); E.reset(1234);
  E.S.phase = 'module'; E.S.moduleId = 'clavier';
  E.clavierTap('1'); E.clavierClear(); E.clavierTap('2');
  assert.equal(E.S.clavierEntry, '2');
  const wrong = p.L.content.CLAVIER.code === '0000' ? '1111' : '0000';
  assert.equal(E.clavierSubmit(wrong), false);
  assert.equal(E.S.codeFeedback.ok, false);
  await p.time.advance(900);
  assert.equal(E.S.clavierEntry, '');
});

for (const module of ['porte', 'bureau', 'clavier', 'coffre']) {
  for (const correct of [true, false]) {
    test(`${module} auto-checks the final input and holds ${correct ? 'success' : 'failure'} feedback before continuing`, async () => {
      const p = recoveredGame(), E = p.L.engine, C = p.L.content;
      if (module !== 'porte') { C.loadJob(1); E.reset(1234); }
      E.ready('p1'); E.ready('p2'); E.openModule(module);
      const answer = module === 'porte' ? C.PORTE.code : module === 'bureau' ? C.BUREAU.answer : module === 'clavier' ? C.CLAVIER.code : C.COFFRE.code;
      const values = Array.from(answer);
      if (!correct) values[0] = module === 'coffre' ? 'wrong-symbol' : values[0] === '0' ? '1' : '0';
      const tap = E[module + 'Tap'];
      values.slice(0, -1).forEach(tap);
      assert.equal(E.S.codeFeedback, null);
      tap(values.at(-1));
      assert.equal(E.S.codeFeedback.ok, correct);
      assert.equal(E.S.phase, 'module');
      assert.equal(E.S.transitions.length, 1);
      const suspicion = E.S.suspicion;
      tap(values.at(-1));
      assert.equal(E.S.transitions.length, 1);
      assert.equal(E.S.suspicion, suspicion);
      await p.time.advance(650);
      assert.equal(E.S.phase, 'module');
      assert.ok(E.S.codeFeedback);
      await p.time.advance(250);
      assert.equal(E.S.codeFeedback, null);
      if (!correct) assert.equal(E.S[module + 'Entry'].length, 0);
      else if (module === 'bureau') assert.equal(E.S.bureauStep, 1);
      else assert.equal(E.S.phase, module === 'clavier' ? 'rank' : 'play');
    });
  }
}

test('repeated wrong door and safe codes finish feedback before starting the guard conversation', async () => {
  for (const module of ['porte', 'coffre']) {
    const p = recoveredGame(), E = p.L.engine, C = p.L.content;
    if (module === 'coffre') { C.loadJob(1); E.reset(1234); }
    E.ready('p1'); E.ready('p2'); E.openModule(module);
    const tries = module === 'porte' ? C.PORTE.fails || 3 : 2;
    for (let i = 0; i < tries; i++) {
      const wrong = module === 'porte' ? (C.PORTE.code === '0000' ? '1111' : '0000').split('') : Array(4).fill('wrong');
      wrong.forEach(E[module + 'Tap']);
      await p.time.advance(650);
      assert.equal(E.S.phase, 'module');
      await p.time.advance(250);
    }
    assert.equal(E.S.phase, 'tchatche');
    assert.equal(E.S.codeFeedback, null);
  }
});

test('refresh resumes the contract, state, session and applied IDs without charging away time', async () => {
  const p = recoveredGame();
  p.L.content.loadJob(1); p.L.engine.reset(42);
  p.L.engine.ready('p1'); p.L.engine.ready('p2');
  p.L.engine.S.turn = 17;
  p.L.recovery.sync(); p.L.recovery.meta.applied.push('applied-tap'); p.L.recovery.meta.seq = 31;
  p.L.recovery.save();
  const session = p.L.recovery.meta.session;
  const q = recoveredGame(p.storage);
  assert.equal(q.L.recovery.pending, true);
  await q.time.advance(60000);
  q.handlers['resume-game:click']();
  assert.equal(q.L.content.jobIndex, 1); assert.equal(q.L.engine.S.turn, 17);
  assert.equal(q.L.engine.S.lastActionAt, q.time.Date.now());
  assert.equal(q.L.recovery.meta.session, session);
  assert.equal(q.L.recovery.meta.seq, 31);
  assert.equal(q.L.recovery.meta.applied[0], 'applied-tap');
  assert.equal(q.nodes.get('stage').inert, false);
});

test('refresh during automatic desk feedback resumes the pending release screen once', async () => {
  const p = recoveredGame(), E = p.L.engine;
  p.L.content.loadJob(1); E.reset(42);
  E.ready('p1'); E.ready('p2'); E.openModule('bureau');
  p.L.content.BUREAU.answer.split('').forEach(E.bureauTap);
  await p.time.advance(300); p.L.recovery.save();
  const q = recoveredGame(p.storage);
  await q.time.advance(60000); q.handlers['resume-game:click']();
  assert.equal(q.L.engine.S.codeFeedback.ok, true);
  await q.time.advance(599); assert.equal(q.L.engine.S.bureauStep, 0);
  await q.time.advance(1); assert.equal(q.L.engine.S.bureauStep, 1);
  assert.equal(q.L.engine.S.codeFeedback, null);
  assert.equal(q.L.engine.S.transitions.length, 0);
});

test('refresh during a puzzle transition resumes its remaining animation and completes once', async () => {
  const p = recoveredGame();
  p.L.content.loadJob(1); p.L.engine.reset(42);
  const E = p.L.engine;
  E.ready('p1'); E.ready('p2'); E.openModule('bureau');
  E.bureauDoor(p.L.content.BUREAU.doorMark);
  await p.time.advance(300); p.L.recovery.save();
  assert.equal(E.S.transitions.length, 1);
  const q = recoveredGame(p.storage);
  await q.time.advance(90000); q.handlers['resume-game:click']();
  await q.time.advance(499); assert.equal(q.L.engine.S.phase, 'module');
  await q.time.advance(1); assert.equal(q.L.engine.S.phase, 'play');
  assert.equal(q.L.engine.S.transitions.length, 0);
  assert.equal(q.L.engine.S.solved.bureau, true);
});

test('starting a new game discards the checkpoint session; old puzzle timers cannot change it', async () => {
  const p = recoveredGame();
  p.L.content.loadJob(1); p.L.engine.reset(42);
  p.L.engine.openModule('bureau'); p.L.engine.bureauDoor(p.L.content.BUREAU.doorMark);
  p.L.recovery.save(); const old = p.L.recovery.meta.session;
  p.L.engine.reset(20); await p.time.advance(5000);
  assert.equal(p.L.engine.S.phase, 'plan'); assert.equal(p.L.engine.S.solved.bureau, false);
  const q = recoveredGame(p.storage);
  q.handlers['new-game:click']();
  assert.equal(q.L.recovery.pending, false);
  assert.notEqual(q.L.recovery.meta.session, old);
});

test('corrupt or incompatible checkpoints do not prevent a fresh local game', () => {
  for (const value of ['bad json', '{"schema":99}', '{"schema":1,"S":null}']) {
    const p = recoveredGame(new Map([['dc-checkpoint-v1', value]]));
    assert.equal(p.L.recovery.pending, false);
    assert.equal(p.L.engine.S.phase, 'plan');
  }
});

