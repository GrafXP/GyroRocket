import { Grid, buildLevel } from "./grid.js";

const W = 160;
const H = 120;
const g = new Grid(W, H);
// The lava rises 1 m/s from 2 s after you take the red key. A flame that
// fires as you come near rests for 1.5 s, or 2 s where you cross it going up;
// stalactites shake for half a second once you're within 6 m of being under
// them. Walls of flame, a vent, gusts and blobs keep a 4 s beat.
const NEAR = { kind: "flame", mode: "near", on: 1, off: 1.5, warn: 0.5, reach: 5 };
const SIDE = { ...NEAR, off: 2 };
const drop = g.label({ kind: "stalactite", reach: 6, warn: 0.5 });
// On a 4 s beat: walls of flame, a vent, gusts and blobs.
const WALL = { kind: "flame", on: 1.5, off: 2.5, warn: 0.5 };
// Gusts along the flames across a shaft, blowing 2 s in 4 from the far wall.
const GUST = { kind: "fan", mode: "cycle", on: 2, off: 2, warn: 0.5, strength: 3, width: 2 };
// Crumbling floors over lava, on row r from column c0 to c1.
const brittle = (c0, c1, r) => g.fill(c0, r, c1, r, "%").fill(c0, r + 1, c1, r + 1, "~");
// A flame right across a shaft from column c0 to c1, from its west wall or its
// east one, with a gust along it from the other wall.
const across = (c0, c1, r, west, gust = true) => {
  const length = c1 - c0 + 1;
  g.set(west ? c0 - 1 : c1 + 1, r, g.label({ ...SIDE, facing: west ? "right" : "left", length }));
  if (gust) g.set(west ? c1 + 1 : c0 - 1, r, g.label({ ...GUST, facing: west ? "left" : "right", length, offset: west ? 0 : 2 }));
};

// The start, bottom left, and the red key at the end of the bottom tunnel,
// under rows of stalactites, past a flame that fires up from the floor as you
// come near and a wall of flame on the beat, over crumbling floors: the key
// wakes the lava.
g.air(3, 104, 62, 114);
g.pad("S", 5, 114);
[11, 14, 17, 20, 41, 44, 47].forEach((c) => g.set(c, 104, drop));
g.pad("F", 29, 114);
brittle(33, 35, 115);
brittle(12, 18, 115);
g.set(24, 115, g.label({ ...NEAR, facing: "up", length: 11 }));
g.set(36, 103, g.label({ ...WALL, facing: "down", length: 11, offset: 0 }));
brittle(38, 43, 115);
g.air(23, 99, 26, 103); // an alcove over the tunnel, with a crystal: the easy one
g.set(24, 100, "*");
g.set(48, 109, "r");

// 1. The first climb: up a shaft on a vent that blows 2 s in 4, through a flame
//    right across it that fires as you come near, a plug of crumbling rock and
//    another such flame, to a pad, and on through a third.
g.air(52, 66, 61, 103);
g.set(56, 115, g.label({ kind: "fan", facing: "up", length: 40, width: 5, strength: 8, mode: "cycle", on: 2, off: 2, warn: 0.5 }));
across(52, 61, 99, true);
g.fill(52, 91, 61, 92, "%");
across(52, 61, 85, false);
// Stalactites under ledges on the east wall.
[95, 80].forEach((r) => g.rock(60, r, 61, r + 1).set(60, r + 2, drop));
g.ledge("F", 53, 78, 3, 2);
across(52, 61, 72, true, false);

// 2. The tube: east along a passage under flames that fire as you come near and
//    stalactites, over crumbling floors, past a pad, to switch 1, which opens
//    gate 2 at the top of the next shaft for 26 s.
g.air(62, 66, 100, 76);
[65, 76, 92].forEach((c) => g.set(c, 65, g.label({ ...NEAR, facing: "down", length: 11 })));
[70, 73, 81, 89].forEach((c) => g.set(c, 66, drop));
[
  [70, 74],
  [78, 81],
  [88, 91],
].forEach(([c0, c1]) => brittle(c0, c1, 77));
g.pad("F", 84, 76);
g.pad(g.thing("1", { kind: "switch", opens: "2", time: 26 }), 96, 76);
// A side branch down from the tube, with a crystal at its end, which the lava
// soon fills.
g.air(64, 77, 68, 84);
g.set(66, 83, "*");

// 3. The second climb: up a shaft through flames right across it that fire as
//    you come near, with gusts along them, past stalactites under ledges,
//    through gate 2, to a pad.
g.air(101, 34, 110, 76);
across(101, 110, 70, false, false); // the tube comes in on the west
across(101, 110, 64, true);
across(101, 110, 58, false);
across(101, 110, 52, true);
// Stalactites under ledges on the east wall, below the pad.
[60, 54].forEach((r) => g.rock(109, r, 110, r + 1).set(109, r + 2, drop));
g.fill(101, 48, 110, 49, g.thing("2", { kind: "gate" }));
g.ledge("F", 106, 44, 3, 2);

// 4. The upper tube: east under stalactites, through a wall of crumbling rock,
//    past a pad, a flame that fires as you come near, more stalactites and a
//    blob from a lava pit, over crumbling floors, to switch 3, which opens gate
//    4 at the top of the last shaft for 24 s.
g.air(111, 34, 150, 43);
[111, 114, 117].forEach((c) => g.set(c, 34, drop));
brittle(113, 119, 44);
g.fill(122, 34, 123, 43, "%");
g.pad("F", 124, 43);
g.set(130, 33, g.label({ ...NEAR, facing: "down", length: 10 }));
brittle(128, 131, 44);
[136, 139].forEach((c) => g.set(c, 34, drop));
g.fill(141, 44, 143, 45, "~");
g.set(142, 44, g.label({ kind: "blob", height: 4, period: 4, warn: 0.6, offset: 0 }));
g.pad(g.thing("3", { kind: "switch", opens: "4", time: 24 }), 146, 43);
// A crystal in a nook over the tube, between a flame and a stalactite: the
// skilful one.
g.air(132, 29, 135, 33);
g.set(133, 30, "*");

// 5. The last climb: up a shaft through flames right across it that fire as
//    you come near and a wall of flame on the beat, through gate 4, and west
//    under stalactites and a flame that fires as you come near to the exit.
g.air(140, 8, 150, 33);
across(140, 150, 30, false);
across(140, 150, 24, true);
g.rock(140, 27, 141, 28).set(141, 29, drop);
g.set(151, 16, g.label({ ...WALL, facing: "left", length: 11, on: 1, off: 3 }));
g.fill(140, 12, 150, 13, g.thing("4", { kind: "gate" }));
g.air(110, 3, 150, 7);
g.pad("F", 137, 7);
[134, 131, 122].forEach((c) => g.set(c, 3, drop));
g.set(127, 2, g.label({ ...NEAR, facing: "down", length: 5 }));
brittle(120, 123, 8);
brittle(128, 132, 8);
g.pad("E", 116, 7);

g.roughen(97, 0.3);
const header = `9-7: A long climb up a sloping tube with the lava rising behind: flames that fire as you come near, crumbling plugs, and timed gates to open on the way.

Along the bottom to the red key, which wakes the lava, then up and east in
steps, shaft and tube and shaft, to the exit at the top. The lava rises 1 m/s
from 2 s after you take the key. A flame that fires as you come near rests for
1.5 s, or 2 s where you cross it going up; stalactites shake for half a second
once you're within 6 m of being under them. Walls of flame, a vent, gusts and
blobs keep a 4 s beat.

Sections, in order:
1. The first climb: along the bottom under rows of stalactites, past a flame
   that fires up from the floor as you come near, a pad and a wall of flame,
   over crumbling floors, to the key, then up a shaft on a vent that blows 2 s
   in 4, through a flame right across it that fires as you come near, a plug
   of crumbling rock and another such flame, past stalactites under ledges, to
   a pad, and on through a third. A crystal in an alcove over the bottom
   tunnel.
2. The tube: east along a passage under flames that fire as you come near and
   stalactites, over crumbling floors, past a pad, to switch 1, which opens
   gate 2 at the top of the next shaft for 26 s. A crystal at the end of a
   side branch down from the tube, which the lava soon fills.
3. The second climb: up a shaft through four flames right across it that fire
   as you come near, with gusts along them, past stalactites under ledges,
   through gate 2, to a pad.
4. The upper tube: east under stalactites, through a wall of crumbling rock,
   past a pad, a flame that fires as you come near, more stalactites and a
   blob from a lava pit, over crumbling floors, to switch 3, which opens gate
   4 at the top of the last shaft for 24 s. A crystal in a nook over the tube,
   between the flame and the stalactites.
5. The last climb: up a shaft through flames right across it that fire as you
   come near, with gusts along them, past a stalactite under a ledge, and a
   wall of flame on the beat, through gate 4, to a pad, and west under
   stalactites and a flame that fires as you come near, over crumbling
   floors, to the exit.`;
await buildLevel("9-7", g, { header, name: "Lava tube", fuel: 24, par: 195, route: "F@30 r F@54 F@85 1 F@107 F@125 3 F@138 E", rise: { speed: 1, from: 2, after: "r", delay: 2 } });
