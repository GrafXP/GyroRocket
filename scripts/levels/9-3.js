import { Grid, buildLevel } from "./grid.js";

const W = 130;
const H = 140;
const g = new Grid(W, H);
// A 4 s beat: blobs every 4 s, flames 1.5 s in 4. Stalactites shake for half a
// second once you're within 6 m of being under them.
const BLOB = { kind: "blob", height: 6, period: 4, warn: 0.6 };
const WALL = { kind: "flame", facing: "right", length: 9, on: 1.5, off: 2.5, warn: 0.5 };
const drop = g.label({ kind: "stalactite", reach: 6, warn: 0.5 });
const blob = (c, r, offset) => g.set(c, r, g.label({ ...BLOB, offset }));
const NEAR = { kind: "flame", mode: "near", on: 1, off: 1.5, warn: 0.5, reach: 5 };
const near = g.label({ ...NEAR, facing: "down", length: 8 });
// Across a shaft, where you cross the flame going down, it rests 2 s: the
// rocket is tall.
const SIDE = { ...NEAR, off: 2 };

// The start, top left, under a row of stalactites on the way to the first floor.
g.air(3, 3, 34, 10);
g.pad("S", 10, 10);
[18, 28].forEach((c) => g.set(c, 3, drop));

// 1. The first floor: down a shaft onto a floor of crumbling rock, which gives
//    way, and past a flame that fires as you come near, into a chamber of blob
//    pools, under stalactites and another such flame, to a pad on an island.
g.air(22, 11, 31, 32);
g.fill(22, 22, 31, 23, "%");
g.set(21, 28, g.label({ ...SIDE, facing: "right", length: 5 }));
g.air(8, 33, 76, 48);
g.fill(8, 49, 58, 50, "~");
[30, 38, 46, 54].forEach((c, k) => blob(c, 49, k * 2));
[36, 44, 52].forEach((c) => g.set(c, 33, drop));
g.set(48, 32, near);
g.rock(60, 44, 66, 50);
g.pad("F", 61, 43);
g.air(12, 28, 15, 32); // an alcove in the chamber's roof, with a crystal: the easy one
g.set(13, 29, "*");

// 2. The second floor: under a stalactite into a shaft, under a flame that
//    fires across it on the beat, onto crumbling rock, past a flame that fires
//    as you come near, and down into a chamber of blob pools under crumbling
//    bridges, stalactites and another near flame, to a pad on an island.
g.air(68, 49, 76, 71);
g.set(67, 55, g.label({ ...WALL, offset: 0 }));
g.fill(68, 64, 76, 65, "%");
g.set(72, 33, drop);
g.set(77, 69, g.label({ ...SIDE, facing: "left", length: 5 }));
g.air(40, 72, 112, 90);
g.fill(40, 91, 98, 92, "~");
[48, 58, 70, 78, 94].forEach((c, k) => blob(c, 91, k * 2));
[
  [44, 54],
  [62, 67],
].forEach(([c0, c1]) => g.fill(c0, 84, c1, 84, "%"));
[80, 96].forEach((c) => g.set(c, 72, drop));
g.set(58, 71, near);
g.rock(84, 86, 90, 92);
g.pad("F", 85, 85);
// A side branch off the chamber, with a crystal at its end.
g.air(113, 76, 124, 80);
g.set(122, 78, "*");

// 3. The third floor: down a shaft through two walls of flame on the beat, onto
//    crumbling rock, into the lowest chamber past a near flame, to a pad under
//    the hole.
g.air(100, 91, 108, 114);
[97, 105].forEach((r, k) => g.set(99, r, g.label({ ...WALL, offset: k * 2 })));
g.fill(100, 112, 108, 113, "%");

// 4. The bottom: west over the lava to a pad on an island, under stalactites and a flame that fires as you come near, and
//    between blobs, then on to the exit on an island at the far end. A crystal
//    low between two blobs, over a crumbling ledge.
g.air(14, 115, 110, 132);
g.fill(14, 133, 110, 134, "~");
[94, 86, 74, 64, 44, 30].forEach((c, k) => blob(c, 133, k * 2));
[90, 82, 70, 60, 40].forEach((c) => g.set(c, 115, drop));
g.set(78, 114, near);
g.set(111, 120, g.label({ ...SIDE, facing: "left", length: 6 }));
g.rock(102, 128, 110, 134);
g.pad("F", 104, 127);
g.rock(52, 128, 58, 134);
g.pad("F", 53, 127);
g.fill(33, 130, 37, 130, "%");
g.set(35, 128, "*");
g.rock(16, 126, 24, 134);
g.pad("E", 18, 125);

g.roughen(93, 0.3);
const header = `9-3: A long way down through crumbling floors over blob pools; the way back up is gone, so every pad is a step forward.

From the top left, down through three floors of crumbling rock, each into a
chamber of blob pools, to the exit on an island in the lowest. Once a floor has
gone, there's no reason to go back up: every pad is on the way down. A 4 s
beat: blobs every 4 s, flames 1.5 s in 4. Stalactites shake for half a second
once you're within 6 m of being under them.

Sections, in order:
1. The first floor: down a shaft onto a floor of crumbling rock, which gives
   way, and past a flame that fires as you come near, into a chamber of blob
   pools, under stalactites and another such flame, to a pad on an island.
   A crystal in an alcove in the chamber's roof.
2. The second floor: under a stalactite into a shaft, under a flame that
   fires across it on the beat, onto crumbling rock, past a flame that fires
   as you come near, and down into a chamber of blob pools under crumbling
   bridges, stalactites and another near flame, to a pad on an island. A
   crystal at the end of a side branch.
3. The third floor: down a shaft through two walls of flame on the beat, onto
   crumbling rock, into the lowest chamber past a near flame, to a pad under
   the hole.
4. The bottom: west over the lava, under
   stalactites and a flame that fires as you come near, and between blobs, to
   a pad on an island and on to the exit on an island at the far end. A
   crystal low between two blobs, over a crumbling ledge.`;
await buildLevel("9-3", g, { header, name: "Landslide", fuel: 23, par: 125 });
