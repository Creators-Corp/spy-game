# The illustrated floor — how the tiles go together

The renderer is `js/tiles.js`. **The television draws its room with it**, in
Assane's view — fog of war by true line of sight, guards only where he can see
them, no sightlines. The television frames it close and pans to follow him; the
camera lives in `tv.js`, not here, because it is about that screen and not about
the tiles.
Benjamin's phone still draws its own schematic plan, and that plan is the
logical map: `content.js` holds one grid, and both screens read it with the
same coordinates, so `H17` is one square on the television and on the dossier.
Nothing is scaled or projected between them.

The workbench is `tiles.html`; open it on the dev server, pick a contract, tick
**grid** under Layers to see every cell's name and the tiles drawn in it, and
**Export full layout** to write what the rules currently produce to
`art/tiles/computed.json`.

This document is the contract between the map data and the artwork. Contract
three (`chambre`) follows it. Contract four (`veille`) does not yet; the last
section says exactly where and why.

---

## 1. The unit

Every room tile is **300 × 290 px**. The moulded 2 × 2 panel is 600 × 580. The
bench draws at 50%, so a tile is 150 × 145 on screen — that is where the
"150 by 145" figure came from, and it is not the source size. Work in tile
units and let the SVG scale; never resample the art twice.

Cells are named the way the grid names them: **column letter + 1-based row**.
`A1` is the top-left cell. **Row 0** is the padding row above the map, where a
two-tile face puts its top half.

---

## 2. The layers, bottom to top

| layer | what it draws |
|---|---|
| ground | `floor-tile` on every walkable square |
| vision | the guards' sightlines, hatched red, as one continuous pattern — except with the lights cut or the power gone, when every cone collapses to the eight squares around a man and the layer lays `guard-sightline-small` over each of them instead, clipped to the squares the engine calls dangerous. White, because in the dark those are torches |
| walls | masses, faces, bands, corners, doors |
| props | the objectives, the desk, the window |
| actors | guards and Assane, drawn south-most last so they overlap correctly |
| ui | the pressure ring |

The vision layer sits **between the ground and the walls** on purpose: it is
paint on the floor, so a wall in front of it hides it exactly as a wall hides
floor.

---

## 3. What the map characters mean

| char | meaning | walls treat it as |
|---|---|---|
| `.` | floor | floor |
| `E` | the starting square | floor |
| `L` | a laser line | floor (you can see across it) |
| `X` | a niche: an opening cut into a thick wall | floor, plus a hand-authored assembly |
| `+` `/` | a door in a wall | wall, with a door drawn on it |
| `#` | wall | wall |

---

## 4. The wall vocabulary

**A mass** is a run of wall. Seen from above it is solid stone. Seen from the
room below it, it shows a panelled face.

- `block-tile` — solid stone, no lines. **This is what a mass is made of.**
- `wall-outer-bottom-center` — the same stone with a black line along its
  bottom edge. It marks where a mass *ends*. Use it only on the mass's last
  row; stacked to fill a mass it draws that line at every cell boundary and
  puts a ladder of parallel lines through the stone.
- `wall-outer-edge-center` — the mass's **top** edge: transparent above its
  band, so it is drawn in the floor cell *above* the mass and the parquet shows
  through over it.

**A face** is the panelled wall you look at from the room to its south. It is
**two tiles tall**: the upper tile carries the top band, the lower one the panel
and skirting. The upper tile goes in the cell above, which may be floor (the
band then reads as the wall's top edge) or more mass.

- `wall-molded-top-left` / `-right`, `wall-molded-bottom-left` / `-right` —
  a moulded panel, drawn as **pairs** across a run.
- `wall-blank-top` / `wall-blank-bottom` — plain, for a leftover odd column and
  for the column a door stands in.
- `wall-blank-corner-top-left` / `-right`, `-bottom-left` / `-right` — a face
  that stops against wall.
- `wall-inner-corner-top-*` / `-bottom-*` — a face that stops against **floor**.
  These are drawn **inside that floor cell**, over the face's two rows.

**Side walls** are the vertical bands.

- `wall-edge-left` / `wall-edge-right` — a plain band in the wall cell.
- `wall-corner-top-*` / `wall-corner-bottom-*` — the caps at each end of a run.
- `wall-corner-bottom-left-fill` / `-right-fill` — the cap where a pocket is cut
  into a mass, with the stone filled in behind it.
- `wall-edge-tjunction-left` / `-right` — where a wall running down meets the
  horizontal top edge of the wall below it.
- `wall-corner-inedge-left` / `-right` — the end of a band that runs inside a
  floor column rather than in a wall cell.

### The naming trap

`edge-left` carries its band on the **RIGHT** of the tile, and `edge-right` on
the **LEFT**. Every other family — corners, inner corners, outer bottoms —
carries it on the side its name says.

**Pick the piece by which side the band must hug, never by the word.** Floor to
the east wants the band on the tile's right; floor to the west, on its left.
This one inconsistency has caused more wrong tiles than everything else
combined.

---

## 5. The rules, in the order they are decided

1. **Inside or outside.** Flood the map from its border through wall cells.
   Anything the flood reaches is **outside the building** and stays dark.
   Anything it cannot reach is a **mass enclosed by rooms** and is filled solid
   with `block-tile`. Never fill the outside: it read as extra rooms.

2. **A face** is a wall cell with floor below it — whatever is on the far side
   of it. Requiring stone above as well meant one internal wall changed from a
   panelled face to a bare block halfway along its length. Runs of faces share
   moulded pairs; a door splits the run so a pair never straddles it, and the
   door's own column is blank.

3. **A face that ends against floor** hands its corner to the room: the two
   inner-corner tiles are drawn **inside that floor cell**, over the same two
   rows as the face. This is the artist's rule — where a wall is concave, it
   goes inside the floor tile.

4. **A face that ends against wall** is capped with the blank-corner pieces.
   *(Contract three sets these by hand in the sheet rather than by rule; see §6.)*

5. **A side wall run** takes a plain band in the wall cell, capped at the bottom
   with a bottom corner. At the top it climbs one cell into the wall above it,
   and if a face stands beside that, a top corner turns above it. A run whose
   bottom meets a face corner is drawn **inside the floor column** instead, so
   the band and the corner below it line up.

   **The band is 80px wide, so it matters which of the two columns it is in.**
   Both answers above are legitimate and they occur on the same board. Where a
   mass's top edge has to turn down beside an opening, its end cap must land in
   the same column as the band below it. The renderer settles this by asking
   the cell below what it actually emits, rather than by re-deciding which rule
   fired — the two disagreed, and the wall jogged sideways by its own thickness
   at contract four's entrance for exactly that reason.

6. **A pocket** — floor with wall above it and wall below it — takes a filled
   corner, and its band climbs the two cells above, capped.

7. **A door** is drawn on whatever it stands in: gold while locked, grey once
   open. A door in a **partition** (rooms on both sides) sits on the grey block.
   A door in a face stands in the face.

8. **No pillars.** A band belongs in a wall cell, or — where the wall is
   concave — in the floor tile beside it. Never hanging in the middle of a room.

---

## 6. The override sheet

`art/tiles/overrides.json` is the hand-written exception list, per contract, per
cell:

```json
{ "chambre": { "K1": ["wall-blank-corner-bottom-left"] } }
```

A cell listed there is drawn **exactly** as listed and the rules are ignored for
it. Order in the list is drawing order; `[]` blanks a cell; tile names are files
in `art/tiles/` without the `.png`.

**Keep it small.** It is for decisions, not for a copy of the board. Pin every
cell and a rule fix will never reach the board again. Contract three uses it for
about fifty cells: the chambre's north face, the partition between the galerie
sud and the vestiaire, and four T-junctions.

---

## 7. Contract four

Contract four now follows the rules. The three faults this section used to
list are gone, and what fixed each one is worth keeping:

- **The hatch sat on the map's edge**, so the outer wall had nowhere to be
  drawn. A wall column was added on the east and a wall row at the bottom.
- **The niche assembly was authored for a west wall** and claimed the wrong
  cells in an east one. The window art was mirrored rather than the assembly
  re-derived, and the exit square moved out of the stone.
- **The entrance's end caps were in the wrong column.** See rule 5.

Its sheet holds four cells: the bands beside the laser openings at C8, J8, N8
and U8, which the rules leave open because a laser square counts as floor.

Contract three's sheet holds about seventy cells and includes two, **B9 and
C9**, that exist only to pin the chambre against rule 5's cap fix. The same
jog is present there. Unpin those two if you want it corrected; the map is
signed off as it stands, so it is deliberately frozen.

---

## 8. When something looks wrong

Read the cell before changing a rule. In the bench, tick **grid**: every cell
shows its name and the tiles drawn in it, and a `*` marks the ones the sheet
sets by hand. Then decide honestly whether what you are looking at is

- **a rule that is wrong everywhere** — fix the rule, and check the mirrored
  case on the other side of the map; or
- **one cell that wants a specific piece** — put it in the sheet.

Turning the second into the first is what repeatedly broke cells nobody had
complained about.
