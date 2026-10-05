/* content.js — THE JOB LIBRARY.
   One contract. Everything that makes a job a job — the building, the
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
     SHARED — the vocabulary this job draws on.
     ======================================================================= */

  var DOOR_MARKS = ['star4', 'chevrons', 'dbar', 'trident'];

  var RING_COLOUR = {
    amber: 'var(--gold)', olive: 'var(--olive)', denim: 'var(--denim)', camel: 'var(--camel)'
  };

  /* the whole wardrobe — the nine pieces in art/wardrobe. Every staff uniform
     is built from these, and the rack hangs all of them. */
  var GARMENTS = {
    head:  ['casquette', 'nu', 'calot'],
    torso: ['tablier', 'gilet', 'blouse'],
    legs:  ['noir', 'salopette', 'jean']
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
    boss:      'Between us — I do not know how you can stand the floor manager.'
  };
  var TOPICS = Object.keys(LINES);

  /* FIRST-BEAM G1 TUTORIAL ONLY. Replace the =... placeholders with its
     three fixed clues, three questions, three answer choices per question,
     and the correct answer's one-based number (1, 2, or 3). This data does
     not use LINES, DIRT, or the regular conversation topics. */
  var FIRST_BEAM_TUTORIAL_CLUES = ['Very thoughtful toward newcomers.', 'Likes having their work noticed', 'Doesn\'t like dawdling on the job.'];
  var FIRST_BEAM_TUTORIAL = [
    { question: 'The laser! Every single day I say it: check the manual, watch your step!', answers: ['I am in a hurry.', 'Sorry, sir! It is my first day.', 'Ever heard of pressure points?'], correct: 2 },
    { question: 'Oh! The new guy! Yes yes, sorry about that. Read the manual and we\'ll get along just fine!', answers: ['Not really the reading type. I learn by doing.', 'You\'ve got beautiful eyes!', 'Of course, sir! I\'ve heard great things about your leadership. I\'ll read everyday!'], correct: 3 },
    { question: 'Now that\'s what I like to hear! Alright, get moving!', answers: ['You see that new show that dropped on Netflix?', 'Where\'s the safe?', 'Yes sir! Excuse me.'], correct: 3 }
  ];

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
    /* THE BEAMS ARE EARNED, AND THEN THEY ARE A RHYTHM.
       Locked until LE BUREAU is cracked (on a floor that has one), and then
       not a single pull but a lever on a cooldown: once the beams come back
       on, the van needs four of Assane's moves before it can drop them again. */
    laser:  { id: 'laser',  icon: 'beam', name: 'CUT THE LASERS ', cost: 10, turns: 8, uses: 1,
              cooldown: 4, needs: 'bureau',
              blurb: 'The beams drop for eight moves. Assane can cross one without them, but it sets off the alarm.' },
    /* Never permanent. A looped camera shows an empty corridor for a few moves
       and then it is a camera again — so a camera that cannot be walked
       around is a camera the two of them have to time together. */
    camera: { id: 'camera', icon: 'eye',  name: 'LOOP A CAMERA',  cost: 4,  turns: 4, uses: 3,
              needs: 'bureau',
              blurb: 'The box nearest Assane sees nothing for four moves, then it is back.' }
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
     CONTRAT No.2 — LA VEILLE DE VENTE
     An auction house, the night before a sale. The shape of contract three
     with the volume turned up band by band: the kitchens are what they
     already know, the ring is where the levers stop being optional, and the
     top floor is everything at once — a desk that releases a vault, a safe
     under a camera that never blinks, and a way out that is not on the plan.
     Built from modules that already exist: only the numbers are new.
     ======================================================================= */
  var JOB1 = {
    id: 'veille',
    HATCH: 'door',
    venue: 'HÔTEL DES VENTES · LA VEILLE',
    contract: 'CONTRAT No.1 — LA VEILLE DE VENTE',
    target: 'Lot 12 · manuscrit enluminé',
    venueArt: 'venue-establishing',
    blurb: 'You need a paper inside The vault. Its room is released from the officer security desk. Find a way out.',

    /* THE FRAME. A wall column down the EAST edge and a wall row along the
       bottom that no route touches: the hatch sits in the east wall, so the
       outermost stone needs a cell of its own to be drawn in. The column goes
       after the last one, so every square keeps the name it had. */
    MAP: [
      '########################',
      '##############.#...L.###',
      '##############.....L.###',
      '#.X..#########.#...L.###',
      '#....###############+###',
      '#.....................##',
      '#...#.................##',
      '#...#.#.#.#.##.###...###',
      '#...#.......##.......###',
      '#...#.#.#.#.##.###...###',
      '#...L........L.......###',
      '#...L........L.......###',
      '###########+########.###',
      '#######...L......#...###',
      '#######...L......#...###',
      '###...#...L......#...###',
      '###E..##+###############',
      '##.......###############',
      '########################',
      '########################'
    ],
    ROOMS: [
      { name: 'LE COFFRE',       x: 14, y: 1,  w: 6,  h: 3, tint: 'warm' },
      { name: 'LES CUISINES',    x: 1,  y: 3,  w: 4,  h: 9, tint: 'warm' },
      { name: 'LA RÉSERVE',      x: 7, y: 13, w: 10,  h: 3, tint: 'olive', labelX: 11, labelY: 14 },
      { name: 'BUREAU',          x: 18, y: 13, w: 3,  h: 3, tint: 'olive' },
      { name: 'LE VESTIAIRE',    x: 2,  y: 15, w: 5,  h: 3, tint: 'warm' },
      { name: 'GALERIE HAUTE',   x: 5,  y: 5,  w: 17, h: 4, tint: 'neutral' },
      { name: 'GALERIE BASSE',   x: 5,  y: 9, w: 17, h: 3, tint: 'neutral' }
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
      /* THE RESERVE MAN, AND THE LESSON IN THE BEAMS. He does not walk a
         round: he stands at the east end of La Réserve looking west, down
         the room at the beam column every route through it has to cross.
         Break a beam in LA RÉSERVE (`hears`) and he walks to Assane and
         stops him, wherever he has got to — the first alarm and the first
         conversation, taught together and on purpose. It is a scripted
         encounter: it does not count as being spotted. Talk him round and he
         walks back to this square and stands down for the night. Was a
         two-square beat at (15,14)-(14,14). */
      { id: 'g1', badge: '4412', from: { x: 14, y: 14 }, to: { x: 14, y: 14 }, at: 0, dir: 1, depth: 1,
        stand: true, facing: 'W', hears: 'LA RÉSERVE' },
      /* was: loop:true, waypoints [C6, C12, U12, U6] — the full perimeter */
      { id: 'g2', badge: '2071', from: { x: 19, y: 6 }, to: { x: 19, y: 10 }, at: 0, dir: 1, depth: 2 },
      /* was: y:5, the door row */
      /* investigate: a broken beam sends him straight to it, not after
         Assane, and he stands there looking round for six moves */
      { id: 'g3', badge: '5195', from: { x: 2, y: 3 }, to: { x: 2, y: 5 }, at: 6, dir: -1, depth: 1, investigate: 6 }
    ],
    /* CAM 1 over the safe never blinks. CAM 2 over the desk is on one beat in
       three — timeable, if Benjamin is counting, loopable if he is not. */
    CAMERAS: [
      { id: 'c1', x: 17,  y: 0, depth: 2, cycle: ['S'],             label: 'CAM 1' }
      /*{ id: 'c2', x: 12, y: 0, depth: 2, cycle: ['S', null, null], label: 'CAM 2' }*/
    ],
    /* fewer pulls than contract three. The van is further away tonight. */
    LEVIERS: [LEVER.lights, LEVER.laser, lever(LEVER.camera, { uses: 2 })],
    /* NO `dark` HERE, AND THAT IS THE WHOLE OF LE TWIST.
       A prize marked dark kills the monitors: the television goes black and
       the job carries on. Without it the same moment runs startBlackout()
       instead — the power goes, Assane's sight collapses to arm's length, the
       cameras come off the plan and back as five emergency feeds, two at a
       time. This contract is the one that earns it: the safe is three rooms
       and two floors from the only way out. */
    PRIZE: { name: 'MANUSCRIPT', hatchHidden: true },
    /* THE FIRST BEAM ASKS BEFORE IT RINGS. The first step into a live beam on
       this contract does not happen: the television says what a beam is, and
       the same step again commits. Once a run. */
    BEAM_CARD: { title: 'THE BEAMS', line: 'Cross one and the alarm goes — someone will come to see who did it. Step again to cross.' },
    /* A separate TV card shown when the Bureau is completed. Keep its copy
       independent from BEAM_CARD so the two messages can be edited separately. */
    BUREAU_CARD: { title: 'Security credentials acquired!', line: 'The van has unrestricted access to the security systems!' },
    MAP_OBJECTIVES: [
      { until: 'porte', targets: ['deguisement', 'porte'] },
      { until: 'bureau', targets: ['bureau'], unlockTargets: ['bureau-door'] },
      { until: 'coffre', targets: ['coffre'] },
      { targets: ['exit'] }
    ],
    OBJ: {
      cloak: 'The vestiaire is at the entrance. Get Assane into the right uniform before he crosses the staff gate.',
      door:  'A padlocked gate between the vestiaire and the service passages. P1 has the keys; P2 knows which is which.',
      porte: 'A locked door beyond La Réserve. P1 has the keypad; P2 has the code.',
      after: 'The manuscript is sealed in a vault beneath a live camera. Crack the safe, take the prize, and disappear through the unmarked exit.',
      out:   'Assane has it and the monitors are dead. The plan shows no way out. Benjamin’s procedures might.',
      dark:  'The power is gone. Assane still has his phone; Benjamin has the procedures — the way out is in them.'
    },
    DOORS: [
      { x: 20,  y: 4,  locked: true,  mark: 'trident',  to: 'LE COFFRE' },
      { x: 11, y: 12,  locked: true,  mark: 'chevrons', to: 'GALERIE BASSE' },
      { x: 8,  y: 16, locked: true,  mark: 'lock',     to: 'LE VESTIAIRE' },
    ],
    MODULES: [
      /* staff only: the padlock will not open for a man out of uniform, so
         the cloakroom is not optional on this contract */
      { id: 'grille',      x: 8,  y: 17, name: 'LA GRILLE',      icon: 'lock', needs: 'deguisement',
        refuse: { title: 'STAFF ONLY', line: 'Assane isn’t in uniform. Someone would ask questions.' } },
      { id: 'deguisement', x: 4, y: 15, name: 'LE DÉGUISEMENT', icon: 'coat' },
        /* LA PORTE, at the north end of La Réserve: the keypad follows the
           beam and the posted guard. */
      { id: 'porte',       x: 11, y: 13, name: 'LA PORTE',       icon: 'lock' },
      { id: 'bureau',      x: 19, y: 14,  name: 'LE BUREAU',      icon: 'desk' },
      { id: 'coffre',      x: 17,  y: 2,  name: 'LE COFFRE',      icon: 'safe' }
    ],

    /* LA GRILLE, contract one's handshake on the kitchen gate. Same padlock
       and the same three keys — the trident is painted into
       art/grille-padlock.png, so the lock cannot change — but the card pairs
       the tags with different keys, so contract one's answer does not carry
       over. Here the trident opens with the old warded key. */
    GRILLE: {
      lock: 'trident',
      board: [{ sym: 'crescent', key: 3, shape: 'keyTeeth',  at: 0.02, wide: 0.36 },
              { sym: 'ladder',   key: 2, shape: 'keyHoles',  at: 0.38, wide: 0.28 },
              { sym: 'trident',  key: 1, shape: 'keyWard',   at: 0.66, wide: 0.32 }],
      door: { x: 8, y: 16 },
      rattle: 3
    },

    PORTE: {
      code: '2549',
      door: { x: 11, y: 12 },
      sign: 'CHAMBRE 302',
      zero: 'hook',
      ring: ['spiral', 'crescent', 'ladder', 'hook', 'drop',
             'trident', 'star4', 'chevrons', 'backz', 'bisect'],
      fails: 3
    },

    /* contract one's dial, a new serial. Three rows share it; the ring colour
       is the only thing that tells them apart. */
    COFFRE: {
      guardId: 'g3', // The existing patrol responds; no extra face is needed.
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
      { badge: '4412', name: 'MOREAU, Serge',     post: 'LA RÉSERVE',    plate: '8028', kids: [{ n: 'Camille', y: 2009 }, { n: 'Léa', y: 2014 }] },
      /* HIS POST IS THE EAST AISLE, and it has to be his alone. He walks it —
         g2's beat is the east side of Galerie Haute. It also has to
         be his alone for LE CLAVIER: the release code is the badge of the
         officer posted to the keypad's zone. */
      { badge: '2071', name: 'DELACROIX, Yann',   post: 'GALERIE HAUTE', plate: '5530', kids: [] },
      { badge: '1184', name: 'VIDAL, Nadia',      post: 'BUREAU',        plate: '1147', kids: [{ n: 'Théo', y: 2011 }] },
      { badge: '5195', name: 'SANGLIER, Bruno',   post: 'LES CUISINES',  plate: '9088', kids: [{ n: 'Inès', y: 2007 }, { n: 'Hugo', y: 2007 }] },
      { badge: '6620', name: 'PARMENTIER, Odile', post: 'LE VESTIAIRE',  plate: '4472', kids: [{ n: 'Marc', y: 2003 }, { n: 'Julie', y: 2016 }] },
      { badge: '3308', name: 'KOFFI, Émile',      post: 'LA RÉSERVE',    plate: '3396', kids: [{ n: 'Awa', y: 2012 }, { n: 'Noé', y: 2005 }] }
    ],
    /* contract one's rack: the whole wardrobe, so every uniform is buildable.
       The post narrows it to LA RÉSERVE, which has two staff — MOREAU and
       KOFFI. MOREAU is the guard standing in that room (g1), and his badge is
       on Benjamin's map, so Assane goes in as the one who is not there. No two
       uniforms are the same; MOREAU's differs from KOFFI's by the torso only,
       so Assane still has to describe the rack carefully. */
    RACK: {
      head:  ['casquette', 'nu', 'calot'],
      torso: ['tablier', 'gilet', 'blouse'],
      legs:  ['noir', 'salopette', 'jean']
    },
    UNIFORMS: {
      '4412': { head: 'casquette', torso: 'blouse',  legs: 'noir' },
      '2071': { head: 'calot',     torso: 'blouse',  legs: 'jean' },
      '1184': { head: 'nu',        torso: 'gilet',   legs: 'jean' },
      '5195': { head: 'casquette', torso: 'gilet',   legs: 'salopette' },
      '6620': { head: 'nu',        torso: 'tablier', legs: 'salopette' },
      '3308': { head: 'casquette', torso: 'tablier', legs: 'noir' }
    },
    DEGUISEMENT: { answerBadge: '3308', targetPost: 'LA RÉSERVE', conePenalty: 1 },
    FACES: {
      // One distinct image per badge, shared by P1's encounter and P2's files.
      '4412': { art: 'ui-new/guard-3', head: 'square', hair: 'swept', moustache: true,  beard: false, glasses: false, scar: false, skin: 'var(--camel)' },
      '2071': { art: 'ui-new/guard-1', head: 'long',   hair: 'bald',  moustache: false, beard: false, glasses: true,  scar: false, skin: 'var(--stone-dk)' },
      // Temporarily hide surplus faces until their new art arrives. Their
      // personnel records and uniforms still supply desk/disguise clues.
      '1184': { hidden: true, art: 'face-3308', head: 'round', hair: 'swept', moustache: false, beard: false, glasses: true, scar: false, skin: 'var(--stone)' },
      '5195': { art: 'ui-new/guard-4', head: 'round', hair: 'swept', moustache: false, beard: false, glasses: false, scar: false, skin: 'var(--stone)' },
      '6620': { art: 'ui-new/guard-2', head: 'round',  hair: 'swept', moustache: false, beard: false, glasses: false, scar: false, skin: 'var(--camel)' },
      '3308': { hidden: true, art: 'face-1184', head: 'long', hair: 'cap', moustache: false, beard: true, glasses: false, scar: false, skin: '#8A5A3B' }
    },
    DIRT: {
      '4412': [{ t: 'kids', s: 'Two daughters. Talks about them constantly.' },
               { t: 'coffee', s: 'Fights with the machine on level three, daily.' },
               { t: 'boss', s: 'Loathes the floor manager. Openly.' }],
      '2071': [{ t: 'study', s: 'Night classes. Law. Second year.' },
               { t: 'car', s: 'Parks in the loading bay. Gets ticketed.' },
               { t: 'promotion', s: 'Applied for shift lead. Waiting to hear.' }],
      '3308': [{ t: 'football', s: 'Saint-Étienne football fan. Home and away.' },
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

    /* LE TWIST. The power goes when the safe opens, and what it takes is
       BENJAMIN'S PICTURE OF THE FLOOR — not continuously, in bursts.

       The first cut of this cut the building into five camera zones and lit
       two of them a turn. It measured fine and played as fog: three fifths of
       the floor missing at any moment, Benjamin blind more often than not, and
       "I have lost you" reduced to the weather rather than a thing that
       happens to you. Assane's phone was cut to static at the same time, which
       took the only reading he had left off the one man who has to walk.

       So: his phone is untouched, and the van drops the whole floor for one or
       two of Assane's moves, then holds it for four to six before it can go
       again. Roughly four dropouts on the walk out, each one an event both of
       them feel — Benjamin because his screen goes to snow mid-sentence,
       Assane because the voice stops.

       These numbers decide only what Benjamin can SEE. Nothing here moves a
       guard or catches anybody, so no route is opened or closed by them and
       the solver does not model them. Widen `drop` to make him panic, widen
       `delay` to make it rarer.

       LINK is not what opts a contract into the twist — CLAVIER is, because a
       power cut locks the way out and a floor with no keypad has no way to
       unlock it. Contract one has a LINK and no CLAVIER: its monitors die
       instead, and the van stutters exactly the same way. */
    LINK: {
      drop:  [1, 1],   /* moves the van has nothing at all */
      delay: [4, 6]    /* moves it is guaranteed before the next dropout */
    },

    /* LE CLAVIER. The hatch locked itself when the power went. P1 can see
       WHICH three keys are worn smooth, never the order.

       `code` and `worn` BELOW ARE PLACEHOLDERS. rollRoster() overwrites both
       at every seed, including seed 0: the code is the vehicle plate of
       whoever is posted to `zone` tonight, reversed. It used to be a badge
       reversed, and badges cannot move — they key the portrait art — so the
       one code in this game that is meant to be looked up was the same every
       night. Plates travel with people, so it is a different four digits and a
       different officer each roster.

       `zone` is the only part that matters here, and it has to be a post
       exactly one officer holds, or the question has two answers. Every plate
       carries exactly three distinct digits so the worn keys stay a real
       check — see rollPlate(). */
    CLAVIER: { code: '8809', worn: ['0', '8', '9'], zone: 'GALERIE HAUTE' },

    PROCEDURES: [
      { k: 'KITCHEN GATE', v: 'Padlocked. Staff in uniform only. The key card pairs each tag with its key.' },
      { k: 'LASER LINES',  v: 'The central corridor is beamed between rounds. Crossing one is not impossible, it is announced: every officer drops his round and converges for five minutes.' },
      { k: 'PATROLS',      v: 'One officer on the east stair, one across the upper gallery, one in the kitchens. They do not keep step.' },
      { k: 'CAMERAS',      v: 'CAM 1 covers the vault continuously.' },
      { k: 'ALERT LEVELS', v: 'Suspicion past 40: officers extend their rounds by one square. Past 70: by two, and anyone stopped is searched.' },
      { k: 'POWER FAILURE', v: 'Cameras and lighting drop. The beam lines stay armed. The service hatch locks itself.' },
      { k: 'RELEASE CODE',  v: 'Vehicle plate of the officer posted to that zone, reversed:' },
      { k: 'EVACUATION',   v: 'Emergency exit at C4, north of the kitchens. Not on the public plans.' }
    ],

    BEATS: [
      'Three floors, and each is worse than the one below.',
      'The desk releases the vault that is under a camera.',
      'The way out is not on the plan. Read the procedures.'
    ]
  };

  /* ONE CONTRACT. The auction-house level is the only available job. */
  var JOBS = [JOB1];

  /* Swap the data under the engine. Every other file reads L.content.<FIELD>
     and holds a reference to this same object, so assigning the fields here is
     all a job change takes — no reload, no rebuild, and not one line of code
     that knows a venue. This function IS the "modules are grammars" argument. */
  var JOB_FIELDS = ['id', 'HATCH', 'venue', 'contract', 'target', 'blurb', 'venueArt', 'MAP', 'ROOMS', 'GUARDS',
    'CAMERAS', 'DOORS', 'MODULES', 'COFFRE', 'PERSONNEL', 'BUREAU', 'RACK', 'UNIFORMS',
    'DEGUISEMENT', 'ECOUTE', 'FAUX', 'FACES', 'DIRT', 'LINK', 'CLAVIER', 'PORTE',
    'PROCEDURES', 'BEATS', 'GRILLE', 'LEVIERS', 'PRIZE', 'BEAM_CARD', 'BUREAU_CARD', 'OBJ', 'MAP_OBJECTIVES'];

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
     child's birth year. On this contract the desk belongs to the only person
     with one child, which makes the photo's child count the first clue and
     leaves a single birth year to read from the file. Seeded deals must keep
     that one-child person on the desk's badge. */
  var PRISTINE = {};
  function personOf(p) { return { name: p.name, plate: p.plate, kids: p.kids, faceOf: p.badge }; }
  function eldestYear(kids) {
    return String(kids.reduce(function (a, b) { return a.y <= b.y ? a : b; }).y);
  }
  function deskWorks(person, mode) {
    if (mode === 'plate') return !!person.plate;
    if (!person.kids || !person.kids.length) return false;
    /* In eldest mode, this contract's clue is that the desk owner's photo has
       one child. The roster deal must keep that person in the Bureau slot;
       their rolled single birth year is the keypad answer. */
    if (mode === 'eldest') return person.kids.length === 1;
    if (person.kids.length < 2) return false;
    return person.kids.some(function (k) { return k.y !== person.kids[0].y; });
  }
  function copyOf(o) { var c = {}; for (var k in o) c[k] = o[k]; return c; }

  /* ------------------------------------------------------- ROLLING NUMBERS
     THE ANSWERS CHANGE WITH THE ROSTER; the building does not. Everything
     below is a number written on a file or a keypad — a door code, a vehicle
     plate, a child's birth year — and none of it moves a wall, a beat or a
     camera. A route measured against the floor stays measured; a pair who
     played last night cannot type last night's codes.

     WHAT CANNOT ROLL, and why: BADGES. They key the FACES artwork, the
     uniforms table and the gossip table, so a rolled badge is a missing
     portrait. They stay, and so does every post. */
  function makeRng(seed) {
    var t = (seed >>> 0) + 0x9E3779B9;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rollCode(rnd) {
    var s2 = '';
    for (var i = 0; i < 4; i++) s2 += Math.floor(rnd() * 10);
    return s2;
  }
  function distinct(str) {
    var seen = {}, out = [];
    str.split('').forEach(function (d) { if (!seen[d]) { seen[d] = 1; out.push(d); } });
    return out.sort();
  }
  /* EVERY PLATE HAS EXACTLY THREE DISTINCT DIGITS, and that is not decoration.
     LE CLAVIER's code is the plate of the officer posted to the hatch's zone,
     reversed, and Assane's only check on Benjamin is that the keypad has three
     keys worn smooth. Four distinct digits and the check is a lie; two and it
     gives half the code away. Since the people are dealt to the slots, ANY of
     them can end up posted there — so all of them carry the property rather
     than one of them being special. */
  function rollPlate(rnd) {
    for (var i = 0; i < 300; i++) {
      var p = rollCode(rnd);
      if (distinct(p).length === 3) return p;
    }
    return '5530';
  }
  /* THE SAFE, DEALT LIKE EVERYTHING ELSE ON A FILE.
     The dial, the serial, the ring colour and the four symbols were all
     authored, so the one module that looks the most like a combination lock
     was the one whose combination never changed. It is rolled now, and the
     shape of the puzzle is rolled with it rather than around it.

     WHAT THE MANUAL HAS TO KEEP DOING is force Benjamin to read two things.
     Six rows: three share the safe's serial and differ by ring colour, three
     share its colour and differ by serial, and exactly one row is in both
     groups. Match on the serial alone and there are three answers; match on
     the colour alone and there are three answers; the row is only unique when
     Assane has read out both, which is the whole exchange.

     The decoy serials are DIGIT PERMUTATIONS of the real one — AV-2231
     against AV-2213 and AV-3221 — so telling them apart is reading rather
     than glancing. That needs at least three distinct digits to have
     permutations to spend, which is what the serial roll insists on. */
  function shuffled(list, rnd) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1)), t = a[i];
      a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function rollSerial(rnd) {
    for (var i = 0; i < 300; i++) {
      var d = rollCode(rnd);
      if (distinct(d).length >= 3) return d;      /* permutations to spend */
    }
    return '2231';
  }
  function permsOf(digits, rnd, want, notThis) {
    var seen = {}, out = [];
    seen[notThis] = 1;
    for (var i = 0; i < 400 && out.length < want; i++) {
      var p = shuffled(digits.split(''), rnd).join('');
      if (seen[p]) continue;
      seen[p] = 1; out.push(p);
    }
    while (out.length < want) out.push(notThis);   /* degenerate, never in practice */
    return out;
  }
  function rollCoffre(job, rnd) {
    var c = copyOf(job.COFFRE);
    var digits = rollSerial(rnd);
    var serials = permsOf(digits, rnd, 3, digits);
    var rings = shuffled(Object.keys(RING_COLOUR), rnd);
    c.serial = 'AV-' + digits;
    c.ring = rings[0];
    c.code = shuffled(c.dial, rnd).slice(0, 4);

    function otherSeq(used) {
      for (var i = 0; i < 200; i++) {
        var seq = shuffled(c.dial, rnd).slice(0, 4).join(' ');
        if (used.indexOf(seq) < 0) { used.push(seq); return seq.split(' '); }
      }
      return shuffled(c.dial, rnd).slice(0, 4);
    }
    var used = [c.code.join(' ')];
    c.manual = shuffled([
      { serial: c.serial,             ring: c.ring,   seq: c.code },
      { serial: c.serial,             ring: rings[1], seq: otherSeq(used) },
      { serial: c.serial,             ring: rings[2], seq: otherSeq(used) },
      { serial: 'AV-' + serials[0],   ring: c.ring,   seq: otherSeq(used) },
      { serial: 'AV-' + serials[1],   ring: c.ring,   seq: otherSeq(used) },
      { serial: 'AV-' + serials[2],   ring: rings[3], seq: otherSeq(used) }
    ], rnd);
    return c;
  }

  /* THE ELDEST HAS TO BE ONE CHILD. deskWorks() only asks that the years are
     not all identical, which still allows a tie at the OLDEST — and "the
     eldest child's birth year" then has two answers and the desk cannot be
     solved. Rolled years guarantee a unique minimum. */
  function rollKids(kids, rnd) {
    var out = kids.map(function (k) { return { n: k.n, y: 2001 + Math.floor(rnd() * 17) }; });
    if (out.length > 1) {
      var min = Math.min.apply(null, out.map(function (k) { return k.y; }));
      var eldest = out.filter(function (k) { return k.y === min; });
      if (eldest.length > 1) eldest[0].y = min - 1 - Math.floor(rnd() * 3);
    }
    return out;
  }

  function rollRoster(seed) {
    var job = JOBS[L.content.jobIndex] || JOBS[0];
    if (!job.PERSONNEL) return;
    if (!PRISTINE[job.id]) PRISTINE[job.id] = JSON.parse(JSON.stringify(job.PERSONNEL));
    var base = PRISTINE[job.id];

    /* seed 0 is the roster as written — the one the content comments describe,
       and the one the walkthrough's answers were read off */
    var order = base.map(function (_, i) { return i; });
    var rnd = makeRng(seed);
    var rolled = base.map(function (p) { return { plate: p.plate, kids: p.kids }; });
    if (seed) {
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
      /* A single eligible person has a small chance not to land in the desk
         slot during the shuffled passes. Guarantee the clue still works for
         every seed by swapping that person into the slot after the retries. */
      if (job.BUREAU && desk.length) {
        var deskSlot = base.map(function (b) { return b.badge; }).indexOf(job.BUREAU.badge);
        if (deskSlot >= 0 && desk.indexOf(order[deskSlot]) < 0) {
          var eligibleAt = order.indexOf(desk[0]), displaced = order[deskSlot];
          order[deskSlot] = order[eligibleAt];
          order[eligibleAt] = displaced;
        }
      }
      /* the car and the children are the person's, so they are rolled per
         person and travel with them into whichever slot they are dealt */
      rolled = base.map(function (p) {
        return { plate: rollPlate(rnd), kids: rollKids(p.kids, rnd) };
      });
    }

    /* badge and post belong to the slot; the person is dealt into it */
    L.content.PERSONNEL = base.map(function (slotDef, i) {
      var who = base[order[i]], num = rolled[order[i]];
      return { badge: slotDef.badge, post: slotDef.post,
               name: who.name, plate: num.plate, kids: num.kids, face: who.badge };
    });

    /* THE DOOR CODE. Four digits, and every one of them is a position on a
       ring of ten symbols — so any four work and none of them touches the
       floor. Benjamin still cannot read it off anything: the ring is printed
       in his dossier and the code is not. */
    if (job.PORTE) {
      var porte = copyOf(job.PORTE);
      if (seed) porte.code = rollCode(rnd);
      L.content.PORTE = porte;
    }

    /* THE SAFE. Rolled whole — serial, colour, combination and the five decoy
       rows that make Benjamin read both halves. See rollCoffre(). */
    if (job.COFFRE && seed) L.content.COFFRE = rollCoffre(job, rnd);

    /* THE RELEASE CODE, derived at every seed rather than authored at one.
       It used to be a badge reversed, which could not move because badges
       cannot move — so the one code in the game that is meant to be looked up
       was the same every night. It is the PLATE of the officer posted to the
       hatch's zone now, and plates travel with people. */
    if (job.CLAVIER) {
      var clav = copyOf(job.CLAVIER);
      var posted = L.content.PERSONNEL.filter(function (x) { return x.post === clav.zone; })[0];
      if (posted && posted.plate) {
        clav.code = posted.plate.split('').reverse().join('');
        clav.worn = distinct(clav.code);
      }
      L.content.CLAVIER = clav;
      /* Procedures report the vehicle plate as written. The keypad code is
         that plate reversed, so Benjamin must still reverse it to get the PIN. */
      if (job.PROCEDURES) L.content.PROCEDURES = job.PROCEDURES.map(function (r) {
        return r.k === 'RELEASE CODE' ? { k: r.k, v: r.v + ' ' + (posted ? posted.plate : '') } : r;
      });
    }

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
    LINES: LINES, TOPICS: TOPICS, FIRST_BEAM_TUTORIAL: FIRST_BEAM_TUTORIAL,
    FIRST_BEAM_TUTORIAL_CLUES: FIRST_BEAM_TUTORIAL_CLUES,
    RANKS: RANKS, ALERT: ALERT, PRESSURE: PRESSURE, ALARM: ALARM,
    AMBIENT: AMBIENT, STATIC_LINES: STATIC_LINES
  };
  loadJob(0);
})(window.DC);
