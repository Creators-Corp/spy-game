/* Door artwork and anchors. Run with: node tools/test_doors.cjs */
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
const state = { solved: {}, guards: [], doors: content.DOORS.map(d => ({ ...d })) };
engine.adopt(state);
const escape = engine.hatchTile();
const anchors = state.doors.map(d => ({ x: d.x, wallY: d.y }));
anchors.push({ x: escape.x, wallY: escape.y - 1 });
function verify(open) {
  const host = {};
  tiles.render(host, { threat: {}, layers: { ground: false, vision: false, actors: false, ui: false } });
  const tags = [...host.innerHTML.matchAll(/<image href="art\/tiles\/door-(open|closed)\.png"[^>]*>/g)];
  assert.equal(tags.length, anchors.length);
  assert.ok(!host.innerHTML.includes('goal-door-'));
  for (const { x, wallY } of anchors) {
    const tag = tags.find(match => match[0].includes(` x="${x * tiles.W}"`));
    assert.ok(tag);
    assert.equal(tag[1], open ? 'open' : 'closed');
    const attr = name => Number(tag[0].match(new RegExp(` ${name}="([^"]+)"`))[1]);
    assert.equal(attr('width'), tiles.W);
    assert.equal(attr('height'), tiles.H * 2);
    assert.equal(attr('y') + attr('height'), (wallY + 1) * tiles.H);
  }
}
verify(false);
state.doors.forEach(d => { d.locked = false; });
state.solved.clavier = true;
verify(true);
for (const name of ['door-open', 'door-closed']) {
  const png = fs.readFileSync(path.join(root, 'art/tiles', name + '.png'));
  assert.equal(png.readUInt32BE(16), tiles.W);
  assert.equal(png.readUInt32BE(20), tiles.H * 2);
}
console.log('Door sprites passed: all doors and escape, open/closed states, two-tile size, and bottom anchors.');
