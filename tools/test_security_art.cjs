/* Security hardware placement independent of threat visibility and power. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({
  window: { location: { search: '' }, DC: {
    util: { assetURL: value => value }, glyphs: { iconMarkup: () => '' }
  } },
  XMLHttpRequest: function () { this.open = () => {}; this.send = () => {}; }
});
for (const file of ['content', 'engine', 'tiles']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', file + '.js'), 'utf8'), context);
}
const { content, engine, tiles } = context.window.DC;
const state = { solved: {}, guards: [], doors: [], seen: {}, cameras: [],
  blackout: true, cutCameras: { c1: true }, levers: { laser: 8, cams: { c1: 4 } } };
engine.adopt(state);
engine.visibleSet = () => state.seen;
function render(view = 'benjamin') {
  const host = {};
  tiles.render(host, { view, threat: {}, layers: { ground: false, vision: false, walls: false, actors: false, ui: false } });
  return [...host.innerHTML.matchAll(/<image href="art\/tiles\/(laser-down|laser-left|laser-right|security-camera)\.png"[^>]*>/g)]
    .map(([tag, name]) => ({ name, x: Number(tag.match(/ x="([^"]+)"/)[1]) / tiles.W,
      y: Number(tag.match(/ y="([^"]+)"/)[1]) / tiles.H,
      width: Number(tag.match(/ width="([^"]+)"/)[1]), height: Number(tag.match(/ height="([^"]+)"/)[1]) }));
}
const hardware = render();
assert.equal(hardware.length, 5);
for (const [x, y] of [[4, 9], [13, 9], [10, 12], [19, 0]]) {
  assert.ok(hardware.some(p => p.name === 'laser-down' && p.x === x && p.y === y));
}
assert.ok(hardware.some(p => p.name === 'security-camera' && p.x === 17 && p.y === -1));
assert.ok(hardware.every(p => p.width === tiles.W && p.height === tiles.H));
assert.equal(render('assane').length, 0);
state.seen['17,1'] = 1;
assert.equal(render('assane')[0].name, 'security-camera');
state.blackout = false;
state.cutCameras = {};
state.levers = { laser: 0, cams: {} };
assert.deepEqual(render(), hardware);
// The vault prop occupies exactly its objective tile and respects Assane's fog.
const vault = content.MODULES.find(module => module.id === 'coffre');
function vaultTag(view) {
  const host = {};
  tiles.render(host, { view, threat: {}, layers: { ground: false, vision: false, walls: false, actors: false, ui: false } });
  return host.innerHTML.match(/<image href="art\/tiles\/vault-sprite\.png"[^>]*>/g) || [];
}
const vaultImages = vaultTag('benjamin');
assert.equal(vaultImages.length, 1);
assert.ok(vaultImages[0].includes(' x="' + vault.x * tiles.W + '"'));
assert.ok(vaultImages[0].includes(' y="' + vault.y * tiles.H + '"'));
assert.ok(vaultImages[0].includes(' width="' + tiles.W + '"'));
assert.ok(vaultImages[0].includes(' height="' + tiles.H + '"'));
assert.equal(vaultTag('assane').length, 0);
state.seen[vault.x + ',' + vault.y] = 1;
assert.equal(vaultTag('assane').length, 1);
// Horizontal and single-cell horizontal beams hug both wall-adjacent ends.
content.CAMERAS = [];
content.MAP = ['#######', '#.....#', '#LLLLL#', '#.....#', '#######'];
assert.deepEqual(render().map(p => [p.name, p.x, p.y]), [['laser-left', 1, 2], ['laser-right', 5, 2]]);
content.MAP = ['###', '#.#', '#L#', '#.#', '###'];
assert.deepEqual(render().map(p => [p.name, p.x, p.y]), [['laser-left', 1, 2], ['laser-right', 1, 2]]);
console.log('Security hardware passed: placement, one-tile size, hidden threat overlays, power states, and fog of war.');
