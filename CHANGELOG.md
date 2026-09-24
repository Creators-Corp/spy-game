# Changelog

## 2026-09-23 — The steps moved to the television

- Every module's how-to-play now reads on the TV, in full, in the place that
  used to carry one line of flavour: La Grille, La Porte, Le Déguisement, Le
  Bureau (both contracts, both stages), Le Coffre, La Tchatche and Le Clavier.
  Line breaks are authored — `.modstate__line` and `.tch__line` are pre-line.
- Le Déguisement names Assane's destination on the TV. It used to be printed on
  Benjamin's STAFF tab alone, where only one of the two could see it.
- Removed the matching step-by-step strips from both phones, along with the
  `U.howto` helper and its stylesheet rules. What is left on each phone is what
  that player can see: art, readouts, pads, files, and the consequence notes.
- Bumped the two TV instruction lines to 17px/16px on a 700px measure so they
  are legible from a sofa and break where they were written to break.

Validation: 50 JavaScript tests and 36 relay tests pass. All nine module
screens plus both Tchatche states checked in the browser on both contracts.

## 2026-09-23 — UX polish

- Replaced Benjamin’s Grille key icons with illustrated keys, centered at 80% height in narrower containers, with larger symbols and arrows.
- Stacked the Plan screen’s player pills and added uppercase Idle, Connected, and Ready labels. Connected players use a blue pill and filled blue dot.
- Added automatic checking on the final input for door, desk, vault, and exit codes. Removed keypad confirm buttons while preserving CLR and 0 positions.
- Added brief green/red result vignettes to P1’s phone and the TV before the existing success or failure flow continues.
- Updated phone input relay, refresh recovery coverage, and route tooling for automatic code checks.

Validation: 44 JavaScript tests and 33 relay tests passed. Browser visual verification remains pending.
