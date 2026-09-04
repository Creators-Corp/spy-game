/* tiles.js — THE ILLUSTRATED FLOOR.
   A second renderer for the same board. The engine's map is a grid of
   characters; this turns it into the artist's tile set — parquet, panelled
   walls, real doors, drawn characters — in four layers, with the guards'
   vision hatched red across the floor between the ground and the walls.

   THE TELEVISION DRAWS ITS ROOM WITH THIS. It asks for view:'assane', which
   is where the fog of war, the guards-only-where-he-can-see-them rule and the
   absence of sightlines are enforced — design law #1 lives inside the
   renderer, not in the caller. Benjamin's phone still draws his own schematic
   plan, and that plan is the logical map: same characters, same coordinates,
   same names. Nothing is projected between the two.

   tiles.html is the artist's bench for the same renderer, with every layer
   switchable and a grid overlay for marking pieces up by cell name.

   THE UNIT. Every room tile is 300 x 290 pixels; the 2 x 2 moulded panel is
   600 x 580. The layout was mocked at half size, which is where "150 by 145"
   came from — that is the tile at 50%. This file works in tile units and lets
   the SVG scale, so the artwork is never resampled twice.

   THE ONE HARD CONSTRAINT IN THE SET. The wall you face — the north wall of a
   room — is drawn TWO cells tall: the grey top face, the panel, the skirting.
   The engine's walls are one cell thick. So a north face is drawn full height
   only where the cell above it is also wall (the outer edge of the building);
   between two rooms it is squeezed into the single cell. That is a property
   of the artwork, and it is the reason this renderer has to exist as its own
   thing rather than a texture swap. */
(function (L) {
  'use strict';
  var U = L.util, C = L.content, E = L.engine, G = L.glyphs;

  var W = 300, H = 290;                       /* the tile, in art pixels */
  var ART = 'art/tiles/';
  var RED = '#C1372E', GOLD = '#C9A24B', VOID = '#0C1118';

  function href(name) { return U.assetURL(ART + name + '.png'); }

  /* THE OVERRIDE SHEET.
     art/tiles/overrides.json is the artist's own copy of the wall layer: a
     map of contract id -> cell name -> the tiles drawn in that cell, in
     drawing order. Anything listed there REPLACES whatever the rules worked
     out for that cell, so a wrong tile is fixed by editing one line and
     reloading rather than by changing code. An empty list blanks a cell.
     Cell names are the grid's own: column letter + 1-based row, with row 0
     meaning the padding row above the map (a two-tile face's top row). */
  /* The sheet is fetched, so it lands AFTER the script runs. Draw before it
     arrives and the board paints itself from the rules alone, then corrects a
     moment later when the sheet turns up — the flash of a wrong map on every
     reload. ready() lets a caller hold its first draw until the sheet is in. */
  var OVERRIDE = {}, sheetIn = false, waiting = [];
  (function () {
    var done = function () {
      sheetIn = true;
      var q = waiting; waiting = [];
      q.forEach(function (fn) { fn(); });
      U.emit('render');
    };
    var r = new XMLHttpRequest();
    /* In the sealed build every asset is served out of the decrypted
       manifest, so the sheet has to be asked for by the same name the tiles
       are. The cache-buster is for the dev server only — appended to a real
       path, it would miss the manifest entirely. */
    var url = U.assetURL(ART + 'overrides.json'), plain = url === ART + 'overrides.json';
    r.open('GET', url + (plain ? '?t=' + Date.now() : ''), true);
    r.onload = function () {
      if (r.status >= 200 && r.status < 300) {
        try { OVERRIDE = JSON.parse(r.responseText) || {}; } catch (e) { OVERRIDE = {}; }
      }
      done();
    };
    r.onerror = done;          /* no sheet is a fine state; the rules stand alone */
    r.send();
  })();
  function ready(fn) { if (sheetIn) fn(); else waiting.push(fn); }
  function cellName(x, y) { return String.fromCharCode(65 + x) + (y + 1); }
  function sheet() { return OVERRIDE[C.id] || {}; }   /* _readme is ignored: it is not a contract id */
  function overrideAt(x, y) {
    var v = sheet()[cellName(x, y)];
    return v === undefined ? null : (v || []);
  }
  function ch(x, y) { return E.charAt(x, y); }
  /* anything a person could stand on, for the purposes of drawing walls. Doors
     are NOT floor here: a door is a hole in a wall and is drawn with the wall. */
  /* 'L' is a laser: blocked to anything that walks, but it stands in an open
     corridor, so for BUILDING the walls it is floor. Treating it as wall
     sealed contract three's central corridor into a chamber. */
  /* TWO KINDS OF WAY OUT. A contract that says HATCH:'niche' has an alcove
     cut into its wall — the 'X' is a floor square and the stone is built
     around it, cell by cell, in that contract's sheet. Any other contract
     gets the simple thing: the wall runs straight past and the window is
     drawn on it. */
  function nicheMode() { return C.HATCH === 'niche'; }
  /* The exit square is a square Assane STANDS ON, so it is floor in both
     kinds of building — in an alcove cut into the wall, or out in the room
     with the window on the wall behind it. Treating it as wall put a notch of
     stone in the room and broke the corner beside it. */
  function floorLike(x, y) {
    var c = ch(x, y);
    return c === '.' || c === 'E' || c === 'L' || c === 'X';
  }
  /* THE HATCH IS A NICHE cut into a thick wall: floor with a window on it, a
     panelled face on the wall above, and below it the wall's top edge in its
     own cell rather than in the niche — an edge tile drawn in the niche would
     cover the window. */
  function isNiche(x, y) { return ch(x, y) === 'X'; }
  function wallLike(x, y) { return !floorLike(x, y); }
  function isDoor(x, y) { var c = ch(x, y); return c === '+' || c === '/'; }
  function img(name, x, y, w, h, extra) {
    return '<image href="' + href(name) + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
           '" preserveAspectRatio="' + (extra && extra.keep ? 'xMidYMax meet' : 'none') + '"' +
           (extra && extra.opacity != null ? ' opacity="' + extra.opacity + '"' : '') + '/>';
  }

  /* ------------------------------------------------------------ the walls */
  /* Which piece goes in a wall cell is decided by where the floor is around
     it. A rules table, not a hand-placed map: any contract, including ones
     not yet written, gets walls for free, and the artist can retune the table
     without touching a level. */
  /* A FACE NEEDS A WALL BEHIND IT. The panelled north face is drawn only
     where the cell above is also wall (or off the map). A wall with rooms on
     both sides is a PARTITION and is drawn as a block — the concept never
     shows a panel between two floors, and a door in such a wall sits on the
     block, the way the exit door does at the bottom of the concept. */
  /* A WALL WITH FLOOR BELOW IT IS A FACE. What sits on the far side of it is
     not this side's business: requiring stone above meant one internal wall
     changed from panelled face to bare block halfway along its length,
     wherever a room happened to back onto it. The top tile then lands on
     whatever is above — stone, or the floor of the room behind. */
  function faceCell(x, y) { return wallLike(x, y) && floorLike(x, y + 1); }

  /* INSIDE THE BUILDING vs OUTSIDE IT. Flood the map from its border through
     wall cells: whatever the flood reaches is outside and stays dark, the way
     the concept leaves everything beyond the room dark. Whatever it cannot
     reach is a wall mass ENCLOSED by rooms — the pillars between the wings —
     and a mass is solid, so it is filled with the grey top face. Leaving them
     unpainted read as holes in the middle of the floor. */
  var outCache = null, outFor = null;
  function outside(x, y) {
    if (outFor !== C.MAP) {
      var cols = C.MAP[0].length, rows = C.MAP.length, seen = {}, q = [];
      var push = function (px, py) {
        if (px < 0 || py < 0 || px >= cols || py >= rows) return;
        var k = px + ',' + py;
        if (seen[k] || floorLike(px, py)) return;
        seen[k] = 1; q.push([px, py]);
      };
      for (var i = 0; i < cols; i++) { push(i, 0); push(i, rows - 1); }
      for (var j = 0; j < rows; j++) { push(0, j); push(cols - 1, j); }
      while (q.length) { var c = q.shift(); push(c[0] + 1, c[1]); push(c[0] - 1, c[1]); push(c[0], c[1] + 1); push(c[0], c[1] - 1); }
      outCache = seen; outFor = C.MAP;
    }
    return !!outCache[x + ',' + y];
  }

  /* The band and the block, in the tile set's own colours, for the corners we
     build ourselves. Six tiles in the set (corner-*, outer-bottom-left/right)
     carry their band on the opposite side from the edge-* tiles, and until the
     artist confirms which convention is which they stay out of the table:
     a corner drawn from an edge band and a strip of the same grey is coherent
     with everything around it, and a corner drawn from a tile we have read
     backwards is not. Pixel rows measured from wall-blank-top: the top face
     band runs y115-196 with 4px black lines either side; edge bands are 80px
     wide with the line on the outer side. */
  var BAND = '#D5CEBE', LINE = '#000';
  var BAND_Y0 = 115 / H, BAND_Y1 = 196 / H, BAND_W = 80 / W, LINE_W = 4 / W, LINE_H = 4 / H;

  /* THE PILLAR. The artist's second rule: where a wall mass juts INTO the
     room — a block with floor above and beside it, or a face run that ends
     against floor — the side band is drawn inside the neighbouring FLOOR tile,
     hugging its edge, with the line on the floor side. It starts a quarter
     tile above the mass so the corner reads as a post. `side` is which floor
     cell it lives in, relative to the wall cell. */
  function pillar(side, fromDy, toDy) {
    var dx = side === 'E' ? 1 : -BAND_W;
    var lineDx = side === 'E' ? 1 + BAND_W - LINE_W : -BAND_W;
    return [{ rect: 1, dx: dx, dy: fromDy, w: BAND_W, h: toDy - fromDy, fill: BAND, pillar: 1 },
            { rect: 1, dx: lineDx, dy: fromDy, w: LINE_W, h: toDy - fromDy, fill: LINE, pillar: 1 }];
  }

  function bandH(dx, dy, w) {        /* a horizontal top-face band, lines above and below */
    return [{ rect: 1, dx: dx, dy: dy + BAND_Y0, w: w, h: BAND_Y1 - BAND_Y0, fill: BAND },
            { rect: 1, dx: dx, dy: dy + BAND_Y0, w: w, h: LINE_H, fill: LINE },
            { rect: 1, dx: dx, dy: dy + BAND_Y1 - LINE_H, w: w, h: LINE_H, fill: LINE }];
  }

  var PROBING = false;

  function wallPieces(x, y) {

    var n = floorLike(x, y - 1), e = floorLike(x + 1, y), s = floorLike(x, y + 1), w = floorLike(x - 1, y);
    var out = [];

    /* WHICH COLUMN DOES THE BAND BELOW RUN IN? Either answer is legitimate:
       an outer side-wall run keeps its 80px band in the wall cell, while a run
       that ends at a face corner hands it to the floor column beside it. The
       mass's end cap above has to land in the same column as whichever it is,
       or the wall jogs sideways by its own thickness where they meet.
       Rather than re-derive which of those rules will fire — that was the bug,
       and the two disagreed — ask the cell below what it actually emits. The
       probe flag keeps that one level deep. */
    function bandInWallColumn(side) {
      if (PROBING || !wallLike(x, y + 1)) return false;
      PROBING = true;
      var below;
      try { below = wallPieces(x, y + 1); } finally { PROBING = false; }
      var want = side === 'E' ? /^wall-(edge-left|corner-bottom-right)/
                              : /^wall-(edge-right|corner-bottom-left)/;
      for (var i = 0; i < below.length; i++) {
        if (!Math.round(below[i].dx || 0) && want.test(below[i].name || '')) return true;
      }
      return false;
    }

    /* floor below wins: this side of the wall is a face whatever backs onto
       it, and its top tile simply lands on the floor of the room behind */
    if (s) {
      /* THE NORTH FACE. Two cells tall, the top tile in the wall cell above.
         Runs of face cells share moulded panels in pairs; a leftover single
         column stays blank. */
      /* ALWAYS two tiles tall. The artist's rule for a partition: the top tile
         goes in the row ABOVE the wall cell and covers the lower part of the
         floor tile there (its upper 115px are transparent, so the floor shows
         through). Nothing is squeezed any more. */
      /* a door column is blank behind the door, and splits the run so the
         moulded pairs never straddle it */
      var runStart = x; while (faceCell(runStart - 1, y) && !isDoor(runStart - 1, y)) runStart--;
      var runEnd = x;   while (faceCell(runEnd + 1, y) && !isDoor(runEnd + 1, y)) runEnd++;
      var i = x - runStart, len = runEnd - runStart + 1;
      var top = 'wall-blank-top', bot = 'wall-blank-bottom';
      var lastSingle = (len % 2 === 1) && (i === len - 1);
      if (len >= 2 && !lastSingle && !isDoor(x, y)) {
        if (i % 2 === 0) { top = 'wall-molded-top-left';  bot = 'wall-molded-bottom-left'; }
        else             { top = 'wall-molded-top-right'; bot = 'wall-molded-bottom-right'; }
      }

      /* WHERE A FACE RUN ENDS AGAINST FLOOR.
         The face itself is never capped: the moulded pair runs right to the
         last column. The corner belongs to the ROOM beside it, and the set
         has the piece for it — the inner-corner tiles, two tiles tall, drawn
         INSIDE that floor cell over the same two rows as the face. That is
         the artist's rule ("when a wall is concave it goes inside the floor
         tile") and the reason the panels are no longer cut through. */
      var pieces = [];
      if (e) {
        pieces.push({ name: 'wall-inner-corner-top-left',    dx: 1, dy: -1, w: 1, h: 1, pillar: 1 });
        pieces.push({ name: 'wall-inner-corner-bottom-left', dx: 1, dy: 0,  w: 1, h: 1, pillar: 1 });
      }
      if (w) {
        pieces.push({ name: 'wall-inner-corner-top-right',    dx: -1, dy: -1, w: 1, h: 1, pillar: 1 });
        pieces.push({ name: 'wall-inner-corner-bottom-right', dx: -1, dy: 0,  w: 1, h: 1, pillar: 1 });
      }
      out.push({ name: top, dx: 0, dy: -1, w: 1, h: 1, face: 1 });
      out.push({ name: bot, dx: 0, dy: 0,  w: 1, h: 1, face: 1 });
      pieces.forEach(function (r) { out.push(r); });
      return out;
    }

    /* the wall's top face, seen from the room above it — only where this wall
       does NOT also face a room below */
    if (n) {
      /* the boundary tile only where the mass actually ends; otherwise the
         plain block, or its bottom line lands inside the stone */
      out.push({ name: floorLike(x, y + 1) ? 'wall-outer-bottom-center' : 'block-tile', dx: 0, dy: 0, w: 1, h: 1 });
      /* THE TOP EDGE OF THE MASS IS A TILE, not something to synthesise.
         wall-outer-edge-center is transparent down to its band and then the
         mass colour, so it goes in the FLOOR cell above and the parquet shows
         through over it. The ends of the run turn with the corner-* tiles,
         in the floor cell diagonally past each end. */
      /* (contract three's wall thickens below its niche; that is its own
         architecture and lives in its sheet, not in a rule here) */
      /* THE TOP EDGE OF THE MASS IS A TILE, not something to synthesise.
         wall-outer-edge-center is transparent down to its band and then the
         mass colour, so it goes in the FLOOR cell above and the parquet shows
         through over it. The ends of the run turn with the corner-* tiles,
         in the floor cell diagonally past each end. */
      /* Contract three's wall thickens below its niche; that is that
         building's own architecture and lives in its sheet, not in a rule
         here. Applied blindly it turned contract four's plain outer wall into
         a short mass and broke the band either side of it. */
      out.push({ name: 'wall-outer-edge-center', dx: 0, dy: -1, w: 1, h: 1, pillar: 1 });
      /* AND THE END CAP OF THAT TOP EDGE, which turns the pale band down the
         side of the opening. The band is 80px wide, so the cap has to land in
         the SAME 80px column as the vertical band below it; put it in the
         wrong one and the wall jogs sideways by its own thickness where the
         two meet. Which column that is depends on the side wall underneath,
         and that is decided further down, so only note the intent here. */
      if (e && !PROBING) out.push(bandInWallColumn('E')
        ? { name: 'wall-corner-top-right', dx: 0, dy: -1, w: 1, h: 1, pillar: 1 }
        : { name: 'wall-corner-top-left',  dx: 1, dy: -1, w: 1, h: 1, pillar: 1 });
      if (w && !PROBING) out.push(bandInWallColumn('W')
        ? { name: 'wall-corner-top-left',  dx: 0,  dy: -1, w: 1, h: 1, pillar: 1 }
        : { name: 'wall-corner-top-right', dx: -1, dy: -1, w: 1, h: 1, pillar: 1 });
      /* a partition: the block's lower edge meets floor, and the concept
         outlines it — a dark line along the bottom */
      if (s) out.push({ rect: 1, dx: 0, dy: 1 - LINE_H, w: 1, h: LINE_H, fill: LINE, pillar: 1 });
      /* the mass's side, as a pillar in the floor beside it; it climbs a
         quarter tile above the block so the corner has a post */
      /* AND THE MASS'S OWN FLANKS. A band still belongs on any wall cell that
         has floor beside it — dropping the pillars took these with them, and
         the top row of every mass was left open down both sides. In the wall
         cell, hugging the floor: edge-left carries its band on the right, so
         floor to the east reads edge-left and floor to the west edge-right. */
      /* NO BAND IN THE WALL CELL HERE. On a mass's top row it can only ever
         cover part of one cell, and nothing continues it below, because the
         band down an opening's side belongs in the FLOOR column — that is
         where the inner-corner pieces put it, and where the sheet puts it.
         Drawn here it was a pale bar floating in the middle of the stone. */
      return out;
    }

    /* SIDE WALLS. An outer wall is a band in the wall cell, on the floor
       side, line outside. But where the room NARROWS — the run of side-wall
       cells hangs below a block, the way the reference's lower section hangs
       below its two blocks — the wall is a pillar inside the floor tile,
       continuing the block's corner straight down. One line, no jog. */
    function sideRunTopIsBlock(side) {
      var nx = side === 'E' ? x + 1 : x - 1, yy = y;
      function isSide(yy) { return wallLike(x, yy) && floorLike(nx, yy) && !floorLike(x, yy - 1) && !floorLike(x, yy + 1); }
      while (isSide(yy - 1)) yy--;
      return wallLike(x, yy - 1) && floorLike(x, yy - 2);
    }
    /* ...and a run whose BOTTOM meets a face corner belongs to the room too:
       the corner below it is drawn inside that room's floor, so the band above
       has to be as well or the two are one cell out of line. This is the
       chambre's side walls, and every recess. */
    function runEndsAtFaceCorner(side) {
      var nx = side === 'E' ? x + 1 : x - 1, yy = y;
      function isSide(q) { return wallLike(x, q) && floorLike(nx, q) && !floorLike(x, q - 1) && !floorLike(x, q + 1); }
      if (!isSide(yy)) return false;
      while (isSide(yy + 1)) yy++;
      var b = yy + 1;
      if (!(wallLike(x, b) && floorLike(x, b + 1) && floorLike(nx, b))) return false;
      /* the corner is two tiles tall and its TOP tile already fills the row
         directly above the face — so the last cell of the run draws nothing,
         or there would be a band on top of the corner */
      return yy === y ? 'covered' : true;
    }
    var handled = false;
    [['E', e, 1, 'wall-edge-right'], ['W', w, -1, 'wall-edge-left']].forEach(function (sd) {
      if (!sd[1]) return;
      handled = true;
      var mode = runEndsAtFaceCorner(sd[0]);
      if (mode === 'covered') return;          /* the corner tile fills this row */
      if (mode) { out.push({ name: sd[3], dx: sd[2], dy: 0, w: 1, h: 1, pillar: 1 }); return; }

      /* AN OUTER WALL RUN, AND ITS TWO CAPS.
         The band sits in the wall cell, outside the floor. Where the run ENDS
         at the bottom the band becomes a bottom corner, and where it starts at
         the top BESIDE A FACE it climbs that face's two tiles — a plain band
         level with the face's lower tile, a top corner level with its upper
         one — so the vertical band and the face's horizontal band meet instead
         of stopping a row short of each other.
         Mirrored: floor to the east reads right-hand pieces, floor to the west
         left-hand ones, which is the same rule seen from the other side. */
      var nx = sd[0] === 'E' ? x + 1 : x - 1;
      var band = sd[0] === 'E' ? 'wall-edge-left' : 'wall-edge-right';
      /* WHERE THE MASS STEPS IN. The floor beside this cell is a pocket cut
         into the mass — wall above it and wall below it — so the band has to
         turn at both ends inside one tile. That is what the filled corner
         pieces are for. */
      if (wallLike(nx, y - 1) && wallLike(nx, y + 1)) {
        /* NOTE ON THE NAMES. edge-left carries its band on the RIGHT of the
           tile and edge-right on the LEFT; every corner tile is named the
           other way round, content on the side its name says. So the piece is
           chosen by which side the band must hug, not by the word: floor to
           the east wants content on the right, floor to the west on the left. */
        out.push({ name: sd[0] === 'E' ? 'wall-corner-bottom-right-fill' : 'wall-corner-bottom-left-fill', dx: 0, dy: 0, w: 1, h: 1 });
        /* ...and the band climbs the two cells above the pocket, capped by a
           corner, exactly as an outer run does — the pocket's side wall is a
           wall like any other and has to reach the mass above it. */
        if (wallLike(x, y - 1)) out.push({ name: sd[0] === 'E' ? 'wall-edge-left' : 'wall-edge-right', dx: 0, dy: -1, w: 1, h: 1 });
        if (wallLike(x, y - 2)) out.push({ name: sd[0] === 'E' ? 'wall-corner-top-right' : 'wall-corner-top-left', dx: 0, dy: -2, w: 1, h: 1 });
        return;
      }
      var isRun = function (q) { return wallLike(x, q) && floorLike(nx, q) && !floorLike(x, q - 1) && !floorLike(x, q + 1); };
      if (!isRun(y + 1)) out.push({ name: sd[0] === 'E' ? 'wall-corner-bottom-right' : 'wall-corner-bottom-left', dx: 0, dy: 0, w: 1, h: 1 });
      else out.push({ name: band, dx: 0, dy: 0, w: 1, h: 1 });
      /* the top of the run climbs one cell into the wall above it, so the
         band meets whatever that wall is instead of stopping a row short; if
         a FACE stands beside it, a corner tile turns above that. */
      if (!isRun(y - 1) && wallLike(x, y - 1)) {
        out.push({ name: band, dx: 0, dy: -1, w: 1, h: 1 });
        if (faceCell(nx, y - 1)) out.push({ name: sd[0] === 'E' ? 'wall-corner-top-right' : 'wall-corner-top-left', dx: 0, dy: -2, w: 1, h: 1 });
      }
    });
    if (handled) return out;

    /* nothing orthogonal: an outside corner. The vertical band continues up
       to meet the face's top band, and a strip of the same grey turns the
       corner towards the face. Above the floor (NW/NE corners) the band has
       to climb into the row above when the face beside it is tall; below the
       floor (SW/SE corners) the blocks next door finish the shape. */
    /* NOTHING ORTHOGONAL. Floor only on a diagonal means the corner belongs
       to the room that can see it — the face's in-corner tile inside the
       floor, or the side band above it — and this cell draws nothing. Both a
       synthesised strip and a corner tile here sit one cell out from the band
       they are meant to continue, which is the jog at the chambre's corners. */
    var ne = floorLike(x + 1, y - 1), nw = floorLike(x - 1, y - 1);
    /* the two corners under the building's south wall */
    if (outside(x, y)) {
      if (ne) { out.push({ name: 'wall-outer-bottom-right', dx: 0, dy: 0, w: 1, h: 1 }); return out; }
      if (nw) { out.push({ name: 'wall-outer-bottom-left',  dx: 0, dy: 0, w: 1, h: 1 }); return out; }
    }
    /* nothing else: the run's own caps close every corner now */
    return out;
  }

  /* ------------------------------------------------------------ the vision */
  /* Red hatching, laid as ONE pattern across the whole floor rather than a
     hatch per cell, so the stripes run continuously through a cone and a
     six-square sightline reads as one shape and not six stamps. The guard's
     own square is part of it: he is standing in his own light.
     This layer sits between the ground and the walls. It is paint on the
     floor, and a wall in front of it hides it the way a wall hides floor. */
  function defs() {
    return '<defs>' +
      '<pattern id="tl-hatch" patternUnits="userSpaceOnUse" width="26" height="26" patternTransform="rotate(45)">' +
        '<rect width="26" height="26" fill="' + RED + '" fill-opacity=".34"/>' +
        '<rect width="9" height="26" fill="' + RED + '" fill-opacity=".55"/>' +
      '</pattern>' +
      '<pattern id="tl-hatch-cam" patternUnits="userSpaceOnUse" width="26" height="26" patternTransform="rotate(-45)">' +
        '<rect width="26" height="26" fill="' + RED + '" fill-opacity=".22"/>' +
        '<rect width="6" height="26" fill="' + RED + '" fill-opacity=".5"/>' +
      '</pattern>' +
      '<filter id="tl-glow"><feGaussianBlur stdDeviation="6"/></filter>' +
    '</defs>';
  }

  /* ------------------------------------------------------------ render */
  /* opts:
       scale     — CSS pixels per art pixel for the host width; the SVG scales
                   itself, this only sets the intrinsic size (default .5)
       view      — 'benjamin': the whole floor, every cone, no fog
                   'assane':   fog of war, guards only where he can see them,
                               no cones unless opts.threat is forced
       layers    — { ground, vision, walls, props, actors, ui } booleans
       threat    — override the vision set (a map of 'x,y' → truthy)
       edges     — also outline the squares a sightline passes beside (+1) */
  function render(host, opts) {
    opts = opts || {};
    var S = E.S, layers = opts.layers || {};
    function on(k) { return layers[k] !== false; }
    var view = opts.view || 'benjamin';
    var cols = C.MAP[0].length, rows = C.MAP.length;
    var seen = view === 'assane' ? S.seen : null;
    var vis = view === 'assane' ? E.visibleSet() : null;
    function known(x, y) { return !seen || !!seen[x + ',' + y]; }
    function lit(x, y) { return !vis || !!vis[x + ',' + y]; }
    /* a wall cell is known if any floor it borders is known */
    function wallKnown(x, y) {
      if (!seen) return true;
      for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) if (seen[(x + dx) + ',' + (y + dy)]) return true;
      return false;
    }

    /* GUARD SIGHTLINES ONLY. The camera hatch was a second red pattern over
       the same floor and the two could not be told apart at a glance. */
    var threat = opts.threat || (view === 'benjamin' ? E.threat('guards') : null);
    var camThreat = {};

    /* pad a cell all round: tall faces rise above row 0, and the shell reads
       better with a margin of dark around it */
    var vbX = -W, vbY = -H, vbW = (cols + 2) * W, vbH = (rows + 2) * H;
    var s = '<svg class="tiles" viewBox="' + vbX + ' ' + vbY + ' ' + vbW + ' ' + vbH + '" width="100%" xmlns="http://www.w3.org/2000/svg">';
    s += defs();
    s += '<rect x="' + vbX + '" y="' + vbY + '" width="' + vbW + '" height="' + vbH + '" fill="' + VOID + '"/>';

    var x, y, px, py, c;

    /* ---- 1. GROUND ---- */
    if (on('ground')) {
      s += '<g class="tl-ground">';
      for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) {
        c = ch(x, y);
        /* Floor goes where there IS floor. Testing for '#' meant every other
           character got parquet — including a hatch that is a wall in this
           contract, which put a patch of floor outside the building. */
        if (!floorLike(x, y) && !isDoor(x, y)) continue;
        if (!known(x, y) && !isDoor(x, y)) continue;
        px = x * W; py = y * H;
        s += img('floor-tile', px, py, W + 1, H + 1);
        if (seen && !lit(x, y)) s += '<rect x="' + px + '" y="' + py + '" width="' + (W + 1) + '" height="' + (H + 1) + '" fill="' + VOID + '" opacity=".55"/>';
      }
      s += '</g>';
    }

    /* ---- 2. VISION ---- */
    if (on('vision') && threat) {
      s += '<g class="tl-vision">';

      /* ARM'S LENGTH, DRAWN AS ARM'S LENGTH.
         With the lights cut or the power gone, coneDepth() collapses to 0 and
         a guard sees the eight squares around him and nothing else — a 3x3
         block, which is exactly the shape the artist cut guard-sightline-small
         to. So in that state the layer stops hatching cell by cell and lays
         his piece over each man instead, clipped to the squares the engine
         actually says are dangerous, so a wall still stops it. White rather
         than red on purpose: in the dark these are torches, and the dossier
         says as much. */
      /* THE ARTIST'S SIGHTLINE, AND THE RULE IT IS NOW THE SHAPE OF.
         cone() used to be a body and a one-tile line ahead, which left the two
         squares diagonally in front of a guard free — the first thing everyone
         tried, and impossible to explain to somebody watching. It is the shape
         of these pieces now: three tiles across from one square behind him to
         `depth` ahead, narrowing to a single tile one further on.

         Both pieces are drawn facing WEST — the man stands one column in from
         the right-hand end and the look runs away from him to the left — so
         west is no rotation and the other three turn about the square he is
         standing on. The full piece is authored at depth three and stretched
         along its own axis for anything else, so ATTENTIVE and ALERT widen his
         look rather than merely lengthening it.

         Both are masked red, because red is threat on this floor. */
      function sightlineFor(g, gi, depth) {
        var p = E.guardAt(g);
        if (!known(p.x, p.y) && !wallKnown(p.x, p.y)) return '';
        var mine = E.cone(p.x, p.y, g.facing, depth);
        if (!mine.length) return '';
        var small = depth <= 0, id = 'tl-sight-' + gi, box = 10;
        var spin = { W: 0, N: 90, E: 180, S: 270 }[g.facing] || 0;
        var cx = p.x * W + W / 2, cy = p.y * H + H / 2;
        var cols = small ? 3 : depth + 3;
        var ix = (small ? p.x - 1 : p.x - depth - 1) * W, iy = (p.y - 1) * H;
        var art = '<image href="' + href(small ? 'guard-sightline-small' : 'guard-sightline') + '"' +
                  ' x="' + ix + '" y="' + iy + '" width="' + (cols * W) + '" height="' + (3 * H) + '"' +
                  ' preserveAspectRatio="none" transform="rotate(' + spin + ' ' + cx + ' ' + cy + ')"/>';

        /* THE TORCH NEEDS NO CLIP. Every non-wall neighbour is in the ring, so
           the only thing a 3x3 can cover beyond the rule is stone, and Assane
           can never stand on stone — while clipping it chopped the glow square
           against the wall and made the piece read as a 3x2.
           THE FAN DOES need one: it can reach past a wall into the next room,
           and painting a square there would be a lie. */
        var clip = '';
        if (!small) {
          mine.concat([p.x + ',' + p.y]).forEach(function (k) {
            var c = k.split(',');
            clip += '<rect x="' + (c[0] * W) + '" y="' + (c[1] * H) + '" width="' + (W + 1) + '" height="' + (H + 1) + '"/>';
          });
        }
        return (clip ? '<clipPath id="' + id + '-c">' + clip + '</clipPath>' : '') +
          '<mask id="' + id + '-m">' + art + '</mask>' +
          '<rect' + (clip ? ' clip-path="url(#' + id + '-c)"' : '') +
          ' mask="url(#' + id + '-m)"' +
          ' x="' + ((p.x - box) * W) + '" y="' + ((p.y - box) * H) + '"' +
          ' width="' + (box * 2 * W) + '" height="' + (box * 2 * H) + '"' +
          ' fill="' + RED + '" opacity="' + (small ? 0.85 : 0.78) + '"/>';
      }

      /* every threatened square, however it is going to be painted — the +1
         outline below is measured off this and has to be the same set */
      var cells = {}, k;
      for (k in threat) cells[k] = 1;
      S.guards.forEach(function (g) { var p = E.guardAt(g); if (view === 'benjamin' || lit(p.x, p.y)) cells[p.x + ',' + p.y] = 1; });

      if (view === 'benjamin') {
        /* coneDepth() is already 0 with the lights cut or the power gone, so
           the torch and the fan are the same call */
        S.guards.forEach(function (g, gi) { s += sightlineFor(g, gi, E.coneDepth(g)); });
      } else {
        for (k in cells) {
          var pr = k.split(',').map(Number);
          if (!known(pr[0], pr[1])) continue;
          var byCam = camThreat[k] && !(threat[k] && threat[k].some && threat[k].some(function (id) { return id.charAt(0) === 'g'; }));
          s += '<rect x="' + (pr[0] * W) + '" y="' + (pr[1] * H) + '" width="' + (W + 1) + '" height="' + (H + 1) + '" fill="url(#' + (byCam ? 'tl-hatch-cam' : 'tl-hatch') + ')"/>';
        }
      }

      /* the +1 zone: a sightline passing within arm's reach costs a point */
      if (opts.edges) {
        for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) {
          if (!floorLike(x, y) || cells[x + ',' + y]) continue;
          var brush = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (v) { return cells[(x + v[0]) + ',' + (y + v[1])]; });
          if (brush) s += '<rect x="' + (x * W + 6) + '" y="' + (y * H + 6) + '" width="' + (W - 12) + '" height="' + (H - 12) + '" fill="none" stroke="' + RED + '" stroke-width="4" stroke-dasharray="14 10" opacity=".6"/>';
        }
      }
      s += '</g>';
    }

    /* ---- 3. WALLS, LASERS, DOORS ---- */
    if (on('walls')) {
      s += '<g class="tl-walls">';
      /* faces first, everything else on top, so a side band can sit over a
         face end without the face erasing it */
      var later = '', over = sheet(), hasOver = false, k2;
      for (k2 in over) { hasOver = true; break; }
      /* a cell the sheet speaks for takes nothing from the rules */
      function owned(cx, cy) { return hasOver && over[cellName(cx, cy)] !== undefined; }
      for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) {
        if (!wallLike(x, y) || !wallKnown(x, y)) continue;
        /* A MASS IS SOLID, AND SILENT.
           wall-outer-bottom-center carries a black line along its bottom edge
           — it is the tile for the wall's lower boundary, not for its middle.
           Stacked to fill a mass it drew that line at every cell boundary,
           which is the ladder of parallel lines running through the blocks.
           block-tile is the same colour with no line, and is what a mass is
           made of. */
        if (!outside(x, y)) s += img('block-tile', x * W, y * H, W + 1, H + 1);
        var pieces = wallPieces(x, y);
        pieces.forEach(function (p) {
          if (owned(x + Math.round(p.dx || 0), y + Math.round(p.dy || 0))) return;
          var tag = p.rect
            ? '<rect x="' + ((x + p.dx) * W) + '" y="' + ((y + p.dy) * H) + '" width="' + (p.w * W + 0.5) + '" height="' + (p.h * H + 0.5) + '" fill="' + p.fill + '"/>'
            : img(p.name, (x + p.dx) * W, (y + p.dy) * H, p.w * W + 1, p.h * H + 1);
          /* faces first, bands and strips over them, pillars last of all */
          if (!p.rect && p.name.indexOf('wall-edge') < 0) s += tag; else later += tag;
        });
      }
      s += later;
      /* ...and then the sheet's own tiles, in the order it lists them */
      for (var oy = -1; oy < rows; oy++) for (var ox = 0; ox < cols; ox++) {
        var list = over[cellName(ox, oy)];
        if (!list || !list.length) continue;
        if (seen && !wallKnown(ox, oy)) continue;
        list.forEach(function (name) {
          s += img(name, ox * W, oy * H, W + 1, H + 1);
        });
      }
      /* the beams are not drawn on this floor — they are Benjamin's to
         know, and on the illustrated plan they read as damage. */

      /* doors: gold while locked (the thing to open), grey once it is not. A
         door in a north face stands in the face; one in a side wall swings. */
      S.doors.forEach(function (d) {
        if (!wallKnown(d.x, d.y)) return;
        var horizontal = floorLike(d.x, d.y + 1) || floorLike(d.x, d.y - 1);
        px = d.x * W; py = d.y * H;
        if (horizontal) {
          var name = d.locked ? 'goal-door-front' : 'prop-door-gray';
          var onBlock = floorLike(d.x, d.y - 1);        /* a partition: the door sits on the grey */
          if (onBlock) s += img(name, px + W * 0.06, py - H * 0.05, W * 0.88, H * 1.08, { keep: true });
          else s += img(name, px + W * 0.02, py - H * 0.1, W * 0.96, H * 1.1, { keep: true });
        } else {
          s += img('goal-door-side', px + W * 0.2, py - H * 0.25, W * 0.6, H * 1.25, { keep: true, opacity: d.locked ? 1 : 0.85 });
        }
      });
      s += '</g>';
    }

    /* ---- 4. PROPS: the objectives, the hatch, the way in ---- */
    if (on('props')) {
      s += '<g class="tl-props">';
      C.MODULES.forEach(function (m) {
        if (!known(m.x, m.y)) return;
        px = m.x * W; py = m.y * H;
        var done = S.solved[m.id];
        if (m.id === 'bureau' || m.id === 'prize') {
          /* the desk stands against the wall behind it; the painting climbs the face */
          /* twice the size, and still standing on the same square: the box
             grows around the old one and stays anchored at its foot. */
          s += img('goal-bureau', px - W * 0.46, py - H * 2.22, W * 1.92, H * 3.2, { keep: true, opacity: done ? 0.7 : 1 });
        } else {
          s += '<circle cx="' + (px + W / 2) + '" cy="' + (py + H / 2) + '" r="' + (W * 0.22) + '" fill="' + (done ? GOLD : VOID) + '" fill-opacity=".9" stroke="' + GOLD + '" stroke-width="6"/>';
          s += '<g color="' + (done ? VOID : GOLD) + '" transform="translate(' + (px + W / 2 - W * 0.14) + ',' + (py + H / 2 - W * 0.14) + ') scale(' + (W * 0.28 / 100) + ')">' + G.iconMarkup(m.icon) + '</g>';
        }
      });
      var hx = E.hatchTile();
      /* PRIZE.hatchHidden keeps the hatch off Benjamin's dossier plan — that
         is p2.js's business. This is the room itself, so the way out is drawn
         wherever it exists; hiding it here just lost the window. */
      if (hx && known(hx.x, hx.y)) {
        /* the way out is a window in the wall, stood against the side of the
           niche it sits in */
        /* the new art is a full 300x290 tile with the window already placed
           against the left of it, so it drops onto the cell as it is */
        /* the window stands against the wall the niche is cut into, so it
           mirrors with the niche: art for a west wall, flipped for an east */
        /* THE WINDOW STANDS IN THE ROOM, AGAINST THE WALL.
           It is drawn on the exit square itself, and mirrored so its frame
           hugs whichever side the wall is on: wall to the east wants the art
           flipped, wall to the west takes it as drawn. That is what the
           mirrored copy is for, and it is why the window no longer hangs out
           past the stone into the dark. */
        var wallEast = wallLike(hx.x + 1, hx.y);
        s += img(wallEast ? 'goal-window-side-right' : 'goal-window-side',
                 hx.x * W, hx.y * H, W + 1, H + 1);
      }
      s += '</g>';
    }

    /* ---- 5. ACTORS: drawn south-most last, so a man lower on the floor
            stands in front of one higher up ---- */
    if (on('actors')) {
      var actors = [];
      S.guards.forEach(function (g) {
        var p = E.guardAt(g);
        if (view === 'assane' && !lit(p.x, p.y)) return;
        actors.push({ who: 'guard', x: p.x, y: p.y, dir: g.facing, alert: g.alert > 0 });
      });
      actors.push({ who: 'assane', x: S.assane.x, y: S.assane.y, dir: S.facing || 'S' });
      actors.sort(function (a, b) { return a.y - b.y || a.x - b.x; });
      s += '<g class="tl-actors">';
      actors.forEach(function (a) {
        var dir = { N: 'up', S: 'down', E: 'right', W: 'left' }[a.dir] || 'down';
        px = a.x * W; py = a.y * H;
        s += '<ellipse cx="' + (px + W / 2) + '" cy="' + (py + H * 0.86) + '" rx="' + (W * 0.22) + '" ry="' + (H * 0.07) + '" fill="#000" opacity=".28"/>';
        s += img(a.who + '-' + dir, px + W * 0.1, py + H * 0.02, W * 0.8, H * 0.9, { keep: true });
      });
      s += '</g>';
    }

    /* ---- 6. UI: the pressure ring on Assane, the grace ring after a talk ---- */
    if (on('ui')) {
      s += '<g class="tl-ui">';
      var ax = S.assane.x * W + W / 2, ay = S.assane.y * H + H * 0.86;
      if (S.running && S.phase === 'play') {
        var idle = (Date.now() - S.lastActionAt) / 1000, P = C.PRESSURE;
        if (idle >= 3) {
          var r = W * 0.3, circ = 2 * Math.PI * r, frac = Math.min(idle / P.grace, 1), hot = idle >= P.grace;
          s += '<circle cx="' + ax + '" cy="' + ay + '" r="' + r + '" fill="none" stroke="' + (hot ? RED : GOLD) + '" stroke-width="14" stroke-linecap="round"' +
               ' stroke-dasharray="' + (frac * circ).toFixed(1) + ' ' + circ.toFixed(1) + '" transform="rotate(-90 ' + ax + ' ' + ay + ')"' + (hot ? ' class="pring is-hot"' : '') + '/>';
        }
      }
      if (S.grace > 0) s += '<circle cx="' + ax + '" cy="' + ay + '" r="' + (W * 0.36) + '" fill="none" stroke="' + GOLD + '" stroke-width="8" stroke-dasharray="18 14"/>';
      s += '</g>';
    }

    /* ---- 7. GRID: markup for the artist. Every cell outlined and named by
            its coordinate; every wall cell also lists the pieces it was built
            from, so a wrong tile can be pointed at by name. Off by default. */
    if (layers.grid) {
      /* Attribute every piece to the cell it LANDS in, not the wall cell that
         emitted it — a corner drawn inside a room belongs to that room's
         square when somebody is marking the render up. */
      var SHORTN = { 'wall-molded-top-left': 'mold-TL', 'wall-molded-top-right': 'mold-TR', 'wall-molded-bottom-left': 'mold-BL',
                     'wall-molded-bottom-right': 'mold-BR', 'wall-blank-top': 'blank-T', 'wall-blank-bottom': 'blank-B',
                     'wall-outer-bottom-center': 'block-edge', 'block-tile': 'block', 'wall-edge-left': 'edge-L', 'wall-edge-right': 'edge-R',
                     'wall-inner-corner-top-left': 'in-TL', 'wall-inner-corner-top-right': 'in-TR',
                     'wall-inner-corner-bottom-left': 'in-BL', 'wall-inner-corner-bottom-right': 'in-BR',
                     'wall-cap-top-left': 'cap-TL', 'wall-cap-top-right': 'cap-TR',
                     'wall-outer-edge-center': 'edge-C', 'wall-corner-top-left': 'cnr-TL', 'wall-corner-top-right': 'cnr-TR',
                     'wall-corner-bottom-left': 'cnr-BL', 'wall-corner-bottom-right': 'cnr-BR',
                     'wall-corner-bottom-left-fill': 'cnrF-BL', 'wall-corner-bottom-right-fill': 'cnrF-BR',
                     'wall-outer-bottom-left': 'out-BL', 'wall-outer-bottom-right': 'out-BR' };
      /* Label what is DRAWN, which means the sheet wins here exactly as it
         wins in the picture. Reading rule output while the board showed the
         sheet's tiles is how a cell came to be labelled one thing and drawn
         another. Sheet cells carry a * so the hand-set ones are obvious. */
      var drawnIn = {}, ov = sheet();
      var put = function (k2, nm) {
        (drawnIn[k2] = drawnIn[k2] || []);
        if (drawnIn[k2].indexOf(nm) < 0) drawnIn[k2].push(nm);
      };
      for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) {
        if (!wallLike(x, y)) continue;
        wallPieces(x, y).forEach(function (p) {
          var cx2 = x + Math.round(p.dx || 0), cy2 = y + Math.round(p.dy || 0);
          if (ov[cellName(cx2, cy2)] !== undefined) return;      /* the sheet owns it */
          /* a hairline is an outline, not a band */
          var nm = p.rect ? (p.h < 0.06 ? 'line' : 'strip') : (SHORTN[p.name] || p.name.replace('wall-', ''));
          put(cx2 + ',' + cy2, nm);
        });
      }
      for (var oy2 = -1; oy2 < rows; oy2++) for (var ox2 = 0; ox2 < cols; ox2++) {
        var lst = ov[cellName(ox2, oy2)];
        if (!lst) continue;
        if (!lst.length) put(ox2 + ',' + oy2, '* (blank)');
        lst.forEach(function (nm) { put(ox2 + ',' + oy2, '* ' + (SHORTN[nm] || nm.replace('wall-', ''))); });
      }
      s += '<g class="tl-grid" font-family="Consolas, monospace" font-weight="700">';
      for (y = -1; y < rows; y++) for (x = 0; x < cols; x++) {
        px = x * W; py = y * H; c = ch(x, y);
        var isWallCell = wallLike(x, y);
        if (isWallCell && !wallKnown(x, y) && seen) continue;
        s += '<rect x="' + px + '" y="' + py + '" width="' + W + '" height="' + H + '" fill="none" stroke="#00E5FF" stroke-width="4" opacity=".85"/>';
        var tag = cellName(x, y) + (c === '#' || c === '.' ? '' : ' ' + c);
        /* big enough to read on the exported PNG at 50%: the coordinate is 24px
           there, the piece names 19px */
        s += '<rect x="' + (px + 6) + '" y="' + (py + 6) + '" width="' + (tag.length * 28 + 18) + '" height="60" rx="6" fill="#000" opacity=".75"/>';
        s += '<text x="' + (px + 15) + '" y="' + (py + 52) + '" font-size="48" fill="#00E5FF">' + tag + '</text>';
        if (drawnIn[x + ',' + y]) {
          var owned = drawnIn[x + ',' + y];
          owned.forEach(function (n, i) {
            s += '<text x="' + (px + 10) + '" y="' + (py + 112 + i * 42) + '" font-size="38" fill="#FFD54F" stroke="#000" stroke-width="8" paint-order="stroke">' + n + '</text>';
          });
        }
        if (false) {
          /* short names, so two fit side by side in a cell at this size */
          var SHORT = { 'wall-molded-top-left': 'mold-TL', 'wall-molded-top-right': 'mold-TR', 'wall-molded-bottom-left': 'mold-BL',
                        'wall-molded-bottom-right': 'mold-BR', 'wall-blank-top': 'blank-T', 'wall-blank-bottom': 'blank-B',
                        'wall-outer-bottom-center': 'block-edge', 'block-tile': 'block', 'wall-edge-left': 'edge-L', 'wall-edge-right': 'edge-R',
                        'wall-inner-corner-top-left': 'end-TL', 'wall-inner-corner-top-right': 'end-TR', 'wall-inner-corner-bottom-left': 'end-BL', 'wall-inner-corner-bottom-right': 'end-BR',
                        'wall-cap-top-left': 'cap-TL', 'wall-cap-top-right': 'cap-TR',
                     'wall-outer-edge-center': 'edge-C', 'wall-corner-top-left': 'cnr-TL', 'wall-corner-top-right': 'cnr-TR',
                     'wall-corner-bottom-left': 'cnr-BL', 'wall-corner-bottom-right': 'cnr-BR',
                     'wall-corner-bottom-left-fill': 'cnrF-BL', 'wall-corner-bottom-right-fill': 'cnrF-BR',
                     'wall-outer-bottom-left': 'out-BL', 'wall-outer-bottom-right': 'out-BR' };
          var names = wallPieces(x, y).map(function (p) { return p.rect ? (p.pillar ? 'pillar' : 'strip') : (SHORT[p.name] || p.name.replace('wall-', '')); });
          var uniq = names.filter(function (n, i) { return names.indexOf(n) === i; });
          uniq.forEach(function (n, i) {
            s += '<text x="' + (px + 10) + '" y="' + (py + 112 + i * 42) + '" font-size="38" fill="#FFD54F" stroke="#000" stroke-width="8" paint-order="stroke">' + n + '</text>';
          });
        }
      }
      s += '</g>';
    }

    s += '</svg>';
    host.innerHTML = s;
    if (opts.scale) host.style.maxWidth = Math.round((cols + 2) * W * opts.scale) + 'px';
  }

  /* the wall layer as the sheet would express it — the seed for overrides.json
     and the way to re-cut it after a rule change */
  function dump() {
    var cols = C.MAP[0].length, rows = C.MAP.length, map = {};
    for (var y = -1; y < rows; y++) for (var x = 0; x < cols; x++) {
      if (!wallLike(x, y)) continue;
      wallPieces(x, y).forEach(function (p) {
        if (p.rect || p.w !== 1 || p.h !== 1) return;      /* tiles only */
        var k = cellName(x + Math.round(p.dx || 0), y + Math.round(p.dy || 0));
        (map[k] = map[k] || []).push(p.name);
      });
    }
    return map;
  }

  L.tiles = { render: render, ready: ready, W: W, H: H, wallPieces: wallPieces, dump: dump, cellName: cellName };
})(window.DC);
