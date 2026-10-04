/* Wall assembly regressions. Run with: node tools/test_tiles.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({
  window: { DC: { util: { assetURL: value => value } } },
  XMLHttpRequest: function () {
    this.open = () => {};
    this.send = () => {};
  }
});
function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
}
load('js/content.js');
const dc = context.window.DC;
dc.engine = { charAt: (x, y) => dc.content.MAP[y]?.[x] || '#' };
load('js/tiles.js');

const sidePiece = /^wall-(inner-corner-|edge-|corner-)/;
function pieces() {
  const result = [];
  dc.content.MAP.forEach((row, y) => {
    [...row].forEach((char, x) => {
      if ('.ELX'.includes(char)) return;
      dc.tiles.wallPieces(x, y).forEach(piece => result.push({
        ...piece, x: x + piece.dx, y: y + piece.dy, sourceX: x, sourceY: y
      }));
    });
  });
  return result;
}

const level = dc.content.MAP;
// An outer wall already carries the side band beside these face endpoints.
// Keep their original top and panel, without a second band in the face cell.
const outerJoins = {
  B3: ['wall-molded-top-left', 'wall-molded-bottom-left'],
  H13: ['wall-molded-top-left', 'wall-molded-bottom-left'],
  U1: ['wall-blank-top', 'wall-blank-bottom'],
  S13: ['wall-molded-top-left', 'wall-molded-bottom-left'],
  Q13: ['wall-blank-top', 'wall-blank-bottom']
};
function assertOuterJoins(mirrored) {
  const all = pieces();
  for (const [cell, names] of Object.entries(outerJoins)) {
    let x = cell.charCodeAt(0) - 65;
    const y = Number(cell.slice(1)) - 1;
    if (mirrored) x = level[0].length - 1 - x;
    const upper = all.filter(p => p.x === x && p.y === y - 1);
    const lower = all.filter(p => p.x === x && p.y === y);
    assert.ok(!upper.some(p => /wall-blank-corner-top-/.test(p.name)), `${cell} has no extra cap`);
    assert.ok(!lower.some(p => /^wall-edge-/.test(p.name)), `${cell} has no extra band`);
    if (!mirrored) {
      assert.ok(upper.some(p => p.name === names[0]), `${cell} keeps its normal top`);
      assert.ok(lower.some(p => p.name === names[1]), `${cell} keeps its normal panel`);
    }
  }
}
assertOuterJoins(false);
// Face endpoints against wall use the turning top pieces, including row 0.
const cornerCells = {
  Q0: 'wall-blank-corner-top-left', D14: 'wall-blank-corner-top-left',
  E2: 'wall-blank-corner-top-right', O0: 'wall-blank-corner-top-right',
  T4: 'wall-blank-corner-top-right', F14: 'wall-blank-corner-top-right'
};
for (const [cell, expected] of Object.entries(cornerCells)) {
  const at = pieces().filter(p => dc.tiles.cellName(p.x, p.y) === cell);
  assert.ok(at.some(p => p.name === expected), `${cell} needs ${expected}`);
  assert.equal(at.filter(p => p.face && p.dy === -1).length, 1, `${cell} has one face top`);
}
const bandCells = {
  D15: ['wall-molded-bottom-left', 'wall-edge-right'],
  E3: ['wall-molded-bottom-right', 'wall-edge-left'],
  F15: ['wall-blank-bottom', 'wall-edge-left']
};
for (const [cell, [panel, band]] of Object.entries(bandCells)) {
  const at = pieces().filter(p => dc.tiles.cellName(p.x, p.y) === cell);
  const panelIndex = at.findIndex(p => p.name === panel);
  const bandIndex = at.findIndex(p => p.name === band);
  assert.ok(panelIndex >= 0 && bandIndex > panelIndex, `${cell} overlays ${band} on ${panel}`);
}
const spans = [[5, 5, 9], [7, 6, 9], [9, 6, 9], [11, 6, 9]];
function assertClearSpans(mirrored) {
  const all = pieces();
  for (const [column, first, last] of spans) {
    const x = mirrored ? level[0].length - 1 - column : column;
    for (let y = first; y <= last; y++) {
      assert.equal(all.filter(p => p.x === x && p.y === y && sidePiece.test(p.name)).length,
        0, `Side piece covers ${dc.tiles.cellName(x, y)}`);
    }
  }
}
assertClearSpans(false);
dc.content.MAP = level.map(row => [...row].reverse().join(''));
assertOuterJoins(true);
assertClearSpans(true);
// Multi-column face endpoints and their bands mirror together.
for (const cell of ['Q0', 'D14', 'E2', 'T4', 'F14']) {
  const x = level[0].length - 1 - (cell.charCodeAt(0) - 65);
  const y = Number(cell.slice(1)) - 1;
  const left = cornerCells[cell].endsWith('left');
  const all = pieces();
  assert.ok(all.some(p => p.x === x && p.y === y &&
    p.name === `wall-blank-corner-top-${left ? 'right' : 'left'}`), `${cell} mirrors its cap`);
  assert.ok(all.some(p => p.x === x && p.y === y + 1 &&
    p.name === `wall-edge-${left ? 'left' : 'right'}`), `${cell} mirrors its band`);
}

// A door splitting a face run does not create a corner or an overlay band.
dc.content.MAP = ['#####', '##+##', '..+..', '.....'];
const besideDoor = dc.tiles.wallPieces(1, 1);
assert.ok(!besideDoor.some(p => /wall-(blank-corner|edge-)/.test(p.name)));

// An isolated wall keeps its two-row face, without either side assembly.
dc.content.MAP = ['.....', '.....', '..#..', '.....', '.....'];
let all = pieces();
assert.equal(all.length, 2);
assert.ok(all.every(p => p.face && !sidePiece.test(p.name)));

// Diagonally adjacent walls do not turn an isolated mass into a side wall.
dc.content.MAP = ['.....', '.#.#.', '..#..', '.#.#.', '.....'];
assert.ok(dc.tiles.wallPieces(2, 2).every(p => p.face && !/wall-(blank-corner|edge-)/.test(p.name)));

// A larger mass in an open room retains side corners on both sides.
dc.content.MAP = ['........', '........', '...##...', '...##...', '........', '........'];
all = pieces();
assert.ok(all.some(p => p.name === 'wall-inner-corner-bottom-left'));
assert.ok(all.some(p => p.name === 'wall-inner-corner-bottom-right'));

// A narrow vertical passage clears both rows of its corners, even where the
// upper row opens into a wider area. This is the geometry of F9/F10.
dc.content.MAP = ['.......', '.##.##.', '.##.##.', '.......', '.......'];
all = pieces();
assert.ok(!all.some(p => p.x === 3 && sidePiece.test(p.name)));
assert.ok(all.some(p => p.face));

// Side corners cannot cover a one-row horizontal passage either.
dc.content.MAP = ['.......', '...##..', '.##....', '...##..', '.......'];
assert.ok(!dc.tiles.wallPieces(2, 2).some(p => p.dx === 1 && sidePiece.test(p.name)));

dc.content.MAP = level;
console.log('Tile rules passed: corner caps and overlays, doors, requested spans, mirrored level, isolated mass, wide room, and narrow passages.');
