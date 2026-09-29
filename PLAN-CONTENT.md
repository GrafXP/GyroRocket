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
  and tests one skill: world 7 tests timing, world 8 finding the way, world 9 flying
  under pressure, and world 10 all of it. That keeps four worlds of "everything" from
  feeling the same.
- **A big level is a chain of sections.** A section is one set piece, 20–45 s of
  flying, built around two or three elements together (flame jets across a fan
  column; turrets covering a timed gate). Sections are joined by quieter stretches,
  and there's a fuel pad before every hard section. Dying costs one section, never
  the whole level. Each level file's header comment lists its sections in order,
  which serves as the level's plan and helps anyone tuning it later.
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
| 9     | Fault line | pressure        | 100–160 × 100–150 | 5–9     | 2–4½ min | 1.25×         | 7 m           |
| 10    | The Heart  | everything      | up to 200 × 150  | 6–10     | 2½–5 min | 1.2×          | 7 m           |

As in `PLAN.md`, these are starting points to tune by playing. "Tank vs route" is
the tank against the fuel the autopilot burns on the longest leg between pads, and
"Par" is the autopilot's time rounded up to 5 s. Gaps get no narrower than in world
6: tilt isn't precise enough for less, and these worlds get harder by combining
elements and by length, not by squeezing.

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
doesn't come back: the world tests flying under pressure. 9-6 is dark.

| Level | Name            | Idea                                                                                    |
| ----- | --------------- | --------------------------------------------------------------------------------------- |
| 9-1   | Tremor          | A wide warm-up: stalactites, crumbling bridges over lava, a fan lifting you up a shaft. |
| 9-2   | Vents           | Fans blow up shafts lined with stalactites: set them falling, then ride the draught up. |
| 9-3   | Landslide       | A long way down through crumbling floors over blob pools; the way back up is gone, so every pad is a step forward. |
| 9-4   | Shifting ground | Moving slabs slide across the shaft and carry you up, under stalactites and past flames. |
| 9-5   | The rift        | A huge crack: flamethrowers fire up its walls in a wave, stalactites hang over it, and the only ledges crumble. |
| 9-6   | Aftershock      | Dark: stalactites and crumbling rock you only see in your headlight, and the shaking gives them away. |
| 9-7   | Lava tube       | A long climb up a sloping tube with the lava rising behind, and timed gates to open on the way. |
| 9-8   | The fault       | The world's test: zigzag down one side of the fault and up the other; a switch at the bottom wakes the lava. |

### World 10: The Heart
*The bottom of everything, where all the caves meet.* Deep violet rock with
crystal-bright edges. Every level mixes elements from at least four earlier worlds,
with the tightest tanks: the world tests all of it. 10-3 and 10-6 are dark.

| Level | Name               | Idea                                                                              |
| ----- | ------------------ | --------------------------------------------------------------------------------- |
| 10-1  | Threshold          | The way in: one section from each world in order, mine to core, a reminder of everything. |
| 10-2  | Firing line        | Turrets cover flame waves over lava: dodge the shots without losing the flames' rhythm. |
| 10-3  | Undertow           | Dark: fans and magnets pushing different ways at once, and crushers where they meet. |
| 10-4  | Keyring            | All four keys, each behind a set piece from a different world, in any order.      |
| 10-5  | Pressure           | One switch starts a timed gate and the rising lava together, and a long climb follows. |
| 10-6  | Deep night         | Dark, and the longest yet: every hazard in the game, with pads glowing close together. |
| 10-7  | The long hall      | One 200-column hall with every kind of hazard in a row and pads between: a race for par. |
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
   the big-level rules and a tank and par to set; `trace.js` shows where the
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

### Phase C3: World 8, The Vaults

The eight levels above. Finding the way is the skill, so the map and sight lines
matter more than ever: in the dark levels pads, doors and keys must glow enough to
find, and the goal shows early. Likely autopilot work: waiting for a gap while a
turret can see it (dodging while it waits), and long routes with four keys.

- [ ] In every level you can tell where to go next, with the map if not without it.
- [ ] No branch is an empty dead end, and no hazard has to be flown twice.
- [ ] The dark levels are hard to find your way round, not hard to see what hurts you.
- [ ] Turrets can always be dodged, even while waiting on a laser or a gate.

### Phase C4: World 9, Fault line

The eight levels above, mostly tall. Pressure is the skill: lava from keys and
switches, floors that go for good, stalactites over the route. Checkpoints must
leave you somewhere you can still get out of: the lava's height and what's fallen
are saved at each pad, so a pad the lava will soon reach is placed with time to
leave it. Likely autopilot work: stalactites in a fan's column, and keeping ahead
of the lava on long climbs.

- [ ] Restarting from any pad gives a fair chance, never a lost cause.
- [ ] One-way drops are visible as one-way before you take them.
- [ ] Rising lava feels like a chase, not a wall that catches you out.

### Phase C5: World 10, The Heart, and the ending

The eight levels above, and the ending. The tightest tanks and the longest levels:
each level is a test of the whole game, and 10-8 the biggest. Its results say
you've flown to the heart of the world and back, and the levels page marks part two
as done when it is.

- [ ] Every level feels like a mix of the whole game, not of one world.
- [ ] 10-8 is long and hard but fair, and feels like the end of the game.
- [ ] Every pad-to-pad stretch in world 10 can be flown in a few tries.

### Phase C6: Tuning on the phone

Play all 32 levels through in order, on the phone, from 7-1. Set pars from real
runs, move pads where a section is too long, and smooth out any level that's a wall
compared to the ones round it. Update the tables here with each level's size,
autopilot time, par, tank and legs, as `PLAN.md` does for world 1.

- [ ] Worlds 7–10 get harder smoothly, with no wall between them.
- [ ] Each world feels different from the others, not just "everything again".
- [ ] Beating par takes a good run, and three stars on every level is a real goal.

## Later

- **A bonus world** unlocked by collecting every crystal in part two.
- **New mechanics** (water, low gravity, portals, cargo) belong in `PLAN.md`'s
  *Later*; they'd make a part three, with worlds that teach again.
- **Community worlds** from the best shared levels, once E5 is there.
