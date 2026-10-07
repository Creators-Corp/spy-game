/* Nobody walks through a guard. Run with: node tools/test_guard_contact.cjs */
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
const key = p => p.x + ',' + p.y;

/* one patrol, everything else out of the way */
function patrol(light) {
  E.reset(1234); E.ready('p1'); E.ready('p2');
  const S = E.S;
  S.phase = 'play'; S.moduleId = null; S.cameras = []; S.beamG1Pending = false;
  C.MODULES.forEach(m => { S.solved[m.id] = true; });
  S.guards = S.guards.filter(g => !g.stand && g.path.length > 2).slice(0, 1);
  if (light === 'lights cut') S.levers.lights = 10;
  if (light === 'blackout') S.blackout = true;
  return { S, g: S.guards[0] };
}

/* head-on: two squares in front of him, walking at him */
for (const light of ['normal', 'lights cut', 'blackout']) {
  const { S, g } = patrol(light);
  const ahead = g.path[(g.at + 2 * (g.dir || 1) + g.path.length) % g.path.length];
  S.assane = { x: ahead.x, y: ahead.y };
  const at = E.guardAt(g);
  E.act(Math.sign(at.x - S.assane.x), Math.sign(at.y - S.assane.y));
  E.flushTransitions();
  assert.equal(S.phase, 'tchatche', `${light}: meeting a patrol head-on is being seen`);
  assert.equal(S.tchatche.guardId, g.id);
}

/* standing still on the square he is about to walk onto */
{
  const { S, g } = patrol('lights cut');
  const next = g.path[(g.at + (g.dir || 1) + g.path.length) % g.path.length];
  S.assane = { x: next.x, y: next.y };
  E.act(0, 0); E.flushTransitions();
  if (key(E.guardAt(g)) === key(S.assane)) assert.equal(S.phase, 'tchatche', 'a guard walking onto him sees him');
}

/* a guard who has been talked round is not looking, on his own square either */
{
  const { S, g } = patrol('normal');
  g.fooled = true;
  const ahead = g.path[(g.at + 2 * (g.dir || 1) + g.path.length) % g.path.length];
  S.assane = { x: ahead.x, y: ahead.y };
  const at = E.guardAt(g);
  E.act(Math.sign(at.x - S.assane.x), Math.sign(at.y - S.assane.y));
  E.flushTransitions();
  assert.equal(S.phase, 'play', 'a fooled guard still lets him pass');
}

console.log('Guard contact passed: head-on meetings are seen in light, lights-out and blackout; a fooled guard still lets him pass.');
