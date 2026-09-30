import { Grid, buildLevel } from "./grid.js";

const W = 160;
const H = 120;
const g = new Grid(W, H);
// The lava rises 1.2 m/s from 2 s after you take the red key. A flame that
// fires as you come near rests for 1.5 s, or 2 s where you cross it going up;
// stalactites shake for half a second once you're within 6 m of being under
// them. Walls of flame, a vent and blobs keep a 4 s beat.
const NEAR = { kind: "flame", mode: "near", on: 1, off: 1.5, warn: 0.5, reach: 5 };
const SIDE = { ...NEAR, off: 2 };
const drop = g.label({ kind: "stalactite", reach: 6, warn: 0.5 });
// On a 4 s beat: walls of flame, a vent and blobs.
const WALL = { kind: "flame", on: 1.5, off: 2.5, warn: 0.5 };

// The start, bottom left, and the red key at the end of the bottom tunnel, past
// walls of flame on the beat and under stalactites: the key wakes the lava.
g.air(3, 104, 62, 114);
g.pad("S", 5, 114);
[20, 34, 46].forEach((c) => g.set(c, 104, drop));
[28, 40].forEach((c, k) => g.set(c, 103, g.label({ ...WALL, facing: "down", length: 11, offset: k * 2 })));
g.air(23, 99, 26, 103); // an alcove over the tunnel, with a crystal: the easy one
g.set(24, 100, "*");
g.set(48, 109, "r");

// 1. The first climb: up a shaft on a vent that blows 2 s in 4, through a plug
//    of crumbling rock, past a flame that fires as you come near, to a pad.
g.air(52, 66, 61, 103);
g.set(56, 115, g.label({ kind: "fan", facing: "up", length: 40, width: 5, strength: 8, mode: "cycle", on: 2, off: 2, warn: 0.5 }));
g.fill(52, 92, 61, 93, "%");
g.set(62, 86, g.label({ ...SIDE, facing: "left", length: 6 }));
g.rock(59, 70, 61, 71).set(59, 72, drop);
g.ledge("F", 53, 78, 3, 2);

// 2. The tube: east along a passage under flames that fire as you come near and
//    stalactites, past a pad, to switch 1, which opens gate 2 at the top of the
//    next shaft for 22 s.
g.air(62, 66, 100, 76);
[65, 72, 82, 94].forEach((c) => g.set(c, 65, g.label({ ...NEAR, facing: "down", length: 11 })));
[76, 88].forEach((c) => g.set(c, 66, drop));
g.pad("F", 84, 76);
g.pad(g.thing("1", { kind: "switch", opens: "2", time: 22 }), 96, 76);
// A side branch down from the tube, with a crystal at its end, which the lava
// soon fills.
g.air(64, 77, 68, 84);
g.set(66, 83, "*");

// 3. The second climb: up a shaft past flames on its walls that fire as you come
//    near and stalactites, through gate 2, to a pad.
g.air(101, 34, 110, 76);
g.set(100, 68, g.label({ ...SIDE, facing: "right", length: 6 }));
g.set(111, 58, g.label({ ...SIDE, facing: "left", length: 6 }));
g.rock(101, 62, 103, 63).set(103, 64, drop);
g.rock(101, 52, 102, 53).set(102, 54, drop);
g.rock(101, 40, 103, 41).set(103, 42, drop);
g.fill(101, 48, 110, 49, g.thing("2", { kind: "gate" }));
g.ledge("F", 106, 44, 3, 2);

// 4. The upper tube: east through a wall of crumbling rock, past a pad, a flame
//    that fires as you come near, a stalactite and a blob from a lava pit, to
//    switch 3, which opens gate 4 at the top of the last shaft for 13 s.
g.air(111, 34, 150, 43);
g.fill(122, 34, 123, 43, "%");
g.set(114, 34, drop);
g.pad("F", 124, 43);
g.set(130, 33, g.label({ ...NEAR, facing: "down", length: 10 }));
g.set(138, 34, drop);
g.fill(141, 44, 143, 45, "~");
g.set(142, 44, g.label({ kind: "blob", height: 4, period: 4, warn: 0.6, offset: 0 }));
g.pad(g.thing("3", { kind: "switch", opens: "4", time: 13 }), 146, 43);
// A crystal in a nook over the tube, between a flame and a stalactite: the
// skilful one.
g.air(132, 29, 135, 33);
g.set(133, 30, "*");

// 5. The last climb: up a shaft past a flame that fires as you come near and a
//    wall of flame on the beat, through gate 4, to the exit.
g.air(140, 8, 150, 33);
g.set(139, 24, g.label({ ...SIDE, facing: "right", length: 6 }));
g.set(151, 16, g.label({ kind: "flame", facing: "left", length: 11, on: 1, off: 3, warn: 0.5 }));
g.fill(140, 12, 150, 13, g.thing("4", { kind: "gate" }));
g.air(110, 3, 150, 7);
[134, 126].forEach((c) => g.set(c, 3, drop));
g.pad("E", 116, 7);

g.roughen(97, 0.3);
const header = `9-7: A long climb up a sloping tube with the lava rising behind: flames that fire as you come near, crumbling plugs, and timed gates to open on the way.

Along the bottom to the red key, which wakes the lava, then up and east in
steps, shaft and tube and shaft, to the exit at the top. The lava rises 1.2 m/s
from 2 s after you take the key. A flame that fires as you come near rests for
1.5 s, or 2 s where you cross it going up; stalactites shake for half a second
once you're within 6 m of being under them. Walls of flame, a vent and blobs
keep a 4 s beat.

Sections, in order:
1. The first climb: along the bottom past walls of flame and under stalactites
   to the key, then up a shaft on a vent that blows 2 s in 4, through a plug of
   crumbling rock, past a flame that fires as you come near, to a pad. A
   crystal in an alcove over the bottom tunnel.
2. The tube: east along a passage under flames that fire as you come near and
   stalactites, past a pad, to switch 1, which opens gate 2 at the top of the
   next shaft for 22 s. A crystal at the end of a side branch down from the
   tube, which the lava soon fills.
3. The second climb: up a shaft past flames on its walls that fire as you come
   near and stalactites, through gate 2, to a pad.
4. The upper tube: east through a wall of crumbling rock, past a pad, a flame
   that fires as you come near, a stalactite and a blob from a lava pit, to
   switch 3, which opens gate 4 at the top of the last shaft for 13 s. A
   crystal in a nook over the tube, between the flame and the stalactite.
5. The last climb: up a shaft past a flame that fires as you come near and a
   wall of flame on the beat, through gate 4, and under stalactites to the
   exit.`;
await buildLevel("9-7", g, { header, name: "Lava tube", fuel: 27, par: 150, route: "r F@54 F@85 1 F@107 F@125 3 E", rise: { speed: 1.2, from: 2, after: "r", delay: 2 } });
