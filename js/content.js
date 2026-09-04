/* content.js — THE JOB LIBRARY.
   Two contracts. Everything that makes a job a job — the building, the
   patrols, the safe, the roster, the uniforms, the canvases, the line codes —
   is data in here. The engine and the three views never learn a venue.

   This is the claim in the deck made literal: modules are grammars, not
   levels. The same code runs both jobs; loadJob() swaps the data underneath
   it and nothing else in the build changes.

   Neither job is a story beat from the show. Both commit to the WORLD of it
   — Paris rooms, the crew, one object worth taking — and never to plot, so they stay
   spoiler-safe by design whatever the season turns out to be. */
(function (L) {
  'use strict';

  /* =======================================================================
     SHARED — the vocabulary both jobs draw on.
     ======================================================================= */

  var DOOR_MARKS = ['star4', 'chevrons', 'dbar', 'trident'];

  var RING_COLOUR = {
    amber: 'var(--gold)', olive: 'var(--olive)', denim: 'var(--denim)', camel: 'var(--camel)'
  };

  /* the whole wardrobe. Each job hangs a different subset on its rack. */
  var GARMENTS = {
    head:  ['casquette', 'beret', 'nu', 'calot'],
    torso: ['tablier', 'gilet', 'veste', 'blouse'],
    legs:  ['noir', 'raye', 'salopette', 'jean']
  };

  /* La Tchatche runs on topics, not on scripted scenes, so one line pool
     serves every guard in every venue. */
  var LINES = {
    wife:      'Give my best to your wife — she still putting up with these hours?',
    kids:      'Kids must be getting big. How old is the eldest now?',
    promotion: 'They passed you over again, did they. Unbelievable.',
    football:  'Rough result at the weekend. I could not watch the second half.',
    study:     'You are still doing the night classes? That is serious discipline.',
    car:       'That is your car in the bay, no? They are ticketing it as we speak.',
    coffee:    'The machine on three is broken again, by the way. Thought you should know.',
    boss:      'Between us — I do not know how you work for that man.'
  };
  var TOPICS = Object.keys(LINES);

  /* Thresholds are measured, not guessed. A solver was run over the live board
     — every guard phase, every camera phase, and the blackout leg under torch
     rules. On job 1 the lowest-suspicion clean route costs 11 and a
     shortest-path clean route costs 17. S sits just above a perfect run, so a
     pair has to route well AND not fumble a module: one wrong safe code (+15)
     or keypad entry (+10) alone puts S out of reach.
     Re-measure if you retune a map, the patrols or the cone depths. */
  var RANKS = [
    { g: 'S', t: 'FANTÔME',   test: function (s) { return s.spotted === 0 && s.suspicion <= 12; } },
    { g: 'A', t: 'OMBRE',     test: function (s) { return s.spotted === 0 && s.suspicion <= 40; } },
    { g: 'B', t: 'DISCRET',   test: function (s) { return s.spotted <= 1 && s.suspicion <= 65; } },
    { g: 'C', t: 'REMARQUÉ',  test: function (s) { return s.spotted <= 2 && s.suspicion < 85; } },
    { g: 'D', t: 'BRUYANT',   test: function () { return true; } }
  ];

  /* THE BUILDING'S ALERT LEVEL.
     Suspicion used to be a number that only the rank card read. Now it is the
     building's state of mind, and the building acts on it: at each threshold
     every guard looks one square further down his line. It never comes back
     down. A sloppy first half makes the second half harder, and both players
     feel it in the same place — on Benjamin's plan the red gets longer, on
     Assane's phone the footsteps get closer.
     Past the second line La Tchatche allows one slip instead of two: a man
     who has been told to look for somebody is not in a chatting mood. */
  var ALERT = [
    { at: 40, name: 'ATTENTIVE', line: 'A radio crackles somewhere. <em>They have been told to keep their eyes open.</em>' },
    { at: 70, name: 'ALERT',     line: 'Doors, all over the building. <em>They are looking for somebody.</em>' }
  ];

  /* WHAT BENJAMIN CAN DO FROM THE VAN.
     Three levers, each a decision rather than a lookup. Every one of them is
     noticed — a corridor going dark, a circuit dropping off the panel, a
     camera feed that suddenly shows nothing — so each costs
     suspicion, and the uses do not come back. Benjamin has to choose WHEN, and
     Assane has to ask. That is a conversation with stakes on both sides, which
     the dossier alone never was. Durations are counted in Assane's moves,
     because nothing in this build happens between his inputs. */
  var LEVER = {
    lights: { id: 'lights', icon: 'bulb', name: 'CUT THE LIGHTS', cost: 8,  turns: 3, uses: 1,
              blurb: 'For three moves, every guard sees only the squares beside him.' },
    laser:  { id: 'laser',  icon: 'beam', name: 'CUT THE LASERS', cost: 10, turns: 5, uses: 1,
              blurb: 'The beams drop for five moves. He can cross one without them, but it sets off the alarm.' },
    /* Never permanent. A looped camera shows an empty corridor for a few moves
       and then it is a camera again — so a camera that cannot be walked
       around is a camera the two of them have to time together. */
    camera: { id: 'camera', icon: 'eye',  name: 'LOOP A CAMERA',  cost: 4,  turns: 4, uses: 3,
              blurb: 'Pick one. It sees nothing for four moves, then it is back.' }
  };

  /* THE PRESSURE.
     Standing still is free for half a minute. After that the building starts
     to wonder about the man who is not going anywhere: a point of suspicion
     every two seconds, until he moves. Moving while nobody can see him earns
     those points back, one per step — and only those points. Idle suspicion
     is a debt; real mistakes stay paid. It runs on the clock, not on moves,
     which makes it the one thing in the build that happens between inputs —
     deliberately, because its whole purpose is to end the pause. Counted only
     during the infiltration: a module open is two people talking, and that is
     not inactivity. */
  var PRESSURE = { grace: 30, every: 2 };

  /* THE BEAMS.
     A laser is not a wall. You can step over one — what you cannot do is step
     over one quietly. Break a beam and every guard in the building drops his
     round and comes for you, for five moves, and then walks back to the square
     he left and picks the round up from exactly where it stopped.

     That is what Benjamin's CUT THE LASERS is for now. It used to be the only
     way through a beam at all, which made it a key; it is a way through
     *without the building hearing*, which makes it a decision. Going through
     loud is always available and always expensive, and on a bad turn it is
     still the right call. */
  var ALARM = { turns: 5, cost: 12 };

  /* the same lever with a different budget — contract four hands out fewer */
  function lever(base, over) {
    var o = {}, k;
    for (k in base) o[k] = base[k];
    for (k in over) o[k] = over[k];
    return o;
  }

  var AMBIENT = [
    'Dust, floor polish, old paper.',
    'A clock ticking, somewhere behind you.',
    'The building settles. Nothing else.',
    'Cold air from an open vent.',
    'Somewhere below, a lift door closes.'
  ];

  /* P1's phone is dead in the blackout. Flavour, never information. */
  var STATIC_LINES = ['signal lost', '— — — —', 'no service', 'battery low', '· · · · · ·'];

  /* =======================================================================
     CONTRAT No.1 — LA CHAMBRE 302
     Three guards, three modules, and a map built to teach rather than to
     test. The shape is a RING around two blocks with one corridor cutting
     through the middle — and that corridor is sealed. Every route is the
     long way round, which is the whole reason Player 2 exists.

     It is deliberately the simplest of the three contracts. One guard in the
     south room demonstrates the rule that guards step when Assane steps. The
     door is the first real lock. Only past it do two guards start looping in
     opposite directions, and only there does the map stop being obvious.
     ======================================================================= */
  var JOB1 = {
    id: 'chambre',
    venue: 'RÉSIDENCE · TROISIÈME ÉTAGE',
    contract: 'CONTRAT No.1 — LA CHAMBRE 302',
    target: 'Chambre 302 · le dossier',
    venueArt: 'venue-particulier',
    blurb: 'One locked door, one sealed corridor, and two guards who never stop walking. Everything here is the long way round.',

    /* THE FRAME. The plan carries a wall column down its left edge and a wall
       row along its bottom that no route ever touches. They exist so the
       outermost wall of the building has a cell of its own to be drawn in:
       without them the hatch on the west face and the stair wall at the foot
       of the map sit ON the boundary, with nothing outside them to hold the
       band. Columns run A to X, and every square in this contract is one to
       the right of where it used to be.

       'L' is a laser. It reads as wall to everything that moves, but it is
       drawn as its own thing, and Assane cannot know it is there until he is
       standing next to it. The central corridor is the short way from the
       south to the north and it is never open — the map is a ring, and the
       shortcut through the middle is a promise it does not keep. */
    MAP: [
      '########################',
      '##########.....#########',
      '##########.....#########',
      '##########.....#########',
      '##.....................#',
      '##.....................#',
      '##..#######...#######..#',
      '##..#######LLL#######..#',
      '#X....####.....####....#',
      '##..#######LLL#######..#',
      '##..#######...#######..#',
      '##.....................#',
      '##.....................#',
      '################+#######',
      '####.................###',
      '####.................###',
      '############+###########',
      '###########.E.##########',
      '###########...##########',
      '########################'
    ],
    ROOMS: [
      { name: 'CHAMBRE 302',     x: 10,  y: 1,  w: 5,  h: 3, tint: 'cool' },
      { name: 'GALERIE NORD',    x: 2,  y: 4,  w: 21, h: 2, tint: 'neutral' },
      { name: 'AILE OUEST',      x: 1,  y: 6,  w: 5,  h: 5, tint: 'neutral' },
      { name: 'COULOIR CENTRAL', x: 10,  y: 6,  w: 5,  h: 5, tint: 'olive' },
      { name: 'AILE EST',        x: 19, y: 6,  w: 4,  h: 5, tint: 'neutral' },
      { name: 'GALERIE SUD',     x: 2,  y: 11, w: 21, h: 2, tint: 'neutral' },
      { name: 'LE VESTIAIRE',    x: 4,  y: 14, w: 17, h: 2, tint: 'warm' },
      { name: 'ESCALIER',        x: 11, y: 16, w: 3,  h: 2, tint: 'warm' }
    ],

    /* One guard south of the door, two north of it. The first exists to be
       beaten: he walks one row, in the open, and Assane can simply wait him
       out. That is the tutorial. The pair past the door loop the ring in
       opposite directions and never enter the middle, so they cannot be
       waited out — only timed. */
    GUARDS: [
      /* The tutorial guard. One row of the vestiaire, thirteen tiles, so his
         cycle is 24 and divides the ring's 48 — that keeps the combined patrol
         period at 48 and the whole map small enough to prove safe. */
      { id: 'g1', badge: '4412', from: { x: 5, y: 14 }, to: { x: 17, y: 14 }, at: 0, dir: 1, depth: 1 },
      /* Both ring guards turn the same way — counter-clockwise: down the west
         arm, east along the south, up the east arm, west along the north. Same
         circuit, started half a lap apart, so they are always opposite each
         other and Benjamin only ever has to track one of them. */
      { id: 'g2', badge: '2071', at: 0,  dir: 1, depth: 1, loop: true,
        waypoints: [{ x: 3, y: 5 }, { x: 3, y: 11 }, { x: 21, y: 11 }, { x: 21, y: 5 }] },
      { id: 'g3', badge: '3308', at: 24, dir: 1, depth: 1, loop: true,
        waypoints: [{ x: 3, y: 5 }, { x: 3, y: 11 }, { x: 21, y: 11 }, { x: 21, y: 5 }] }
    ],
    /* Two cameras, and one of them cannot be walked around. CAM 1 hangs over
       the desk and never blinks: the prize is under it, so the prize does not
       exist without Benjamin looping it. CAM 2 watches the keypad every other
       beat — that one can be timed, if somebody in the van is counting. */
    CAMERAS: [
      { id: 'c1', x: 12, y: 0,  depth: 2, cycle: ['S'],                 label: 'CAM 1' },
      /* on, off, on, off. Two-on/two-off left the square under it a trap on the
         beat it woke (four dead states); every other beat leaves none, and is
         the easiest rhythm there is to count out loud. */
      { id: 'c2', x: 16, y: 16, depth: 1, cycle: ['N', null, 'N', null], label: 'CAM 2' }
    ],
    LEVIERS: [LEVER.lights, LEVER.laser, LEVER.camera],
    /* Taking the dossier kills the monitors. The television goes dark and the
       two phones are all there is; the stairs are a floor away, and the hatch
       in the west wall ('X' on the plan) is the only way out. */
    /* the way out is an alcove cut into the west wall, hand-built tile by
       tile; contract four's is a plain window on a plain wall. */
    HATCH: 'niche',
    PRIZE: { dark: true, name: 'DOSSIER' },
    DOORS: [
      /* the service gate at the foot of the stairs. Its mark is a plain lock on
         Benjamin's plan — what is stamped on the padlock is Assane's to see */
      { x: 12, y: 16, locked: true, mark: 'lock', to: 'LE VESTIAIRE' },
      { x: 16, y: 13, locked: true, mark: 'dbar', to: 'GALERIE SUD' }
    ],
    MODULES: [
      /* on the square he starts on, so it opens the moment both players are
         ready — the first thing anyone does in this game is talk */
      { id: 'grille',      x: 12, y: 17, name: 'LA GRILLE',      icon: 'lock' },
      { id: 'deguisement', x: 13, y: 17, name: 'LE DÉGUISEMENT', icon: 'coat', optional: true },
      { id: 'porte',       x: 16, y: 14, name: 'LA PORTE',       icon: 'lock' },
      /* The desk. For now it hands over the dossier and nothing more —
         the full Bureau puzzle is the stretch goal, and a placeholder that
         works beats a half-built module that does not. */
      { id: 'prize',       x: 12, y: 2,  name: 'LE BUREAU',      icon: 'desk' }
    ],

    /* LA GRILLE — the handshake.
       Every "I don't understand" this prototype has produced came from the same
       gap: the player did not yet know that the OTHER phone holds the missing
       half. So the first thing that happens is the smallest possible proof of
       it.

       IT GOES BOTH WAYS, and that is the point of the shape. Assane has a
       padlock with a symbol stamped on its tag and three keys on a ring.
       Benjamin's card pairs each symbol with a key — but the keys are not
       numbered on either phone, they are DRAWN. So Assane describes the
       symbol, Benjamin finds the row and describes the key, and Assane picks
       the one that matches what he was told. Two sentences, one each way.

       It used to be one sentence: Benjamin read out "key 2" and Assane tapped
       the button marked 2, which is a lookup with a courier, not a
       conversation. Nothing is written on a key now, so the only way through
       is for one of them to say what a thing looks like and the other to
       recognise it — which is every later module in miniature.

       No guard, no code, no ring, no counting: a wrong key rattles the gate
       and costs a little suspicion, nothing worse. */
    GRILLE: {
      lock: 'trident',
      board: [{ sym: 'crescent', key: 1, shape: 'keyWard' },
              { sym: 'trident',  key: 2, shape: 'keyHoles' },
              { sym: 'ladder',   key: 3, shape: 'keyTeeth' }],
      door: { x: 12, y: 16 },
      rattle: 3
    },

    /* LA PORTE.
       The keypad is numeric and Assane can see it. The code is in Benjamin's
       dossier as four SYMBOLS, above a ring of ten in a fixed order — and the
       dossier says plainly that it does not record which one is zero. Without
       that, the ring is a cipher with ten possible rotations and Benjamin can
       read out nothing at all.

       Assane holds the missing rotation and does not know it: the sign beside
       the door says CHAMBRE 302, and there is a small mark under the 0 that
       looks like decoration. He has to describe it; Benjamin has to find it on
       the ring; and only then does either of them have a number.

       This is the cleanest lock in the build. Neither half is a hint. Half the
       key is on each phone and the puzzle does not exist until they talk. */
    PORTE: {
      code: '2549',
      door: { x: 16, y: 13 },
      sign: 'CHAMBRE 302',
      zero: 'hook',
      ring: ['spiral', 'crescent', 'ladder', 'hook', 'drop',
             'trident', 'star4', 'chevrons', 'backz', 'bisect'],
      fails: 3
    },

    /* THE RACK HAS TO NARROW IT. Nine pieces are hanging up and three officers
       are on tonight, but the rack is deliberately missing VIDAL's dungarees,
       so only two of the three uniforms can be assembled at all. Of those two,
       MOREAU is posted to the cloakroom Assane is standing in — no use to a man
       heading north. DELACROIX walks the north gallery, which is where he is
       going. One buildable uniform, one correct post, one answer.

       Built the other way round it does not work: with every piece present the
       rack narrows nothing, and two officers sharing a post leaves two answers
       that both look right. */
    RACK: {
      head:  ['casquette', 'nu', 'calot'],
      torso: ['tablier', 'gilet', 'blouse'],
      legs:  ['noir', 'raye', 'jean']
    },
    UNIFORMS: {
      '4412': { head: 'casquette', torso: 'blouse',  legs: 'noir' },
      '2071': { head: 'calot',     torso: 'gilet',   legs: 'jean' },
      '3308': { head: 'nu',        torso: 'tablier', legs: 'salopette' }
    },
    DEGUISEMENT: { answerBadge: '2071', targetPost: 'GALERIE NORD', conePenalty: 1 },

    PERSONNEL: [
      { badge: '4412', name: 'MOREAU, Serge',   post: 'LE VESTIAIRE', plate: '8021', kids: [] },
      { badge: '2071', name: 'DELACROIX, Yann', post: 'GALERIE NORD', plate: '5530', kids: [] },
      { badge: '3308', name: 'VIDAL, Nadia',    post: 'GALERIE SUD',  plate: '1147', kids: [] }
    ],
    FACES: {
      '4412': { art: 'face-4412', head: 'square', hair: 'short', moustache: true,  beard: false, glasses: false, scar: false, skin: 'var(--camel)' },
      '2071': { art: 'face-2071', head: 'long',   hair: 'bald',  moustache: false, beard: false, glasses: true,  scar: false, skin: 'var(--stone-dk)' },
      '3308': { art: 'face-3308', head: 'round',  hair: 'swept', moustache: false, beard: false, glasses: true,  scar: false, skin: 'var(--stone)' }
    },
    DIRT: {
      '4412': [{ t: 'kids', s: 'Two daughters. Talks about them constantly.' },
               { t: 'coffee', s: 'Fights with the machine on level three, daily.' },
               { t: 'boss', s: 'Loathes the floor manager. Openly.' }],
      '2071': [{ t: 'study', s: 'Night classes. Law. Second year.' },
               { t: 'car', s: 'Parks in the loading bay. Gets ticketed.' },
               { t: 'promotion', s: 'Applied for shift lead. Waiting to hear.' }],
      '3308': [{ t: 'football', s: 'Saint-Étienne. Home and away.' },
               { t: 'boss', s: 'Covers for the floor manager. Constantly.' },
               { t: 'coffee', s: 'Brings her own flask. Refuses the machine.' }]
    },

    PROCEDURES: [
      { k: 'DOOR CODES',   v: 'Held as symbols only. The ring is printed in order; the zero is not marked.' },
      { k: 'LASER LINES',  v: 'Central corridors are protected between rounds. Do not cross. Go around.' },
      { k: 'PATROLS',      v: 'Two officers, opposite directions, outer halls only.' },
      { k: 'ALERT LEVELS', v: 'Suspicion past 40: officers extend their rounds by one square. Past 70: by two, and anyone stopped is searched.' },
      { k: 'CAMERAS',      v: 'CAM 1 covers the study desk continuously. CAM 2 sweeps the cloakroom keypad every other beat.' },
      /* the chambre DOES draw its hatch on Benjamin's plan — it is the
         teaching contract and the way out is meant to be visible. The line
         used to end "Not on the public plans", which is contract four's rule
         copied one job too far: the dossier was contradicting the map beside
         it. Contract four keeps that clause, and keeps the hatch off the
         plan to go with it. */
      { k: 'EVACUATION',   v: 'Service hatch, west wall, row 9. Marked on the plan.' }
    ],

    BEATS: [
      'One of you is inside. One of you has the plans. Neither of you can finish alone.',
      'The guards move when Assane moves. Nothing happens between your inputs.',
      'The way through the middle is sealed. Everything here is the long way round.',
      'Benjamin has three levers in the van. Every one of them is noticed.',
      'Standing still is free for thirty seconds. After that the building starts to wonder.'
    ]
  };

  /* =======================================================================
     CONTRAT No.2 — LA VEILLE DE VENTE
     An auction house, the night before a sale. The shape of contract three
     with the volume turned up band by band: the kitchens are what they
     already know, the ring is where the levers stop being optional, and the
     top floor is everything at once — a desk that releases a vault, a safe
     under a camera that never blinks, and a way out that is not on the plan.
     Built from modules that already exist: only the numbers are new.
     ======================================================================= */
  var JOB2 = {
    id: 'veille',
    venue: 'HÔTEL DES VENTES · LA VEILLE',
    contract: 'CONTRAT No.2 — LA VEILLE DE VENTE',
    target: 'Lot 12 · manuscrit enluminé',
    venueArt: 'venue-establishing',
    blurb: 'Three floors, each behind a door, each worse than the last. The vault is released from the desk beside it, and the way out is not drawn anywhere.',

    /* THE FRAME. A wall column down the EAST edge and a wall row along the
       bottom that no route touches: the hatch sits in the east wall, so the
       outermost stone needs a cell of its own to be drawn in. The column goes
       after the last one, so every square keeps the name it had. */
    MAP: [
      '########################',
      '#####.....#....#########',
      '#####.....#....#########',
      '#####.....#....#########',
      '#####+#####/############',
      '#....................X##',
      '#.....................##',
      '#..######LLLLL######..##',
      '#..######.....######..##',
      '#..######LLLLL######..##',
      '#.....................##',
      '#.....................##',
      '######+#################',
      '#.....................##',
      '#.....................##',
      '#.....................##',
      '######.E.###############',
      '######...###############',
      '########################',
      '########################'
    ],
    ROOMS: [
      { name: 'LA RÉSERVE',      x: 5,  y: 1,  w: 5,  h: 3, tint: 'cool' },
      { name: 'BUREAU',          x: 11, y: 1,  w: 4,  h: 3, tint: 'olive' },
      { name: 'GALERIE HAUTE',   x: 1,  y: 5,  w: 22, h: 2, tint: 'neutral' },
      { name: 'AILE OUEST',      x: 1,  y: 7,  w: 2,  h: 3, tint: 'neutral' },
      { name: 'COULOIR CENTRAL', x: 9,  y: 7,  w: 5,  h: 3, tint: 'olive' },
      { name: 'AILE EST',        x: 20, y: 7,  w: 2,  h: 3, tint: 'neutral' },
      { name: 'GALERIE BASSE',   x: 1,  y: 10, w: 21, h: 2, tint: 'neutral' },
      { name: 'LES CUISINES',    x: 1,  y: 13, w: 21, h: 3, tint: 'warm' },
      { name: 'ESCALIER',        x: 6,  y: 16, w: 3,  h: 2, tint: 'warm' }
    ],

    /* A GUARD IS THREE ROWS TALL AND THIS BUILDING'S GALLERIES ARE TWO.
       cone() gives every man the eight squares around him, so a patrol
       standing anywhere in a two-row corridor covers the whole height of it
       and cannot be walked past — he is a moving plug, and the only answer to
       a plug is to wait for it. Both galleries here are two rows, and the
       first cut of this roster had g3 walking the upper one's door row while
       g2's ring walked the lower one's, which put a plug across every
       north-south crossing on the floor.

       It measured badly and it played worse. The two legs that cross the
       building averaged 81 turns against a walking distance of 46 — thirty-
       five turns of standing still — and a solved route opened with twenty-one
       taps of HOLD STILL before anybody moved.

       Two changes, and the same three men:

       · g3 walks row 7 instead of row 6. Row 6 carries both doors and the
         hatch; leaving it clear means the crossing is a timing question rather
         than a closed door.
       · g2 walks the east aisle instead of ringing the whole floor. A ring is
         a lovely shape and it is why contract three reads the way it does, but
         here it traverses BOTH long rows, so it plugged the gallery twice a
         lap. On the aisle he still owns the way to the hatch, which is the
         thing on this floor most worth owning.

       81 turns became 68, and a full contract went from about 120 to about 96.
       Nobody was removed and nothing was made shallower. Put the ring back by
       restoring the waypoints below and g3 to y:5 — the walkthrough would need
       regenerating, and `DC.route.audit` will tell you what it cost. */
    GUARDS: [
      /* the beat stops two short of each wall: a guard who walks into the
         corner makes the corner a trap, and the scan found four dead states
         at each end when he did */
      { id: 'g1', badge: '4412', from: { x: 3, y: 14 }, to: { x: 11, y: 14 }, at: 0, dir: 1, depth: 1 },
      /* was: loop:true, waypoints [C6, C12, U12, U6] — the full perimeter */
      { id: 'g2', badge: '2071', from: { x: 20, y: 5 }, to: { x: 20, y: 11 }, at: 0, dir: 1, depth: 2 },
      /* was: y:5, the door row */
      { id: 'g3', badge: '5195', from: { x: 5, y: 6 }, to: { x: 17, y: 6 }, at: 6, dir: -1, depth: 1 }
    ],
    /* CAM 1 over the safe never blinks. CAM 2 over the desk is on one beat in
       three — timeable, if Benjamin is counting, loopable if he is not. */
    CAMERAS: [
      { id: 'c1', x: 7,  y: 0, depth: 2, cycle: ['S'],             label: 'CAM 1' },
      { id: 'c2', x: 12, y: 0, depth: 2, cycle: ['S', null, null], label: 'CAM 2' }
    ],
    /* fewer pulls than contract three. The van is further away tonight. */
    LEVIERS: [LEVER.lights, LEVER.laser, lever(LEVER.camera, { uses: 2 })],
    PRIZE: { dark: true, name: 'MANUSCRIPT', hatchHidden: true },
    OBJ: {
      door:  'A locked door at the back of the kitchens. P1 has the keypad; P2 has the code.',
      after: 'Up through the ring. The desk releases the vault, and the vault holds the lot.',
      out:   'He has it and the monitors are dead. The plan shows no way out. Benjamin’s procedures might.'
    },
    DOORS: [
      { x: 5,  y: 4,  locked: true,  mark: 'trident',  to: 'LA RÉSERVE' },
      { x: 11, y: 4,  locked: false, mark: 'chevrons', to: 'BUREAU' },
      { x: 6,  y: 12, locked: true,  mark: 'dbar',     to: 'GALERIE BASSE' },
    ],
    MODULES: [
      { id: 'porte',       x: 6,  y: 13, name: 'LA PORTE',       icon: 'lock' },
      { id: 'deguisement', x: 18, y: 14, name: 'LE DÉGUISEMENT', icon: 'coat', optional: true },
      { id: 'bureau',      x: 12, y: 2,  name: 'LE BUREAU',      icon: 'desk' },
      { id: 'coffre',      x: 7,  y: 2,  name: 'LE COFFRE',      icon: 'safe' }
    ],

    /* the same cipher as contract three, a different zero, and one fewer try */
    PORTE: {
      code: '7180',
      sign: 'SALLE 10',
      zero: 'star4',
      door: { x: 6, y: 12 },
      ring: ['drop', 'star4', 'spiral', 'chevrons', 'hook',
             'bisect', 'crescent', 'trident', 'ladder', 'backz'],
      fails: 2
    },

    /* contract one's dial, a new serial. Three rows share it; the ring colour
       is the only thing that tells them apart. */
    COFFRE: {
      serial: 'AV-2231', ring: 'denim',
      dial: ['hook', 'trident', 'spiral', 'drop', 'ladder', 'bisect', 'crescent', 'backz'],
      code: ['trident', 'drop', 'hook', 'ladder'],
      manual: [
        { serial: 'AV-2213', ring: 'olive', seq: ['drop', 'hook', 'ladder', 'trident'] },
        { serial: 'AV-2231', ring: 'amber', seq: ['hook', 'ladder', 'trident', 'drop'] },
        { serial: 'AV-2231', ring: 'denim', seq: ['trident', 'drop', 'hook', 'ladder'] },
        { serial: 'AV-3221', ring: 'denim', seq: ['ladder', 'trident', 'drop', 'hook'] },
        { serial: 'AV-2231', ring: 'camel', seq: ['drop', 'trident', 'ladder', 'hook'] },
        { serial: 'AV-2132', ring: 'denim', seq: ['hook', 'drop', 'trident', 'ladder'] }
      ]
    },

    /* the desk belongs to KOFFI: two children, and the eldest is listed
       second. Position is not the answer; reading is. */
    BUREAU: { badge: '1184', mode: 'eldest', answer: '2005', doorMark: 'trident', photo: 'a boy and a girl' },

    PERSONNEL: [
      { badge: '4412', name: 'MOREAU, Serge',     post: 'LES CUISINES',  plate: '8021', kids: [{ n: 'Camille', y: 2009 }, { n: 'Léa', y: 2014 }] },
      { badge: '2071', name: 'DELACROIX, Yann',   post: 'GALERIE HAUTE', plate: '5530', kids: [] },
      { badge: '3308', name: 'VIDAL, Nadia',      post: 'BUREAU',        plate: '1147', kids: [{ n: 'Théo', y: 2011 }] },
      { badge: '5195', name: 'SANGLIER, Bruno',   post: 'GALERIE HAUTE', plate: '9083', kids: [{ n: 'Inès', y: 2007 }, { n: 'Hugo', y: 2007 }] },
      { badge: '6620', name: 'PARMENTIER, Odile', post: 'LE VESTIAIRE',  plate: '4472', kids: [{ n: 'Marc', y: 2003 }, { n: 'Julie', y: 2016 }] },
      { badge: '1184', name: 'KOFFI, Émile',      post: 'LA RÉSERVE',    plate: '3396', kids: [{ n: 'Awa', y: 2012 }, { n: 'Noé', y: 2005 }] }
    ],
    /* contract one's rack: two uniforms buildable, VIDAL (BUREAU) and KOFFI
       (LA RÉSERVE). The post decides it. */
    RACK: {
      head:  ['casquette', 'nu', 'calot'],
      torso: ['tablier', 'gilet', 'blouse'],
      legs:  ['noir', 'salopette', 'jean']
    },
    UNIFORMS: {
      '4412': { head: 'beret',     torso: 'veste',   legs: 'raye' },
      '2071': { head: 'calot',     torso: 'veste',   legs: 'noir' },
      '3308': { head: 'nu',        torso: 'gilet',   legs: 'jean' },
      '5195': { head: 'casquette', torso: 'blouse',  legs: 'raye' },
      '6620': { head: 'beret',     torso: 'tablier', legs: 'noir' },
      '1184': { head: 'casquette', torso: 'tablier', legs: 'noir' }
    },
    DEGUISEMENT: { answerBadge: '1184', targetPost: 'LA RÉSERVE', conePenalty: 1 },
    FACES: {
      '4412': { art: 'face-4412', head: 'square', hair: 'short', moustache: true,  beard: false, glasses: false, scar: false, skin: 'var(--camel)' },
      '2071': { art: 'face-2071', head: 'long',   hair: 'bald',  moustache: false, beard: false, glasses: true,  scar: false, skin: 'var(--stone-dk)' },
      '3308': { art: 'face-3308', head: 'round',  hair: 'swept', moustache: false, beard: false, glasses: true,  scar: false, skin: 'var(--stone)' },
      /* the delivered portrait has no scar, so the trait row does not claim one.
         5195 is still clearly separable from 2071 — both are bald, but 2071
         wears glasses and is clean shaven while this one has the moustache. */
      '5195': { art: 'face-5195', head: 'square', hair: 'bald',  moustache: true,  beard: false, glasses: false, scar: false, skin: 'var(--stone-dk)' },
      '6620': { art: 'face-6620', head: 'round',  hair: 'short', moustache: false, beard: false, glasses: false, scar: false, skin: 'var(--camel)' },
      '1184': { art: 'face-1184', head: 'long',   hair: 'cap',   moustache: false, beard: true,  glasses: false, scar: false, skin: '#8A5A3B' }
    },
    DIRT: {
      '4412': [{ t: 'kids', s: 'Two daughters. Talks about them constantly.' },
               { t: 'coffee', s: 'Fights with the machine on level three, daily.' },
               { t: 'boss', s: 'Loathes the floor manager. Openly.' }],
      '2071': [{ t: 'study', s: 'Night classes. Law. Second year.' },
               { t: 'car', s: 'Parks in the loading bay. Gets ticketed.' },
               { t: 'promotion', s: 'Applied for shift lead. Waiting to hear.' }],
      '3308': [{ t: 'football', s: 'Saint-Étienne. Home and away.' },
               { t: 'boss', s: 'Covers for the floor manager. Constantly.' },
               { t: 'coffee', s: 'Brings her own flask. Refuses the machine.' }],
      '5195': [{ t: 'wife', s: 'Married. Hélène. Twenty-two years.' },
               { t: 'promotion', s: 'Passed over for shift lead. Twice.' },
               { t: 'football', s: 'Season ticket. Never misses.' }],
      '6620': [{ t: 'car', s: 'New car. Will not stop mentioning it.' },
               { t: 'kids', s: 'A son at university, a daughter still small.' },
               { t: 'wife', s: 'Recently separated. Do not push it.' }],
      '1184': [{ t: 'boss', s: 'Ex-military. Has no patience for the manager.' },
               { t: 'study', s: 'Teaches a class on weekends.' },
               { t: 'kids', s: 'Two children. The eldest is at school abroad.' }]
    },

    PROCEDURES: [
      { k: 'DOOR CODES',   v: 'Held as symbols only. The ring is printed in order; the zero is not marked. Two attempts, then a call.' },
      { k: 'LASER LINES',  v: 'The central corridor is protected between rounds. Crossing one is not impossible, it is announced: officers abandon their rounds for five minutes and converge. The side halls are patrolled.' },
      { k: 'PATROLS',      v: 'One officer on the east stair, one across the upper gallery, one in the kitchens. They do not keep step.' },
      { k: 'CAMERAS',      v: 'CAM 1 covers the vault continuously. CAM 2 sweeps the office desk one beat in three.' },
      { k: 'ALERT LEVELS', v: 'Suspicion past 40: officers extend their rounds by one square. Past 70: by two, and anyone stopped is searched.' },
      { k: 'EVACUATION',   v: 'Service hatch, east wall of the upper gallery, row 6. Not on the public plans.' }
    ],

    BEATS: [
      'Three floors. Every door is a lock, and every floor is worse than the one below it.',
      'The desk releases the vault. The vault holds the lot. Both are under cameras.',
      'The way out is not drawn on the plan. Benjamin has the procedures; read them before you need them.'
    ]
  };

  /* TWO CONTRACTS. The first pair were the ones that taught the shape and
     they have been cut: everything they proved is proved better by the two
     that replaced them, and a picker with four entries made the demo start
     with a choice nobody had the information to make. */
  var JOBS = [JOB1, JOB2];

  /* Swap the data under the engine. Every other file reads L.content.<FIELD>
     and holds a reference to this same object, so assigning the fields here is
     all a job change takes — no reload, no rebuild, and not one line of code
     that knows a venue. This function IS the "modules are grammars" argument. */
  var JOB_FIELDS = ['id', 'HATCH', 'venue', 'contract', 'target', 'blurb', 'venueArt', 'MAP', 'ROOMS', 'GUARDS',
    'CAMERAS', 'DOORS', 'MODULES', 'COFFRE', 'PERSONNEL', 'BUREAU', 'RACK', 'UNIFORMS',
    'DEGUISEMENT', 'ECOUTE', 'FAUX', 'FACES', 'DIRT', 'BLACKOUT', 'CLAVIER', 'PORTE',
    'PROCEDURES', 'BEATS', 'GRILLE', 'LEVIERS', 'PRIZE', 'OBJ'];

  function loadJob(i) {
    var job = JOBS[i] || JOBS[0];
    JOB_FIELDS.forEach(function (k) { L.content[k] = job[k]; });
    L.content.jobIndex = JOBS.indexOf(job);
    L.content.job = { venue: job.venue, contract: job.contract, target: job.target };
    return job;
  }

  /* ------------------------------------------------------------- THE ROSTER
     WHAT CHANGES BETWEEN RUNS IS WHO IS ON TONIGHT — never where anybody
     stands. The beats were measured and every route, scan and walkthrough is
     written against the building as authored; shuffling the men voids all of
     it, and it voided it on both contracts when this was first tried.

     So the badges stay where they are, the posts stay where they are, and the
     PEOPLE behind them are dealt out fresh: a different name, a different car,
     different children on each badge. The floor is identical and the interview
     is not — which is the half of this game that is about reading a file
     rather than walking a corridor.

     The desk is the one slot with a requirement. LE BUREAU asks for the eldest
     child's birth year, and the trick is that the file lists the children in
     the wrong order — so whoever ends up on that badge has to have at least
     two children born in different years, or the question stops being a
     question. The deal is redone until they do. */
  var PRISTINE = {};
  function personOf(p) { return { name: p.name, plate: p.plate, kids: p.kids, faceOf: p.badge }; }
  function eldestYear(kids) {
    return String(kids.reduce(function (a, b) { return a.y <= b.y ? a : b; }).y);
  }
  function deskWorks(person, mode) {
    if (mode === 'plate') return !!person.plate;
    if (!person.kids || person.kids.length < 2) return false;
    return person.kids.some(function (k) { return k.y !== person.kids[0].y; });
  }

  function rollRoster(seed) {
    var job = JOBS[L.content.jobIndex] || JOBS[0];
    if (!job.PERSONNEL) return;
    if (!PRISTINE[job.id]) PRISTINE[job.id] = JSON.parse(JSON.stringify(job.PERSONNEL));
    var base = PRISTINE[job.id];

    /* seed 0 is the roster as written — the one the content comments describe */
    var order = base.map(function (_, i) { return i; });
    if (seed) {
      var t = (seed >>> 0) + 0x9E3779B9;
      var rnd = function () {
        t = (t + 0x6D2B79F5) >>> 0;
        var r = Math.imul(t ^ (t >>> 15), 1 | t);
        r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
      };
      var desk = job.BUREAU ? base.map(function (b, i) { return i; })
                                  .filter(function (i) { return deskWorks(base[i], job.BUREAU.mode); }) : [];
      for (var pass = 0; pass < 40; pass++) {
        for (var i = order.length - 1; i > 0; i--) {
          var j = Math.floor(rnd() * (i + 1)), tmp = order[i]; order[i] = order[j]; order[j] = tmp;
        }
        if (!job.BUREAU) break;
        var slot = base.map(function (b) { return b.badge; }).indexOf(job.BUREAU.badge);
        if (slot < 0 || desk.indexOf(order[slot]) >= 0) break;
      }
    }

    /* badge and post belong to the slot; the person is dealt into it */
    L.content.PERSONNEL = base.map(function (slotDef, i) {
      var who = base[order[i]];
      return { badge: slotDef.badge, post: slotDef.post,
               name: who.name, plate: who.plate, kids: who.kids, face: who.badge };
    });

    if (job.BUREAU) {
      var owner = L.content.PERSONNEL.filter(function (x) { return x.badge === job.BUREAU.badge; })[0];
      var b = {}; for (var k in job.BUREAU) b[k] = job.BUREAU[k];
      if (owner) {
        b.answer = b.mode === 'plate' ? owner.plate : eldestYear(owner.kids);
        b.photo = b.mode === 'plate' ? b.photo
                : owner.kids.length === 2 ? 'two children' : owner.kids.length + ' children';
      }
      L.content.BUREAU = b;
    }
  }

  L.content = {
    JOBS: JOBS, loadJob: loadJob, rollRoster: rollRoster, jobIndex: 0,
    DOOR_MARKS: DOOR_MARKS, RING_COLOUR: RING_COLOUR, GARMENTS: GARMENTS,
    LINES: LINES, TOPICS: TOPICS, RANKS: RANKS, ALERT: ALERT, PRESSURE: PRESSURE, ALARM: ALARM,
    AMBIENT: AMBIENT, STATIC_LINES: STATIC_LINES
  };
  loadJob(0);
})(window.DC);
