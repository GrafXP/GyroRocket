import { Grid, buildLevel } from "./grid.js";

const W = 100;
const H = 140;
const g = new Grid(W, H);
// A 4 s beat: the flames across the rift fire 1 s in 4, one after another, a
// wave that runs down the west rift and up the east one. Stalactites shake for
// half a second once you're within 6 m of being under them; a flame that fires
// as you come near rests for 2 s.
const WAVE = { kind: "flame", on: 1, off: 3, warn: 0.5, length: 14 };
const NEAR = { kind: "flame", mode: "near", on: 1, off: 2, warn: 0.5, reach: 5, length: 7 };
const drop = g.label({ kind: "stalactite", reach: 6, warn: 0.5 });
// Flames across a rift from its west wall at column c0 - 1 or its east wall at
// c1 + 1, alternately, on rows `rows`, firing `step` seconds one after another.
const wave = (c0, c1, rows, step) =>
  rows.forEach((r, k) => (k % 2 ? g.set(c1 + 1, r, g.label({ ...WAVE, facing: "left", offset: k * step })) : g.set(c0 - 1, r, g.label({ ...WAVE, facing: "right", offset: k * step }))));

// The start, top left.
g.air(3, 3, 23, 9);
g.pad("S", 4, 9);
g.air(1, 4, 2, 6); // an alcove off the start, with a crystal: the easy one
g.set(1, 5, "*");

// 1. Down the west rift, through a wave of flames across it, past crumbling
//    ledges, to a pad in a nook in its wall.
g.air(10, 10, 23, 117);
wave(10, 23, [18, 26, 34, 42, 50], 0.8);
g.fill(10, 30, 12, 30, "%");
g.fill(21, 46, 23, 46, "%");
g.air(4, 56, 9, 60);
g.pad("F", 5, 60);

// 2. On down, under stalactites hanging from overhangs, past crumbling ledges
//    and flames that fire as you come near, to a pad in a nook at the foot.
g.rock(10, 66, 13, 67).set(13, 68, drop);
g.rock(20, 76, 23, 77).set(20, 78, drop);
g.rock(10, 88, 13, 89).set(13, 90, drop);
g.set(24, 84, g.label({ ...NEAR, facing: "left" }));
g.set(9, 98, g.label({ ...NEAR, facing: "right" }));
g.fill(21, 94, 23, 94, "%");
g.rock(20, 102, 23, 103).set(20, 104, drop);
// A crystal on a crumbling ledge between the flames: the skilful one.
g.fill(10, 72, 12, 72, "%");
g.set(11, 70, "*");

// 3. The floor of the rift: east over the lava, between blobs and under
//    stalactites, past the red key, to the red door into the east rift.
g.air(10, 118, 73, 130);
g.air(24, 110, 29, 116);
g.pad("F", 25, 116);
g.fill(10, 131, 73, 132, "~");
[28, 38, 48].forEach((c, k) => g.set(c, 131, g.label({ kind: "blob", height: 6, period: 4, warn: 0.6, offset: k * 1.33 })));
[33, 43, 53].forEach((c) => g.set(c, 118, drop));
g.set(40, 124, "r");
g.rock(56, 126, 62, 132);
g.pad("F", 57, 125);
// A side branch off the floor, with a crystal at its end.
g.air(74, 124, 90, 128);
g.set(88, 126, "*");
g.fill(60, 112, 73, 117, "R");

// 4. Up the east rift, under stalactites, past crumbling ledges and flames that
//    fire as you come near, to a pad in a nook in its wall.
g.air(60, 10, 73, 111);
g.rock(70, 96, 73, 97).set(70, 98, drop);
g.set(59, 90, g.label({ ...NEAR, facing: "right" }));
g.rock(60, 80, 63, 81).set(63, 82, drop);
g.fill(71, 86, 73, 86, "%");
g.set(74, 72, g.label({ ...NEAR, facing: "left" }));
g.air(74, 58, 79, 62);
g.pad("F", 75, 62);

// 5. On up through a wave of flames across the rift, to the exit.
wave(60, 73, [50, 42, 34, 26, 18], 0.8);
g.fill(60, 38, 62, 38, "%");
g.air(60, 3, 95, 9);
g.pad("E", 86, 9);

g.roughen(95, 0.3);
const header = `9-5: A huge crack: flamethrowers fire up its walls in a wave, stalactites hang over it, and the only ledges crumble.

Down the west rift from the top, east along its floor over the lava to the red
key and door, and up the east rift to the exit. A 4 s beat: the flames across
the rifts fire 1 s in 4, one after another, a wave that runs down the west rift
and up the east one. Stalactites shake for half a second once you're within 6 m
of being under them; a flame that fires as you come near rests for 2 s. The
ledges along the walls are crumbling rock; the pads are in nooks in the walls.

Sections, in order:
1. Down the west rift, through a wave of flames across it, past crumbling
   ledges, to a pad in a nook in its wall. A crystal in an alcove off the
   start.
2. On down, under stalactites hanging from overhangs, past crumbling ledges and
   flames that fire as you come near, to a pad in a nook at the foot. A
   crystal on a crumbling ledge between the flames.
3. The floor of the rift: east over the lava, between blobs and under
   stalactites, past the red key, to a pad on an island and the red door into
   the east rift. A crystal at the end of a side branch.
4. Up the east rift, under stalactites, past crumbling ledges and flames that
   fire as you come near, to a pad in a nook in its wall.
5. On up through a wave of flames across the rift, to the exit.`;
await buildLevel("9-5", g, { header, name: "The rift", fuel: 24, par: 130, route: "F@6 F@26 r F@58 F@76 E" });
