/* Opening laser/talk is free; later mistakes and grade boundaries still count. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const L = { util: { clamp: (n, a, b) => Math.max(a, Math.min(b, n)),
  shuffle: items => items.slice(),
  sfx: new Proxy({}, { get: () => () => {} }), buzz() {}, emit() {} } };
const ctx = vm.createContext({ window: { DC: L, location: { search: '' } }, setTimeout, clearTimeout });
for (const file of ['content.js', 'engine.js']) {
  let code = fs.readFileSync(path.join(__dirname, '../js', file), 'utf8');
  if (file === 'engine.js') code = code.replace('})(window.DC);',
    'L.tutorialTest = { trip: tripAlarm, turn: actTurn }; })(window.DC);');
  vm.runInContext(code, ctx);
}
const E = L.engine, C = L.content;
E.reset(0);
E.S.phase = 'play'; E.S.running = true;
const posted = E.S.guards.find(g => g.id === 'g1');
const cells = C.MAP.flatMap((row, y) => Array.from(row, (ch, x) => ({ ch, x, y })));
const firstBeam = cells.find(p => p.ch === 'L' && E.roomAt(p.x, p.y)?.name === posted.hears);
assert.ok(firstBeam);
E.S.assane = { x: firstBeam.x, y: firstBeam.y };
L.tutorialTest.trip(firstBeam);
assert.equal(E.S.suspicion, 0);
assert.equal(E.S.alert, 0);
assert.equal(E.S.beamG1Pending, true);
E.S.lastActionAt = Date.now() - 60000;
assert.equal(E.tick(Date.now()), null, 'forced tutorial wait has no pressure penalty');
assert.equal(E.S.suspicion, 0);
for (let i = 0; i < 100 && E.S.phase === 'play'; i++) {
  L.tutorialTest.turn(0, 0, { freeze: true });
  assert.equal(E.S.suspicion, 0, 'guard approach has no near-miss or freeze penalty');
}
assert.equal(E.S.phase, 'tchatche');
assert.equal(E.S.tchatche.tag, 'first-beam-g1');
assert.equal(E.S.spotted, 0);
E.tchatchePick(C.FIRST_BEAM_TUTORIAL[0].correct % 3);
assert.equal(E.S.suspicion, 0, 'tutorial wrong answers remain free');
for (const question of C.FIRST_BEAM_TUTORIAL) E.tchatchePick(question.correct - 1);
assert.equal(E.S.phase, 'play');
assert.equal(E.S.suspicion, 0);
assert.equal(E.S.spotted, 0);
const laterBeam = cells.find(p => p.ch === 'L' && E.roomAt(p.x, p.y)?.name === 'KITCHENS');
L.tutorialTest.trip(laterBeam);
assert.equal(E.S.suspicion, C.ALARM.cost, 'later laser alarms retain their cost');
function grade(suspicion, spotted = 0) {
  return C.RANKS.find(rank => rank.test({ suspicion, spotted })).g;
}
for (const [suspicion, expected] of [[0, 'S'], [5, 'S'], [6, 'A'], [28, 'A'], [29, 'B'], [53, 'B'], [54, 'C'], [72, 'C'], [73, 'D']]) {
  assert.equal(grade(suspicion), expected);
}
assert.equal(grade(0, 1), 'B');
assert.equal(grade(0, 2), 'C');
assert.notEqual(grade(10), 'S');
assert.notEqual(grade(15), 'S');
console.log('Tutorial/grading passed: free laser, approach, waiting and talk; paid later alarms; grade boundaries and sighting caps.');
