/* Nothing typed at a door or a safe outlives the attempt it belongs to.
   Run with: node tools/test_door_reset.cjs */
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
const E = L.engine, C = L.content, S = () => E.S;
const wrong = () => C.PORTE.code.split('').map(d => String((Number(d) + 1) % 10)).join('');
function miss() { wrong().split('').forEach(d => E.porteTap(d)); E.flushTransitions(); }

/* three misses at the door bring a guard; the talk happens with the door shut */
E.reset(1234);
E.openModule('porte');
for (let i = 0; i < 3 && S().phase === 'module'; i++) miss();
assert.equal(S().phase, 'tchatche');
assert.equal(S().moduleId, null, 'a caught attempt closes the door');

/* won the talk and came back: a fresh attempt, not one miss from the next talk */
S().phase = 'play'; S().tchatche = null;
E.openModule('porte');
assert.equal(S().porteEntry, '');
assert.equal(S().porteFails, 0);
miss();
assert.equal(S().phase, 'module', 'one miss after a talk is one miss');
assert.equal(S().porteFails, 1);

/* a half-typed code does not survive walking away */
E.porteTap('1'); E.porteTap('2');
E.declineModule();
E.openModule('porte');
assert.equal(S().porteEntry, '');

/* roster 0 is the authored safe, even straight after another roster */
E.reset(0); const authored = JSON.stringify(C.COFFRE);
E.reset(4321); assert.notEqual(JSON.stringify(C.COFFRE), authored);
E.reset(0); assert.equal(JSON.stringify(C.COFFRE), authored, 'roster 0 brings the authored safe back');

console.log('Door reset passed: caught attempts close the door, reopening is a fresh attempt, roster 0 restores the authored safe.');
