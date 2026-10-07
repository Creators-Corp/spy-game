/* The exit keypad: the worn keys point at exactly one plate on file, and the
   code is that plate reversed, on every roster.
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
const digits = plate => [...new Set(plate.split(''))].sort().join('');

let rosters = 0;
for (let seed = 0; seed < 10000; seed += 7) {
  E.reset(seed);
  const worn = [...C.CLAVIER.worn].sort().join('');
  assert.equal(worn.length, 3, `seed ${seed}: three worn keys`);
  const matching = C.PERSONNEL.filter(p => digits(p.plate) === worn);
  assert.equal(matching.length, 1, `seed ${seed}: the worn keys ${worn} fit exactly one plate, not ` +
    matching.map(p => p.plate).join(', '));
  assert.equal(C.CLAVIER.code, matching[0].plate.split('').reverse().join(''), `seed ${seed}: the code is that plate reversed`);
  rosters++;
}

/* a pinned roster deals the same night */
E.reset(4242); const first = JSON.stringify([C.CLAVIER, C.PERSONNEL.map(p => p.plate)]);
E.reset(77); E.reset(4242);
assert.equal(JSON.stringify([C.CLAVIER, C.PERSONNEL.map(p => p.plate)]), first);

console.log(`Exit keypad passed: on ${rosters} rosters the worn keys fit one plate and the code is it reversed.`);
