const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const L = { util: { clamp: (n, a, b) => Math.max(a, Math.min(b, n)),
  sfx: new Proxy({}, { get: () => () => {} }), buzz() {}, emit() {} } };
const ctx = vm.createContext({ window: { DC: L, location: { search: '' } }, setTimeout, clearTimeout });
for (const file of ['content.js', 'engine.js']) {
  let code = fs.readFileSync(path.join(__dirname, '../js', file), 'utf8');
  if (file === 'engine.js') code = code.replace('})(window.DC);',
    'L.postTest = { advance: advanceGuards, trip: tripAlarm }; })(window.DC);');
  vm.runInContext(code, ctx);
}
const E = L.engine;
E.reset(0);
const storage = E.S.guards.find(g => g.id === 'g1');
const guard = E.S.guards.find(g => g.id === 'g3');
const position = g => JSON.stringify(E.guardAt(g));
assert.equal(position(storage), JSON.stringify({ x: 15, y: 14 }));
assert.equal(position(guard), JSON.stringify({ x: 2, y: 4 }));
for (let i = 0; i < 10; i++) L.postTest.advance();
assert.equal(position(guard), JSON.stringify({ x: 2, y: 4 }));
assert.equal(guard.facing, 'N');
const beam = L.content.MAP.flatMap((row, y) => Array.from(row, (ch, x) => ({ ch, x, y })))
  .find(p => p.ch === 'L' && E.roomAt(p.x, p.y)?.name === 'KITCHENS');
assert.ok(beam);
L.postTest.trip(beam);
assert.equal(guard.probe.x, beam.x);
assert.equal(guard.probe.y, beam.y);
L.postTest.advance();
assert.notEqual(position(guard), JSON.stringify({ x: 2, y: 4 }));
let reached = false;
for (let i = 0; i < 200; i++) {
  if (E.guardAt(guard).x === beam.x && E.guardAt(guard).y === beam.y) reached = true;
  L.postTest.advance();
}
assert.ok(reached, 'guard reaches the tripped beam');
assert.equal(guard.probe, null);
assert.equal(position(guard), JSON.stringify({ x: 2, y: 4 }));
assert.equal(guard.facing, 'N');
console.log('Guard posts passed: P15 and C5 positions, idle hold, laser investigation, and return to C5.');
