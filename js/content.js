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
     noticed — a phone ringing in an empty room at two in the morning, a
     corridor going dark, a circuit dropping off the panel — so each costs
     suspicion, and the uses do not come back. Benjamin has to choose WHEN, and
     Assane has to ask. That is a conversation with stakes on both sides, which
     the dossier alone never was. Durations are counted in Assane's moves,
     because nothing in this build happens between his inputs. */
  var LEVER = {
    phone:  { id: 'phone',  icon: 'bell', name: 'RING A PHONE',   cost: 5,  turns: 2, uses: 2, reach: 8,
              blurb: 'The nearest guard stops and looks at it for two of his moves.' },
    lights: { id: 'lights', icon: 'bulb', name: 'CUT THE LIGHTS', cost: 8,  turns: 3, uses: 1,
              blurb: 'For three moves, every guard sees only the squares beside him.' },
    laser:  { id: 'laser',  icon: 'beam', name: 'CUT THE LASERS', cost: 10, turns: 5, uses: 1,
              blurb: 'The beams drop for five moves. Back on with him in one, and somebody comes.' },
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
     CONTRAT No.1 — LA VENTE DE NUIT
     An auction house. Two rooms off a two-lane corridor, vestibule at the bottom.
     A corridor job: the tension is timing a crossing.
     ======================================================================= */
  var JOB1 = {
    id: 'ventes',
    venue: 'MAISON DE VENTES · SALLE 9',
    contract: 'CONTRAT No.1 — LA VENTE DE NUIT',
    target: 'Lot 47 · manuscrit relié',
    venueArt: 'venue-establishing',
    blurb: 'An auction house. One corridor, two guards walking it in opposite directions, and a camera on the only way up.',

    MAP: [
      '###############',
      '#.....#.......#',
      '#.....#.......#',
      '#.....#.......#',
      '###+#####/#####',
      '#.............#',
      '#.............#',
      '#####.....#####',
      '#####.E...#####',
      '###############'
    ],
    ROOMS: [
      { name: 'LA RÉSERVE',           x: 1, y: 1, w: 5,  h: 3, tint: 'cool' },
      { name: 'BUREAU DE SÉCURITÉ',   x: 7, y: 1, w: 7,  h: 3, tint: 'olive' },
      { name: 'GALERIE',              x: 1, y: 5, w: 13, h: 2, tint: 'neutral' },
      { name: 'VESTIBULE',            x: 5, y: 7, w: 5,  h: 2, tint: 'warm' }
    ],
    GUARDS: [
      { id: 'g1', badge: '5195', from: { x: 2, y: 5 }, to: { x: 12, y: 5 }, at: 2, dir: 1, depth: 2 },
      { id: 'g2', badge: '2071', from: { x: 3, y: 6 }, to: { x: 11, y: 6 }, at: 8, dir: -1, depth: 2 },
      { id: 'g3', badge: '3308', from: { x: 8, y: 1 }, to: { x: 12, y: 1 }, at: 0, dir: 1, depth: 2 }
    ],
    CAMERAS: [
      { id: 'c1', x: 7, y: 4, depth: 3, cycle: ['S', null, 'S', null], label: 'CAM 1' },
      { id: 'c2', x: 3, y: 0, depth: 2, cycle: ['S', 'S', 'S', null], label: 'CAM 2' }
    ],
    LEVIERS: [LEVER.phone, LEVER.lights, LEVER.camera],
    DOORS: [
      { x: 3, y: 4, locked: true,  mark: 'dbar',     to: 'LA RÉSERVE' },
      { x: 9, y: 4, locked: false, mark: 'chevrons', to: 'BUREAU DE SÉCURITÉ' }
    ],
    MODULES: [
      { id: 'bureau',      x: 10, y: 2, name: 'LE BUREAU',      icon: 'desk' },
      { id: 'coffre',      x: 3,  y: 2, name: 'LE COFFRE',      icon: 'safe' },
      { id: 'deguisement', x: 9,  y: 8, name: 'LE DÉGUISEMENT', icon: 'coat',  optional: true },
      { id: 'faux',        x: 1,  y: 2, name: 'LE FAUX',        icon: 'frame', optional: true },
      { id: 'ecoute',      x: 12, y: 2, name: 'L’ÉCOUTE',       icon: 'wave',  optional: true }
    ],

    /* LE COFFRE. P1 holds the object, P2 holds the manual, and the manual is
       indexed by BOTH the plate and the ring colour — so the index runs P1→P2
       while the answer runs P2→P1. Several rows share a serial. */
    COFFRE: {
      serial: 'DR-1187', ring: 'amber',
      dial: ['spiral', 'backz', 'crescent', 'ladder', 'hook', 'drop', 'bisect', 'trident'],
      code: ['crescent', 'ladder', 'backz', 'drop'],
      manual: [
        { serial: 'DR-1178', ring: 'olive', seq: ['ladder', 'crescent', 'drop', 'backz'] },
        { serial: 'DR-1187', ring: 'denim', seq: ['backz', 'drop', 'ladder', 'crescent'] },
        { serial: 'DR-1187', ring: 'amber', seq: ['crescent', 'ladder', 'backz', 'drop'] },
        { serial: 'DR-8117', ring: 'amber', seq: ['drop', 'backz', 'crescent', 'ladder'] },
        { serial: 'DR-1187', ring: 'camel', seq: ['crescent', 'backz', 'ladder', 'drop'] },
        { serial: 'DR-1871', ring: 'amber', seq: ['ladder', 'drop', 'backz', 'crescent'] }
      ]
    },

    PERSONNEL: [
      { badge: '4412', name: 'MOREAU, Serge',     post: 'SALLE 9',   plate: '8021', kids: [{ n: 'Camille', y: 2009 }, { n: 'Léa', y: 2014 }] },
      { badge: '2071', name: 'DELACROIX, Yann',   post: 'GALERIE',   plate: '5530', kids: [] },
      { badge: '3308', name: 'VIDAL, Nadia',      post: 'BUREAU DE SÉCURITÉ', plate: '1147', kids: [{ n: 'Théo', y: 2011 }] },
      { badge: '5195', name: 'SANGLIER, Bruno',   post: 'GALERIE',   plate: '9083', kids: [{ n: 'Inès', y: 2007 }, { n: 'Hugo', y: 2007 }] },
      { badge: '6620', name: 'PARMENTIER, Odile', post: 'VESTIBULE', plate: '4472', kids: [{ n: 'Marc', y: 2003 }, { n: 'Julie', y: 2016 }] },
      { badge: '1184', name: 'KOFFI, Émile',      post: 'LA RÉSERVE', plate: '3396', kids: [{ n: 'Awa', y: 2012 }, { n: 'Noé', y: 2005 }] }
    ],
    /* mode 'eldest': the note is a cake, the code is the eldest child's year.
       5195 has twins and 1184's eldest is listed second — position is not the
       answer, reading is. */
    BUREAU: { badge: '4412', mode: 'eldest', answer: '2009', doorMark: 'dbar' },

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
    /* buildable from this rack: 3308 (BUREAU) and 1184 (RÉSERVE).
       The post is what separates them. */
    DEGUISEMENT: { answerBadge: '1184', targetPost: 'LA RÉSERVE', conePenalty: 1 },

    ECOUTE: {
      transmission: ['s', 'l', 's', 's', 'l'],
      answer: 'C-3', kills: 'c2', circuits: ['C-1', 'C-2', 'C-3', 'C-4'],
      book: [
        { p: ['l', 's', 's', 'l', 's'], c: 'C-1' },
        { p: ['s', 'l', 's', 'l', 's'], c: 'C-2' },
        { p: ['s', 'l', 's', 's', 'l'], c: 'C-3' },
        { p: ['s', 's', 'l', 's', 'l'], c: 'C-4' },
        { p: ['l', 'l', 's', 's', 'l'], c: 'C-7  (niveau 2)' },
        { p: ['s', 'l', 'l', 's', 'l'], c: 'C-9  (niveau 2)' }
      ]
    },

    FAUX: {
      genuine: { horizon: 'low', tree: 'left', birds: 3, sun: false, sig: 'BL' },
      forgery: { horizon: 'low', tree: 'left', birds: 4, sun: true,  sig: 'BR' },
      notes: [
        { s: 'The horizon sits low — barely a third of the canvas is sky.' },
        { s: 'Three birds over the field. Never four.' },
        { s: 'No sun. He never painted one into this series.' },
        { s: 'His mark is in the lower-LEFT corner.' }
      ]
    },

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

    BLACKOUT: {
      torchDepth: 3,
      zones: [
        { id: 'A', name: 'RÉSERVE',   x: 1, y: 1, w: 5,  h: 4 },
        { id: 'B', name: 'BUREAU',    x: 7, y: 1, w: 7,  h: 4 },
        { id: 'C', name: 'GALERIE',   x: 1, y: 5, w: 13, h: 2 },
        { id: 'D', name: 'VESTIBULE', x: 5, y: 7, w: 5,  h: 2 }
      ],
      feedCycle: [['A', 'C'], ['B', 'D'], ['C', 'D'], ['A', 'B']]
    },

    /* LE CLAVIER. P1 can see WHICH three keys are worn, never the order.
       6620 is posted to the vestibule; reversed that is 0266, whose digits are
       exactly 0, 2 and 6 — so P1 can verify P2's answer before typing it. */
    CLAVIER: { code: '0266', worn: ['0', '2', '6'], zone: 'VESTIBULE' },

    PROCEDURES: [
      { k: 'POWER FAILURE', v: 'Zone doors lock themselves. Emergency supply runs two cameras at a time.' },
      { k: 'RELEASE CODE',  v: 'Badge number of the officer posted to that zone, digits reversed.' },
      { k: 'PATROLS',       v: 'Torches mandatory. Increased range.' }
    ],

    BEATS: [
      'One of you is inside. One of you has the plans. Neither of you can finish alone.',
      'The guards move when Assane moves. Nothing happens between your inputs.',
      'And if the building fights back, the lights go out and his phone dies with them.'
    ]
  };

  /* =======================================================================
     CONTRAT No.2 — LA COLLECTION PRIVÉE
     A private hôtel particulier. One sealed chamber in the middle of a ring
     corridor, and a guard who walks the ring without ever turning back.

     Deliberately a different SHAPE, not a reskin. Job 1 is a corridor you
     time a crossing on. This is a loop: there are two ways round to the only
     door, they are never equally safe, and choosing which way is the game.
     ======================================================================= */
  var JOB2 = {
    id: 'particulier',
    venue: 'HÔTEL PARTICULIER · PARIS VIII',
    contract: 'CONTRAT No.2 — LA COLLECTION PRIVÉE',
    target: 'Vitrine 3 · le flacon de cristal',
    venueArt: 'venue-particulier',
    blurb: 'A private collection. A sealed chamber with a door at each end, and a ring corridor with two ways round to them — the patrol walks the ring one way and never turns back.',

    /* Two hard lessons from the solver are baked into this map.
       ONE: the ring is TWO lanes wide everywhere. A single-file ring was tried
       first and came back unreachable from all 36 world phases — a guard's
       cone fills a one-lane corridor completely and there is no sideways.
       TWO: the chamber is three rows, and nobody patrols inside it. At 7x2
       with a guard walking it, the whole room was watched at once and the
       lean route (skip the disguise, skip the tap) had no solution at all.
       A sealed room is guarded by its door and a camera, not by a man pacing
       a box he cannot help but fill. */
    MAP: [
      '###############',
      '#.............#',
      '#.............#',
      '##.#########..#',
      '##.#.......#..#',
      '##.+.......+..#',
      '##.#.......#..#',
      '##.#########..#',
      '#.............#',
      '#......E......#',
      '###############'
    ],
    /* the ring is one continuous corridor, so all three of its arms share the
       neutral tint — only the chamber and the way out read as different rooms */
    ROOMS: [
      { name: 'LA CHAMBRE',   x: 4,  y: 4, w: 7,  h: 3, tint: 'cool' },
      { name: 'GALERIE NORD', x: 1,  y: 1, w: 13, h: 2, tint: 'neutral' },
      { name: 'AILE OUEST',   x: 1,  y: 3, w: 2,  h: 5, tint: 'neutral' },
      { name: 'AILE EST',     x: 12, y: 3, w: 2,  h: 5, tint: 'neutral' },
      { name: 'VESTIBULE',    x: 1,  y: 8, w: 13, h: 2, tint: 'warm' }
    ],
    /* The ring patrol is the new shape: a multi-leg route walked in one
       direction forever. It never reverses, so Benjamin can say "he is gone
       for eleven" and be right — but it also means he always comes back. */
    GUARDS: [
      /* Depth 2, and it was measured back down from 3. The narrowed west wing
         and the moved desk already tighten every route; a deeper cone on top
         of them started stranding the greedy route mid-job, because the
         undisguised penalty stacks on it and seals a corridor outright.
         Three tightenings at once was one too many. */
      { id: 'g1', badge: '7731', loop: true,
        waypoints: [{ x: 2, y: 1 }, { x: 13, y: 1 }, { x: 13, y: 9 }, { x: 2, y: 9 }],
        at: 0, dir: 1, depth: 2 },
      { id: 'g2', badge: '2264', from: { x: 3, y: 2 }, to: { x: 11, y: 2 }, at: 0, dir: 1, depth: 2 },
      /* posted on the east lane, in front of the chamber door — which is
         both where a guard would actually stand and where the pressure
         belongs. He started on the bottom lane and, together with the ring
         patrol, sealed the vestibule outright on 18 of 80 world phases. */
      { id: 'g3', badge: '5507', from: { x: 12, y: 3 }, to: { x: 12, y: 7 }, at: 4, dir: -1, depth: 2 }
    ],
    /* Neither camera watches the way in. Job 1 shipped a first draft where
       Assane spawned inside a cone; that is a mistake you make once. */
    CAMERAS: [
      /* Pressure on this job comes from the cameras rather than more guards.
         A fourth patrol was tried and it made the lean route unreachable from
         14 of 80 phases: a roaming cone can seal a corridor outright, a fixed
         one on a cycle only ever poses a timing question. */
      { id: 'c1', x: 7, y: 3, depth: 3, cycle: ['S', 'S', null, null], label: 'CAM 1' },
      { id: 'c2', x: 3, y: 4, depth: 3, cycle: ['W', 'W', null, null], label: 'CAM 2' }
    ],
    /* TWO doors, one circuit, one mark — so releasing the chamber is still a
       single deduction, but getting to it is a choice. With one door the tile
       in front of it was a chokepoint the east-lane guard could seal outright,
       and the lean route came back unreachable from all 80 phases. A ring with
       two ways round has to have two ways in. */
    LEVIERS: [LEVER.phone],
    DOORS: [
      { x: 11, y: 5, locked: true, mark: 'trident', to: 'LA CHAMBRE (EST)' },
      { x: 3,  y: 5, locked: true, mark: 'trident', to: 'LA CHAMBRE (OUEST)' }
    ],
    MODULES: [
      /* The desk sits at the far end of the ring from the way in, so even the
         lean route has to travel and pick a side; at three tiles from the
         entrance it never touched the venue's whole idea. The tile was chosen
         by measurement, not taste. The corners diagonally opposite (12,2 and
         13,1) were tried first and both are UNREACHABLE without a uniform at
         any cone depth — the north route is simply sealed to a man who looks
         wrong. This one keeps the lean route alive and still doubles its
         opening leg. */
      { id: 'bureau',      x: 12, y: 8, name: 'LE BUREAU',      icon: 'desk' },
      { id: 'coffre',      x: 7,  y: 5, name: 'LE COFFRE',      icon: 'safe' },
      { id: 'deguisement', x: 4,  y: 9, name: 'LE DÉGUISEMENT', icon: 'coat',  optional: true },
      { id: 'faux',        x: 5,  y: 6, name: 'LE FAUX',        icon: 'frame', optional: true },
      { id: 'ecoute',      x: 2,  y: 1, name: 'L’ÉCOUTE',       icon: 'wave',  optional: true }
    ],

    COFFRE: {
      serial: 'PG-4402', ring: 'olive',
      dial: ['tridot', 'chevrons', 'dbar', 'star4', 'spiral', 'hook', 'bisect', 'crescent'],
      code: ['star4', 'tridot', 'crescent', 'dbar'],
      manual: [
        { serial: 'PG-4402', ring: 'camel', seq: ['tridot', 'star4', 'dbar', 'crescent'] },
        { serial: 'PG-4042', ring: 'olive', seq: ['crescent', 'dbar', 'star4', 'tridot'] },
        { serial: 'PG-4402', ring: 'olive', seq: ['star4', 'tridot', 'crescent', 'dbar'] },
        { serial: 'PG-2044', ring: 'olive', seq: ['dbar', 'crescent', 'tridot', 'star4'] },
        { serial: 'PG-4402', ring: 'denim', seq: ['star4', 'crescent', 'tridot', 'dbar'] },
        { serial: 'PG-4420', ring: 'olive', seq: ['tridot', 'crescent', 'dbar', 'star4'] }
      ]
    },

    PERSONNEL: [
      { badge: '7731', name: 'BRUNEL, Solange', post: 'GALERIE NORD', plate: '4416', kids: [{ n: 'Achille', y: 2008 }, { n: 'Rose', y: 2013 }] },
      { badge: '2264', name: 'OKONKWO, Daniel', post: 'LA CHAMBRE',   plate: '9052', kids: [{ n: 'Ada', y: 2010 }] },
      { badge: '5507', name: 'MARCHAND, Yves',  post: 'VESTIBULE',    plate: '3318', kids: [] },
      { badge: '8890', name: 'FERRAND, Lucie',  post: 'AILE OUEST',   plate: '7724', kids: [{ n: 'Tom', y: 2005 }, { n: 'Zoé', y: 2015 }] },
      { badge: '3145', name: 'DIALLO, Aminata', post: 'AILE EST',     plate: '6690', kids: [{ n: 'Sekou', y: 2011 }, { n: 'Fanta', y: 2006 }] },
      { badge: '6012', name: 'ROUX, Patrick',   post: 'LA CHAMBRE',   plate: '2237', kids: [{ n: 'Manon', y: 2001 }] }
    ],
    /* mode 'plate': the note on this desk is a car, not a cake, and the code
       is the officer's registration. Same module, same screen, a different
       question — the content-economics argument, demonstrated rather than
       asserted. */
    BUREAU: { badge: '3145', mode: 'plate', answer: '6690', doorMark: 'trident' },

    RACK: {
      head:  ['beret', 'nu', 'calot'],
      torso: ['veste', 'gilet', 'tablier'],
      legs:  ['noir', 'raye', 'jean']
    },
    UNIFORMS: {
      '7731': { head: 'calot',     torso: 'veste',  legs: 'raye' },
      '2264': { head: 'beret',     torso: 'gilet',  legs: 'noir' },
      '5507': { head: 'casquette', torso: 'veste',  legs: 'noir' },
      '8890': { head: 'nu',        torso: 'blouse', legs: 'jean' },
      '3145': { head: 'beret',     torso: 'veste',  legs: 'salopette' },
      '6012': { head: 'nu',        torso: 'blouse', legs: 'noir' }
    },
    /* buildable here: 7731 (GALERIE NORD) and 2264 (LA CHAMBRE). */
    DEGUISEMENT: { answerBadge: '2264', targetPost: 'LA CHAMBRE', conePenalty: 1 },

    ECOUTE: {
      transmission: ['l', 's', 'l', 's', 's'],
      answer: 'C-2', kills: 'c1', circuits: ['C-1', 'C-2', 'C-3', 'C-4'],
      book: [
        { p: ['s', 's', 'l', 'l', 's'], c: 'C-1' },
        { p: ['l', 's', 'l', 's', 's'], c: 'C-2' },
        { p: ['s', 'l', 'l', 's', 's'], c: 'C-3' },
        { p: ['l', 's', 'l', 's', 'l'], c: 'C-4' },
        { p: ['l', 'l', 's', 'l', 's'], c: 'C-6  (annexe)' },
        { p: ['l', 's', 's', 's', 'l'], c: 'C-8  (annexe)' }
      ]
    },

    FAUX: {
      genuine: { horizon: 'high', tree: 'right', birds: 2, sun: true,  sig: 'BR' },
      forgery: { horizon: 'high', tree: 'right', birds: 3, sun: false, sig: 'BL' },
      notes: [
        { s: 'The tree stands on the right of the field.' },
        { s: 'Two birds. He never painted three.' },
        { s: 'There is a sun. This is the only daylight piece he made.' },
        { s: 'His mark is in the lower-RIGHT corner.' }
      ]
    },

    FACES: {
      '7731': { art: 'face-7731', head: 'round',  hair: 'swept', moustache: false, beard: false, glasses: false, scar: false, skin: 'var(--stone)' },
      '2264': { art: 'face-2264', head: 'square', hair: 'nu',    moustache: false, beard: true,  glasses: false, scar: false, skin: '#8A5A3B' },
      '5507': { art: 'face-5507', head: 'long',   hair: 'bald',  moustache: true,  beard: false, glasses: false, scar: false, skin: 'var(--camel)' },
      '8890': { art: 'face-8890', head: 'round',  hair: 'cap',   moustache: false, beard: false, glasses: true,  scar: false, skin: 'var(--stone-dk)' },
      '3145': { art: 'face-3145', head: 'long',   hair: 'short', moustache: false, beard: false, glasses: false, scar: true,  skin: '#8A5A3B' },
      '6012': { art: 'face-6012', head: 'square', hair: 'bald',  moustache: true,  beard: false, glasses: true,  scar: false, skin: 'var(--camel)' }
    },
    DIRT: {
      '7731': [{ t: 'promotion', s: 'Turned down the supervisor job. Regrets it.' },
               { t: 'kids', s: 'Two, and photographs of both on the desk.' },
               { t: 'coffee', s: 'Will not drink anything from the machine.' }],
      '2264': [{ t: 'study', s: 'Finishing an architecture degree at night.' },
               { t: 'boss', s: 'The owner talks to him like staff. He notices.' },
               { t: 'football', s: 'Follows the away games religiously.' }],
      '5507': [{ t: 'wife', s: 'Thirty years married. Mentions it hourly.' },
               { t: 'car', s: 'Restoring an old Peugeot in his garage.' },
               { t: 'promotion', s: 'Was head of security once. Not any more.' }],
      '8890': [{ t: 'kids', s: 'A boy at university and a girl of nine.' },
               { t: 'coffee', s: 'Runs the coffee fund. Takes it seriously.' },
               { t: 'boss', s: 'Cannot stand the night manager.' }],
      '3145': [{ t: 'car', s: 'New car, and it is parked where it should not be.' },
               { t: 'football', s: 'Plays on Sundays. Talks about it on Mondays.' },
               { t: 'wife', s: 'Engaged. The wedding is all she talks about.' }],
      '6012': [{ t: 'boss', s: 'Been here longer than the owner. Says so.' },
               { t: 'study', s: 'Reads history. Will tell you about it.' },
               { t: 'kids', s: 'One daughter, grown, and he misses her.' }]
    },

    BLACKOUT: {
      torchDepth: 3,
      /* five zones on a ring, two feeds at a time — so every zone is dark more
         often than it is lit, and the corners go blind together */
      zones: [
        { id: 'A', name: 'CHAMBRE', x: 4,  y: 4, w: 7,  h: 3 },
        { id: 'B', name: 'NORD',    x: 1,  y: 1, w: 13, h: 2 },
        { id: 'C', name: 'OUEST',   x: 1,  y: 3, w: 2,  h: 5 },
        { id: 'D', name: 'EST',     x: 11, y: 3, w: 3,  h: 5 },
        { id: 'E', name: 'SUD',     x: 1,  y: 8, w: 13, h: 2 }
      ],
      feedCycle: [['A', 'C'], ['B', 'D'], ['E', 'A'], ['C', 'D'], ['B', 'E']]
    },

    /* 5507 is posted to the vestibule; reversed that is 7055, digits 0, 5, 7. */
    CLAVIER: { code: '7055', worn: ['0', '5', '7'], zone: 'VESTIBULE' },

    PROCEDURES: [
      { k: 'POWER FAILURE', v: 'Zone doors lock themselves. Emergency supply runs two cameras at a time.' },
      { k: 'RELEASE CODE',  v: 'Badge number of the officer posted to that zone, digits reversed.' },
      { k: 'PATROLS',       v: 'Torches mandatory. Increased range.' }
    ],

    BEATS: [
      'A sealed chamber with a door at each end, and a corridor all the way round it.',
      'Two ways in, and they are never equally safe.',
      'The ring patrol never turns back — predictable, and always coming round again.'
    ]
  };


  /* =======================================================================
     CONTRAT No.3 — LA CHAMBRE 302
     Three guards, three modules, and a map built to teach rather than to
     test. The shape is a RING around two blocks with one corridor cutting
     through the middle — and that corridor is sealed. Every route is the
     long way round, which is the whole reason Player 2 exists.

     It is deliberately the simplest of the three contracts. One guard in the
     south room demonstrates the rule that guards step when Assane steps. The
     door is the first real lock. Only past it do two guards start looping in
     opposite directions, and only there does the map stop being obvious.
     ======================================================================= */
  var JOB3 = {
    id: 'chambre',
    venue: 'RÉSIDENCE · TROISIÈME ÉTAGE',
    contract: 'CONTRAT No.3 — LA CHAMBRE 302',
    target: 'Chambre 302 · le dossier',
    venueArt: 'venue-particulier',
    blurb: 'One locked door, one sealed corridor, and two guards who never stop walking. Everything here is the long way round.',

    /* 'L' is a laser. It reads as wall to everything that moves, but it is
       drawn as its own thing, and Assane cannot know it is there until he is
       standing next to it. The central corridor is the short way from the
       south to the north and it is never open — the map is a ring, and the
       shortcut through the middle is a promise it does not keep. */
    MAP: [
      '#######################',
      '#########.....#########',
      '#########.....#########',
      '#########.....#########',
      '#.....................#',
      '#.....................#',
      '#..#######...#######..#',
      '#..#######LLL#######..#',
      'X....####.....####....#',
      '#..#######LLL#######..#',
      '#..#######...#######..#',
      '#.....................#',
      '#.....................#',
      '###############+#######',
      '###.................###',
      '###.................###',
      '###########+###########',
      '##########.E.##########',
      '#######################'
    ],
    ROOMS: [
      { name: 'CHAMBRE 302',     x: 9,  y: 1,  w: 5,  h: 3, tint: 'cool' },
      { name: 'GALERIE NORD',    x: 1,  y: 4,  w: 21, h: 2, tint: 'neutral' },
      { name: 'AILE OUEST',      x: 0,  y: 6,  w: 5,  h: 5, tint: 'neutral' },
      { name: 'COULOIR CENTRAL', x: 9,  y: 6,  w: 5,  h: 5, tint: 'olive' },
      { name: 'AILE EST',        x: 18, y: 6,  w: 4,  h: 5, tint: 'neutral' },
      { name: 'GALERIE SUD',     x: 1,  y: 11, w: 21, h: 2, tint: 'neutral' },
      { name: 'LE VESTIAIRE',    x: 3,  y: 14, w: 17, h: 2, tint: 'warm' },
      { name: 'ESCALIER',        x: 10, y: 16, w: 3,  h: 2, tint: 'warm' }
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
      { id: 'g1', badge: '4412', from: { x: 4, y: 14 }, to: { x: 16, y: 14 }, at: 0, dir: 1, depth: 1 },
      /* Both ring guards turn the same way — counter-clockwise: down the west
         arm, east along the south, up the east arm, west along the north. Same
         circuit, started half a lap apart, so they are always opposite each
         other and Benjamin only ever has to track one of them. */
      { id: 'g2', badge: '2071', at: 0,  dir: 1, depth: 1, loop: true,
        waypoints: [{ x: 2, y: 5 }, { x: 2, y: 11 }, { x: 20, y: 11 }, { x: 20, y: 5 }] },
      { id: 'g3', badge: '3308', at: 24, dir: 1, depth: 1, loop: true,
        waypoints: [{ x: 2, y: 5 }, { x: 2, y: 11 }, { x: 20, y: 11 }, { x: 20, y: 5 }] }
    ],
    /* Two cameras, and one of them cannot be walked around. CAM 1 hangs over
       the desk and never blinks: the prize is under it, so the prize does not
       exist without Benjamin looping it. CAM 2 watches the keypad every other
       beat — that one can be timed, if somebody in the van is counting. */
    CAMERAS: [
      { id: 'c1', x: 11, y: 0,  depth: 2, cycle: ['S'],                 label: 'CAM 1' },
      /* on, off, on, off. Two-on/two-off left the square under it a trap on the
         beat it woke (four dead states); every other beat leaves none, and is
         the easiest rhythm there is to count out loud. */
      { id: 'c2', x: 15, y: 16, depth: 1, cycle: ['N', null, 'N', null], label: 'CAM 2' }
    ],
    LEVIERS: [LEVER.phone, LEVER.lights, LEVER.laser, LEVER.camera],
    /* Taking the dossier kills the monitors. The television goes dark and the
       two phones are all there is; the stairs are a floor away, and the hatch
       in the west wall ('X' on the plan) is the only way out. */
    PRIZE: { dark: true },
    DOORS: [
      /* the service gate at the foot of the stairs. Its mark is a plain lock on
         Benjamin's plan — what is stamped on the padlock is Assane's to see */
      { x: 11, y: 16, locked: true, mark: 'lock', to: 'LE VESTIAIRE' },
      { x: 15, y: 13, locked: true, mark: 'dbar', to: 'GALERIE SUD' }
    ],
    MODULES: [
      /* on the square he starts on, so it opens the moment both players are
         ready — the first thing anyone does in this game is talk */
      { id: 'grille',      x: 11, y: 17, name: 'LA GRILLE',      icon: 'lock' },
      { id: 'deguisement', x: 12, y: 17, name: 'LE DÉGUISEMENT', icon: 'coat', optional: true },
      { id: 'porte',       x: 15, y: 14, name: 'LA PORTE',       icon: 'lock' },
      /* The desk. For now it hands over the dossier and nothing more —
         the full Bureau puzzle is the stretch goal, and a placeholder that
         works beats a half-built module that does not. */
      { id: 'prize',       x: 11, y: 2,  name: 'LE BUREAU',      icon: 'desk' }
    ],

    /* LA GRILLE — the handshake.
       Every "I don't understand" this prototype has produced came from the same
       gap: the player did not yet know that the OTHER phone holds the missing
       half. So the first thing that happens is the smallest possible proof of
       it. Assane has a padlock with a symbol stamped on its tag and three keys
       numbered 1, 2, 3. Benjamin has a card that says which symbol is which
       key. Neither can open the gate alone; one sentence each and it is open.
       No guard, no code, no ring, no counting — a wrong key rattles the gate
       and costs a little suspicion, nothing worse. After this, every later
       module has the same shape and needs no manual to say so. */
    GRILLE: {
      lock: 'trident',
      board: [{ sym: 'crescent', key: 1 }, { sym: 'trident', key: 2 }, { sym: 'ladder', key: 3 }],
      door: { x: 11, y: 16 },
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
      door: { x: 15, y: 13 },
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
      { k: 'EVACUATION',   v: 'Service hatch, west wall, row 9. Not on the public plans.' }
    ],

    BEATS: [
      'One of you is inside. One of you has the plans. Neither of you can finish alone.',
      'The guards move when Assane moves. Nothing happens between your inputs.',
      'The way through the middle is sealed. Everything here is the long way round.',
      'Benjamin has four levers in the van. Every one of them is noticed.',
      'Standing still is free for thirty seconds. After that the building starts to wonder.'
    ]
  };

  var JOBS = [JOB3, JOB1, JOB2];

  /* Swap the data under the engine. Every other file reads L.content.<FIELD>
     and holds a reference to this same object, so assigning the fields here is
     all a job change takes — no reload, no rebuild, and not one line of code
     that knows a venue. This function IS the "modules are grammars" argument. */
  var JOB_FIELDS = ['venue', 'contract', 'target', 'blurb', 'venueArt', 'MAP', 'ROOMS', 'GUARDS',
    'CAMERAS', 'DOORS', 'MODULES', 'COFFRE', 'PERSONNEL', 'BUREAU', 'RACK', 'UNIFORMS',
    'DEGUISEMENT', 'ECOUTE', 'FAUX', 'FACES', 'DIRT', 'BLACKOUT', 'CLAVIER', 'PORTE',
    'PROCEDURES', 'BEATS', 'GRILLE', 'LEVIERS', 'PRIZE'];

  function loadJob(i) {
    var job = JOBS[i] || JOBS[0];
    JOB_FIELDS.forEach(function (k) { L.content[k] = job[k]; });
    L.content.jobIndex = JOBS.indexOf(job);
    L.content.job = { venue: job.venue, contract: job.contract, target: job.target };
    return job;
  }

  L.content = {
    JOBS: JOBS, loadJob: loadJob, jobIndex: 0,
    DOOR_MARKS: DOOR_MARKS, RING_COLOUR: RING_COLOUR, GARMENTS: GARMENTS,
    LINES: LINES, TOPICS: TOPICS, RANKS: RANKS, ALERT: ALERT, PRESSURE: PRESSURE,
    AMBIENT: AMBIENT, STATIC_LINES: STATIC_LINES
  };
  loadJob(0);
})(window.DC);
