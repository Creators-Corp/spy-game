# DEUX COMPLICES — playable prototype

**One TV. Two phones. One heist.** All three faked on one screen, so a room can watch the whole conversation at once.

> **Confidential.** This build is held under an NDA. The published site serves
> only ciphertext behind a passphrase — see **[HOSTING.md](HOSTING.md)** before
> putting it anywhere. This repository was started with no history for the same
> reason; do not import the earlier one.

Open `index.html` in a browser. No build, no install, no server, no network.

If you would rather serve it — or if anything looks stale while you are editing — run `python serve.py` and open **http://127.0.0.1:8080/index.html**. Always that address. It sends no-cache headers, so a plain reload always picks up your edits; the plain `http.server` module does not, which turns a stale file into a bug hunt.

Typography is **Jost** (a geometric sans in the Futura lineage — the shape the ligne claire palette wants) with **IBM Plex Mono** on the serials, codes and clock. Both are SIL Open Font Licence and both are **embedded in `styles/fonts.css` as base64**, so it looks identical on any machine: no network, and no need for Futura or Century Gothic to be installed. That is why they are embedded rather than linked — font loading over `file://` is inconsistent between browsers, and a demo that quietly falls back to Segoe UI on a client's laptop is the failure this prevents. It costs a 210 KB stylesheet nobody has to read.

---

## WHAT THIS IS

A complete, playable job — the whole filmstrip from slide 04 of the deck, end to end, including Le Twist:

**LE PLAN → [LE DÉGUISEMENT] → L'INFILTRATION → LE BUREAU → [L'ÉCOUTE] → [LE FAUX] → LE COFFRE → LE BLACKOUT → LE CLAVIER → LA SORTIE**, with **LA TCHATCHE** if you get caught and the **jail slam** if you fumble that.

**Two contracts, and all six modules from the library are built.** Benjamin picks the job on his phone during Le Plan — he holds the dossier, so choosing the night's work is his.

- **CONTRAT No.1 — LA CHAMBRE 302**, a residence, third floor. A ring job: a sealed chamber with a door at each end, a corridor that goes all the way round it, and guards who never stop walking. The tension is choosing which way round.
- **CONTRAT No.2 — LA VEILLE DE VENTE**, an auction house the night before the sale. Three floors, each behind a door and each worse than the last. The vault is released from the desk beside it, both are under cameras, and the way out is not drawn anywhere.

They are not reskins. Different map, different shape, different patrol grammar, different roster, and six different module payloads. `js/content.js` is a job library and `loadJob()` swaps the data underneath the engine — **not one line of code anywhere knows a venue.** That is the deck's "modules are grammars, not levels" claim made literal rather than asserted.
 The three in brackets are **optional** — you can walk straight past all of them. That is the difficulty dial, and it is the one from the design doc: *same content, chosen risk*. A lean pair grabs the manuscript and leaves; a greedy pair takes the cloakroom, the wiretap and the canvas as well. Measured, the greedy route costs almost nothing in extra moves — the disguise and the cut camera pay their own detours back — but it keeps two people in the building longer, talking, with more chances to be seen. Both land around **6–8 minutes**.

Two people, one keyboard-and-mouse, two halves of the truth.

The three panes are laid out exactly as sketched: TV centre-top, P1 left, P2 right. The whole thing is a fixed 1680×1000 canvas scaled to fit whatever screen it lands on, so the layout cannot break in the room.

---

## HOW TO DEMO IT (read this bit before Friday)

Sit two people down. **Player 1 drives the left phone, Player 2 drives the right phone.** They must not look at each other's screens — that is the entire game. The TV in the middle is safe for everyone, including anyone on the couch who is not playing.

Then just let them talk. Nothing on either phone tells a player what the other one needs; they have to ask.

**The job, in order:**

1. **Le Plan.** Both players tap PRÊT. Roles lock, the clock starts.
2. **L'Infiltration.** P1 has a d-pad and a feeling. P2 has the whole floor plan with patrol cones and camera cycles. P2 calls the route: *"Two right. Stop. Now up."*
3. **Le Déguisement** — *optional*, the far corner of the vestibule. The staff cloakroom. P1 can see **what is on the rack** — three heads, three tops, three pairs of legs — and nothing about who owns any of it. P2 can see **whose uniform is whose and who is posted where**, and nothing about what is actually hanging there. Exactly **two of the six uniforms can be built from this rack**, and only one of those is posted to La Réserve, which is where they are going.
   - Skipping it is allowed and costs you: **out of uniform every guard's cone reaches one tile further, for the whole job.** Solving it doesn't make the building easier than normal — it stops you making it harder.
   - Best cheap demo beat in the game: P2 is looking at his floor plan when Assane changes, and **watches every cone on the map shrink**. Measured: 27 watched tiles → 21.
4. **Le Bureau** (the desk, top right of the map). P1 reads what is on the desk out loud — a badge number, a photo of two daughters of clearly different ages, a note with a cake on it. P2 digs the PERSONNEL tab, works out which daughter and what year, and reads it back. P1 types it. Then the computer offers four door marks and only P2's floor plan says which one is La Réserve.
5. **L'Écoute** — *optional*, two tiles from the security desk, so it is barely a detour. P1 taps the line and it repeats five pulses, short and long. **Only P1 can hear it. Only P2 has the code book — and the book cannot be browsed, only queried**, so Benjamin has to reproduce the rhythm on a soundboard before it will tell him anything. It answers with a circuit number, P1 cuts that circuit, and a camera dies for the rest of the job.
   - Two of the six book entries are one pulse apart. Relay a single pulse wrong and the book hands back a circuit that is real, plausible and wrong.
   - **Reward, measured:** cutting the right circuit takes the safe tile from **60 of 80 turns watched to 0**. P2 sees the cone vanish off his plan.
   - **Accessibility is a rule here, not a nicety.** Every pulse has a synchronised visual, the pattern stays on screen after playback, and replays are unlimited. The module is fully playable with the sound off. Nothing in this game is ever carried by sound alone.
   - **And the trap it invites:** P2 taps a **sequence, never a tempo**. There is no timing window anywhere in it. Asking Benjamin to tap in rhythm would have turned the one module built on audio into the one module with a dexterity check, and design law #2 has no exceptions.
6. **Le Faux** — *optional*, next to the safe. Two canvases, one crate, one decision, **no retry**. P1 has the paintings; P2 has Benjamin's authentication notes. The notes are ordered so a pair who stops reading after the first one can still get it wrong — note 1 is true of *both* canvases and settles nothing. Take the right one and it goes on the rank card as loot. Take the wrong one and you have carried a forgery out of the building; you find out at the end.
7. **Le Coffre** (the safe, top left — the door P1 just released). P1 has a dial of symbols nobody has ever named, plus a plate number and the colour of the ring. P2's MANUEL is indexed by **both**, and several entries share a serial. P2 has to describe four symbols out loud, in order. *"A swirly circle. A backwards Z."*
8. **Le Blackout** — *the twist*, **on contract two**. The instant the safe opens, the building cuts the power. The TV holds on the cut for a beat and then comes back near-black. Contract one keeps its lights on and merely kills the monitors: it is somebody's first ten minutes with two phones and a television, and taking all three away is not an opening. A contract opts in by carrying a `BLACKOUT` block and a `CLAVIER`, and opts out by marking its prize `dark`.
   - **Nothing happens to P1's phone.** Same readout, same d-pad, same sense line. What he loses is the television, which now shows three squares in every direction and is exactly what a man walking a dark building would notice. His phone is the last instrument he has; taking it away leaves him pressing arrows at a wall.
   - **P2 is the one who loses his picture, and he loses all of it.** The van drops the floor completely — no plan, no patrols, no gold dot, just snow — for **one or two of Assane's moves**, then holds it for **four to six** before it can go again. About **five dropouts** on the walk out, **seven turns blind** in total, each one an event rather than weather.
   - **That is the design correction that matters.** The first cut of this cut the building into five camera zones and lit two a turn. It measured fine and played as fog: three fifths of the floor missing at any moment, Benjamin blind more often than not, and *"I've lost you"* demoted from a thing that happens to you into the ambient condition. A dropout has to be an **event** — his screen goes to snow mid-sentence and Assane hears the voice stop.
   - **Nobody sees past arm's length, guards included.** The cameras are gone entirely and every cone collapses to the eight squares around the man. Verified from **all 48** guard phases the safe could open on — the walk from the vault to the hatch exists every time, in 23–29 turns, holding still at most 6 of them.
   - **The dropouts are drawn from the run's own seed** and decide only what Benjamin can *see*. They never move a guard or catch anybody, so no route is opened or closed by them, and a pinned roster replays the same night.
9. **Le Clavier.** The way out locked itself when the power went. P1 sees a keypad with **three keys worn smooth** — he can see *which* three, never the order. The order lives in two different tabs of P2's dossier: **MANUEL** says emergency codes are the posted officer's badge reversed, and **PERSONNEL** says who is posted to the gallery the hatch is in. P1 can check P2's answer against the wear before he types it. **This is the beat where the information flow reverses** — and neither of them can get there alone.
10. **La Sortie.** The door opens onto the street. Grade — plus a **BUTIN** line saying what actually left with you.

**If P1 gets spotted, that is not a loss.** It is **La Tchatche**: P1 describes the guard's face, P2 finds him in VISAGES, reads the crack, and tells P1 which of three lines to use. Three exchanges. Two mistakes ends the job — and losing takes five seconds and gets a laugh.

**The single best 20 seconds to show a room:** the first dropout. Benjamin is mid-sentence — *"right two, then up"* — and his screen goes to snow. He has nothing. Assane is standing in a dark room he cannot see three squares of, holding a manuscript, waiting. *"I've lost you. Don't move. Don't move."* Two moves later it comes back. That exchange is the whole pitch, out loud, in one breath.

If you want a second one, the camera gate before the blackout also lands: camera 1 covers the corridor mouth 1-on-1-off, camera 2 covers the safe 3-on-1-off. P2 can see the cycle; P1 cannot.

**LOOP A CAMERA does not ask which.** It takes the box nearest Assane, and Benjamin's phone names that box on the button before he pulls. Choosing used to be a sub-panel and a second tap, and the answer was never in doubt — the map in front of him already said which lens he was walking into. The decision the lever is actually for is whether to spend one of a very small number of them, and when.

---

## WHAT TO TELL THEM IT PROVES

- **The TV keeps no secrets.** It draws only what Assane can actually perceive — fog of war, guards visible only when he can see them, cones never. So P2 reading the shared screen learns nothing, and the asymmetry survives being in one room. This is the design law that makes the whole thing work, and you can point at it live.
- **Every input is an answer.** There is not one skill check anywhere: no swipe, no timing window, no gesture. Every tap is a conclusion two people reached out loud. When a job goes wrong the couch blames the plan, never the phone.
- **Guards move when you move.** Nothing happens between inputs — which is the engineering sentence for the room. This shape of game cannot stutter on a stream.
- **Modules are data, not levels — and here are two jobs proving it.** The safe, the desk, the keypad, the roster, the uniforms, the canvases, the line codes and the six guard faces are all content in `js/content.js`. Le Bureau is the clearest demonstration: on job 1 the note on the desk is a cake and the code is the eldest child's birth year; on job 2 it is a car and the code is the officer's registration. Same module, same screen, a different question — no new code. The faces, the uniforms and the paintings are **drawn from feature data**, not from art files — so those modules are playable before a single asset exists, and one module can hold an endless roster.
- **Difficulty is self-selected through greed, not a menu.** Two modules are optional and both are worth real things. Same content, chosen risk — and the letter grade stays purely about stealth while greed is scored on its own line.
- **The twist is the same game, inverted.** Le Blackout adds no new map, no new art pipeline and no new rules engine — it reuses the same tiles, the same patrols and the same turn loop, and just moves who can see what. That is the argument for it being the cheapest sequence in the game and the highest tension per dollar.
- **Nothing to translate inside a puzzle.** The safe runs on symbols, the desk on numerals, the faces on features. A French P1 and an English P2 can run this job together right now.

---

## HOW IT WAS TUNED (so you can answer "is it actually beatable?")

Not by feel. A solver was run over the live board — every guard phase, every camera phase, all 80 world states:

| | |
|---|---|
Every leg was checked from all 80 phases, in both disguise states, with and without each optional module. **No dead states anywhere** — there is no phase from which any leg is impossible.

| route | moves | suspicion | rank |
|---|---|---|---|
| **lean** — manuscript only, no optionals | 46 | 14 | A · OMBRE |
| **everything**, shortest-path routing | 45 | 17 | A · OMBRE |
| **everything**, lowest-suspicion routing | 46 | 10 | **S · FANTÔME** |

Worth reading twice: taking all three optional modules costs roughly **nothing in moves**, because the disguise and the cut camera pay their own detours back. What it costs is *turns spent in the building* and therefore chances to be seen — a solver never gets spotted, two people talking will. Greed buys a better card and more rope to hang yourself with.

Per-leg, from all 80 phases:

| leg | result |
|---|---|
| entry → cloakroom, undisguised | 3–4 moves |
| cloakroom → desk, disguised | 7–12 moves |
| entry → desk, **skipping** the disguise | 10–23 moves |
| desk → canvas → safe, disguised | 19–31 moves |
| desk → safe, **skipping** the canvas | 14–25 moves |
| safe → exit in the blackout, disguised | 9–24 moves |
| safe → exit in the blackout, **undisguised** | 9–**54** moves |
| the wiretap, two tiles off the desk route | 2 moves |
| the canvas, routed *around* the safe so it does not trip early | 4 moves |

That last pair is the disguise justifying itself: skipping it more than doubles the worst-case escape. Theoretical minimum suspicion is **10** on both the lean and the greedy route, so the **S ≤ 12** threshold sits just above a perfect run either way.

The blackout is **beatable without holding still at all** on most phases, and never needs more than six waits on any of the 48 — see the twist above.

Two bugs the solver caught earlier, both the same shape: the cloakroom was first placed on a tile watched **56 of 80 turns** (moved to one watched 5), and the disguise penalty had quietly made the **exit tile** dangerous.

**Job 2 was built almost entirely by solver, and it failed three times before it worked.** Worth reading, because all three are level-design mistakes that look completely fine on paper:

1. **A one-lane ring corridor.** A guard's cone fills a single-file corridor completely — there is no sideways. The blackout escape came back *unreachable from all 36 world phases*. Fixed by making the ring two lanes everywhere.
2. **A chamber too small to patrol.** At 7×2 with a guard walking it, the whole room was watched at once and the lean route had **no solution at all**. Fixed by making the chamber three rows and taking the guard out of it — a sealed room is guarded by its door and a camera, not by a man pacing a box he cannot help but fill.
3. **One door.** With a single entrance, the one tile in front of it is a chokepoint the door guard can seal outright; the lean route went unreachable again. Fixed by giving the chamber a door at each end on the same release circuit — so it is still one deduction to open, but a choice to reach. Which is also the better version of the ring's own idea.

A fourth guard was tried for grade discrimination and reverted: it made the lean route unreachable from 14 of 80 phases. **A roaming cone can seal a corridor; a fixed camera on a cycle only ever poses a timing question.** Pressure on job 2 comes from cameras for exactly that reason.

**Job 2 was then tightened, and what it took is worth knowing.** The west wing was narrowed to a single lane — so the ring is now asymmetric, a short dangerous side and a long safer one — and the security desk was moved to the far end of the ring so even the lean route has to travel and pick a side. A hurried greedy pair now lands at **A** where it used to walk away with S.

Three things were measured and rejected on the way, all of them the obvious move:

| tried | result |
|---|---|
| deepen the pacers' cones | suspicion floor moved **not at all** — an optimal route just avoids them |
| deepen the ring patrol's cone | stranded the greedy route mid-job; the undisguised penalty stacks on it and seals a corridor |
| desk in the corner diagonally opposite | **unreachable without a uniform at any cone depth** — the north route is simply sealed to a man who looks wrong |

The finding underneath all three: **a ring resists tuning.** Job 1's dead-end corridor concentrates pressure, so turning a knob there is felt. A ring always offers the other way round, so pressure applied in one place is routed around and pressure applied everywhere seals the map. Tighten job 2 by changing its *shape*, not its numbers — and change one thing at a time, because three tightenings at once was one too many and broke it.

It is still the more forgiving of the two, and a careful pair can take everything on it and score S. That is a fair thing for a second contract to be.

The rank thresholds are set just above the measured perfect run, so **S is very nearly the perfect run** and a pair has to route well *and* not fumble a module. If you retune guards, cones, torch depth or the map, **re-measure** — the numbers move fast. Tuning by feel put S out of reach entirely on the first pass.

---

## THE COLD READ (why the screens explain themselves now)

Every screen was re-read as somebody who has never played a game — the actual
audience, two people on a sofa who opened this instead of a film. The test was
not "is it clear to me", it was "can a first-time player say out loud what this
symbol is and what they are supposed to do with it". Four screens failed.

| screen | what it said | what a first-timer saw |
|---|---|---|
| P1 infiltration | a "WITHIN REACH" four-dot diagram | an abstract map that needed a key it did not have |
| P2 plan | a three-item legend for six symbols, first entry `ASSANE / OBJECTIVE` | the player and his target on one line, in one colour — no way to tell which gold mark was the man |
| P1 Le Coffre | *"read him the plate and the colour of the ring"* | no word "plate" anywhere on screen, and a colour with no name |
| P1 La Tchatche | *"Describe him"* — then three sentences about football | describe him **to whom**, and what are the buttons for |
| P2 Les Visages | three facts in three silent styles | nothing said the gold one was the thing to read out loud |

The fixes are all the same move: **put the noun on the screen, and say the verb.**
The d-pad greys out walls instead of drawing a diagram of them. The plan carries a
six-row key, each symbol drawn exactly as the map draws it, each with a sentence.
Le Coffre captions its two lookup keys and names the ring colour in words —
*amber* and *camel* are both tan, and Benjamin's book lists the same serial three
times, so a colour the players cannot **say** is a colour they cannot use. Both
two-step screens now number their steps.

**What was deliberately left alone: the dial symbols still have no names.**
Inventing "the backwards Z" together is the reason the module is a conversation
and not a lookup, it needs no translation, and it is the one puzzle in the build
that is pure two-player. Naming them would have removed the game. Naming the
*colours* removed an argument. Those are different things — and if the client
wants the glyphs labelled anyway, it is one table in `glyphs.js`.

Two mechanical changes came out of the same pass:

- **Le Coffre has an undo.** A mis-tap used to complete a wrong four: +15
  suspicion, and the second one puts a guard at the door. That is a dexterity
  penalty in a build whose second design law is that every input is an answer
  and never a feat of dexterity. Undo sits in the footer, which never scrolls.
- **La Tchatche reports each exchange.** It used to change silently, so a pair
  could win twice and not know it. Now it says whether the line landed.

Both fixes added height to screens that had none to spare, so both were then
measured: on a phone pane La Tchatche's three answer lines had been pushed
**entirely below the fold**, and Le Coffre's entry slots — the only feedback a
tap produces — with them. Portrait moved beside the text, count and strikes onto
one line, the entry slots numbered 1-4 to match the numbered figures in
Benjamin's manual instead of captioned in a sentence. Both screens now fit.

### The one that mattered most: the two maps did not line up

The question that found it was *"the first image is my position on the map? and
how do I relate that to the one from P2?"* — and the honest answer was that the
television gave you no way to.

The television draws only what Assane perceives, so the explored fragment sat in
an empty black field. It was always at its **true** position — the vestibule is
bottom-centre on the television and bottom-centre on Benjamin's plan — but a
black field looks identical wherever the fragment is, so the registration was
invisible. The only link between the two screens was the room name, and that was
printed at a fixed screen corner, outside the map group, as far from the man it
described as the frame allows. It read as a title for the television.

Three anchors now, in increasing order of how much they give away:

1. **The room name rides with Assane**, on the floor beside him, and carries his
   square: `VESTIBULE · G9`. Benjamin's plan prints the same sentence above his
   map. Same two words on both screens, at the same moment.
2. **Both maps are ruled the same way** — letters across, numbers down, counted
   from the outer wall. A square has one name in the room and on the plan, so a
   callout is *"go to J6"* and not *"by the doorway — no, the other doorway"*.
3. **The building's footprint is drawn faint on the television.** This is the one
   thing on that screen Assane has not walked, and the only deliberate crack in
   "the television keeps no secrets": it gives away the outside dimensions of a
   building he is standing inside, and nothing else — no rooms, no walls, no
   guards, no contents. It is what makes the two pictures click by eye rather
   than by reading. If it ever feels like too much, it is one `shell` string in
   `tv.js` and the other two anchors stand on their own.

**None of it appears in the blackout.** Not knowing which room he is in is the
entire point of that sequence, so the label and the coordinate go dark with the
lights and Benjamin's feeds become the only anchor — which is the module.

Verified across every legal square on both contracts: the label never leaves the
footprint, and the two screens never disagree.

**Do this again before the pitch, with a person.** Sit somebody down who has not
seen it and watch where they stall — that is the only instrument that finds this
class of problem, and it found every one of the five above.

---

## TWO CONTRACTS

The first two — LA VENTE DE NUIT and LA COLLECTION PRIVÉE — are gone. They were
the ones that taught the shape, and everything they proved is proved better by
the two that replaced them; a picker with four entries also made the demo open
with a choice nobody yet had the information to make. LA CHAMBRE 302 is now
No.1 and LA VEILLE DE VENTE is No.2, and the four tables the veille used to
borrow from the old No.1 (the rack, the uniforms, the faces, the gossip) now sit
in the veille itself.

**LA GRILLE goes both ways now.** It is the first thing that happens and its
whole job is to prove that the other phone holds the missing half — so it had
better take two sentences rather than one. Assane has a padlock with a symbol
on its tag and three keys on a ring; Benjamin's card pairs each symbol with a
key. Nothing is numbered and nothing is written: the keys are *drawn*, on both
phones. So Assane describes the symbol, Benjamin finds the row and describes the
key, and Assane picks the one that matches. It used to be Benjamin reading out
"key 2" and Assane pressing the button marked 2, which is a lookup with a
courier rather than a conversation.

---

## A BEAM IS NOT A WALL

You can walk through a laser. What you cannot do is walk through one quietly:
break a beam and every guard in the building leaves his round and comes
straight at you for five moves, one square a turn, then walks back to the
square he left and picks his round up from exactly where it stopped.

It used to be a wall until Benjamin dropped it, which made his CUT THE LASERS a
key — no lever, no way through, no decision. Now the lever buys the same
crossing *without the building hearing it*, and going through loud is always
available and always expensive: twelve suspicion at the beam, and then the
chase is the rest of the price. On a bad turn it is still the right call, which
is the whole point.

The chase is distance and nothing else. Guards move one square a turn, the same
as Assane, so a man six squares away never reaches him in five and a man two
squares away does — and a man behind a locked door does not come at all. He
stops on the doorstep rather than on Assane's square, because `cone()` is a
man's reach and excludes the tile he stands on; a guard who walked onto him
would be the only guard in the game who could not see him.

Neither player can see the whole of it. Assane's phone tells him the bell is
ringing and how many moves are left; the television goes to full tension and
prints `ALARME · n`; and Benjamin — the only one who can see all of them at
once — gets a red banner and guards drawn off their lines on his plan. Calling
the way out is his.

`tools/route.js` treats a live beam as a wall even though the engine does not.
An alarm takes every guard off his round, which is the assumption the whole
model rests on, so a route that trips one cannot be reasoned about there: what
the solver prints is always a way through that nobody hears.

---

## THE ROOM, SINCE THE ART LANDED

The television draws the floor in the artist's tile set now — parquet, panelled
walls, real doors, drawn characters — through the same renderer the bench uses
(`js/tiles.js`, documented in `TILES.md`). It asks for Assane's view, and the
fog of war, "guards only where he can see them" and "no sightlines, ever" are
enforced **inside** that renderer rather than trusted to the caller, so design
law #1 survives the change of medium.

**Benjamin's plan did not change, and it is still the logical map.** One grid in
`content.js`, read by both screens with the same coordinate function, so `H17`
is one square on the television and on the dossier. Nothing is projected between
them.

Three things followed from putting real art on that screen:

- **The camera sits close.** The window is eight tiles tall and as wide as the
  television's shape allows, and it pans to follow him — the board is drawn once
  and moved under a window by a transform, because a transform is the one thing
  that can be transitioned. A step slides; opening the room or loading a
  contract cuts.
- **Vision is true line of sight**, by recursive shadowcasting. Step into a
  corridor and you see the whole length of it; you see nothing at all round
  either corner, and a doorway opens a widening wedge as he walks up to it. What
  it replaced was a three-square flood along walkable squares, which saw round
  corners because the flood simply turned, and could not see down a hall because
  four squares away was four squares away whether there was a wall in the way or
  not. Both are backwards for a stealth floor. A live laser does not block sight
  — you can see across a beam even though you cannot walk through one. In the
  blackout it collapses back to three squares, because not being able to see is
  the whole sequence.
- **The two red vignettes were pulled apart.** The building's suspicion pulses
  on the television, where the room is watching; the pressure clock pulses on
  Assane's phone, where the person standing still is already looking. They used
  to be the same overlay, with stillness adding a level to alert, and neither
  cue could be told from the other.

**One screen, two private phones.** The chrome carries a `P1 ASSANE` /
`P2 BENJAMIN` switch and a `BOTH PHONES` button. Blocking is real and not a
label: the blocked screen is blurred past reading, sealed against the pointer,
and Assane's arrow keys go dead while his phone is the blocked one. `BOTH PHONES`
is the default, because that is how the prototype has always been walked through.

---

## THE ROSTER CHANGES EVERY RUN — THE BUILDING DOES NOT

**Where every guard stands is authored, and stays authored.** The beats were
measured — the one that stops two squares short of each wall so the corner is
not a trap, the ring that never reverses so "he is gone for eleven" is a
sentence Benjamin can say and be right about — and every dead-state scan, every
route and the walkthrough are written against the roster as written. An earlier
build shuffled the starting positions per run. It should not have: it voided
all of that on both contracts at once, and it made a rehearsed demo impossible,
because RESTART dealt a different building every time.

**What varies is who is on shift.** Same badges, same posts, same beats — a
different name, a different car and different children behind each one. So the
floor is identical every run and the *interview* is not, which is the half of
this game that is about reading a file rather than walking a corridor. LE
BUREAU asks for the eldest child's birth year of badge 1184; who that badge
belongs to, and therefore the answer, is dealt fresh each time. The desk slot
is the one with a requirement — the file has to list at least two children born
in different years, or the question stops being a question — and the deal is
redone until it does.

Seed 0 is the roster as written, the one the content comments describe. The
number is on the plan screen, and the **ROSTER** control beside RESTART pins
one: type it, press PIN, and every restart and every change of contract deals
the same people. NEW goes back to a fresh shift each time. `?seed=1234` in the
URL arrives already pinned, so a link still works.

**Every roster is winnable, and cleanly.** `tools/route.js` solves a contract by
modelling the world as what it is — periodic in the turn count, 48 on both
contracts — and then *replaying its own answer through the real engine*, so the
grade it reports is the one the rank card gives. Rosters are solved in batches
after every change to a patrol; none has failed, and every one has a route that
finishes **S**.

```bash
fetch('tools/route.js').then(r=>r.text()).then(eval)
```

then `DC.route.script(DC.route.solve({ job: 1, mode: 'quiet' }))` for a route,
or `DC.route.audit(20, 1)` to re-run the check after touching a patrol.

**`WALKTHROUGH.md`** is a rehearsed S on contract two, verified end to end and
good for every run: thirty-four steps, the three module answers, and the one
moment neither player can get past alone.

### A guard is three rows tall and contract two's galleries were two

`cone()` gives every man the three tiles across his own line — see `TILES.md`
5b — so a patrol standing anywhere in a two-row corridor covers the whole
height of it and cannot be walked past. He is a moving plug, and the only answer to a plug is to wait.
Both of contract two's galleries had one, on the rows carrying the doors — so
every north-south crossing had a plug sliding across it, the two legs that
cross the building averaged 81 turns against a walking distance of 46, and a
solved route opened with twenty-one taps of HOLD STILL.

Two changes, and the same three men: the upper guard walks row 7 instead of the
door row, and the ring guard walks the east stair instead of lapping the whole
floor — a ring is a lovely shape, but here it traversed *both* long rows and
plugged the gallery twice a lap. 81 turns became 68. Nobody was removed and
nothing was made shallower; `content.js` says how to put the ring back.

About forty turns of contract two are still spent letting somebody go past.
That is the floor of two galleries, two aisles and three patrols, and no
reshuffling of beats gets under it — posting a guard on a short beat instead
makes it worse, because a patrol that never walks away seals the corridor
outright.

---

## ART

Every image is a **named placeholder slot**. Until a file exists it draws itself as a labelled dashed box, so the layout is already final and the art is genuinely drop-in — no code changes.

**`art/ART_PROMPTS.md` holds every prompt** — eleven single images plus the twelve guard portraits from one template — point an agent at it, or paste the blocks by hand, in strict ligne claire (Tintin / Franco-Belgian album tradition) as the client asked. Style, palette, likeness rules and negatives are baked into each block — copy a whole block, never assemble one from parts. Drop the PNGs into `art/` with the exact filenames and reload.

The **SLOTS** button bottom-left hides the placeholder labels for a clean screenshot.

Likeness rules are already enforced in the prompts: **Omar Sy is cleared** and Assane appears in full flattering likeness; **Antoine Gouy is not cleared**, so Benjamin is on-model but his face is always obscured; the detective is a featureless silhouette.

---

## CONTROLS

| | |
|---|---|
| P1 movement | the d-pad, or arrow keys / WASD |
| P1 hold still | **ATTENDRE**, or spacebar — holding still is a real move and you will need it |
| P1 in the dark | nothing changes — same phone, same d-pad. It is P2's screen that drops |
| P2 | the four dossier tabs; nothing ever switches them for you |
| RECOMMENCER | restart the job |
| SON | mute — every audio cue has a visual twin, so the whole thing is playable muted |
| SLOTS | hide placeholder labels for screenshots |

---

## THE FILES

```
index.html          the three-pane frame
styles/
  fonts.css         Jost + IBM Plex Mono, embedded as base64 (SIL OFL)
  app.css           design tokens, the stage, art slots
  tv.css            the TV
  phone.css         both phones
js/
  util.js           DOM helpers, art slots, event bus, audio
  glyphs.js         the abstract symbol set (deliberately unnameable)
  figures.js        uniforms and canvases, drawn from feature data
  content.js        THE JOB LIBRARY — two contracts plus the shared vocabulary.
                    Add a third by adding an object and one line to JOBS.
  engine.js         rules. Turn loop, vision cones, spotting, scoring. Touches no DOM.
  tv.js  p1.js  p2.js   the three views
  main.js           boot, scaling, the clock
art/
  ART_PROMPTS.md    the eleven prompts
```

`content.js` is where a second job would live — swap it and the same code runs a different heist.

`engine.js` never touches the DOM and the three views never talk to each other; they only read state and emit intent. Splitting this across real devices later is a transport swap, not a rewrite.

---

## WHAT THIS PROTOTYPE DOES NOT DO

Worth saying out loud so nobody is surprised in the room:

- **No networking.** Three panes on one screen, by design, for this pass.
- **One authored job.** The modules are data-driven, but only one job is written.
- **Two jobs, not eight.** The library holds two contracts; the retention story in the deck wants one per episode.
- **All six modules are built** — Le Coffre, Le Bureau, Le Blackout, Le Déguisement, Le Faux and L'Écoute, plus Le Clavier (the keypad beat inside the blackout). Nothing from the module library is missing.
- **Solo and 3–4 player modes are not built.** Duo only.
- **Nothing.** All twenty-three art slots are filled. The guard portraits still fall back to a code-drawn face if a file goes missing, so La Tchatche cannot break. Everything else — `venue-particulier` (contract No.2's establishing shot) and `coffre-door` (the safe door behind the dial). Both have prompts; both render as labelled placeholders until they land.
