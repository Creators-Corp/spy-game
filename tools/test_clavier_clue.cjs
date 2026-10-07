/* The exit keypad's code is the one its clue leads to, on every roster.
   Run with: node tools/test_clavier_clue.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const L = { util: { silence() {}, sfx: new Proxy({}, { get: () => () => {} }), buzz() {}, shuffle: a => a.slice(),
  clamp: (n, lo, hi) => Math.max(lo, Math.min(hi, n)), on() {}, emit() {} } };
const context = vm.createContext({ window: { DC: L, location: { search: '' } }, setTimeout, clearTimeout, Math, Date });
for (const file of ['content', 'engine']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', file + '.js'), 'utf8'), context);
}
const E = L.engine, C = L.content;

/* The procedures send Benjamin to the officer posted where the hatch is. */
E.reset(0);
const hatch = E.hatchTile();
const room = E.roomAt(hatch.x, hatch.y);
assert.ok(room, 'the hatch is inside a named room');
assert.equal(C.CLAVIER.zone, room.name, 'the code comes from the post the hatch is in');
assert.ok(C.PROCEDURES.some(p => (p.steps || [p.v]).join(' ').toLowerCase().includes(room.name.toLowerCase().replace(/s$/, ''))),
  'the procedures name that room');

let rosters = 0;
for (let seed = 0; seed < 10000; seed += 13) {
  E.reset(seed);
  const posted = C.PERSONNEL.filter(p => p.post === room.name);
  assert.equal(posted.length, 1, `seed ${seed}: exactly one officer holds ${room.name}`);
  const answer = posted[0].plate.split('').reverse().join('');
  assert.equal(C.CLAVIER.code, answer, `seed ${seed}: the keypad wants the clue's answer`);
  assert.ok(answer.split('').every(d => C.CLAVIER.worn.includes(d)), `seed ${seed}: the answer uses only the worn keys`);
  rosters++;
}
console.log(`Exit keypad passed: on ${rosters} rosters the code is the ${room.name} officer's plate reversed, on the worn keys.`);
