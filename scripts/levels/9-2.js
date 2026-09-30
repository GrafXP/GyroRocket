import { Grid, buildLevel } from "./grid.js";

const W = 110;
const H = 140;
const g = new Grid(W, H);
// A 4 s beat: vents blow 2 s in 4, flames fire 1.5 s in 4. The vents blow a
// little weaker than gravity, so you can hold still in one under a flame.
// Stalactites shake for half a second once you're within 6 m of being under
// them, or 9 m where the roof is high, so they come down in front of you, not
// behind.
const VENT = { kind: "fan", facing: "up", strength: 9, mode: "cycle", on: 2, off: 2, warn: 0.5 };
const DROP = { kind: "stalactite", reach: 6, warn: 0.5 };
const NEAR = { kind: "flame", mode: "near", on: 1, off: 1.5, warn: 0.5, reach: 5 };
// Across a shaft, where you cross the flame going up, it rests 2 s: the rocket
// is tall.
const SIDE = { ...NEAR, off: 2 };
const WALL = { kind: "flame", facing: "down", length: 10, on: 1.5, off: 2.5, warn: 0.5 };
const drop = g.label(DROP);
const fall = g.label({ ...DROP, reach: 9 });

// The start, bottom left, under a row of stalactites.
g.air(3, 122, 27, 131);
g.pad("S", 6, 131);
[12, 15, 18, 21, 24].forEach((c) => g.set(c, 122, fall));

// 1. Vent A: up a narrow shaft on a vent that blows 2 s in 4, through flames
//    right across it that fire as you come near, from alternate walls, and
//    past stalactites under ledges between them, with a pad in a nook halfway.
g.air(26, 74, 39, 85);
g.air(28, 86, 37, 131);
g.rock(30, 132, 35, 133).set(32, 132, g.label({ ...VENT, length: 46, width: 6 }));
[124, 102].forEach((r) => g.set(38, r, g.label({ ...SIDE, facing: "left", length: 10 })));
[116, 90].forEach((r) => g.set(27, r, g.label({ ...SIDE, facing: "right", length: 10 })));
[118, 98].forEach((r) => g.rock(28, r, 29, r + 1).set(29, r + 2, drop));
[112, 94, 86].forEach((r) => g.rock(36, r, 37, r + 1).set(36, r + 2, drop));
g.ledge("F", 26, 109);

// 2. The first crossing: east between ledges, over a lava channel with blobs and
//    under a row of stalactites.
g.air(40, 74, 84, 85);
g.ledge("F", 41, 80);
[47, 51, 55, 59, 66, 69].forEach((c) => g.set(c, 74, fall));
g.fill(50, 86, 70, 86, "~");
[52, 56, 60, 64, 68].forEach((c, k) => g.set(c, 86, g.label({ kind: "blob", height: 5, period: 4, warn: 0.6, offset: k * 0.8 })));
g.air(62, 68, 64, 73); // an alcove over the crossing, with a crystal: the easy one
g.set(63, 70, "*");
g.ledge("F", 79, 80);

// 3. Vent B: up a narrow shaft on a steady updraft, through flames right across
//    it that fire as you come near, from alternate walls, and past stalactites
//    under ledges.
g.air(72, 30, 82, 73);
g.set(77, 86, g.label({ kind: "fan", facing: "up", length: 56, width: 5, strength: 7 }));
[68, 56, 44].forEach((r) => g.set(83, r, g.label({ ...SIDE, facing: "left", length: 11 })));
[62, 50, 38].forEach((r) => g.set(71, r, g.label({ ...SIDE, facing: "right", length: 11 })));
[64, 52, 40].forEach((r) => g.rock(72, r, 74, r + 1).set(74, r + 2, drop));
// A side branch off the shaft, with a crystal at its end.
g.air(83, 47, 100, 51);
g.set(98, 49, "*");
g.ledge("F", 80, 30);

// 4. The second crossing: west under stalactites and a flame that fires as you
//    come near, then walls of flame on the beat, with stalactites between them,
//    and a pad halfway.
g.air(20, 20, 84, 29);
g.set(74, 19, g.label({ ...NEAR, facing: "down", length: 10 }));
[69, 66, 63].forEach((c) => g.set(c, 20, fall));
[60, 48, 36].forEach((c, k) => g.set(c, 19, g.label({ ...WALL, offset: k * 1.33 })));
[55, 52, 39, 30, 27].forEach((c) => g.set(c, 20, fall));
g.pad("F", 43, 29);
g.pad("F", 22, 29);

// 5. Vent C: two vents side by side, each blowing while the other rests,
//    through a flame right across them that fires as you come near, under
//    stalactites, then east to the exit under more, past a flame that fires up
//    from the floor as you come near. A crystal in a nook between two of them.
g.air(4, 6, 19, 29);
g.rock(4, 30, 19, 31);
g.set(7, 30, g.label({ ...VENT, length: 15, width: 4, offset: 0 }));
g.set(16, 30, g.label({ ...VENT, length: 15, width: 4, offset: 2 }));
g.set(3, 20, g.label({ ...SIDE, facing: "right", length: 16 }));
g.rock(4, 17, 6, 18).set(6, 19, drop);
g.rock(17, 13, 19, 14).set(17, 15, drop);
g.rock(17, 22, 19, 23).set(17, 24, drop);
g.air(1, 11, 3, 14);
g.set(2, 12, "*");
g.air(20, 4, 40, 10);
[23, 26].forEach((c) => g.set(c, 4, drop));
g.set(29, 11, g.label({ ...NEAR, facing: "up", length: 6 }));
g.pad("E", 33, 10);

g.roughen(92, 0.3);
const header = `9-2: Fans blow up shafts lined with stalactites: set them falling, then ride the draught up.

From the bottom left, up three shafts, each on a fan, with a crossing between
each and the next. A 4 s beat: vents blow 2 s in 4, a little weaker than
gravity, and flames fire 1.5 s in 4. A flame that fires as you come near rests
1.5 s, or 2 s where you cross it going up. Stalactites shake for half a second
once you're within 6 m of being under them, or 9 m where the roof is high, so
they come down in front of you: you see them go and get out from under.

Sections, in order:
1. Vent A: from the start under a row of stalactites, up a narrow shaft on a
   vent that blows 2 s in 4, through flames right across it that fire as you
   come near, from alternate walls, and past stalactites under ledges between
   them, with a pad in a nook halfway.
2. The first crossing: east between ledges, over a lava channel with blobs and
   under a row of stalactites. A crystal in an alcove over it.
3. Vent B: up a narrow shaft on a steady updraft, through flames right across
   it that fire as you come near, from alternate walls, and past stalactites
   under ledges. A crystal at the end of a side branch.
4. The second crossing: west under stalactites and a flame that fires as you
   come near, then walls of flame on the beat, with stalactites between them,
   and a pad halfway.
5. Vent C: two vents side by side, each blowing while the other rests, through
   a flame right across them that fires as you come near, under stalactites,
   then east to the exit under more, past a flame that fires up from the floor
   as you come near. A crystal in a nook between two of them.`;
await buildLevel("9-2", g, { header, name: "Vents", fuel: 22, par: 195, route: "F@27 F@42 F@80 F@83 F@46 F@23 E" });
