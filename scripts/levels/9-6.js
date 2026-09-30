import { Grid, buildLevel } from "./grid.js";

const W = 140;
const H = 110;
const g = new Grid(W, H);
// Dark. Stalactites shake for half a second once you're within 6 m of being
// under them, shedding dust: in the dark, that's how you see them go. A 4 s
// beat for the blobs, beams and flames; a flame that fires as you come near
// rests for 1.5 s.
const drop = g.label({ kind: "stalactite", reach: 6, warn: 0.5 });
const BLOB = { kind: "blob", height: 7, period: 4, warn: 0.6 };
const NEAR = { kind: "flame", mode: "near", on: 1, off: 1.5, warn: 0.5, reach: 5 };
// Across a shaft, where you cross the flame going up, it rests 2 s: the rocket
// is tall.
const SIDE = { ...NEAR, off: 2 };

// The start, on the left.
g.air(3, 50, 20, 58);
g.pad("S", 5, 58);
[12, 17].forEach((c) => g.set(c, 50, drop));

// 1. The tunnel: east along a winding tunnel under stalactites, over a pillar
//    that shoots flame on the beat, through a wall of crumbling rock, to a pad.
g.air(21, 50, 92, 58);
g.rock(34, 50, 37, 53);
g.rock(48, 55, 51, 58);
g.set(49, 55, g.label({ kind: "flame", facing: "up", length: 4, on: 1.5, off: 2.5, warn: 0.5 }));
[25, 30, 41, 45, 56, 61, 71, 80, 88].forEach((c) => g.set(c, 50, drop));
g.fill(66, 50, 67, 58, "%");
g.air(50, 44, 52, 49); // an alcove over the tunnel, with a crystal: the easy one
g.set(51, 45, "*");
g.pad("F", 74, 58);

// 2. The lava cave: down through a crumbling floor, into a cave lit by its
//    blobs, under stalactites, to the red key on a pillar and a pad on an
//    island.
g.fill(84, 59, 90, 60, "%");
g.air(60, 61, 125, 94);
g.fill(60, 95, 125, 96, "~");
[66, 76, 98, 108, 118].forEach((c, k) => g.set(c, 95, g.label({ ...BLOB, offset: k * 0.8 })));
[70, 96, 104, 112].forEach((c) => g.set(c, 61, drop));
g.rock(84, 80, 89, 96);
g.set(86, 77, "r");
g.rock(91, 88, 94, 96);
g.pad("F", 92, 87);
// A crystal low between two blobs, over a crumbling ledge: the skilful one.
g.fill(69, 90, 73, 90, "%");
g.set(71, 88, "*");
// A side branch off the cave, with a crystal at its end.
g.air(44, 70, 59, 74);
g.set(46, 72, "*");

// 3. The updraft: up the east shaft on a fan, past stalactites under ledges,
//    flames that fire as you come near and a wall of flame on the beat, to a
//    pad on a ledge at the top.
g.air(126, 20, 135, 94);
g.rock(126, 95, 135, 96);
g.set(130, 95, g.label({ kind: "fan", facing: "up", length: 60, width: 4, strength: 7 }));
g.rock(133, 76, 135, 77).set(133, 78, drop);
g.rock(126, 56, 128, 57).set(128, 58, drop);
g.set(136, 66, g.label({ ...SIDE, facing: "left", length: 5 }));
g.set(125, 44, g.label({ ...SIDE, facing: "right", length: 5 }));
g.set(125, 34, g.label({ kind: "flame", facing: "right", length: 10, on: 1, off: 3, warn: 0.5 }));
g.rock(133, 26, 135, 27).set(133, 28, drop);
g.ledge("F", 132, 20);

// 4. The top gallery: west past a beam on the beat, through the red door, under
//    stalactites, another beam and a flame that fires as you come near, over
//    crumbling floors, to the exit.
g.air(40, 10, 135, 19);
g.fill(116, 10, 117, 19, "R");
const BEAM = { kind: "laser", facing: "down", mode: "cycle", on: 1.5, off: 2.5, warn: 0.5 };
g.set(124, 9, g.label({ ...BEAM, offset: 0 }));
g.set(100, 9, g.label({ ...BEAM, offset: 2 }));
[108, 92, 84, 76, 68, 60, 52].forEach((c) => g.set(c, 10, drop));
g.set(80, 9, g.label({ ...NEAR, facing: "down", length: 10 }));
[
  [86, 90],
  [62, 66],
].forEach(([c0, c1]) => g.fill(c0, 19, c1, 19, "%"));
g.pad("E", 44, 19);

g.roughen(96, 0.3);
const header = `9-6: Dark: stalactites and crumbling rock you only see in your headlight, and the shaking gives them away.

East along a tunnel, down into a lava cave for the red key, up a fan shaft, and
west along the top through the red door to the exit. Dark: stalactites shake
for half a second once you're within 6 m of being under them, shedding dust,
which is how you see them go. A 4 s beat for the blobs, beams and flames; a
flame that fires as you come near rests for 1.5 s, or 2 s where you cross it
going up.

Sections, in order:
1. The tunnel: east along a winding tunnel under stalactites, over a pillar
   that shoots flame on the beat, through a wall of crumbling rock, to a pad.
   A crystal in an alcove over the tunnel.
2. The lava cave: down through a crumbling floor into a cave lit by its blobs,
   under stalactites, to the red key on a pillar and a pad on an island. A
   crystal low between two blobs, and one at the end of a side branch.
3. The updraft: up the east shaft on a fan, past stalactites under ledges,
   flames that fire as you come near and a wall of flame on the beat, to a pad
   on a ledge at the top.
4. The top gallery: west past a beam on the beat, through the red door, under
   stalactites, another beam and a flame that fires as you come near, over
   crumbling floors, to the exit.`;
await buildLevel("9-6", g, { header, name: "Aftershock", fuel: 27, par: 140, dark: true, route: "F@75 r F@93 F@133 E" });
