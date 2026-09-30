import { Grid, buildLevel } from "./grid.js";

const W = 100;
const H = 140;
const g = new Grid(W, H);
// A 4 s beat: the flames across the rift fire 1 s in 4, one after another, a
// wave that runs down the west rift and up the east one. Between the waves,
// flames right across the rift that fire as you come near, rest for 2 s, every
// 12 m. Stalactites shake for half a second once you're within 6 m of being
// under them, or 9 m in the west rift's pockets and over the floor, where they
// have far to fall, so they come down in front of you.
const WAVE = { kind: "flame", on: 1, off: 3, warn: 0.5, length: 10 };
const NEAR = { kind: "flame", mode: "near", on: 1, off: 2, warn: 0.5, reach: 5 };
const drop = g.label({ kind: "stalactite", reach: 6, warn: 0.5 });
const fall = g.label({ kind: "stalactite", reach: 9, warn: 0.5 });
// In the pockets up the east rift, they shake only once you're within 3 m, so
// they wait for you to come close rather than fall while you're far below.
const edge = g.label({ kind: "stalactite", reach: 3, warn: 0.5 });
// Flames across a rift from its west wall at column c0 - 1 or its east wall at
// c1 + 1, alternately, on rows `rows`, firing `step` seconds one after another.
const wave = (c0, c1, rows, step) =>
  rows.forEach((r, k) => (k % 2 ? g.set(c1 + 1, r, g.label({ ...WAVE, facing: "left", offset: k * step })) : g.set(c0 - 1, r, g.label({ ...WAVE, facing: "right", offset: k * step }))));
// Flames right across a rift that fire as you come near, from the west wall
// (facing right) or the east.
const across = (c0, c1, r, west) => g.set(west ? c0 - 1 : c1 + 1, r, g.label({ ...NEAR, facing: west ? "right" : "left", length: c1 - c0 + 1 }));

// A crumbling ledge on the west or east wall of a rift from column c0 to c1, on
// row r, or a stalactite in a pocket there, hanging from an overhang.
const ledge = (c0, c1, r, west) => g.fill(west ? c0 : c1 - 1, r, west ? c0 + 1 : c1, r, "%");
const pocket = (c0, c1, r, west, s = fall) => g.rock(west ? c0 : c1 - 1, r - 2, west ? c0 + 1 : c1, r - 1).set(west ? c0 + 1 : c1 - 1, r, s);
// A flame down across the way into a nook, from its roof on row r0 - 1 to row
// r1, that fires as you come near.
const curtain = (c, r0, r1) => g.set(c, r0 - 1, g.label({ ...NEAR, off: 1.5, facing: "down", length: r1 - r0 + 1 }));

// The start, top left, under stalactites over the top of the rift.
g.air(3, 3, 23, 9);
g.pad("S", 4, 9);
g.air(1, 4, 2, 6); // an alcove off the start, with a crystal: the easy one
g.set(1, 5, "*");
[14, 19].forEach((c) => g.set(c, 3, drop));

// 1. Down the west rift, through a wave of flames across it, past crumbling
//    ledges and stalactites in pockets in its walls, to a pad in a nook in its
//    wall, behind a flame that fires as you come near.
g.air(12, 10, 21, 117);
wave(12, 21, [18, 26, 34, 42, 50], 0.8);
[22, 38, 54].forEach((r) => (ledge(12, 21, r, false), pocket(12, 21, r, true)));
[30, 46].forEach((r) => (ledge(12, 21, r, true), pocket(12, 21, r, false)));
g.air(4, 56, 11, 60);
g.pad("F", 5, 60);
curtain(10, 56, 60);

// 2. On down, through flames right across the rift that fire as you come near,
//    between crumbling ledges and stalactites in pockets, to a pad in a nook
//    halfway, and on through more to a pad in a nook at the foot. A crystal on
//    a crumbling ledge just under one of the flames: the skilful one.
[65, 77, 96, 108].forEach((r) => across(12, 21, r, false));
[71, 83, 102].forEach((r) => across(12, 21, r, true));
g.fill(12, 72, 13, 72, "%");
g.set(12, 70, "*");
[68, 80, 99].forEach((r) => (ledge(12, 21, r, false), pocket(12, 21, r, true)));
[74, 93, 105].forEach((r) => (ledge(12, 21, r, true), pocket(12, 21, r, false)));
g.air(4, 86, 11, 90);
g.pad("F", 6, 90);
curtain(10, 86, 90);

// 3. The floor of the rift: east under stalactites, over the lava, past a flame
//    from the roof that fires as you come near, between blobs and under more
//    stalactites, past the red key, to the red door into the east rift.
g.air(10, 118, 73, 130);
g.air(22, 110, 29, 116);
g.pad("F", 25, 116);
curtain(23, 110, 116);
[24, 27].forEach((c) => g.set(c, 118, fall));
g.fill(10, 131, 73, 132, "~");
[19, 35, 46].forEach((c, k) => g.set(c, 131, g.label({ kind: "blob", height: 6, period: 4, warn: 0.6, offset: k * 1.33 })));
g.set(32, 117, g.label({ ...NEAR, off: 1.5, facing: "down", length: 13 }));
[40, 43, 51, 54].forEach((c) => g.set(c, 118, fall));
g.set(40, 124, "r");
g.rock(56, 126, 62, 132);
g.pad("F", 57, 125);
// A side branch off the floor, with a crystal at its end.
g.air(74, 124, 90, 128);
g.set(88, 126, "*");
g.fill(60, 112, 73, 117, "R");

// 4. Up the east rift, through flames right across it that fire as you come
//    near, between stalactites in pockets on both walls, to a pad in a nook
//    halfway, and on through more to a pad in a nook in its east wall.
g.air(60, 104, 73, 111);
g.air(62, 10, 71, 103);
across(60, 73, 108, false);
[102, 77, 65].forEach((r) => across(62, 71, r, true));
[96, 83, 71].forEach((r) => across(62, 71, r, false));
// Between the flames, stalactites in pockets on both walls, which shake only
// once you're within 3 m: keep to the middle.
[105, 99, 93, 80, 74, 68].forEach((r) => (pocket(62, 71, r, true, edge), pocket(62, 71, r, false, edge)));
g.air(54, 86, 61, 90);
g.pad("F", 55, 90);
curtain(60, 86, 90);
g.air(72, 56, 79, 60);
g.pad("F", 75, 60);
curtain(73, 56, 60);

// 5. On up through a wave of flames across the rift, past crumbling ledges and
//    stalactites in pockets, and east under stalactites to the exit.
wave(62, 71, [50, 42, 34, 26, 18], 0.8);
[38, 22].forEach((r) => (ledge(62, 71, r, true), pocket(62, 71, r, false, edge)));
[54, 46, 30].forEach((r) => (ledge(62, 71, r, false), pocket(62, 71, r, true, edge)));
pocket(62, 71, 14, true, edge);
pocket(62, 71, 14, false, edge);
g.air(60, 3, 95, 9);
g.set(75, 2, g.label({ ...NEAR, off: 1.5, facing: "down", length: 7 }));
[80, 83].forEach((c) => g.set(c, 3, drop));
g.pad("E", 86, 9);

g.roughen(95, 0.3);
const header = `9-5: A huge crack: flamethrowers fire up its walls in a wave, stalactites hang over it, and the only ledges crumble.

Down the west rift from the top, east along its floor over the lava to the red
key and door, and up the east rift to the exit. A 4 s beat: the flames across
the rifts fire 1 s in 4, one after another, a wave that runs down the west rift
and up the east one. Between the waves, flames right across the rift fire as
you come near, 12 m apart, and rest for 2 s. Stalactites hang in pockets on
the walls, between the flames: in the west rift they shake for half a second
once you're within 9 m of being under them, so they come down around you on
the way down; up the east rift, only once you're within 3 m, so keep to the
middle. Over the floor of the rift, where the roof is high, they shake from
9 m, and at the start and the exit from 6 m. The ledges along the walls are crumbling rock; the pads are in nooks in
the walls, most of them behind a flame that fires as you come near.

Sections, in order:
1. Down the west rift, under stalactites and through a wave of flames across
   it, past crumbling ledges and stalactites in pockets, to a pad in a nook in
   its wall. A crystal in an alcove off the start.
2. On down, through flames right across the rift that fire as you come near,
   between crumbling ledges and stalactites in pockets, to a pad in a nook
   halfway, and on through more to a pad in a nook at the foot. A crystal on a
   crumbling ledge just under one of the flames.
3. The floor of the rift: east under stalactites, over the lava, past a flame
   from the roof that fires as you come near, between blobs and under more
   stalactites, past the red key, to a pad on an island and the red door into
   the east rift. A crystal at the end of a side branch.
4. Up the east rift, through flames right across it that fire as you come
   near, between stalactites in pockets on both walls, to a pad in a nook
   halfway, and on through more to a pad in a nook in its east wall.
5. On up through a wave of flames across the rift, past crumbling ledges and
   stalactites in pockets, and east past a flame from the roof and under
   stalactites to the exit.`;
await buildLevel("9-5", g, { header, name: "The rift", fuel: 29, par: 255, route: "F@6 F@9 F@26 r F@58 F@56 F@76 E" });
