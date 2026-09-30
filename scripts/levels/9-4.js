import { Grid, buildLevel } from "./grid.js";

const W = 120;
const H = 130;
const g = new Grid(W, H);
// An 8 s beat for the slabs, which slide across a shaft and back once in it; a
// flame that fires as you come near rests for 1.5 s, or 2 s where you cross it
// going up. Stalactites shake for half a second once you're within 6 m of being
// under them.
const SLAB = { kind: "mover", period: 8 };
const NEAR = { kind: "flame", mode: "near", on: 1, off: 1.5, warn: 0.5, reach: 5 };
const SIDE = { ...NEAR, off: 2 };
const drop = g.label({ kind: "stalactite", reach: 6, warn: 0.5 });

// The start, bottom left.
g.air(3, 116, 30, 124);
g.pad("S", 6, 124);
[16, 24].forEach((c) => g.set(c, 116, drop));

// 1. The lift shaft: from under stalactites, up past slabs sliding across the
//    shaft, flames on its walls that fire as you come near and more
//    stalactites, beside a lift you can ride, with a pad on a ledge halfway. A
//    crystal at the top of the lift's travel: the skilful one.
g.air(31, 56, 44, 124);
g.air(45, 92, 49, 124);
g.fill(45, 122, 49, 123, g.label({ kind: "mover", to: [0, 26], period: 12 }));
g.set(47, 93, "*");
g.fill(31, 106, 37, 107, g.label({ ...SLAB, to: [7, 0], offset: 0 }));
g.fill(38, 88, 44, 89, g.label({ ...SLAB, to: [-7, 0], offset: 4 }));
g.set(30, 114, g.label({ ...SIDE, facing: "right", length: 6 }));
g.set(30, 96, g.label({ ...SIDE, facing: "right", length: 6 }));
g.rock(43, 76, 44, 77).set(44, 78, drop);
g.rock(31, 80, 33, 81).set(33, 82, drop);
g.set(45, 72, g.label({ ...SIDE, facing: "left", length: 6 }));
g.rock(43, 60, 44, 61).set(44, 62, drop);
g.ledge("F", 39, 100);
g.air(26, 99, 30, 102); // an alcove off the shaft, with a crystal: the easy one
g.set(27, 100, "*");
g.ledge("F", 32, 68);

// 2. The slip: east over a lava floor where slabs slide back and forth, under
//    stalactites and flames that fire as you come near, to a pad on an island.
g.air(45, 56, 88, 67);
g.fill(45, 68, 88, 69, "~");
g.fill(52, 64, 57, 64, g.label({ ...SLAB, to: [8, 0], offset: 2 }));
g.fill(70, 64, 75, 64, g.label({ ...SLAB, to: [-8, 0], offset: 6 }));
[50, 62, 74].forEach((c) => g.set(c, 56, drop));
[56, 68].forEach((c) => g.set(c, 55, g.label({ ...NEAR, facing: "down", length: 8 })));
g.rock(81, 63, 88, 69);
g.pad("F", 83, 62);
// A side branch up from the slip, with a crystal at its end.
g.air(78, 46, 81, 55);
g.set(79, 48, "*");

// 3. The upper shaft: up past more slabs, flames that fire as you come near, and
//    stalactites, with a pad on a ledge halfway, and under more stalactites to
//    the exit.
g.air(89, 2, 104, 67);
g.fill(89, 52, 96, 53, g.label({ ...SLAB, to: [8, 0], offset: 0 }));
g.fill(97, 24, 104, 25, g.label({ ...SLAB, to: [-8, 0], offset: 4 }));
g.set(105, 58, g.label({ ...SIDE, facing: "left", length: 7 }));
g.set(88, 32, g.label({ ...SIDE, facing: "right", length: 7 }));
g.rock(101, 44, 104, 45).set(101, 46, drop);
g.rock(89, 16, 91, 17).set(91, 18, drop);
g.ledge("F", 90, 40);
g.set(88, 12, g.label({ ...SIDE, facing: "right", length: 7 }));
g.air(60, 2, 92, 10);
[86, 78].forEach((c) => g.set(c, 2, drop));
g.pad("E", 66, 10);

g.roughen(94, 0.3);
const header = `9-4: Moving slabs slide across the shaft and carry you up, under stalactites that drop as you ride past and flames that fire as you come near.

Up a shaft from the bottom left, east over a lava floor, and up another shaft
to the exit. The slabs slide across a shaft and back once in 8 s; ride on top
of one to save fuel, or slip past while it's at the far side. A flame that
fires as you come near rests for 1.5 s, or 2 s where you cross it going up.
Stalactites shake for half a second once you're within 6 m of being under
them.

Sections, in order:
1. The lift shaft: from under stalactites, up past slabs sliding across the
   shaft, flames on its walls that fire as you come near and more
   stalactites, beside a lift you can ride, with a pad on a ledge halfway. A
   crystal in an alcove off the shaft, and one at the top of the lift's
   travel.
2. The slip: east over a lava floor where slabs slide back and forth, under
   stalactites and flames that fire as you come near, to a pad on an island.
   A crystal at the end of a side branch.
3. The upper shaft: up past more slabs, flames that fire as you come near, and
   stalactites, with a pad on a ledge halfway, and under more stalactites to
   the exit.`;
await buildLevel("9-4", g, { header, name: "Shifting ground", fuel: 23, par: 135 });
