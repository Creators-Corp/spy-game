// Verify laser overlays never split the walkable map floor.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const MAP = ['#####', '#...#', '#.L.#', '#...#', '#####'];
let live = true;
const L = {
  util: {}, glyphs: {},
  content: { MAP, MODULES: [], ROOMS: [] },
  engine: {
    S: { doors: [], cameras: [], guards: [], assane: { x: 1, y: 1 } },
    threat: () => ({}), roomAt: () => null, doorAt: () => null,
    charAt: (x, y) => MAP[y]?.[x] || '#',
    beamLive: () => live, hatchTile: () => null
  }
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/p2.js'), 'utf8')
  .replace('})(window.DC);', 'L.drawMap = planSVG; })(window.DC);'), { window: { DC: L } });
const guard = { id: 'g1', stoodDown: false };
// Keep the fixture's actor layer empty while exposing the guard reveal state.
L.engine.S.guards.some = predicate => predicate(guard);
for (const phase of ['play', 'tchatche']) {
  L.engine.S.phase = phase;
  L.engine.S.beamG1Done = true; // Set during the approach, before the conversation ends.
  const hidden = L.drawMap();
  assert.ok(!hidden.includes('stroke-width="2.5"'));
  assert.ok(!hidden.includes('opacity=".22"'));
  assert.ok(hidden.includes('<rect x="40" y="40" width="20.5" height="20.5" fill="var(--floor-neutral)"/>'));
}
guard.stoodDown = true;
for (const enabled of [true, false]) {
  live = enabled;
  const svg = L.drawMap();
  assert.ok(svg.includes('<rect x="40" y="40" width="20.5" height="20.5" fill="var(--floor-neutral)"/>'));
  const beam = svg.match(/<line x1="50" y1="40" x2="50" y2="60"[^>]*>/)?.[0];
  assert.ok(beam, 'beam spans the tile vertically');
  assert.equal(beam.includes('stroke-dasharray'), !enabled);
  assert.equal(svg.includes('<rect x="40" y="40" width="20" height="20" fill="var(--red)" opacity=".22"/>'), enabled);
  const edges = [...svg.matchAll(/<line x1="(\d+)" y1="(\d+)" x2="(\d+)" y2="(\d+)"[^>]*stroke-width="1.75"[^>]*>/g)];
  for (const edge of edges) {
    const [x1, y1, x2, y2] = edge.slice(1).map(Number);
    assert.ok((x1 === x2 && [20, 80].includes(x1)) || (y1 === y2 && [20, 80].includes(y1)),
      'only the outer walls have floor boundaries');
  }
}
console.log('P2 map passed: connected laser floor, vertical beams, active red highlight, and disabled dashed beams.');
