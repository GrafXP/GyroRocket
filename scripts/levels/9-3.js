import { Grid, buildLevel } from "./grid.js";

const W = 130;
const H = 140;
const g = new Grid(W, H);
// A 4 s beat: blobs every 4 s, flames 1.5 s in 4. Stalactites shake for half a
// second once you're within 6 m of being under them, or 9 m, or 11 m in the
// bottom chamber, where the roof is high, so they come down in front of you.
const BLOB = { kind: "blob", height: 6, period: 4, warn: 0.6 };
const WALL = { kind: "flame", facing: "right", length: 9, on: 1.5, off: 2.5, warn: 0.5 };
const DROP = { kind: "stalactite", reach: 6, warn: 0.5 };
const drop = g.label(DROP);
const fall = g.label({ ...DROP, reach: 9 });
const deep = g.label({ ...DROP, reach: 11 });
const blob = (c, r, offset, height = 6) => g.set(c, r, g.label({ ...BLOB, height, offset }));
const NEAR = { kind: "flame", mode: "near", on: 1, off: 1.5, warn: 0.5, reach: 5 };
// Across a shaft, where you cross the flame going down, it rests 2 s: the
// rocket is tall.
const SIDE = { ...NEAR, off: 2 };

// The start, top left, under a row of stalactites on the way to the first floor.
g.air(3, 3, 34, 10);
g.pad("S", 10, 10);
[14, 16, 18, 20, 22, 25, 28].forEach((c) => g.set(c, 3, drop));

// 1. The first floor: down a shaft past a flame across it that fires as you
//    come near, onto a floor of crumbling rock, which gives way, and past
//    another such flame, into a chamber of blob pools, to a pad on a ledge, and
//    east under stalactites and flames that fire as you come near, to a pad on
//    an island.
g.air(22, 11, 31, 32);
g.set(21, 15, g.label({ ...SIDE, facing: "right", length: 10 }));
g.fill(22, 22, 31, 23, "%");
g.set(21, 28, g.label({ ...SIDE, facing: "right", length: 10 }));
g.air(8, 33, 76, 48);
g.fill(8, 49, 58, 50, "~");
blob(21, 49, 3, 7); // thrown up past the way down to the pad
[26, 30, 34, 38, 42, 46, 50, 54].forEach((c, k) => blob(c, 49, k % 4, 5));
[35, 37, 46, 48, 57].forEach((c) => g.set(c, 33, fall));
g.set(66, 33, drop);
[40, 52].forEach((c) => g.set(c, 32, g.label({ ...NEAR, facing: "down", length: 16 })));
g.rock(60, 44, 66, 50);
g.pad("F", 61, 43);
g.ledge("F", 16, 44); // a pad on a ledge under the shaft
g.air(12, 28, 15, 32); // an alcove in the chamber's roof, with a crystal: the easy one
g.set(13, 29, "*");

// 2. The second floor: under stalactites into a shaft, under a flame that
//    fires across it on the beat, past a stalactite under a ledge, onto
//    crumbling rock, past a flame across it that fires as you come near, and
//    down into a chamber of blob pools, through a flame from the roof to the
//    lava that fires as you come near, to a pad on an island, and on under
//    stalactites and between blobs. West, off the way, crumbling bridges over
//    the pools.
g.air(68, 49, 76, 71);
[69, 72].forEach((c) => g.set(c, 33, drop));
g.set(67, 53, g.label({ ...WALL, offset: 0 }));
g.rock(68, 56, 70, 57).set(70, 58, drop);
g.fill(68, 61, 76, 62, "%");
g.set(77, 68, g.label({ ...SIDE, facing: "left", length: 9 }));
g.air(40, 72, 112, 90);
g.fill(40, 91, 98, 92, "~");
[
  [48, 0],
  [58, 2],
  [70, 0],
  [80, 3, 7],
  [82, 1, 7],
  [93, 3],
  [96, 1],
].forEach(([c, offset, height]) => blob(c, 91, offset, height));
[
  [44, 54],
  [62, 67],
].forEach(([c0, c1]) => g.fill(c0, 84, c1, 84, "%"));
g.set(78, 71, g.label({ ...NEAR, facing: "down", length: 19 }));
g.set(83, 72, drop).set(90, 72, drop).set(91, 72, fall).set(92, 72, fall);
g.set(58, 71, g.label({ ...NEAR, facing: "down", length: 8 }));
g.rock(84, 86, 90, 92);
g.pad("F", 85, 85);
// A side branch off the chamber, with a crystal at its end.
g.air(113, 76, 124, 80);
g.set(122, 78, "*");

// 3. The third floor: under two stalactites, down a shaft through two walls of
//    flame on the beat, past a stalactite under a ledge between them, onto
//    crumbling rock, into the lowest chamber past a flame across the way that
//    fires as you come near, to a pad under the hole.
g.air(100, 91, 108, 114);
g.set(100, 72, drop).set(102, 72, drop);
[97, 105].forEach((r, k) => g.set(99, r, g.label({ ...WALL, offset: k * 2 })));
g.rock(100, 100, 101, 101).set(101, 102, drop);
g.fill(100, 112, 108, 113, "%");

// 4. The bottom: west over the lava, under rows of stalactites, between blobs
//    and through flames from the roof to the lava that fire as you come near,
//    to a pad on an island, then on the same way to the exit on an island at
//    the far end. A crystal low between two blobs, over a crumbling ledge.
g.air(14, 115, 110, 132);
g.fill(14, 133, 110, 134, "~");
g.set(111, 120, g.label({ ...SIDE, facing: "left", length: 11 }));
// The flames from the roof reach down to the lava.
const DOWN = g.label({ ...NEAR, facing: "down", length: 18 });
// From the pad under the hole: rows of stalactites, pairs of blobs and flames,
// with 5 columns after each flame and each pair before the next thing that
// goes off because of you, so there's room to stop. The blobs between those
// are thrown up to just short of the way.
[
  [99, "stalactite"],
  [97, "stalactite"],
  [95, "stalactite"],
  [93, "stalactite"],
  [92, "blob", 0],
  [89, "blob", 0],
  [86, "blob", 1],
  [84, "flame"],
  [81, "blob", 3],
  [79, "stalactite"],
  [77, "stalactite"],
  [75, "stalactite"],
  [73, "stalactite"],
  [72, "blob", 2],
  [69, "blob", 2],
  [66, "blob", 3],
  [64, "flame"],
  [61, "blob", 1],
  [59, "stalactite"],
  [49, "flame"],
  [46, "blob", 0],
  [44, "stalactite"],
  [42, "stalactite"],
  [40, "stalactite"],
  [38, "blob", 3],
  [31, "blob", 3],
  [28, "blob", 1],
  [26, "flame"],
].forEach(([c, kind, offset]) => (kind === "blob" ? blob(c, 133, offset) : kind === "flame" ? g.set(c, 114, DOWN) : g.set(c, 115, deep)));
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
once you're within 6 m of being under them, or 9 m, or 11 m in the bottom
chamber, where the roof is high, so they come down in front of you.

Sections, in order:
1. The first floor: down a shaft past a flame across it that fires as you come
   near, onto a floor of crumbling rock, which gives way, and past another such
   flame, into a chamber of blob pools, to a pad on a ledge, and east under
   stalactites and flames that fire as you come near, to a pad on an island. A crystal in an alcove in the
   chamber's roof.
2. The second floor: under stalactites into a shaft, under a flame that fires
   across it on the beat, past a stalactite under a ledge, onto crumbling
   rock, past a flame across it that fires as you come near, and down into a
   chamber of blob pools, through a flame from the roof to the lava that fires
   as you come near, to a pad on an island, and on under stalactites and
   between blobs. West, off the way, crumbling bridges over the pools. A
   crystal at the end of a side branch.
3. The third floor: under two stalactites, down a shaft through two walls of
   flame on the beat, past a stalactite under a ledge between them, onto
   crumbling rock, into the lowest chamber past a flame across the way that
   fires as you come near, to a pad under the hole.
4. The bottom: west over the lava, under rows of stalactites, between blobs
   and through flames from the roof to the lava that fire as you come near, to
   a pad on an island, and on the same way to the exit on an island at the far
   end. A crystal low between two blobs, over a crumbling ledge.`;
await buildLevel("9-3", g, { header, name: "Landslide", fuel: 25, par: 195, route: "F@17 F@62 F@86 F@105 F@54 E" });
