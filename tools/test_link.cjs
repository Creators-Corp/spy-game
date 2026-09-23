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

function peer(role, remember = true) {
  const loops = [], handlers = {}, nodes = new Map(), calls = [];
  const classList = () => ({ add() {}, toggle() {} });
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, { classList: classList(), textContent: '',
      addEventListener(event, fn) { handlers[id + ':' + event] = fn; }, setAttribute() {}, querySelector() { return {}; } });
    return nodes.get(id);
  }
  const E = { S: { seed: 1, phase: 'plan', ready: { p1: false, p2: false }, turn: 0 },
    pullLever(...args) { calls.push(['lever', ...args]); }, ready(who) { calls.push(['ready', who]); }, act(...args) { calls.push(['act', ...args]); },
    reset(seed) { calls.push(['reset', seed]); E.S = { seed }; }, adopt(s) { E.S = s; } };
  const L = { engine: E, content: { jobIndex: 0, JOBS: [{}, {}], loadJob(i) { calls.push(['job', i]); } },
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
  const window = { ...events(), DC: L, location: { search: role !== 'host' ? '?join=1&t=a%2Bb' : '', protocol: 'https:' } };
  const document = { ...events(), readyState: 'complete', body: { classList: classList() }, getElementById: node, querySelectorAll() { return []; } };
  let now = 100000;
  vm.runInNewContext(source('link.js'), { window, document, sessionStorage: { getItem(key) { return key === 'dc-phone-seat' && role !== 'host' && remember ? JSON.stringify({ role: role === 'p2' ? 'p2' : 'p1', ticket: 'ticket', epoch: 'server-a' }) : ''; }, setItem() {} },
    URLSearchParams, Set, Event, Math, setTimeout, navigator: {}, Date: class extends Date { static now() { return now; } } });
  return { L, E, loops, handlers, nodes, calls, setTime(t) { now = t; } };
}
const state = (session = 'run-a', epoch = 'server-a', turn = 0) => ({ epoch, v: 1, hostAge: 0,
  payload: { session, job: 0, seed: 1, S: { seed: 1, turn, phase: 'plan' } } });

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
  p.L.net.request = async () => ({ relay: true, protocol: 4 });
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
    if (url.startsWith('/link/status')) return { protocol: 4, hostReady: true,
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
    return { protocol: 4, hostReady: true, seats: { p1: { taken: false }, p2: { taken: false } } };
  };
  await p.loops[2].work();
  assert.equal(p.L.link.player, null);
});

test('competing host never publishes state or reads inputs while ownership is rejected', async () => {
  const p = peer('host');
  p.L.net.request = async () => ({ relay: true, protocol: 4 });
  await p.loops[0].work();
  const paths = [];
  p.L.net.request = async url => { paths.push(url.split('?')[0]); const e = new Error('occupied'); e.status = 409; throw e; };
  await p.loops[1].work().catch(p.loops[1].onError);
  await p.loops[2].work();
  assert.deepEqual(paths, ['/link/host']);
  assert.equal(p.L.recovery.blocked, true);
});

test('pending recovery renews ownership without publishing the blank initial game', async () => {
  const p = peer('host');
  p.L.net.request = async () => ({ relay: true, protocol: 4 });
  await p.loops[0].work();
  p.L.recovery.pending = true;
  const paths = [];
  p.L.net.request = async url => { paths.push(url.split('?')[0]); return { lease: 'private-lease' }; };
  await p.loops[1].work(); await p.loops[2].work();
  assert.deepEqual(paths, ['/link/host']);
});

test('restored applied input IDs prevent replay after refresh with a lost acknowledgment', async () => {
  const p = peer('host');
  p.L.net.request = async () => ({ relay: true, protocol: 4 }); await p.loops[0].work();
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
  const L = { util: { silence() {}, sfx: new Proxy({}, { get: () => () => {} }), buzz() {},
    on(n, fn) { (listeners[n] ||= []).push(fn); }, emit(n) { for (const fn of listeners[n] || []) fn(); } },
    p1: { resetTyped() {} }, p2: { reset() {} }, net: { event() {} }, link: { role: 'host' } };
  const window = { ...events(), DC: L, crypto: require('node:crypto').webcrypto, location: { search: '' } };
  const document = { ...events(), getElementById: node, querySelector: () => node('stage') };
  const ctx = vm.createContext({ window, document, Uint8Array, sessionStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) },
    ...time, setInterval() {}, Math });
  for (const file of ['content.js', 'engine.js', 'recovery.js']) vm.runInContext(source(file), ctx);
  L.engine.reset(1234); L.recovery.boot();
  return { L, time, storage, handlers, window, nodes };
}

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

