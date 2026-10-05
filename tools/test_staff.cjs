// Staff dropdowns and Smooth Talk clues, without a browser dependency.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = name => fs.readFileSync(path.join(__dirname, '../js', name), 'utf8');
function el(tag, attrs = {}, children = []) {
  return { tag, ...attrs, children: children.filter(Boolean),
    appendChild(child) { this.children.push(child); return child; } };
}
const L = {
  util: { el, assetURL: value => value, sfx: { tap() {} }, emit() {} },
  engine: { S: { unlocked: { visages: true }, guards: [] } },
  glyphs: {}, face: { portrait: (data, cls) => el('portrait', { class: cls, art: data.art }) },
  figures: { uniformStack: data => el('uniform', { data }) }
};
const ctx = vm.createContext({ window: { DC: L } });
vm.runInContext(source('content.js'), ctx);
vm.runInContext(source('p2.js').replace('})(window.DC);',
  'L.staffTest = { viewPersonnel: viewPersonnel, availableTabs: availableTabs, tabBar: tabBar }; })(window.DC);'), ctx);
const walk = node => [node, ...node.children.flatMap(walk)];
const matches = (node, cls) => walk(node).filter(n => n.class === cls);
assert.equal(L.staffTest.availableTabs().some(t => t[0] === 'visages'), false);
assert.equal(L.staffTest.availableTabs().some(t => t[0] === 'personnel'), true);
let roster = L.staffTest.viewPersonnel();
assert.equal(matches(roster, 'file__details').length, 0);
assert.equal(matches(roster, 'file__hd').length, L.content.PERSONNEL.length);
matches(roster, 'file__hd')[0].onclick();
const badge = L.content.PERSONNEL[0].badge;
roster = L.staffTest.viewPersonnel();
assert.equal(matches(roster, 'file__portrait')[0].art, L.content.FACES[badge].art);
assert.equal(walk(roster).filter(n => n.tag === 'uniform').length, 1);
assert.deepEqual(matches(roster, 'file__talk')[0].children[0].children.map(n => n.children[0].text),
  Array.from(L.content.DIRT[badge], d => d.s));
const info = matches(roster, 'file__info')[0];
assert.equal(info.children[0].tag, 'dl');
assert.equal(info.children[1].class, 'file__talk');
assert.equal(matches(info, 'h').length, 0);
for (let round = 0; round < 3; round++) {
  L.engine.S.tchatche = { badge, round };
  assert.equal(matches(L.staffTest.viewPersonnel(), 'is-key')[0].text, L.content.DIRT[badge][round].s);
}
L.engine.S.tchatche = { badge: 'someone-else', round: 0 };
assert.equal(matches(L.staffTest.viewPersonnel(), 'is-key').length, 0);
L.engine.S.tchatche = { badge, round: 1, tag: 'first-beam-g1' };
assert.equal(matches(L.staffTest.viewPersonnel(), 'is-key')[0].text, L.content.FIRST_BEAM_TUTORIAL_CLUES[1]);
matches(L.staffTest.viewPersonnel(), 'file__hd')[0].onclick();
assert.equal(matches(L.staffTest.viewPersonnel(), 'file__details').length, 0);
L.engine.S.unlocked = { personnel: true, porte: true, manuel: true };
L.engine.S.tchatche = null;
for (const [moduleId, label] of [['deguisement', 'STAFF'], ['grille', 'MAP'], ['porte', 'DOOR'], ['bureau', 'STAFF'], ['coffre', 'MANUAL'], ['clavier', 'MANUAL']]) {
  L.engine.S.phase = 'module'; L.engine.S.moduleId = moduleId;
  let bar = L.staffTest.tabBar();
  const flashing = bar.children.filter(n => n.class.includes('is-flash'));
  assert.equal(flashing.length, 1);
  assert.equal(flashing[0].children[0].text, label);
  flashing[0].onclick();
  assert.equal(L.staffTest.tabBar().children.some(n => n.class.includes('is-flash')), false);
  L.engine.S.phase = 'play'; L.staffTest.tabBar();
  L.engine.S.phase = 'module';
  assert.equal(L.staffTest.tabBar().children.filter(n => n.class.includes('is-flash')).length, 1);
}
console.log('Staff and puzzle hints passed: dropdown content, clue highlights, tutorial, tab targets, dismissal, and re-entry.');
