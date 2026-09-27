# Gyro Rocket: plan

A cave-flying game for the phone. Tilt to steer a little rocket, hold the screen to
burn, and get it through a cave to the exit pad in one piece. Caves have locked
doors and the keys that open them, flamethrowers and other hazards, and only so much
fuel, with fuel pads along the way. There are many levels, grouped into worlds;
each world brings in something new, and the levels get harder as you go.

It builds on the prototype (phase 0): the flight model, tilt controls and the app
shell from factorygame. Same stack: Vite + vanilla JS + three.js, SPA routes,
light/dark theme, fullscreen PWA, `node --test`.

## Core decisions

- **2D game, 3D look.** The sim is flat, like the prototype: x sideways, y up.
  three.js draws it from the side with a perspective camera. The rock's face is
  flat in the plane of flight and the rock goes back from there to a back wall,
  so the cave has depth. Nothing moves in z.
- **Levels are tile maps written as text.** Each level is a JS module whose map is
  rows of characters (`#` rock, `.` air, `F` a fuel pad…), plus a few settings. They
  are easy to write and change by hand (or by Claude), easy to diff, and a test can
  check every one. A tile is 2 m, so the rocket (5 m tall, 2.7 m across its fins) is
  about 2½ tiles tall and 1½ wide. A level editor can come later.
- **Smooth-cornered caves from square tiles.** Marching squares turns the tile grid
  into rock outlines: straight walls stay on tile edges and corners are cut at 45°.
  The same outline is drawn and collided with, so what you see is what you hit.
- **Steering stays as it is.** Tilt sets how far the rocket leans (up to 60°), and
  it can't flip over. At full lean a full burn just about hovers while pushing
  sideways, which suits tunnels; going down means letting gravity do it. Retuning
  for caves should keep that.
- **Walls hurt, they don't always kill.** The rocket has a hull (100). Hitting rock
  costs hull by how hard you hit (a scrape a little, a slam a lot, and past a limit
  it's a crash), and the rocket bounces off. Tilt isn't precise enough for a single
  touch to kill fairly. Landing gently and nearly upright on any flat floor is safe,
  as now.
- **Fuel pads are checkpoints.** Landing on one fills the tank, repairs the hull and
  saves a checkpoint. After a crash, or when you're stranded with an empty tank, you
  start again from the last pad, with the level as it was when you landed there
  (keys, doors, crystals). The level clock keeps running.
- **Keys are kept and open every door of their colour.** There are four keys (red,
  yellow, green, blue), each with its own shape as well as its colour. Fly through a
  key to pick it up, and doors of its colour slide open when you come near. Keys are
  never used up, so you can't lock yourself out of a level.
- **Hazards warn first and keep time.** Anything that fires or moves on a cycle
  flickers, hisses or glows before it's dangerous. Cycles run on the level clock, so
  a hazard does the same thing on every attempt and can be learned.
- **Three stars a level.** ★ finish it, ★ beat its par time, ★ collect all its
  crystals (one to three, off the main route). Finishing a level unlocks the next;
  stars are for replay and bragging.
- **The sim stays separate and deterministic.** `src/sim/` has no DOM and no
  three.js, runs at 60 ticks/s, and gives the same run from the same inputs. So it
  is tested in node, a checkpoint is just a copy of the level's state, and ghost
  replays later are just recorded inputs.
- **Landscape first, portrait works.** Holding the phone sideways like a steering
  wheel suits tilt best and shows more of the cave. The camera always shows at least
  18 tiles (36 m) across the screen's short side, so portrait works too, just with
  less to the sides.
- **Progress in localStorage.** Unlocked levels, best times, stars and settings are
  small, so they go in localStorage (behind try/catch, like the theme), not IndexedDB.
- **Performance target:** 60 fps on a mid-range phone in a 200×100-tile level with
  30 hazards on screen.

## Layout

```
src/
  main.js          routes and pages: home, levels, play, help
  game.js          owns the level in play, the view and the controls; fixed-timestep loop
  controls.js      tilt, touch and keys → { steer, thrust }
  progress.js      unlocked levels, best times, stars, settings (localStorage)
  sim/
    rocket.js      flight: thrust, gravity, lean, fuel, hull
    level.js       parses a level's text into tiles, pads, keys, doors and hazards
    outline.js     marching squares: tiles → rock outline segments, looked up by tile
    collide.js     the rocket against the outline and closed doors; landing
    world.js       a level in play: rocket, pickups, doors and gates, checkpoint, clock
    hazards/       one file per kind: its state, step(), and what it hits
  levels/
    index.js       the worlds in order, each with its levels and colours
    1-1.js …       one level per file
  render/
    view.js        scene, camera, lights
    cave.js        the rock mesh, built once per level from the outline
    rocket.js      rocket model, flame, legs, light
    things.js      pads, crystals, hazards
    doors.js       keys, doors, gates and switch posts
  ui/
    dom.js         shared page bits: icons, stars, theme picker, fullscreen button
    play.js        the play page: HUD, pause menu, level complete sheet, dev overlay
    map.js         the map of what's been seen
  looks.js         key colours and shapes, for the scene, the HUD and the map
  theme.js, fullscreen.js, style.css
scripts/
  autopilot.js     flies a level pad to pad, for tuning and for the level tests
  fly.js           npm run fly: each level's legs, with time and fuel
test/              node:test specs for sim/, progress, and a check of every level
```

## The level format

```js
// src/levels/2-5.js
export default {
  name: "The switch",
  fuel: 16, // seconds of full burn in a full tank
  par: 20, // seconds, for the time star
  route: "1 3 E", // the autopilot's stops (scripts/autopilot.js)
  // Things that need more than a letter, by the digit that marks them.
  things: {
    1: { kind: "switch", opens: 2 }, // opens gate 2 for good
    2: { kind: "gate" },
    3: { kind: "switch", opens: 4, time: 10 }, // for 10 s from lift-off
    4: { kind: "gate" },
  },
  map: `
    ##########################
    #......2..........4......#
    #......2...*......4......#
    #......2..........4......#
    #.SSS..2...333....4..EEE.#
    ##########################
  `,
};
```

| Letter      | Meaning                                                    |
| ----------- | ---------------------------------------------------------- |
| `#`         | rock                                                       |
| `.`         | air                                                        |
| `S`         | start pad: the rocket starts landed on it                  |
| `E`         | exit pad: land on it to finish                             |
| `F`         | fuel pad (a checkpoint)                                    |
| `*`         | crystal                                                    |
| `r y g b`   | key                                                        |
| `R Y G B`   | door: a rectangle of its letter, opened by its key         |
| `< > ^ v`   | flamethrower facing that way, with the default cycle       |
| `~`         | lava                                                       |
| `1`–`9`     | a thing set up in `things`: a switch (a pad) or a gate (a rectangle) |

A pad is a run of at least 3 of its letter on the air row just above a flat floor;
so is a switch. Door and gate tiles are air to the rock outline, and block as
rectangles while shut. A level has at most one key of each colour, every door's key
is on the map, every switch opens a gate and every gate has a switch. Later hazards
get letters as they arrive.

`route` lists the autopilot's stops: keys by letter, `F` for the nearest other fuel
pad or `F@45` for the one at map column 45, switches by digit, and `E`. Without
one, it flies the fuel pads in order of distance from the start, then the exit.

## Worlds and difficulty

Six worlds of eight levels: 48 levels to start, with room for more worlds. Each
world brings in one new thing. It teaches it in its first level, where mistakes are
cheap, mixes it with what came before in the middle levels, and ends with a long,
hard level. Levels get harder in these ways:

- **Room:** tunnels and gaps get narrower.
- **Fuel:** the tank holds less compared with what the route needs, and pads get further apart.
- **Timing:** hazard windows get shorter, and hazards start to overlap.
- **Routes:** more keys, more branches and backtracking, crystals in nastier places.
- **Pressure:** timed gates, and at the end, rising lava.

| World | Name           | Brings in                                   | Narrowest gap | Tank vs route |
| ----- | -------------- | ------------------------------------------- | ------------- | ------------- |
| 1     | Training caves | flying, landing, fuel pads                  | 16 m          | 2×, 1.4×      |
| 2     | Old mine       | keys, doors, switches                       | 12 m          | 1.6×          |
| 3     | Furnace        | flamethrowers, lava                         | 10 m          | 1.4×          |
| 4     | Works          | fans, crushers, moving blocks               | 10 m          | 1.3×          |
| 5     | Deep dark      | darkness, lasers, turrets                   | 8 m           | 1.25×         |
| 6     | Core           | falling rock, crumbling floors, rising lava | 7 m           | 1.2×          |

These figures are starting points, to be tuned by playing. "Tank vs route" is the
tank against the fuel the autopilot (`npm run fly`) burns on the longest leg
between pads. Where a level needs its pads, the tank must also be less than two
legs together, so it can't be much over 1.4× (world 1 is 2× on its levels without
fuel pads, 1.4× on those with them). Each world has its own
rock colour, lighting and background, so you can see yourself getting deeper.

Level design rules:

- Teach, then test. Something new first appears where a mistake costs little.
- No blind drops. You can see what's below before you commit to it.
- A pad before every hard part, and never much more than a minute's flying between
  pads (less in the early worlds).
- Crystals are off the main route and never needed to finish.
- Everything dangerous reads at a glance on a small screen, and not by colour alone.
- Par times come from real runs, not guesses. The autopilot's time, rounded up to
  5 s, is the first guess (it's careful, at most 9 m/s); then the dev overlay's
  timings from real flights.

## How each phase works

- It ends with a build you can play on the phone and a short checklist to try by hand.
- New sim logic gets `npm test` coverage, and from phase 3 every level is checked
  by `test/levels.test.js`, which includes the autopilot finishing it within its tank.
- A new hazard gets a sim file in `sim/hazards/`, a model in `render/things.js`, a
  letter or a `things` kind, and its first level teaches it.
- Commit when tests and build pass.

## Phases

### Phase 0: Prototype ✅ (done)
Tilt to steer, hold to burn, over a flat field that fades into space. Land slower
than 5 m/s and nearly upright, or crash; tap to go again. Home, Play and Help
pages, theme and fullscreen.

### Phase 1: Caves ✅ (done)
Levels become caves. `sim/level.js` parses a map. Short rows are filled with rock,
and it refuses, naming the row and column: unknown letters, pads under 3 tiles
wide, pads not on rock or without 3 tiles of air above, and anything but one start
and one exit. `sim/outline.js` makes the rock outline with marching squares, and
answers `solidAt` and `floorAt`. `render/cave.js` draws the rock's face flat at
z = 0, the plane the rocket flies in, and its surfaces going back 10 m to a dark
back wall, with a lighter rim along the edge and a generated rock texture.

For collision the rocket is 12 circles (`SHAPE` in `sim/rocket.js`: feet, fins,
engine, body, nose), and it turns about its centre of mass. Both feet on flat
floor, under 5 m/s and within 20° of upright, is a landing, on any floor, not just
pads. Anything else is a hit: the rocket bounces off (30%, with friction) and loses
7 hull per m/s it hit at over 1.5 m/s. 13 m/s or more, or an empty hull, is a
crash. Substeps keep every move under 0.15 m, so nothing passes through rock; a
test flies 30,000 ticks of random input round the test cave and checks.

The rocket starts on the `S` pad, and landing on `E` shows *Level complete* with
the time. The HUD shows the clock (from lift-off) and a hull bar, and the screen's
edges flash red on a hit. The camera looks 0.4 s ahead, shows at least 36 m across
the short side (up to 25% more at speed), and stays inside the level. `/play` loads
the test cave (`levels/testcave.js`) and the open field is gone. The rocket stands
on three fins ending in feet, glows red when hit, and carries a light, with another
under the engine while it burns. Drag went from 0.05 to 0.4 (a fall tops out at
about 25 m/s) and the turn rate from 3 to 3.5 rad/s; both still need tuning by
flying the test cave.
- [ ] The cave looks like rock with smooth corners, not squares, and the rocket is always easy to spot.
- [ ] Brushing a wall bounces off with a little damage; flying into one fast destroys the rocket.
- [ ] You can land on any flat floor, but not on a slope or a ledge narrower than the rocket's legs.
- [ ] Landing on the exit pad finishes the level and shows the time.
- [ ] Nothing ever sticks in or passes through rock, even at full speed.
- [ ] Still 60 fps on the phone.

### Phase 2: Fuel and checkpoints ✅ (done)
The rocket's tank holds the level's `fuel` in seconds of full burn (`TANK`, 15, if
not set). Burning uses it, and with none left the engine only sputters (a weak,
broken flame). Landing on a fuel pad (`F`, any number of them) fills an empty tank
and mends a wrecked hull in 1.5 s (`REFUEL_TIME`), and makes that pad the
checkpoint. The pad is blue, and its pump behind has a gauge that fills with the
rocket's tank and a lamp that's lit while it's the checkpoint. After a crash, or
when stranded (out of fuel and landed away from a fuel pad, or stuck still for a
second somewhere it can't land), a tap after a second puts a fresh rocket on the
checkpoint, the start pad until the first fuel pad. The checkpoint is only the pad
for now; phase 4 adds keys and doors to it. The clock keeps running through
crashes and restarts. The HUD has fuel and hull bars: fuel goes amber below 30%
and flashes red below 15%, hull goes amber below 60% and red below 30%. Messages
say where a tap takes you back to, and the *Level complete* banner counts the
restarts. The test cave has a fuel pad at the top of the shaft and one at the
bottom of the drop, and a 12 s tank.
- [ ] Fuel only goes down while burning, and the bar reads at a glance mid-flight.
- [ ] With an empty tank you fall; landed and empty, you're offered a restart from the last pad.
- [ ] Landing on a fuel pad fills up and repairs, and a later crash puts you back on it.
- [ ] The clock keeps running across restarts.

### Phase 3: Levels, worlds and progress ✅ (done)
The game becomes a series of levels. `levels/index.js` lists the worlds and their
levels. A new page, `/levels`, shows each world as a grid of its levels with the
stars earned; locked levels are greyed out. Levels play at `/play/1-3`. Crystals
(`*`) are collected and counted on the HUD. The level complete sheet shows the time
against par, crystals and stars (new ones animate in), with Retry, Levels and Next.
A pause menu (button, P or Esc, and whenever the app is hidden) has Resume, Restart
from pad, Restart level and Levels, plus settings: tilt sensitivity (`FULL_TILT`),
theme and fullscreen. `progress.js` saves unlocked levels, best times, stars and
settings. Home gets Continue, which plays the next unfinished level.

`test/levels.test.js` checks every level. It must parse and have one start pad and
one exit pad, and every pad must sit on flat floor and be wide enough. Every door
needs its key. A flood fill over the air, narrowed by the rocket's size, must get
from the start to the exit and to every crystal, opening each door only once its
key has been reached. A dev overlay (`?dev`) shows the tile under your finger and
the fuel and time since the last pad, with keys for no damage and endless fuel, to
build and tune levels.

Then world 1, *Training caves*: 8 levels that teach flying up, across and down,
landing on small ledges, and fuel and pads, ending with a long level that needs
every pad.

What was built: crystals are picked up within 1 m of the rocket's shape, and a
checkpoint now saves the crystals too, so a restart puts back any taken since.
Stars are worked out from a level's record (`{ best, crystals }`), so changing a
par time moves them. `/play` alone plays the next level to do, and locked levels
say so (`?dev` opens them all). The pause menu and the results sheet go two
columns on a phone held sideways. The flood fill in `test/levels.test.js` moves an
upright rocket in 1 m steps; doors join it in phase 4. The dev overlay also shows
the frame rate and puts the game on `window.game`.

`scripts/autopilot.js` flies a level pad to pad along a path that keeps clear of
rock, steering for a point 5 m ahead at up to 9 m/s. `npm run fly` prints each
leg's length, time and fuel; `test/levels.test.js` checks it finishes every level
within its tank.

World 1 was laid out with a carving script (tunnels and shafts with ragged
walls), and its tanks and pars are set from the autopilot:

| Level | Name       | Autopilot | Par  | Tank | Fuel per leg          |
| ----- | ---------- | --------- | ---- | ---- | --------------------- |
| 1-1   | Lift-off   | 8.2 s     | 10 s | 12 s | 4.5                   |
| 1-2   | The gap    | 14.6 s    | 15 s | 16 s | 7.7                   |
| 1-3   | Chimney    | 14.4 s    | 15 s | 18 s | 9.1                   |
| 1-4   | The well   | 14.7 s    | 15 s | 13 s | 6.5                   |
| 1-5   | Ledges     | 13.2 s    | 15 s | 15 s | 7.6                   |
| 1-6   | Pit stop   | 21.4 s    | 25 s | 9 s  | 4.9, 6.0              |
| 1-7   | Switchback | 39.4 s    | 45 s | 12 s | 6.7, 6.4, 8.7         |
| 1-8   | Grand tour | 54.3 s    | 60 s | 11 s | 8.3, 7.1, 6.6, 7.5    |

- [ ] A new player can tell where to go in 1-1 without reading anything.
- [ ] Finishing a level unlocks the next, and stars and best times survive a reload.
- [ ] Pause and restart work from the keyboard and with one thumb.
- [ ] The eight levels get harder smoothly: none is a wall, and 1-8 is a real test.
- [ ] A change of tilt sensitivity is noticeable straight away.

### Phase 4: Keys, doors and switches ✅ (done)
Keys (`r y g b`) float and spin, and flying through one picks it up and shows it on
the HUD. Doors (`R Y G B`) are solid rock-like slabs with their key's colour and
shape on them; they slide open, and stay open, when you come near with the key.
Switches are small pads you land on. Each opens a numbered gate, either for good or
for a set time, with a countdown on the gate: the first time you have to hurry. A
map (button or M) shows the parts of the cave you've seen, with pads, keys and
doors marked, since levels now branch. Then world 2, *Old mine*: 8 levels of keys,
branches and backtracking, with timed gates in the second half.
What was built: keys are tokens in their colour and shape (red circle, yellow
triangle, green square, blue cross; `looks.js`), rocking in a glow, and doors are
steel slabs framed in that colour with the shape on each tile. A door opens when
the rocket's centre comes within 10 m of it with the key, and slides up (or aside,
if it's wide) into the rock. Gates are striped orange and black with their switch's
number, and a switch has a numbered post with a lamp: green while its gate is open,
blinking for a timed gate's last three seconds. A timed gate's time restarts while
the rocket sits on the switch, so it runs from lift-off; the HUD counts it down
("Gate 3 shuts in 6"), and it never shuts on the rocket. A shut door or gate is a
rectangle in the collision (`deepestContact`'s `boxes`), and its top is floor you
can land on. Checkpoints save keys, open doors and gates open for good; timed gates
come back shut. The map (button or M, pausing the game) draws the tiles within 24 m
of anywhere the rocket has been, with pads, shut doors and gates, and the keys and
crystals still there. The level tests' flood fill opens doors and gates as their
keys and switches come within reach, and the autopilot follows each level's
`route`; its paths now really keep clear of rock (a bug had them hugging it).

World 2, *Old mine*: 2-1 The red door, 2-2 Two keys, 2-3 Crossroads, 2-4 Backtrack,
2-5 The switch, 2-6 Against the clock, 2-7 Mine shafts, 2-8 The deep mine. Tanks
are 1.6× the longest stretch between fuel pads (1.3× in 2-8, the world's test),
and gate times 1.2–1.5× the autopilot's.

- [ ] Keys stand out from a distance, and you can tell which door each one opens.
- [ ] A door opens as you arrive with its key; without it, it's clearly locked.
- [ ] A timed gate's countdown can be seen from its switch, or the route makes it obvious.
- [ ] Restarting from a pad puts keys, doors and gates back as they were when you landed there.
- [ ] The map helps you find your way back without giving the level away.

### Phase 5: Flamethrowers and lava
Flamethrowers (`< > ^ v`, or numbered in `things` for their own settings) are set
in the rock and shoot a jet of flame several tiles long on a cycle: half a second
of flicker and hiss, then on, then off. Their settings are length, on time, off
time and offset, so a row of them can fire in a wave. Some are always on, and some
fire when the rocket comes near. Flame burns hull fast while you're in it, so
clipping the tip is survivable but sitting in it isn't. Lava (`~`) glows on cave
floors and destroys the rocket on touch, and some pools throw up blobs on a cycle.
Then world 3, *Furnace*: 8 levels with a hot palette, flamethrower timing and lava
floors that make every landing count.
- [ ] You can always see a flamethrower is about to fire before it does.
- [ ] The flame hurts exactly where it's drawn.
- [ ] A row of offset flamethrowers makes a wave you can read and time.
- [ ] 20 flamethrowers on screen still run at 60 fps.

### Phase 6: Game feel
Sound made in code with Web Audio (no files): an engine roar that follows the
burn, scrapes, bumps, crash, key, crystal, door, fuel pump, flame hiss, a low-fuel
beep and a level complete jingle. Volume and mute go in the pause menu. Particles:
exhaust smoke, sparks on scrapes, debris and smoke on a crash, embers near fire. A
small camera shake on hits, and a buzz on hits and landings where the phone can
vibrate. Each world gets its palette, lighting and background, and an intro on the
levels page. This phase can move earlier if the game feels flat while testing.
- [ ] You can tell you're burning from the sound alone.
- [ ] Hits feel like hits (sound, shake, sparks, buzz) and landings feel solid.
- [ ] Mute is remembered.

### Phase 7: Machinery
Fans blow the rocket along a column of moving dust, and some switch on and off.
Crushers are pistons that slam across a tunnel on a cycle, with a warning before
each slam. Moving blocks slide back and forth along a path, and some carry a pad.
Moving rock pushes the rocket and carries it when it's landed on top, and being
squeezed against rock is a crash. Then world 4, *Works*: 8 levels with an
industrial palette.
- [ ] A full burn can fight a fan, except where the fan is meant to win.
- [ ] Moving blocks push and carry the rocket, and it never ends up stuck inside one.
- [ ] Crushers warn you before every slam.

### Phase 8: Deep dark and defences
Dark levels have no light but the rocket's headlight, which points where the nose
points, and whatever glows: crystals, pads, lava and fire. Laser gates are beams
between two emitters, switched by a cycle or a switch, and touching one is a crash.
Turrets wind up and fire slow, glowing shots at the rocket when they can see it,
and each shot costs hull. Then world 5, *Deep dark*: 8 levels.
- [ ] In the dark you can see enough to fly carefully, but not far.
- [ ] A turret shot can always be dodged if you're paying attention.
- [ ] You can always tell whether a laser is on or off.

### Phase 9: The core
Stalactites shake, then drop, when the rocket passes under them. Crumbling rock
(`%`) cracks and falls away a moment after the rocket touches it or lands on it.
In escape levels lava rises at a set speed, from the start or from a trigger, and
the camera keeps it in view. Then world 6, *Core*: 8 levels, ending with a long
escape from the core up to the surface, where the sky and stars from the
prototype are waiting.
- [ ] Stalactites always shake before they fall.
- [ ] Crumbling floor gives you time to take off if you're quick.
- [ ] The last level is hard but fair, and feels like an ending.

## Later

- **Level editor** on the phone: paint tiles, place things, fly the level at once,
  and share it as a link (the map compressed into the URL).
- **Ghosts:** record your best run's inputs and race against it. The sim is
  deterministic, so replaying the inputs replays the run.
- **Endless caves:** a generated cave each day, the same for everyone.
- **Cargo:** carry a pod on a rope under the rocket, like Thrust, and set it down at the exit.
- **Assist mode:** more hull and fuel and slower hazards, for anyone who wants to see
  every level without the fight.
- **More worlds:** water (floaty and slow), low gravity, magnets, portals.
- **Offline:** a service worker, so it plays with no connection.
- **Gamepad** support.
