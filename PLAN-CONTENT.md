# Gyro Rocket: content plan, worlds 7–10

The six worlds in `PLAN.md` teach the game: each brings in one new thing, and by
the end of 6-8 the player has met everything. This plan adds four more worlds of
eight levels each, 32 levels in all, and none of them brings in anything new. They
put what's there together: big levels where fire, machines, keys, darkness and
falling rock meet, and the player has to use everything they learned.

This plan stands on its own. It needs phases 0–8 of `PLAN.md` (all done) and nothing
else. It changes no sim code, so it doesn't depend on phase 9 or on
`PLAN-EDITOR.md`'s phases E3–E6, and they don't depend on it. It can go before, after
or in between them.

## Core decisions

- **Nothing new, everything together.** No new hazards, no new settings, no sim
  changes. The player has learned the whole game by 6-8, and what's left to give
  them is harder combinations of it. Keeping `src/sim/` still also keeps content off
  the replay work: existing levels' hashes and golden replays (E3) don't move, and
  `SIM_VERSION` never has to go up for a level. The only code this plan touches is
  the autopilot, the level tests, the levels page and the ending.
- **Each world has a job.** Every new world mixes many elements, but leans on a few
  and tests one skill: world 7 tests timing, world 8 finding the way, world 9
  reactions, under pressure, and world 10 all of it, with the quickest reactions
  in the game. That keeps four worlds of "everything" from feeling the same.
- **A big level is a chain of sections.** A section is one set piece, 20–45 s of
  flying (10–25 s in worlds 9 and 10, which are denser), built around two or three
  elements together (flame jets across a fan column; turrets covering a timed
  gate). Sections are joined by quieter stretches, and there's a fuel pad before
  every hard section. Dying costs one section, never the whole level. Each level
  file's header comment lists its sections in order, which serves as the level's
  plan and helps anyone tuning it later.
- **Worlds 9 and 10 get harder by reaction.** Worlds 7 and 8 turned out to test
  dexterity: flying a clean line on a beat you can learn. Worlds 9 and 10 pack
  things closer, tighten the timing, and lean on hazards that go off because of
  you, so you have to see and react, not just remember. How, with targets to
  measure against, is in *Harder by reaction* below.
- **Bigger levels, closer pads.** The levels are two to four times the size of the
  world 6 levels, but no leg between pads is longer than 45 s of the autopilot's
  flying (a player does it faster). A four-minute level has six to ten pads.
  Length makes a level harder by asking you to stay good for longer, not by making
  you repeat more.
- **Big, but within the editor's limits.** At most 200×150 tiles and 48 KB, like
  a shared level (`PLAN-EDITOR.md`, *The level file*). Every new level then opens
  in the editor as "Copy of a built-in level", passes `validate.js`, and can be
  seeded for top scores in E6 like the others. A map can name at most 50 things
  (the digits, and the letters that don't mean something else), fewer than the
  editor's limit of 60, so flamethrowers and stalactites keep their plain letters
  where the default settings do, and copies of a thing with the same settings share
  its character.
- **Fix the autopilot, not the level.** Every level must still be finished by the
  autopilot within its tank (`test/levels.test.js`). Combinations will beat it: a
  turret shooting it while it waits for a flame to pause, a magnet pulling it
  towards a crusher. When that happens and a person can still fly the section
  fairly, the autopilot gets better (`src/autopilot.js` isn't the sim, so replays
  don't care). The level changes only when it's unfair to people too.
- **The game goes on after the escape.** World 7 unlocks when 6-8 is finished, like
  any next level. 6-8 still ends with "you made it out", and it's the end of part
  one: the levels page puts a heading, *Part two*, above world 7. Part two ends on
  10-8, which gets the game's real ending.

## Worlds 7–10

| World | Name       | Tests           | Size (tiles)     | Sections | Par      | Tank vs route | Narrowest gap |
| ----- | ---------- | --------------- | ---------------- | -------- | -------- | ------------- | ------------- |
| 7     | Foundry    | timing          | 140–200 × 60–100 | 4–8      | 1½–4 min | 1.3×          | 8 m           |
| 8     | The Vaults | finding the way | 160–200 × 80–120 | 5–9      | 2–4½ min | 1.3×          | 8 m           |
| 9     | Fault line | reactions       | 100–160 × 100–150 | 5–9     | 2–4½ min | 1.25×         | 7 m           |
| 10    | The Heart  | everything, fast | up to 200 × 150 | 6–10     | 2½–5 min | 1.2×          | 7 m           |

As in `PLAN.md`, these are starting points to tune by playing. "Tank vs route" is
the tank against the fuel the autopilot burns on the longest leg between pads, and
"Par" is the autopilot's time rounded up to 5 s. Gaps get no narrower than in world
6: tilt isn't precise enough for less, and these worlds get harder by combining
elements, by length and, in worlds 9 and 10, by density and timing, not by
squeezing.

What each world uses (**lead**: in most levels, the world's character; *some*: in a
few levels; few: once or twice; —: not at all):

| Element                   | 7 Foundry | 8 Vaults  | 9 Fault line | 10 Heart |
| ------------------------- | --------- | --------- | ------------ | -------- |
| Keys and doors            | *some*    | **lead**  | *some*       | **lead** |
| Switches, timed gates     | *some*    | **lead**  | *some*       | *some*   |
| Flamethrowers             | **lead**  | *some*    | *some*       | **lead** |
| Lava and blobs            | **lead**  | few       | **lead**     | *some*   |
| Fans                      | **lead**  | few       | **lead**     | *some*   |
| Magnets                   | *some*    | *some*    | few          | *some*   |
| Moving blocks             | **lead**  | *some*    | *some*       | *some*   |
| Crushers                  | **lead**  | few       | few          | *some*   |
| Darkness                  | —         | **lead**  | few          | *some*   |
| Lasers                    | —         | **lead**  | few          | *some*   |
| Turrets                   | —         | **lead**  | —            | *some*   |
| Stalactites               | —         | few       | **lead**     | *some*   |
| Crumbling rock            | few       | few       | **lead**     | *some*   |
| Rising lava               | few       | —         | **lead**     | *some*   |

Each world gets its own rock colours (`colors` in `levels/index.js`, like worlds
2–6) and an `about` line for the levels page. Lighting and backgrounds come with
phase 9, which then has ten worlds to do instead of six. A world's colours must
leave keys, crystals, pads, lava, flames and lasers easy to read against its rock.

## Level design rules

`PLAN.md`'s rules still hold (teach then test, no blind drops, a pad before every
hard part, crystals off the main route, danger reads at a glance, par from real
runs). Big levels add these:

- **Sections, then a breather.** After a hard section comes a quiet stretch: an
  open room, a pad, somewhere to look around. Two hard sections never come back to
  back without a pad between them.
- **Show the goal early.** The next key, the door it opens or the exit can be seen,
  through a gap or across a chasm, before the route gets there. In a 200-column
  level, knowing where you're heading is half the fun, and the map (M) shouldn't be
  the only way to find it.
- **Few choices at once.** At most three open branches at a time. Every branch ends
  in something (a key, a switch, a crystal, a pad), never an empty dead end.
- **No long retreads.** When the route comes back, it comes back a different way,
  or the hazards on the way have been switched off (switches can turn lasers off
  for good) or opened (doors stay open). Flying the same gauntlet twice is a chore.
- **Three crystals a level:** one easy to spot and a small detour, one down a side
  branch, and one that takes skill (under a crusher, between two flame waves, on a
  crumbling ledge).
- **Each level uses at least four elements,** at least two of them from other
  worlds than the one it leans on, and every section uses at least two together.
- **Cycles that meet are tuned together.** Where two things on cycles cover the
  same stretch (a crusher and a flame wave, a laser and a timed gate), their
  periods fit together, so the gap you're looking for comes round regularly and
  can be learned.
- **The first level of each world is a way back in.** It's big, but gentle: long
  cycles, wide gaps, pads close together, a reminder of the elements the world
  leans on. The eighth is the longest level so far and the world's test.

## Harder by reaction

Worlds 7 and 8 were played through on the phone (September 2026). They play well,
but they test dexterity more than reactions: flying a known line cleanly, on a
beat that can be learned. The numbers say the same. Nothing in world 7 reacts to
the rocket: every hazard fires on a fixed 5 s beat. World 8 is sparse, with three
quarters of its route clear of anything. So worlds 9 and 10 get harder another
way: things packed closer, shorter gaps in time, and more that goes off because
of you, so you have to read it and react rather than learn it.

**How it's measured.** Along the autopilot's route (not counting where it waits),
a hazard is *passed* when the rocket comes within 6 m of what it covers: a flame's
or a beam's length, a blob's throw, a block's or crusher's whole travel, the column
under a stalactite, a patch of crumbling rock, a cycling fan's column, the strong
part of a magnet's pull (within 60% of its range), or a turret within 24 m. The
route is *quiet* where nothing is that close. *Triggered* hazards are the ones
whose timing follows the rocket's: stalactites, crumbling rock, flames that fire
when you come near, and turrets. A *window* is how long a cycling hazard is clear:
its off time less its warning (a crusher's rest, and how long a blob's column is
clear halfway up its throw).

| World        | Passed per 100 m | Quiet route | Triggered | Shortest window | Shortest warning | Beat  |
| ------------ | ---------------- | ----------- | --------- | --------------- | ---------------- | ----- |
| 6 Core       | 2.6 (0–4.7)      | 77%         | 89%       | 1.5 s           | 0.5 s            | —     |
| 7 Foundry    | 2.6 (1.2–3.7)    | 52%         | none      | 1.9 s           | 0.5 s            | 5 s   |
| 8 The Vaults | 1.3 (0.8–1.6)    | 74%         | 29%       | 2.7 s           | 0.5 s            | 5 s   |
| 9 Fault line | 4 or more        | 40% at most | half      | 1.5 s           | 0.5 s            | 3–4 s |
| 10 The Heart | 6 or more        | 25% at most | half      | 1.2 s           | 0.4 s            | 3 s   |

Worlds 6–8 are measured, over each world's route as a whole (the range is its
levels), by `scripts/levels/reaction.js` since C4; a rougher first count had world
6's route 58% quiet. Worlds 9 and 10 are targets for levels 2–8 of each; the first level is a
way back in, at about world 7's density. Like the other tables, they're starting
points to tune by playing.

World 9 is where reactions take over: half of what you pass goes off because of
you, and quiet stretches are short. World 10 is very hard: the densest levels,
windows and warnings at the floors, and it's as reactive as world 9 while it mixes
in every cycle in the game, so a section asks you to hold a rhythm and react at
the same time.

**What makes a section need reactions.** All of it is in the game already, so
there are still no sim changes:

- **Things that go off because of you.** Stalactites drop as you pass under them,
  rock crumbles where you touch it, flames set to `near` fire as you come close,
  turrets aim where you are, and rising lava and timed gates start when you take a
  key or land on a switch. Their timing follows yours, so it can't be learned as a
  beat: you see it and react.
- **Denser.** Something to deal with every few seconds, and short ways between
  sections: rows of stalactites, crumbling floors under flames, turrets over
  cycles.
- **Tighter timing.** Faster beats (3–4 s instead of 5), shorter windows, and two or
  three cycles meeting, so the gap where they're all clear is shorter than any one
  of them. Cycles that meet are still tuned together, so the gap comes round
  regularly.
- **Shorter warnings,** down to the floors below, and faster turret shots (up to
  9 m/s, from 6).
- **Darkness,** where you only see a hazard when your headlight finds it (9-6,
  10-3, 10-6).

**What keeps it fair:**

- **Room to react.** Where you have to react, the way is at least 8 m wide, so the
  hard part is when to go, not threading a slot while dodging. Narrow gaps and
  quick reactions don't come together, as that's dexterity again. The narrowest
  gaps stay in stretches that are only about flying.
- **Floors.** No warning shorter than 0.4 s and no window shorter than 1 s: less
  can't be reacted to on a phone you tilt to steer. Every triggered hazard still
  warns before it hurts: it shakes, cracks, glows or winds up.
- **Seen in time.** What you have to react to is on screen when its warning starts.
  A turret over a dense section sits close enough to be seen, not off the edge of
  the screen in portrait.
- **Short sections, pads between.** A dense section is 10–25 s of a good run, with
  a pad either side. Reactions fail more often than a learned line does, so trying
  again has to be quick. No leg is longer than 45 s of the autopilot's flying, as
  before.
- **Breathers stay.** The density is inside the sections. After one comes a pad and
  room to look around, but not a long empty passage.

**The autopilot** will find this harder than people do, and the rule stays: fix
the autopilot, not the level. It knows every schedule exactly, so it can go at
speed and set off before a gap opens, where it now waits for a gap it can cross at
6 m/s with time to spare. Likely work: windows of 1.2–1.5 s, a row of stalactites
without stopping under each, and dodging shots while it crosses a cycle. It waits
out triggered hazards, so its times will be slow, and pars for these worlds come
from real runs more than from the autopilot (C6).

**Checking it.** `check.js` reports each level's hazards passed per 100 m, quiet
share, triggered share, and shortest window and warning along its route, and the
tables in C4 and C5 record them with the size, par and tank. `keepsToBigRules`
checks the floors in part two, on each thing's own settings: no warning under
0.4 s, no window under 1 s.

## The levels

Names, ideas and main elements; the sections and their details are worked out when
a world is built. The names don't repeat any in worlds 1–6.

### World 7: Foundry
*The old machines still run, and the fire with them.* Soot-black rock with brass
edges. Heavy machinery and fire on cycles that fit together: the world tests your
timing.

| Level | Name             | Idea                                                                                   |
| ----- | ---------------- | -------------------------------------------------------------------------------------- |
| 7-1   | Cold start       | A wide warm-up: fans lift you over a lava lake, slow flamethrowers, a red key and door. |
| 7-2   | Bellows          | Fans that switch on and off blow across flame jets: ride the gust while the flame rests. |
| 7-3   | Conveyor         | Ride moving blocks through a hall of lava blobs and flamethrowers; a pad at each end.  |
| 7-4   | Hammer and tongs | Crushers and flame waves on one beat, down a long tunnel; a switch opens the way out.  |
| 7-5   | Magnet crane     | Magnets pull you out over lava and towards the flames; push magnets guard the pads; two keys. |
| 7-6   | The pour         | Rising lava (molten metal) from a switch, and a climb through crushers and fans ahead of it. |
| 7-7   | The forge        | One huge hall round a lava pit with blobs, fans and blocks crossing it; three keys, any order. |
| 7-8   | The foundry      | The world's test: 200 columns of everything above, three keys and a timed gate to the exit. |

### World 8: The Vaults
*Sealed vaults deep in the rock, and what was left to guard them.* Cold green-grey
stone with teal edges. Big branching caves full of doors, switches and defences,
half of them dark: the world tests finding your way. Levels 8-4, 8-6, 8-7 and 8-8 are
dark.

| Level | Name        | Idea                                                                                       |
| ----- | ----------- | ------------------------------------------------------------------------------------------ |
| 8-1   | Antechamber | A lit warm-up: a hub with three doors off it, two keys, and pads at the hub.               |
| 8-2   | Alarm       | Lasers on switches: each switch turns off the beams guarding the next key, for good.       |
| 8-3   | Four keys   | All four keys, hub and spokes; each key's branch has its own mix of hazards, blue opens the exit. |
| 8-4   | Night watch | Dark: turrets watch a big hall, and you hop from one rock pillar's cover to the next.      |
| 8-5   | Clockwork   | Timed gates one after another, through lasers on a cycle; the countdowns and the beams fit together. |
| 8-6   | Strongroom  | Dark: sliding blocks as vault doors, magnets that hold you off the pads, keys behind both. |
| 8-7   | Labyrinth   | Dark: a big maze where the map earns its place; lasers and turrets at the crossings, crystals deep in it. |
| 8-8   | The vaults  | The world's test, dark: four keys, three switches, lasers, turrets and magnets, and a last timed gate. |

### World 9: Fault line
*Where the rock is still moving.* Pale ash-grey rock with orange cracks. Mostly
tall levels where the rock falls, gives way and fills with lava, and what's gone
doesn't come back: the world tests reactions, under pressure. Most of what's
dangerous goes off because of you, and this is where reacting takes over from
remembering a line. 9-6 is dark.

| Level | Name            | Idea                                                                                    |
| ----- | --------------- | --------------------------------------------------------------------------------------- |
| 9-1   | Tremor          | A wide warm-up: stalactites, crumbling bridges over lava, a fan lifting you up a shaft. |
| 9-2   | Vents           | Fans blow up shafts lined with stalactites: set them falling, then ride the draught up. |
| 9-3   | Landslide       | A long way down through crumbling floors over blob pools; the way back up is gone, so every pad is a step forward. |
| 9-4   | Shifting ground | Moving slabs slide across the shaft and carry you up, under stalactites that drop as you ride past and flames that fire as you come near. |
| 9-5   | The rift        | A huge crack: flamethrowers fire up its walls in a wave, stalactites hang over it, and the only ledges crumble. |
| 9-6   | Aftershock      | Dark: stalactites and crumbling rock you only see in your headlight, and the shaking gives them away. |
| 9-7   | Lava tube       | A long climb up a sloping tube with the lava rising behind: flames that fire as you come near, crumbling plugs, and timed gates to open on the way. |
| 9-8   | The fault       | The world's test: zigzag down one side of the fault and up the other, under falling rock all the way; a switch at the bottom wakes the lava. |

### World 10: The Heart
*The bottom of everything, where all the caves meet.* Deep violet rock with
crystal-bright edges. Every level mixes elements from at least four earlier worlds,
with the tightest tanks, the most packed sections and the shortest warnings: the
hardest world, testing all of it at speed. 10-3 and 10-6 are dark.

| Level | Name               | Idea                                                                              |
| ----- | ------------------ | --------------------------------------------------------------------------------- |
| 10-1  | Threshold          | The way in: one section from each world in order, mine to core, a reminder of everything. |
| 10-2  | Firing line        | Turrets with fast shots cover flame waves over lava: dodge the shots without losing the flames' rhythm. |
| 10-3  | Undertow           | Dark: fans and magnets pushing different ways at once, crushers where they meet, and stalactites you only see in your headlight. |
| 10-4  | Keyring            | All four keys, each behind a set piece from a different world, in any order.      |
| 10-5  | Pressure           | One switch starts a timed gate and the rising lava together, and a long climb follows through crumbling rock and flames that fire as you come near. |
| 10-6  | Deep night         | Dark, and the longest yet: every hazard in the game, with pads glowing close together. |
| 10-7  | The long hall      | One 200-column hall with every kind of hazard in a row, most of them set off by you, and pads between: a race for par. |
| 10-8  | Heart of the world | The finale: down into the heart, where a key wakes the lava, then all the way up through every world's caves to the sky. |

10-8 is the biggest level in the game (200×150) and the only one in part two with
`sky`. Its results give the game's ending, and 6-8 keeps "you made it out".

## How a level gets built

1. **Sketch it.** Write its header comment first: the sections in order, what each
   combines, where the pads, keys, switches and crystals go, and which way the route
   runs. A world's eight sketches are done together before any map, so the world
   builds up to its test and no two levels repeat an idea.
2. **Build the map.** With a building script in `scripts/levels/`, one per level
   (`7-1.js`…), which draws it in rectangles of rock and air with pads, things and
   ragged edges (`grid.js`), and writes it as a plain text map to `src/levels/`,
   with a picture of it in `previews/`: `node scripts/levels/8-1.js`. Change the
   script and run it again, rather than editing the map by hand. (Or in the editor
   on the phone, exported as a level module into `src/levels/`.)
3. **Check it.** `node scripts/levels/check.js 8-1` parses it, runs `checkLevel`,
   flies it with the autopilot, and prints its legs, the stretches between pads,
   the big-level rules, a tank and par to set and, from C4, how dense and quick it
   is (*Harder by reaction*); `trace.js` shows where the
   autopilot was when it gave up, and `render.js` runs the render code over it.
   `npm test` does the same checks for every level. The tank is the world's ratio
   times the longest leg, and the par is the autopilot's time rounded up to 5 s.
4. **Fly it on the phone.** With `?dev` for the timings between pads. Every section
   should be doable in a few tries, and the level as a whole in one sitting. Pars
   are tightened towards what a good run does, as in worlds 1–6.

## Phases

Each phase ends with a build to play on the phone and a short checklist, and is
committed when `npm test` and the build pass (for example "Phase C2: world 7,
Foundry").

### Phase C1: Room for big levels ✅ (done)

Before any new level, make sure big ones run well.

- **A stress level.** A 200×150 test level with 50 things (all a map can name),
  30 hazards on screen at once in places, played at `/play/big` beside the test
  cave and kept out of the worlds. On the phone: the frame rate, how long the cave mesh takes to
  build, how long the autopilot takes to plan its longest leg, and memory. Anything
  that falls short gets fixed here: `PLAN.md`'s target is 60 fps in a 200×100 level
  with 30 hazards on screen, and this is half as big again.
- **Level tests that scale.** `test/levels.test.js` flies every level in one test,
  one after another. 32 big levels would make `npm test` slow and a failure hard to
  place. It's split into one test per level, and, if that isn't enough, one file per
  world so `node --test` runs them in parallel.
- **Checks for big levels.** For worlds 7–10 the tests also check what this plan
  promises: within the editor's limits (200×150, 48 KB, passes `validate.js`),
  three crystals, and no leg between pads over 45 s of the autopilot's flying.
- **Part two.** `levels/index.js` gets room for worlds 7–10. The levels page shows
  a *Part two* heading above world 7. The ending moves off whichever level is last:
  6-8 keeps "you made it out", and 10-8 will get the real ending.

- [x] The stress level runs at 60 fps on the phone (110 fps on the frame rate display), and loads in a couple of seconds.
- [ ] Switching the autopilot on in the stress level starts it flying without a noticeable pause.
- [ ] `npm test` takes no more than about twice as long as before, with the stress level included.
- [ ] Finishing 6-8 still gives its ending, and then opens world 7.

What was built: the *Big cave* (`src/levels/bigcave.js`, at `/play/big`, linked
from the levels page and in the editor's list to copy from) is 200×150 tiles with
50 things, as many as a map can name. It's six bands of 20 rows, flown in a zigzag
from the bottom: lava pools with 38 blobs under 83 flamethrowers in the roof; fans,
crushers and sliding blocks; magnets and lasers; stalactites and turrets; flame
waves from floor and roof, and a crumbling wall; then a key and its door, a switch
and its gate, blocks and the exit. Its pads in the lava and flame bands stand on
ledges, clear of what's on the floor. The autopilot flies it in 357 s over 19 legs,
at most 42 s between pads, so the tank is 30 s and par 360 s.

Measured in node on the phone (the dev machine is a phone, whose timings vary a
lot as it warms up): the cave mesh is 28,000 triangles and builds in about 0.1 s.
The scene has about 1,500 objects, and updating and culling them costs about
0.5 ms a frame. The sim takes 0.16 ms a tick. What the GPU makes of it is for the
checklist.

The autopilot needed two fixes. It couldn't fly the big cave at all. Its path
search is breadth first in 1 m steps, where many paths are equally short, and it
took the first it found, which dived from the start ledge to just over the lava
and then waited at every blob's column until the tank ran dry. With `avoid`, the
search now takes, of the shortest paths, the one with the fewest steps in reach
of hazards it would have to wait for (`hazardGrid` marks them; `hazardZones` and it
share `passingHazards` and `touches`). That also flies 3-8 in 74 s instead of 85.
Planning was also slow when a leg has no way through until crumbling rock falls:
each search that failed flooded the whole cave at all five margins from rock, 1.6 s
for that leg. Now each point's fit carries over between margins (a point that fits
with a wide margin fits with a narrow one). The search tries the widest margin,
then none, and gives up if that fails. A flood over the tiles (`airJoins`) skips the
searches altogether when air doesn't join the two ends. And a level without moving
blocks doesn't search twice. The slowest planning tick in the big cave is now
0.1–0.2 s once warm (the first can be 0.5 s), and no slower than before on the
other levels.

To check the frame rate on the phone, the pause menu has a *Frame rate* switch
(remembered, and always on with `?dev`). It shows the frames a second, the
slowest frame, the code's time per frame (sim, HUD and handing the scene to
WebGL; a low frame rate with little code time means the GPU is the slow part),
and the draw calls and triangles.

Levels are tested a world to a file (`test/world-<n>.test.js`, each calling
`testWorld` in `test/worlds.js`), a test per level, so `node --test` flies the
worlds side by side and a failure names its level. Part two's levels also keep to
the big-level rules (`keepsToBigRules`): their copy in the editor is valid, within
200×150 and 48 KB as JSON, three crystals, and no more than 45 s of the autopilot's
flying between pads. The big cave keeps them too (`test/levels.test.js`). `npm
test` takes 20–35 s, against 16.5 s before on the same phone run back to back; the
big cave's test (6.5 s, 0.7 s of it the level check) is the longest. Worlds 7–10
will add their flights, about 3–5 s a big level, side by side.

Worlds have a `part` (1 if not given) and the one that ends a part an `ending`
(`endingOf`), so the results say "Out of the core!" after 6-8 because world 6 ends
part one, not because it's the last level; "That's every level, for now" only
shows when there's no next level. The levels page puts a heading over each part
once there's more than one.

### Phase C2: World 7, Foundry ✅ (done)

The eight levels above, with the world's colours and `about` line. Timing is the
skill here, so the cycles that meet are tuned together, and the dev overlay's
timings from real flights set the pars. Likely autopilot work: riding a moving
block through hazards, and waiting for a gap in two cycles at once (a crusher and a
flame).

- [ ] Every cycle can be read before it's dangerous, even with three things moving at once.
- [ ] A section that goes wrong costs one section, never the whole level.
- [ ] 7-1 feels like a way back in after world 6, not a step down.
- [ ] 7-8 is the hardest level yet, and feels like the world's test.

What was built: the Foundry, world 7, the first of part two, with soot-black rock
and brass edges. Each level's header comment lists its sections. The levels were
drawn with a building script (rectangles of rock and air, then ragged edges eaten
into the rock), and are plain text maps like the others.

| Level | Name             | Size      | Autopilot | Par   | Tank | Pads | Sections                                             |
| ----- | ---------------- | --------- | --------- | ----- | ---- | ---- | ---------------------------------------------------- |
| 7-1   | Cold start       | 150 × 70  | 144 s     | 145 s | 24 s | 4    | lake with fans, chimney, gallery, run home           |
| 7-2   | Bellows          | 164 × 64  | 97 s      | 100 s | 24 s | 3    | tailwind, updraft, headwind, tailwind                |
| 7-3   | Conveyor         | 180 × 60  | 136 s     | 140 s | 26 s | 4    | shutters, conveyor, pools, pistons                   |
| 7-4   | Hammer and tongs | 184 × 46  | 136 s     | 140 s | 27 s | 3    | anvils, tongs, quench, hammer mill, drop forge, lift |
| 7-5   | Magnet crane     | 170 × 70  | 95 s      | 95 s  | 24 s | 4    | hub, crane, swing, the way out                       |
| 7-6   | The pour         | 150 × 100 | 113 s     | 115 s | 26 s | 4    | flue, quench, ladle, pour, spout                     |
| 7-7   | The forge        | 180 × 86  | 129 s     | 130 s | 20 s | 5    | three keys round a hall, then the pit                |
| 7-8   | The foundry      | 200 × 96  | 232 s     | 235 s | 26 s | 6    | nine, one from each level before it                  |

Tanks are 1.3× the longest burn between refills and pars the autopilot's time
rounded up to 5 s, for C6 to tighten. Each level has a beat, mostly 5 s, that
its cycles fit, so where two things cover the same stretch the gap comes round
regularly. Flames are mostly walls from floor to roof, so a crossing is a clear
matter of timing, not a near miss at a flame's tip. 7-4 is lower than the 60 rows
the worlds table asks for (46), being one long tunnel there and back. 7-8 names 44
things.

The autopilot needed more work than expected, and none of it was riding blocks:
the levels never need it, and on the conveyor a rider and a flyer both have a way.
Coming up to a hazard it can't cross yet, it now slows in time to stop where it
waits, rather than overshooting into it. Hazards too close together to wait
between (less than 4 m) it crosses as one, when all of them have a gap: shutters
one over another, or tongs and the blob pit behind them. It plans round where
crushers rest when it can, instead of through the floor crusher of a pair of
tongs. Crossing, it follows its path instead of heading straight for the far
side, which cut corners. Of the grid's equally short paths it takes the
straightest, where it used to weave, dipping between blob columns. And it counts
passing within 1.2 m of a flame or beam, not 0.8, as crossing it, since a lean
swings the feet out. Worlds 1–6 still fly within their tanks, a few seconds either
way and never over par.

Levels can be copied into the editor with world 7's look: `LOOKS` (`validate.js`)
is seven, and goes up with each world.

### Phase C3: World 8, The Vaults ✅ (done)

The eight levels above. Finding the way is the skill, so the map and sight lines
matter more than ever: in the dark levels pads, doors and keys must glow enough to
find, and the goal shows early. Likely autopilot work: waiting for a gap while a
turret can see it (dodging while it waits), and long routes with four keys.

- [ ] In every level you can tell where to go next, with the map if not without it.
- [ ] No branch is an empty dead end, and no hazard has to be flown twice.
- [ ] The dark levels are hard to find your way round, not hard to see what hurts you.
- [ ] Turrets can always be dodged, even while waiting on a laser or a gate.

What was built: the Vaults, world 8, with green-grey rock and teal edges. Each
level's header comment lists its sections, and each has a building script in
`scripts/levels/` (the world 7 ones moved there too), which writes it as a
plain text map.

| Level | Name        | Size      | Autopilot | Par   | Tank | Pads | Sections                                                    |
| ----- | ----------- | --------- | --------- | ----- | ---- | ---- | ----------------------------------------------------------- |
| 8-1   | Antechamber | 160 × 90  | 121 s     | 125 s | 21 s | 4    | cellar, strongbox, the way back, the way out                |
| 8-2   | Alarm       | 180 × 80  | 140 s     | 140 s | 27 s | 3    | lobby, gallery, yellow vault, lower passage, exit           |
| 8-3   | Four keys   | 170 × 112 | 232 s     | 235 s | 22 s | 6    | a spoke per key off the hub, then up to the exit            |
| 8-4   | Night watch | 190 × 84  | 98 s      | 100 s | 23 s | 4    | gatehouse, watch hall, red door, gallery, timed gate        |
| 8-5   | Clockwork   | 140 × 80  | 114 s     | 115 s | 27 s | 2    | three clocks: a switch, beams, and its gate                 |
| 8-6   | Strongroom  | 170 × 96  | 115 s     | 115 s | 23 s | 3    | way in, outer vault, airlock, inner vault, way out          |
| 8-7   | Labyrinth   | 168 × 94  | 118 s     | 120 s | 26 s | 4    | a maze of 24 rooms: two keys at dead ends, the exit at a third |
| 8-8   | The vaults  | 200 × 120 | 257 s     | 260 s | 24 s | 8    | eight, from the levels before it, for all four keys         |

Tanks are 1.3× the longest burn between refills, and pars the autopilot's time
rounded up to 5 s, for C6 to tighten. 8-4 to 8-7 are quicker than the table's 2
minutes for this world, and 8-5 is narrower than its 160 columns: they're dense
rather than long, which C6 can change if they feel slight. 8-8 is the longest
level so far. Every switch in the world turns beams off for good, except the
timed gates of 8-4, 8-5 and 8-8. Where a key's branch is flown back, the way
back is different, or its beams are switched off, or its rock has fallen.

The autopilot needed no changes; the levels did, three ways, which will hold for
worlds 9 and 10. Flame walls across a vertical shaft less than about 16 m apart
are crossed as one, since the rocket's height spans them, and two flames that are
never off together can't be: switch 1 in 8-2 moved from the top of a shaft to the
end of a level passage. A block whose full reach leaves a gap the rocket fits
with no margin at all is routed under, at speed, and the rocket's lean scrapes its
feet: presses reach the floor. And a block sliding smoothly across a shaft is
clear for too short a time to drop through: the vault doors of 8-6 and 8-8 are
crushers, resting open for 4.5 s of a 10 s beat. The autopilot dodges turrets'
shots on its own (19 of 19 in 8-4's hall; one hit each in 8-2 and 8-8). It makes
8-5's timed gates with 3.4–4.8 s to spare, and 8-8's with 7.4 s.

Levels can be copied into the editor with world 8's look (`LOOKS` is eight).

### Phase C4: World 9, Fault line ✅ (done)

The eight levels above, mostly tall. Pressure is the skill: lava from keys and
switches, floors that go for good, stalactites over the route. Checkpoints must
leave you somewhere you can still get out of: the lava's height and what's fallen
are saved at each pad, so a pad the lava will soon reach is placed with time to
leave it. Likely autopilot work: stalactites in a fan's column, and keeping ahead
of the lava on long climbs.

Reactions are what's new. Before any level, `check.js` gets the report from
*Harder by reaction* (hazards passed per 100 m, quiet and triggered shares,
shortest window and warning) and `keepsToBigRules` its floors, and the report is
run over worlds 7 and 8 to check it gives the numbers in that section's table.
World 9's levels aim for its row there: half of what you pass set off by you,
denser than any level so far, and windows down to 1.5 s. More autopilot work
comes with that: windows of 1.5 s, and rows of stalactites without stopping under
each one.

- [ ] Restarting from any pad gives a fair chance, never a lost cause.
- [ ] One-way drops are visible as one-way before you take them.
- [ ] Rising lava feels like a chase, not a wall that catches you out.
- [ ] It plays as a test of reactions: you die to something you saw too late, not
      to a wall you steered into.
- [ ] Every warning can be reacted to, and nothing you have to react to starts off
      screen.

What was built: first the report. `scripts/levels/reaction.js` measures a level,
or whole worlds (`node scripts/levels/reaction.js 7 8`), along the autopilot's
route as *Harder by reaction* says, and with `--quiet` lists where the route is
quiet, to know where a level needs more. `check.js` prints it for the level it
flies. It measures from the rocket's shape, which gives worlds 7 and 8 the numbers
in the table above to within 0.2 hazards per 100 m and a percentage point of quiet
(8's triggered share comes out 29%, not 21%). Blobs' windows are taken halfway up
their throw: at the lava they're shorter than anything else in the game, and
nobody crosses there. Part two's levels keep to the floors on each thing's own
settings (`keepsToFloors` in the level tests): the big cave, outside the worlds,
doesn't, with a blob clear for 0.98 s. `flight.js` also tells how far below the
rocket the rising lava is on each pad, and times gates it passes up or down
through, not only across.

Then Fault line, world 9, with ash-grey rock and orange cracks, each level with
its building script:

| Level | Name            | Size      | Autopilot | Par   | Tank | Pads | Sections                                                  |
| ----- | --------------- | --------- | --------- | ----- | ---- | ---- | --------------------------------------------------------- |
| 9-1   | Tremor          | 140 × 100 | 108 s     | 110 s | 19 s | 4    | gallery, drop, upper deck, lava hall, updraft, way out    |
| 9-2   | Vents           | 110 × 140 | 95 s      | 100 s | 16 s | 4    | three vents, with a crossing between each and the next    |
| 9-3   | Landslide       | 130 × 140 | 121 s     | 125 s | 23 s | 4    | three crumbling floors, each into a chamber, and the bottom |
| 9-4   | Shifting ground | 120 × 130 | 131 s     | 135 s | 23 s | 4    | lift shaft, slip, upper shaft                             |
| 9-5   | The rift        | 100 × 140 | 128 s     | 130 s | 24 s | 4    | down one rift, along its floor, up the other              |
| 9-6   | Aftershock      | 140 × 110 | 137 s     | 140 s | 27 s | 3    | tunnel, lava cave, updraft, top gallery                   |
| 9-7   | Lava tube       | 160 × 120 | 145 s     | 150 s | 27 s | 4    | climb, tube, climb, upper tube, climb                     |
| 9-8   | The fault       | 160 × 150 | 248 s     | 250 s | 29 s | 8    | ten, one from each level before it                        |

| Level | Passed per 100 m | Quiet | Triggered | Shortest window | Shortest warning |
| ----- | ---------------- | ----- | --------- | --------------- | ---------------- |
| 9-1   | 3.4              | 41%   | 83%       | 2.8 s           | 0.7 s            |
| 9-2   | 4.3              | 38%   | 67%       | 1.5 s           | 0.5 s            |
| 9-3   | 6.1              | 31%   | 62%       | 1.5 s           | 0.5 s            |
| 9-4   | 4.8              | 29%   | 75%       | 1.5 s           | 0.5 s            |
| 9-5   | 4.5              | 37%   | 57%       | 1.8 s           | 0.5 s            |
| 9-6   | 6.1              | 29%   | 81%       | 1.5 s           | 0.5 s            |
| 9-7   | 5.1              | 37%   | 83%       | 1.5 s           | 0.5 s            |
| 9-8   | 4.8              | 39%   | 67%       | 1.5 s           | 0.5 s            |
| World | 4.8              | 36%   | 71%       | 1.5 s           | 0.5 s            |

Tanks are 1.25× the longest burn between refills and pars the autopilot's time
rounded up to 5 s, for C6. The world passes twice as many hazards per 100 m as
world 7, with a third of its route quiet, which meets its row in *Harder by
reaction* but for the triggered share: seven in ten of the hazards passed go off
because of you, not half, as stalactites (quick ones, shaking for 0.5 s once
you're within 6 m) and flames that fire as you come near are most of it. The
cycles keep a 4 s beat, 9-1's a 5 s one. 9-1 and 9-2 are shorter than the
worlds table's 2 minutes, being dense. The lava in 9-7 rises from its key at
1.2 m/s and in 9-8 from its switch at 2.5 m/s, up to just below the top of the
vents: the autopilot keeps 23 to 86 m ahead of it at every pad.

The autopilot needed more work, all of it for reactions:

- **Stalactites at speed.** It works out when each stalactite in its way will be
  set off and fall, as the sim does, and flies through at crossing speed where none
  would hit it (allowing for going a fifth slower), deciding 11 m out so as not to
  slow down. Otherwise it edges up to them as before. A row of ten that took 49 s
  takes 19. World 6 flies much faster for it (6-1 in 28 s instead of 57, 6-4 in 42
  instead of 72), so its pars, made from the old times, are now roomy.
- **Flames that fire as you come near** it treats like stalactites: it edges up
  until one fires, out of its way, then crosses while it rests. Before, it went on
  while out of reach and flew into the flame it had just set off, unless the reach
  was wide (8 m in 3-4). It counts the window as the rest and the next warning,
  since it sets it off again coming through.
- **Blobs by height.** It crosses a blob's column while the blob is above or below
  where it crosses, not only while it's down in the lava.
- **Moving blocks.** Of the shortest paths it takes the one through ground a block
  covers for the least of its cycle, where that's more than half, so it passes a
  slab sliding across a shaft at the side it leaves, not in the middle, which a
  slab covers all the time.
- **Fixes:** it skips stalactites that have fallen (it waited on one behind a fallen
  one for ever), and expects rising lava to stop at the top it's given.

Worlds 1–8 fly as before, within a tenth of a second, but for world 6 and 7-2 (4.6
s quicker) and 8-3 (7.9 s quicker). 3-6 and 7-1 were already a little over their
pars (by 0.1 and 3.2 s) and stay so.

What the levels taught, for world 10:

- **A pad never under a stalactite**, however far up: it sees the rocket past
  sliding blocks, and falls on the pad.
- **Room before what you set off.** A stalactite or a flame that fires as you come
  near needs clear route before it, about 10 m, to stop in and set it off from;
  right after a blob or another flame, the autopilot can neither stop between them
  nor cross both. Likewise crumbling rock across the way needs room to slow down
  before it.
- **Flames crossed going up or down rest 2 s**, not 1.5: the rocket is tall, and
  crossing takes it longer. Their reach is 5 m, so they're set off from out of the
  way.
- **A vent stronger than gravity ends well short of the roof**, or it throws you
  into it.
- **Slabs across a shaft need a side to pass on**: nothing on the walls that pushes
  the way into the middle of their travel.

Levels can be copied into the editor with world 9's look (`LOOKS` is nine).

### Phase C5: World 10, The Heart, and the ending

The eight levels above, and the ending. The tightest tanks and the longest levels:
each level is a test of the whole game, and 10-8 the biggest. Its results say
you've flown to the heart of the world and back, and the levels page marks part two
as done when it is.

This is the hardest world, and the one with the most reacting to do. Its levels
aim for its row in *Harder by reaction*: denser than world 9, as much set off by
you, windows of 1.2 s and warnings of 0.4 s, at the floors. Every section asks you
to keep a rhythm and react at the same time. Likely autopilot work: windows of
1.2 s, and dodging fast shots while it crosses a cycle.

- [ ] Every level feels like a mix of the whole game, not of one world.
- [ ] It's clearly harder than world 9, and the difficulty comes from the speed of
      it, not from narrow gaps or unfair surprises.
- [ ] 10-8 is long and hard but fair, and feels like the end of the game.
- [ ] Every pad-to-pad stretch in world 10 can be flown in a few tries.

### Phase C6: Tuning on the phone

Play all 32 levels through in order, on the phone, from 7-1. Set pars from real
runs, move pads where a section is too long, and smooth out any level that's a wall
compared to the ones round it. Update the tables here with each level's size,
autopilot time, par, tank and legs, as `PLAN.md` does for world 1.

- [ ] Worlds 7–10 get harder smoothly, with no wall between them.
- [ ] Worlds 9 and 10 feel like tests of reaction, and world 10 like the hardest
      thing in the game.
- [ ] Each world feels different from the others, not just "everything again".
- [ ] Beating par takes a good run, and three stars on every level is a real goal.

## Later

- **A bonus world** unlocked by collecting every crystal in part two.
- **New mechanics** (water, low gravity, portals, cargo) belong in `PLAN.md`'s
  *Later*; they'd make a part three, with worlds that teach again.
- **Community worlds** from the best shared levels, once E5 is there.
