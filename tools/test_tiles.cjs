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
function assertMassSideContinuation(mirrored) {
  const x = mirrored ? level[0].length - 1 - 4 : 4;
  const name = mirrored ? 'wall-edge-left' : 'wall-edge-right';
  const all = pieces();
  for (const y of [6, 7]) {
    assert.equal(all.filter(p => p.x === x && p.y === y && p.name === name).length,
      1, `${dc.tiles.cellName(x, y)} continues the block-column side band`);
  }
}
assertMassSideContinuation(false);
function assertBlockSides(mirrored) {
  const all = pieces();
  const invert = side => mirrored ? (side === 'left' ? 'right' : 'left') : side;
  for (const [column, top, last, sides] of [[4, 6, 9, ['left', 'right']], [12, 7, 9, ['left']], [13, 7, 9, ['right']]]) {
    const x = mirrored ? level[0].length - 1 - column : column;
    for (const originalSide of sides) {
      const side = invert(originalSide);
      const edge = `wall-edge-${side === 'left' ? 'right' : 'left'}`;
      for (let y = top; y < last; y++) {
        const expected = y === last - 1 ? `wall-corner-bottom-${side}` : edge;
        assert.equal(all.filter(p => p.x === x && p.y === y && p.name === expected).length,
          1, `${dc.tiles.cellName(x, y)} has one ${expected}`);
        const floorX = x + (side === 'left' ? -1 : 1);
        assert.ok(!all.some(p => p.sourceX === x && p.sourceY === y && p.x === floorX && sidePiece.test(p.name)),
          `${dc.tiles.cellName(x, y)} does not put its band on floor`);
      }
      assert.ok(!all.some(p => p.x === x && p.y === last && sidePiece.test(p.name)),
        `${dc.tiles.cellName(x, last)} leaves the lower face panel clear`);
      assert.ok(all.some(p => p.x === x && p.y === top - 1 && p.name === `wall-corner-top-${side}`),
        `${dc.tiles.cellName(x, top - 1)} connects the top cap`);
    }
  }
  // Every automatically emitted block with adjacent floor has a separator
  // on that side in its own cell, beyond just the named regression cells.
  for (const p of all.filter(p => p.name === 'block-tile')) {
    for (const dx of [-1, 1]) {
      if (!'.ELX'.includes(dc.engine.charAt(p.x + dx, p.y))) continue;
      const side = dx === -1 ? 'left' : 'right';
      const edge = `wall-edge-${dx === -1 ? 'right' : 'left'}`;
      assert.ok(all.some(q => q.x === p.x && q.y === p.y &&
        (q.name === edge || q.name === `wall-corner-bottom-${side}`)),
        `${dc.tiles.cellName(p.x, p.y)} separates block from adjacent floor`);
    }
  }
}
assertBlockSides(false);
// The lower block cap is painted before the face top in the same cell.
for (const [cell, cap, top, bottom] of [
  ['M9', 'wall-corner-bottom-left', 'wall-molded-top-left', 'wall-molded-bottom-left'],
  ['N9', 'wall-corner-bottom-right', 'wall-molded-top-right', 'wall-molded-bottom-right']
]) {
  const x = cell.charCodeAt(0) - 65;
  const y = Number(cell.slice(1)) - 1;
  const at = pieces().filter(p => p.x === x && p.y === y).map(p => p.name);
  assert.ok(at.indexOf(cap) >= 0 && at.indexOf(top) > at.indexOf(cap), `${cell} places its cap underneath the face top`);
  assert.deepEqual(pieces().filter(p => p.x === x && p.y === y + 1).map(p => p.name), [bottom],
    `${dc.tiles.cellName(x, y + 1)} contains only its lower panel`);
}
/* The vault door sits at U5, in the same face as T5 (moved there from U6 in
   "Level Minor Update"). A door splits a face without turning it, so T5 is a
   plain panel with no inner corner, and T4 carries one face top with no cap. */
function assertDoorInFace(mirrored) {
  const at = column => mirrored ? level[0].length - 1 - column : column;
  const all = pieces();
  assert.deepEqual(all.filter(p => p.x === at(19) && p.y === 4).map(p => p.name),
    [mirrored ? 'wall-molded-bottom-left' : 'wall-blank-bottom'],
    'T5 runs straight into the vault door, with no inner turn');
  assert.deepEqual(all.filter(p => p.x === at(20) && p.y === 4).map(p => p.name), ['wall-blank-bottom'],
    'the vault door at U5 keeps the face panel');
  const top = all.filter(p => p.x === at(19) && p.y === 3);
  assert.equal(top.filter(p => p.face && p.dy === -1).length, 1, 'T4 has one face top');
  assert.ok(!top.some(p => /wall-blank-corner-top-/.test(p.name)), 'T4 has no corner cap beside a door');
}
assertDoorInFace(false);
function assertNarrowFaceJoin(mirrored) {
  const x = mirrored ? level[0].length - 1 - 14 : 14;
  const all = pieces();
  for (const [y, expected] of [[-1, ['wall-blank-top']], [0, ['wall-blank-bottom']], [1, []]]) {
    assert.deepEqual(all.filter(p => p.x === x && p.y === y).map(p => p.name), expected,
      `O${y + 1} has no detached side assembly above the narrow passage`);
  }
}
assertNarrowFaceJoin(false);
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
  E2: 'wall-blank-corner-top-right', F14: 'wall-blank-corner-top-right'
};   /* T4 used to be one; the vault door made its face straight (assertDoorInFace) */
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
assertMassSideContinuation(true);
assertBlockSides(true);
assertDoorInFace(true);
assertNarrowFaceJoin(true);
assertOuterJoins(true);
assertClearSpans(true);
// Multi-column face endpoints and their bands mirror together.
for (const cell of Object.keys(cornerCells)) {
  const x = level[0].length - 1 - (cell.charCodeAt(0) - 65);
  const y = Number(cell.slice(1)) - 1;
  const left = cornerCells[cell].endsWith('left');
  const all = pieces();
  assert.ok(all.some(p => p.x === x && p.y === y &&
    p.name === `wall-blank-corner-top-${left ? 'right' : 'left'}`), `${cell} mirrors its cap`);
  assert.ok(all.some(p => p.x === x && p.y === y + 1 &&
    (p.name === `wall-edge-${left ? 'left' : 'right'}` ||
     p.name === `wall-inner-corner-top-${left ? 'right' : 'left'}`)), `${cell} mirrors its band or inner turn`);
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

// A larger mass in an open room keeps its side corners inside the block.
dc.content.MAP = ['........', '........', '...##...', '...##...', '........', '........'];
all = pieces();
assert.ok(all.some(p => p.x === 3 && p.name === 'wall-corner-bottom-left'));
assert.ok(all.some(p => p.x === 4 && p.name === 'wall-corner-bottom-right'));
assert.ok(!all.some(p => /^wall-inner-corner-/.test(p.name)));

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
