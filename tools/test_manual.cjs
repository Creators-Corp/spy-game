/* Progressive Manual reveals and per-phone unread highlights. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function el(tag, attrs = {}, children = []) {
  return { tag, attrs, children: children.filter(Boolean),
    appendChild(child) { this.children.push(child); return child; } };
}
const context = vm.createContext({ window: { location: { search: '' }, DC: {
  util: { el, assetURL: value => value, sfx: { tap() {}, good() {} },
    emit() {}, buzz() {}, clamp: (v, min, max) => Math.max(min, Math.min(max, v)) }, glyphs: {}
} } });
for (const file of ['content', 'engine']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', file + '.js'), 'utf8'), context);
}
const source = fs.readFileSync(path.join(root, 'js/p2.js'), 'utf8');
vm.runInContext(source.replace('  L.p2 = {',
  '  L.manualTest = { entries: manualEntries, tabs: tabBar, view: viewManuel };\n  L.p2 = {'), context);
const { content, engine, manualTest, p2 } = context.window.DC;
/* assane: the tab bar asks how far he is from the hatch once the lights go;
   the far corner keeps that hint out of these checks */
const state = { phase: 'play', assane: { x: 0, y: 0 }, unlocked: {}, solved: {}, guards: [], alert: 0, blackout: false };
engine.adopt(state);
const entries = () => Array.from(manualTest.entries());
const manualButton = () => manualTest.tabs()?.children.find(button => button.children[0].attrs.text === 'MANUAL');
const flashing = () => manualButton().attrs.class.includes('is-flash');
function text(node) { return [node.attrs.text || node.attrs.html || '', ...node.children.map(text)].join(' '); }
assert.equal(manualButton(), undefined);
assert.deepEqual(entries(), []);
// Complete the tutorial's final exchange through the real rules engine.
state.phase = 'tchatche';
state.tchatche = { tag: 'first-beam-g1', round: 2, strikes: 0 };
engine.tchatchePick(content.FIRST_BEAM_TUTORIAL[2].correct - 1);
assert.equal(state.unlocked.manuel, true);
assert.deepEqual(entries(), ['LASER LINES']);
let notes = text(manualTest.view());
assert.ok(notes.includes('Tripping a laser beam will bring a guard to the location.'));
for (const unwanted of ['SAFES', 'LINE CODES', 'AUTHENTICATION', 'ALERT LEVELS', 'CAMERAS', 'POWER FAILURE', 'KITCHEN GATE', 'PATROLS', 'EVACUATION', 'RELEASE CODE']) {
  assert.ok(!notes.includes(unwanted), unwanted);
}
assert.equal(flashing(), true);
manualButton().attrs.onclick();
assert.equal(flashing(), false);
state.alert = 1;
assert.ok(entries().includes('ALERT LEVELS'));
assert.equal(flashing(), true);
manualButton().attrs.onclick();
assert.equal(flashing(), false);
state.solved.bureau = true;
assert.ok(entries().includes('CAMERAS'));
assert.equal(flashing(), true);
manualButton().attrs.onclick();
state.blackout = true;
assert.ok(entries().includes('POWER FAILURE'));
assert.equal(flashing(), true);
notes = text(manualTest.view());
assert.ok(notes.includes('<strong><u>service hatch in the kitchen</u></strong>'));
assert.ok(notes.includes('<strong><u>REVERSED</u></strong>'));
manualButton().attrs.onclick();
assert.equal(flashing(), false);
// Puzzle reference sections remain hidden until that puzzle is encountered.
for (const id of ['coffre', 'ecoute', 'faux']) {
  engine.openModule(id);
  assert.equal(state.unlocked['manual-' + id], true);
  assert.ok(entries().includes(id));
  assert.equal(flashing(), true);
  manualButton().attrs.onclick();
  assert.equal(flashing(), false);
}
state.unlocked = {}; state.solved = {}; state.alert = 0; state.blackout = false;
p2.reset();
assert.equal(manualButton(), undefined);
console.log('Manual passed: tutorial unlock, staged notes and puzzle references, numbered power instructions, repeated highlights and reset.');
