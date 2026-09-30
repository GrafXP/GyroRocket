import { Grid, buildLevel } from "./grid.js";

const W = 110;
const H = 140;
const g = new Grid(W, H);
// A 4 s beat: vents blow 2 s in 4, flames fire 1.5 s in 4. Stalactites shake
// for half a second once you're within 6 m of being under them.
const VENT = { kind: "fan", facing: "up", strength: 12, mode: "cycle", on: 2, off: 2, warn: 0.5 };
const DROP = { kind: "stalactite", reach: 6, warn: 0.5 };
const NEAR = { kind: "flame", mode: "near", on: 1, off: 1.5, warn: 0.5, reach: 5 };
const WALL = { kind: "flame", facing: "down", length: 10, on: 1.5, off: 2.5, warn: 0.5 };
const drop = g.label(DROP);

// The start, bottom left.
g.air(3, 122, 25, 131);
g.pad("S", 6, 131);

// 1. Vent A: up a shaft on a vent that blows 2 s in 4, under stalactites that
//    hang from ledges on alternate walls.
g.air(26, 74, 39, 131);
g.rock(30, 132, 35, 133).set(32, 132, g.label({ ...VENT, length: 46, width: 6 }));
g.rock(26, 118, 29, 119).set(29, 120, drop).set(28, 120, drop);
g.rock(36, 108, 39, 109).set(36, 110, drop);
g.rock(26, 98, 29, 99).set(29, 100, drop);

// 2. The first crossing: east between ledges, over a lava channel with blobs and
//    under a row of stalactites.
g.air(40, 74, 84, 85);
g.ledge("F", 41, 80);
for (let c = 48; c <= 66; c += 6) g.set(c, 74, drop);
g.fill(50, 86, 70, 86, "~");
[54, 60, 66].forEach((c, k) => g.set(c, 86, g.label({ kind: "blob", height: 5, period: 4, warn: 0.6, offset: k * 1.33 })));
g.air(62, 68, 64, 73); // an alcove over the crossing, with a crystal: the easy one
g.set(63, 70, "*");
g.ledge("F", 79, 80);

// 3. Vent B: up a shaft on a steady updraft, past flames on its walls that fire as
//    you come near, and stalactites over the way.
g.air(70, 30, 84, 73);
g.set(75, 86, g.label({ kind: "fan", facing: "up", length: 56, width: 5, strength: 7 }));
g.set(70, 62, g.label({ ...NEAR, facing: "right", length: 6 }));
g.set(84, 50, g.label({ ...NEAR, facing: "left", length: 6 }));
g.set(70, 38, g.label({ ...NEAR, facing: "right", length: 6 }));
g.rock(80, 42, 84, 43).set(81, 44, drop);
g.rock(70, 55, 73, 56).set(73, 57, drop);
// A side branch off the shaft, with a crystal at its end.
g.air(85, 56, 100, 60);
g.set(98, 58, "*");
g.ledge("F", 80, 30);

// 4. The second crossing: west under walls of flame on the beat, with
//    stalactites between them.
g.air(20, 20, 84, 29);
[60, 48, 36].forEach((c, k) => g.set(c, 19, g.label({ ...WALL, offset: k * 1.33 })));
[54, 42].forEach((c) => g.set(c, 20, drop));
g.pad("F", 22, 29);

// 5. Vent C: two vents side by side, each blowing while the other rests, up to
//    the exit, under stalactites. A crystal in a nook between two of them.
g.air(4, 6, 19, 29);
g.rock(4, 30, 19, 31);
g.set(7, 30, g.label({ ...VENT, length: 15, width: 4, offset: 0 }));
g.set(16, 30, g.label({ ...VENT, length: 15, width: 4, offset: 2 }));
g.rock(4, 17, 6, 18).set(6, 19, drop);
g.rock(17, 13, 19, 14).set(17, 15, drop);
g.air(1, 11, 3, 14);
g.set(2, 12, "*");
g.air(20, 4, 40, 10);
g.pad("E", 32, 10);

g.roughen(92, 0.3);
const header = `9-2: Fans blow up shafts lined with stalactites: set them falling, then ride the draught up.

From the bottom left, up three shafts, each on a fan, with a crossing between
each and the next. A 4 s beat: vents blow 2 s in 4, flames fire 1.5 s in 4.
Stalactites shake for half a second once you're within 6 m of being under
them, so you see them go and get out from under.

Sections, in order:
1. Vent A: up a shaft on a vent that blows 2 s in 4, under stalactites that
   hang from ledges on alternate walls.
2. The first crossing: east between ledges, over a lava channel with blobs and
   under a row of stalactites. A crystal in an alcove over it.
3. Vent B: up a shaft on a steady updraft, past flames on its walls that fire
   as you come near, and stalactites over the way. A crystal at the end of a
   side branch.
4. The second crossing: west under walls of flame on the beat, with stalactites
   between them.
5. Vent C: two vents side by side, each blowing while the other rests, up to
   the exit, under stalactites. A crystal in a nook between two of them.`;
await buildLevel("9-2", g, { header, name: "Vents", fuel: 16, par: 100 });
