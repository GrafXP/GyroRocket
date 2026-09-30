import { Grid, buildLevel } from "./grid.js";

const W = 120;
const H = 130;
const g = new Grid(W, H);
// An 8 s beat for the slabs, which slide across a shaft and back once in it; a
// flame that fires as you come near rests for 1.5 s, or 2 s where you cross it
// going up. Stalactites shake for half a second once you're within 6 m of being
// under them, or 9 m where the roof is high, so they come down in front of you.
const SLAB = { kind: "mover", period: 8 };
const NEAR = { kind: "flame", mode: "near", on: 1, off: 1.5, warn: 0.5, reach: 5 };
const SIDE = { ...NEAR, off: 2 };
const drop = g.label({ kind: "stalactite", reach: 6, warn: 0.5 });
const fall = g.label({ kind: "stalactite", reach: 9, warn: 0.5 });
// In pockets on a shaft's wall they shake only once you're within 3 m, so they
// wait for you to come close rather than fall while you're far below: keep to
// the middle.
const edge = g.label({ kind: "stalactite", reach: 3, warn: 0.5 });
// A flame down across the way to a pad, from its roof on row r0 - 1 to row
// r1, that fires as you come near.
const curtain = (c, r0, r1) => g.set(c, r0 - 1, g.label({ ...NEAR, facing: "down", length: r1 - r0 + 1 }));

// The start, bottom left, past a flame that fires up from the floor as you come
// near, under stalactites.
g.air(3, 116, 30, 124);
g.pad("S", 6, 124);
g.set(11, 116, drop);
g.set(14, 125, g.label({ ...NEAR, facing: "up", length: 9 }));
[19, 22, 25, 28, 30].forEach((c) => g.set(c, 116, fall));

// 1. The lift shaft: up past slabs sliding across the shaft and flames right
//    across it that fire as you come near, beside a lift you can ride, to a pad
//    on a ledge; then up a narrower part between crumbling ledges, through more
//    flames, to a pad on a ledge at the top. A crystal at the top of the lift's
//    travel: the skilful one.
g.air(31, 83, 44, 124);
g.air(33, 56, 42, 82);
g.air(33, 56, 44, 67);
g.air(45, 92, 49, 124);
g.fill(45, 122, 49, 123, g.label({ kind: "mover", to: [0, 26], period: 12 }));
g.set(47, 93, "*");
g.set(30, 114, g.label({ ...SIDE, facing: "right", length: 14 }));
g.fill(31, 106, 37, 107, g.label({ ...SLAB, to: [7, 0], offset: 0 }));
g.ledge("F", 39, 100);
g.air(26, 99, 30, 102); // an alcove off the shaft, with a crystal: the easy one
g.set(27, 100, "*");
g.set(30, 94, g.label({ ...SIDE, facing: "right", length: 14 }));
g.fill(38, 87, 44, 88, g.label({ ...SLAB, to: [-7, 0], offset: 4 }));
// Crumbling ledges on the walls of the narrow part: nowhere to rest.
g.fill(33, 81, 34, 81, "%");
g.fill(41, 75, 42, 75, "%");
g.set(43, 78, g.label({ ...SIDE, facing: "left", length: 10 }));
g.set(32, 72, g.label({ ...SIDE, facing: "right", length: 10 }));
g.ledge("F", 33, 68);
// Over the way on into the slip, stalactites that hang over rock, not the
// shaft, and shake only once you're under them.
[43, 44].forEach((c) => g.set(c, 56, edge));

// 2. The slip: east over a lava floor where slabs slide back and forth, past
//    flames from the roof that fire as you come near, each followed by a blob
//    and a row of stalactites, to a pad on an island.
g.air(45, 56, 88, 67);
g.fill(45, 68, 88, 69, "~");
g.fill(52, 64, 57, 64, g.label({ ...SLAB, to: [8, 0], offset: 2 }));
g.fill(70, 64, 75, 64, g.label({ ...SLAB, to: [-8, 0], offset: 6 }));
// East: a flame from the roof, a blob, stalactites, and again, twice.
const BLOB = { kind: "blob", height: 6, period: 4, warn: 0.6 };
[49, 63, 77].forEach((c) => g.set(c, 55, g.label({ ...NEAR, facing: "down", length: 12 })));
[52, 66, 79].forEach((c, k) => g.set(c, 68, g.label({ ...BLOB, offset: k * 1.33 })));
[57, 60, 71, 74].forEach((c) => g.set(c, 56, fall));
// Right after a blob, stalactites that shake only once you're under them:
// they come down behind you if you keep going.
[54, 68].forEach((c) => g.set(c, 56, drop));
g.rock(81, 63, 88, 69);
g.pad("F", 83, 62);
// A side branch up from the slip, with a crystal at its end.
g.air(78, 46, 81, 55);
g.set(79, 48, "*");

// 3. The upper shaft: up past more slabs and flames right across it that fire
//    as you come near, by stalactites in pockets on its wall, with a pad on a
//    ledge halfway, to a pad at the top behind a flame from the roof.
g.air(89, 56, 104, 67);
g.air(91, 2, 102, 55);
g.set(103, 59, g.label({ ...SIDE, facing: "left", length: 14 }));
g.fill(91, 52, 96, 53, g.label({ ...SLAB, to: [6, 0], offset: 0 }));
g.rock(100, 46, 102, 47).set(100, 48, edge);
g.set(90, 45, g.label({ ...SIDE, facing: "right", length: 12 }));
g.rock(100, 42, 102, 43).set(100, 44, drop);
g.ledge("F", 92, 40);
g.rock(100, 35, 102, 36).set(100, 37, edge);
g.set(103, 34, g.label({ ...SIDE, facing: "left", length: 12 }));
g.rock(99, 28, 102, 29).set(99, 30, drop);
g.fill(97, 24, 102, 25, g.label({ ...SLAB, to: [-6, 0], offset: 4 }));
g.set(103, 18, g.label({ ...SIDE, facing: "left", length: 12 }));
g.fill(91, 15, 93, 15, "%");
g.set(90, 12, g.label({ ...SIDE, facing: "right", length: 12 }));
// 4. The top gallery: west over a lava floor where blobs are thrown up, under
//    rows of stalactites and past flames from the roof that fire as you come
//    near, to the exit.
g.air(38, 2, 102, 10);
g.pad("F", 84, 10);
curtain(88, 2, 10);
g.fill(45, 11, 80, 11, "~");
[81, 78, 66, 63].forEach((c) => g.set(c, 2, fall));
[76, 69, 61, 53, 50, 47].forEach((c) => g.set(c, 2, drop));
[74, 58].forEach((c) => g.set(c, 1, g.label({ ...NEAR, facing: "down", length: 9 })));
[71, 55].forEach((c, k) => g.set(c, 11, g.label({ kind: "blob", height: 4, period: 4, warn: 0.6, offset: k * 2 })));
g.pad("E", 41, 10);

g.roughen(94, 0.3);
const header = `9-4: Moving slabs slide across the shaft and carry you up, under stalactites that drop as you ride past and flames that fire as you come near.

Up a shaft from the bottom left, east over a lava floor, up another shaft, and
west along the top to the exit. The slabs slide across a shaft and back once in
8 s; ride on top of one to save fuel, or slip past while it's at the far side.
A flame that fires as you come near rests for 1.5 s, or 2 s where you cross it
going up. Stalactites shake for half a second once you're within 6 m of being
under them, or 9 m where the roof is high, so they come down in front of you;
those in pockets on a shaft's wall only once you're within 3 m.

Sections, in order:
1. The lift shaft: from under stalactites and past a flame from the floor, up
   past slabs sliding across the shaft and flames right across it that fire as
   you come near, beside a lift you can ride, to a pad on a ledge; then up a
   narrower part between crumbling ledges, through more flames, to a pad on a
   ledge at the top. A crystal in an alcove off the shaft, and one at the top
   of the lift's travel.
2. The slip: east under stalactites, over a lava floor where slabs slide back
   and forth, past flames from the roof that fire as you come near, each
   followed by a blob and a row of stalactites, to a pad on an island. A
   crystal at the end of a side branch.
3. The upper shaft: up past more slabs and flames right across it that fire as
   you come near, by stalactites in pockets on its wall, with a pad on a ledge
   halfway, to a pad at the top behind a flame from the roof.
4. The top gallery: west over a lava floor where blobs are thrown up, under
   rows of stalactites and past flames from the roof that fire as you come
   near, to the exit.`;
await buildLevel("9-4", g, { header, name: "Shifting ground", fuel: 28, par: 200, route: "F@40 F@34 F@84 F@93 F@87 E" });
