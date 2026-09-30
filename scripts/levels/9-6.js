import { Grid, buildLevel } from "./grid.js";

const W = 140;
const H = 110;
const g = new Grid(W, H);
// Dark. Stalactites shake for half a second once you're within 6 m of being
// under them, shedding dust: in the dark, that's how you see them go. A 4 s beat for the
// blobs, beams, gusts and flames; a flame that fires as you come near rests for
// 1.5 s, or 2 s where you cross it going up or down.
const drop = g.label({ kind: "stalactite", reach: 6, warn: 0.5 });
const BLOB = { kind: "blob", height: 7, period: 4, warn: 0.6 };
const NEAR = { kind: "flame", mode: "near", on: 1, off: 1.5, warn: 0.5, reach: 5 };
// Across a shaft, where you cross the flame going up or down, it rests 2 s: the
// rocket is tall.
const SIDE = { ...NEAR, off: 2 };

// The start, on the left.
g.air(3, 50, 20, 58);
g.pad("S", 5, 58);

// 1. The tunnel: east along a winding tunnel under rows of stalactites, past a
//    flame that fires up from the floor as you come near, under a stalactite in
//    the low way under a rock hanging from the roof, to a pad, over a pillar
//    that shoots flame on the beat, under more stalactites and another low way,
//    through a wall of crumbling rock, to a pad.
g.air(21, 50, 92, 58);
// Crumbling floors over lava.
const brittle = (c0, c1) => g.fill(c0, 59, c1, 59, "%").fill(c0, 60, c1, 60, "~");
[11, 14, 17, 20, 23, 26].forEach((c) => g.set(c, 50, drop));
g.set(29, 59, g.label({ ...NEAR, facing: "up", length: 9 }));
g.rock(34, 50, 37, 53).set(35, 54, drop);
g.pad("F", 40, 58);
brittle(31, 33);
brittle(44, 47);
g.set(44, 50, drop);
g.rock(48, 55, 51, 58);
g.set(49, 55, g.label({ kind: "flame", facing: "up", length: 4, on: 1.5, off: 2.5, warn: 0.5 }));
[54, 57, 60].forEach((c) => g.set(c, 50, drop));
g.rock(62, 50, 64, 53).set(63, 54, drop);
g.fill(67, 50, 68, 58, "%");
brittle(70, 72);
g.air(50, 44, 52, 49); // an alcove over the tunnel, with a crystal: the easy one
g.set(51, 45, "*");

g.pad("F", 74, 58);
g.set(79, 50, drop).set(82, 50, drop).set(88, 50, drop);

// 2. The lava cave: down through a crumbling floor and a shaft where flames
//    fire across the way as you come near, into a cave lit by its blobs, to the
//    red key on a pillar between two blobs and a pad on an island, then east
//    under a low roof hung with stalactites, between blobs, to a pad on another
//    island and the updraft.
g.fill(84, 59, 90, 60, "%");
g.air(60, 61, 125, 94);
g.fill(60, 95, 125, 96, "~");
// Rock either side of the way down, and the low roof east of it.
g.rock(70, 61, 83, 80);
g.rock(91, 61, 125, 78);
[65, 77].forEach((r) => g.set(83, r, g.label({ ...SIDE, facing: "right", length: 7 })));
g.set(91, 71, g.label({ ...SIDE, facing: "left", length: 7 }));
[72, 75, 78, 81].forEach((c) => g.set(c, 81, drop));
[66, 76, 83, 90, 99, 112, 124].forEach((c, k) => g.set(c, 95, g.label({ ...BLOB, offset: (k * 0.8) % 4 })));
[97, 104, 107, 117].forEach((c) => g.set(c, 79, drop));
g.rock(84, 89, 89, 96);
g.set(86, 86, "r");
g.rock(91, 90, 94, 96);
g.pad("F", 92, 89);
g.rock(119, 90, 123, 96);
g.pad("F", 120, 89);
// A crystal low between two blobs, over a crumbling ledge: the skilful one.
g.fill(69, 90, 73, 90, "%");
g.set(71, 88, "*");
// A side branch off the cave, under stalactites, with a crystal at its end.
g.air(44, 70, 59, 74);
[50, 53, 56].forEach((c) => g.set(c, 70, drop));
g.set(46, 72, "*");

// 3. The updraft: up the east shaft on a fan, through flames right across it
//    that fire as you come near, with gusts along them, a pad in a nook
//    halfway, and a wall of flame on the beat, to a pad on a ledge at the top.
g.air(126, 20, 135, 94);
g.rock(126, 95, 135, 96);
g.set(130, 95, g.label({ kind: "fan", facing: "up", length: 60, width: 4, strength: 7 }));
const across = (c, r, facing) => g.set(c, r, g.label({ ...SIDE, facing, length: 10 }));
[82, 70, 58, 38].forEach((r) => across(136, r, "left"));
[76, 64, 44].forEach((r) => across(125, r, "right"));
g.ledge("F", 124, 50);
g.set(125, 32, g.label({ kind: "flame", facing: "right", length: 10, on: 1, off: 3, warn: 0.5 }));
across(136, 26, "left");
// Gusts along the flames, blowing 2 s in 4 from the far wall, one way then the
// other.
const GUST = { kind: "fan", mode: "cycle", on: 2, off: 2, warn: 0.5, strength: 3, width: 2, length: 10 };
[76, 64, 44, 32].forEach((r) => g.set(136, r, g.label({ ...GUST, facing: "left", offset: 0 })));
[70, 58, 38, 26].forEach((r) => g.set(125, r, g.label({ ...GUST, facing: "right", offset: 2 })));
g.ledge("F", 132, 20);

// 4. The top gallery: west past a flame that fires as you come near and a beam
//    on the beat, through the red door, under stalactites, another beam, a pad,
//    then rows of stalactites between flames that fire as you come near, over
//    crumbling floors, past a pad, to the exit.
g.air(40, 10, 135, 19);
g.fill(116, 10, 117, 19, "R");
const BEAM = { kind: "laser", facing: "down", mode: "cycle", on: 1.5, off: 2.5, warn: 0.5 };
g.set(128, 9, g.label({ ...NEAR, facing: "down", length: 10 }));
g.set(124, 9, g.label({ ...BEAM, offset: 0 }));
g.set(100, 9, g.label({ ...BEAM, offset: 2 }));
[112, 109, 106, 103, 91, 88, 80, 77, 74, 61, 58, 49].forEach((c) => g.set(c, 10, drop));
g.pad("F", 94, 19);
g.pad("F", 64, 19);
[85, 71, 54].forEach((c) => g.set(c, 9, g.label({ ...NEAR, facing: "down", length: 10 })));
[
  [99, 103],
  [86, 90],
  [75, 79],
  [48, 52],
].forEach(([c0, c1]) => g.fill(c0, 19, c1, 19, "%"));
g.pad("E", 44, 19);

g.roughen(96, 0.3);
const header = `9-6: Dark: stalactites and crumbling rock you only see in your headlight, and the shaking gives them away.

East along a tunnel, down into a lava cave for the red key, up a fan shaft, and
west along the top through the red door to the exit. Dark: stalactites shake
for half a second once you're within 6 m of being under them, shedding dust,
which is how you see them go. A 4 s beat for the blobs, beams, gusts and flames; a flame
that fires as you come near rests for 1.5 s, or 2 s where you cross it going
up or down.

Sections, in order:
1. The tunnel: east along a winding tunnel under rows of stalactites, past a
   flame that fires up from the floor as you come near, under a stalactite in
   the low way under a rock hanging from the roof, over crumbling floors, to a
   pad, over a pillar that shoots flame on the beat, under more stalactites
   and another low way, through a wall of crumbling rock, to a pad. A crystal
   in an alcove over the tunnel.
2. The lava cave: down through a crumbling floor and a shaft where three
   flames fire across the way as you come near, into a cave lit by its blobs,
   to the red key on a pillar between two blobs and a pad on an island, then
   east under a low roof hung with stalactites, between blobs, to a pad on
   another island. A crystal low between two blobs, and one at the end of a
   side branch under stalactites.
3. The updraft: up the east shaft on a fan, through flames right across it
   that fire as you come near, with gusts along them from the far wall, a pad
   in a nook halfway, and a wall of flame on the beat, to a pad on a ledge at
   the top.
4. The top gallery: west past a flame that fires as you come near and a beam
   on the beat, through the red door, under stalactites, another beam, a pad,
   then rows of stalactites between flames that fire as you come near, over
   crumbling floors, past a pad, to the exit.`;
await buildLevel("9-6", g, { header, name: "Aftershock", fuel: 23, par: 240, dark: true, route: "F@41 F@75 r F@93 F@121 F@125 F@133 F@97 F@65 E" });
