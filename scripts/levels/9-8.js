import { Grid, buildLevel } from "./grid.js";

const W = 160;
const H = 150;
const g = new Grid(W, H);
// A 4 s beat for everything on a cycle. Stalactites shake for half a second once
// you're within 6 m of being under them, or 9 m where the roof is high, so they
// come down in front of you; a flame that fires as you come near rests for
// 1.5 s, or 2 s where you cross it going up or down. Switch 1, at the bottom,
// wakes the lava: it rises 1.3 m/s from 2 s after you land on it, up to just
// below the top of the vents.
const DROP = { kind: "stalactite", reach: 6, warn: 0.5 };
const drop = g.label(DROP);
const fall = g.label({ ...DROP, reach: 9 });
const NEAR = { kind: "flame", mode: "near", on: 1, off: 1.5, warn: 0.5, reach: 5 };
const SIDE = { ...NEAR, off: 2 };
const BLOB = { kind: "blob", height: 5, period: 4, warn: 0.6 };
const WAVE = { kind: "flame", on: 1, off: 3, warn: 0.5 };
const VENT = { kind: "fan", facing: "up", strength: 12, mode: "cycle", on: 2, off: 2, warn: 0.5 };
const SLAB = { kind: "mover", period: 8 };
// A blob, on the beat: offsets go round a second at a time.
const blob = (c, r, k) => g.set(c, r, g.label({ ...BLOB, offset: k % 4 }));
// Flames across a shaft from its west wall at column c0 - 1 or its east wall at
// c1 + 1, alternately, on rows `rows`, firing `step` seconds one after another.
const wave = (c0, c1, rows, step) =>
  rows.forEach((r, k) => {
    const west = k % 2 === 0;
    g.set(west ? c0 - 1 : c1 + 1, r, g.label({ ...WAVE, facing: west ? "right" : "left", length: c1 - c0 + 1, offset: k * step }));
  });

// West of the fault, down; east of it, up.

// 1. The gallery (from Tremor): east along the top under rows of stalactites,
//    past flames that fire up from the floor as you come near and a blob
//    thrown up from a pool in it.
g.air(3, 5, 69, 14);
g.pad("S", 5, 14);
[11, 14, 17, 28, 31, 40, 48, 51].forEach((c) => g.set(c, 5, fall));
g.fill(33, 15, 37, 15, "~");
blob(35, 15, 0);
[23, 43].forEach((c) => g.set(c, 15, g.label({ ...NEAR, facing: "up", length: 10 })));
g.air(34, 1, 36, 4); // an alcove over the gallery, with a crystal: the easy one
g.set(35, 2, "*");
g.pad("F", 55, 14);

// 2. The first floor (from Landslide): down a shaft onto crumbling rock, past
//    flames right across it that fire as you come near and a stalactite, into a
//    chamber of blob pools with a stalactite over every blob, west to a pad on
//    an island and on to a pad at the far end.
g.air(60, 15, 69, 40);
[62, 67].forEach((c) => g.set(c, 5, fall)); // hanging over the shaft, from the gallery's roof
g.fill(60, 19, 69, 20, "%");
g.set(59, 25, g.label({ ...SIDE, facing: "right", length: 10 }));
g.set(70, 31, g.label({ ...SIDE, facing: "left", length: 10 }));
g.rock(60, 35, 61, 36).set(61, 37, drop);
g.air(8, 41, 69, 52);
g.fill(22, 53, 58, 54, "~");
[58, 53, 48, 33, 28, 23].forEach((c, k) => {
  g.set(c, 41, fall);
  blob(c, 53, k);
});
g.set(18, 41, fall);
g.set(16, 40, g.label({ ...NEAR, facing: "down", length: 5 }));
g.rock(36, 48, 42, 54);
g.pad("F", 37, 47);
g.air(8, 53, 21, 54);
g.ledge("F", 9, 46);

// 3. The slabs (from Shifting ground): down a shaft through a wall of flame on
//    the beat, past slabs sliding across it, a flame right across it that fires
//    as you come near, and stalactites under ledges on alternate walls.
g.air(8, 53, 21, 84);
g.set(7, 55, g.label({ ...WAVE, facing: "right", length: 14, offset: 0 }));
g.fill(8, 60, 14, 61, g.label({ ...SLAB, to: [7, 0], offset: 0 }));
g.rock(20, 66, 21, 67).set(20, 68, drop);
g.set(22, 70, g.label({ ...SIDE, facing: "left", length: 14 }));
g.rock(8, 73, 9, 74).set(9, 75, drop);
g.fill(15, 78, 21, 79, g.label({ ...SLAB, to: [-7, 0], offset: 4 }));
g.rock(8, 81, 9, 82).set(9, 83, drop);

// 4. The cellar (from Aftershock): from a pad at the foot of the slabs, east
//    along a tunnel under stalactites, past flames that fire as you come near,
//    through a wall of crumbling rock, to a pad. A crystal at the end of a side
//    branch.
g.air(8, 85, 69, 96);
g.pad("F", 12, 96);
[23, 26, 41, 43].forEach((c) => g.set(c, 85, fall));
[57, 60, 66].forEach((c) => g.set(c, 85, drop));
[30, 46].forEach((c) => g.set(c, 84, g.label({ ...NEAR, facing: "down", length: 12 })));
g.fill(35, 85, 36, 96, "%");
g.pad("F", 52, 96);
g.air(1, 88, 7, 92);
g.set(2, 90, "*");

// 5. The rift (from The rift): down a shaft through a wave of flames across it,
//    with a plug of crumbling rock between each and the next.
g.air(58, 97, 69, 125);
wave(58, 69, [100, 111, 122], 1);
[105, 116].forEach((r) => g.fill(58, r, 69, r + 1, "%"));

// 6. The bottom of the fault: from a pad at the foot of the rift, east over the
//    lava, with a stalactite over every blob, to switch 1 on an island, which
//    wakes the lava, a pad on the next island, and on the same way to the foot
//    of the climb.
g.air(20, 126, 142, 140);
g.fill(20, 141, 142, 142, "~");
// A stalactite over every blob: it comes down as you come up to it, and then
// the blob's to get past.
[70, 75, 80, 85, 90, 101, 115, 120, 125].forEach((c, k) => {
  g.set(c, 126, fall);
  blob(c, 141, k);
});
g.rock(61, 136, 67, 142);
g.pad("F", 63, 135);
g.rock(92, 136, 98, 142);
g.pad(g.thing("1", { kind: "switch", opens: "2" }), 93, 135);
g.rock(105, 136, 111, 142);
g.pad("F", 106, 135);
g.fill(30, 137, 34, 137, "%"); // a crystal low over the lava, over a crumbling ledge: the skilful one
g.set(32, 135, "*");

// 7. The climb (from Lava tube): up the east side ahead of the lava, past a
//    flame right across the shaft that fires as you come near, to a pad on a
//    ledge, and on past more such flames and through a plug of crumbling rock
//    to a pad.
g.air(128, 76, 139, 125);
g.set(127, 122, g.label({ ...SIDE, facing: "right", length: 12 }));
g.ledge("F", 129, 116, 3, 2);
g.set(140, 110, g.label({ ...SIDE, facing: "left", length: 12 }));
g.fill(128, 103, 139, 104, "%");
g.set(127, 97, g.label({ ...SIDE, facing: "right", length: 12 }));
g.set(140, 91, g.label({ ...SIDE, facing: "left", length: 12 }));
g.ledge("F", 134, 88, 3, 2);

// 8. Past a beam on the beat, through gate 2 (opened for good by switch 1), and
//    west along a passage under stalactites and past a flame that fires as you
//    come near, to a pad beside the vents.
g.air(95, 76, 127, 87);
g.fill(122, 76, 123, 87, g.thing("2", { kind: "gate" }));
g.set(126, 75, g.label({ kind: "laser", facing: "down", mode: "cycle", on: 1.5, off: 2.5, warn: 0.5 }));
[119, 116, 113].forEach((c) => g.set(c, 76, fall));
g.set(110, 75, g.label({ ...NEAR, facing: "down", length: 12 }));
g.air(90, 76, 94, 87);
g.pad("F", 91, 87);

// 9. The vents (from Vents): up a shaft on a vent that blows 2 s in 4, weaker
//    than gravity, past flames right across it that fire as you come near and
//    stalactites that hang from ledges on alternate walls, to a pad.
g.air(95, 26, 106, 75);
g.rock(98, 88, 103, 89);
// It blows weaker than gravity, so you can stop in it under a flame.
g.set(100, 88, g.label({ ...VENT, strength: 9, length: 30, width: 6 }));
g.rock(95, 70, 97, 71).set(97, 72, drop);
g.rock(104, 62, 106, 63).set(104, 64, drop);
[69, 50].forEach((r) => g.set(107, r, g.label({ ...SIDE, facing: "left", length: 12 })));
[56, 44].forEach((r) => g.set(94, r, g.label({ ...SIDE, facing: "right", length: 12 })));
g.ledge("F", 96, 36, 3, 2);

// 10. The top of the fault: east past flames that fire up from the floor as you
//     come near, and stalactites over blobs thrown up from pools in the floor,
//     with a pad halfway, then up the last shaft through a wave of flames
//     across it, and west under more stalactites to a pad, and past another
//     flame that fires as you come near to the exit.
g.air(107, 26, 155, 35);
g.set(101, 26, drop); // over the top of the vents
g.set(109, 36, g.label({ ...NEAR, facing: "up", length: 10 }));
// A stalactite over every blob, from pools in the floor.
g.fill(113, 36, 120, 36, "~");
g.fill(132, 36, 144, 36, "~");
[114, 119, 133, 138, 143].forEach((c, k) => {
  g.set(c, 26, fall);
  g.set(c, 36, g.label({ ...BLOB, height: 3, offset: k % 4 }));
});
g.set(150, 36, g.label({ ...NEAR, facing: "up", length: 10 }));
g.set(124, 36, g.label({ ...NEAR, facing: "up", length: 10 }));
g.pad("F", 128, 35);
g.air(144, 8, 155, 25);
wave(144, 155, [20, 12], 1);
g.air(110, 2, 155, 7);
[141, 138, 122, 119].forEach((c) => g.set(c, 2, drop));
g.pad("F", 131, 7);
g.set(127, 8, g.label({ ...NEAR, facing: "up", length: 6 }));
g.pad("E", 114, 7);

g.roughen(98, 0.3);
const header = `9-8: The world's test: zigzag down one side of the fault and up the other, under falling rock all the way; a switch at the bottom wakes the lava.

Down the west side of the fault in a zigzag, east along its bottom to switch 1,
which wakes the lava and opens gate 2, then up the east side ahead of the lava
to the exit at the top. A section from each level before it, and something to
react to every few seconds all the way. A 4 s beat for everything on a cycle.
Stalactites shake for half a second once you're within 6 m of being under
them, or 9 m where the roof is high, so they come down in front of you; a
flame that fires as you come near rests for 1.5 s, or 2 s where you cross it
going up or down. The lava rises 1.3 m/s from 2 s after you land on switch 1,
and fills the fault to just below the top of the vents.

Sections, in order:
1. The gallery (from Tremor): east along the top under rows of stalactites,
   past flames that fire up from the floor as you come near and a blob thrown
   up from a pool in it. A crystal in an alcove over it.
2. The first floor (from Landslide): down a shaft onto crumbling rock, past
   flames right across it that fire as you come near and a stalactite, into a
   chamber of blob pools with a stalactite over every blob, west to a pad on
   an island and on to a pad at the far end.
3. The slabs (from Shifting ground): down a shaft through a wall of flame on
   the beat, past slabs sliding across it, a flame right across it that fires
   as you come near, and stalactites under ledges on alternate walls.
4. The cellar (from Aftershock): from a pad at the foot of the slabs, east
   along a tunnel under stalactites, past flames that fire as you come near,
   through a wall of crumbling rock, to a pad. A crystal at the end of a side
   branch.
5. The rift (from The rift): down a shaft through a wave of flames across it,
   with a plug of crumbling rock between each and the next.
6. The bottom of the fault: from a pad at the foot of the rift, east over the
   lava, with a stalactite over every blob, to switch 1 on an island, which
   wakes the lava, a pad on the next island, and on the same way to the foot of
   the climb. A crystal low over the lava, over a crumbling ledge.
7. The climb (from Lava tube): up the east side ahead of the lava, past a
   flame right across the shaft that fires as you come near, to a pad on a
   ledge, and on past more such flames and through a plug of crumbling rock to
   a pad.
8. Past a beam on the beat, through gate 2, opened by switch 1, and west along
   a passage under stalactites and past a flame that fires as you come near, to
   a pad beside the vents.
9. The vents (from Vents): up a shaft on a vent that blows 2 s in 4, weaker
   than gravity, past flames right across it that fire as you come near and
   stalactites that hang from ledges on alternate walls, to a pad.
10. The top of the fault: east past flames that fire up from the floor as you
    come near, and stalactites over blobs thrown up from pools in the floor,
    with a pad halfway, then up the last shaft through a wave of flames across
    it, and west under more stalactites to a pad, and past another flame that
    fires as you come near to the exit.`;
await buildLevel("9-8", g, { header, name: "The fault", fuel: 27, par: 395, route: "F@56 F@38 F@10 F@13 F@53 F@64 1 F@107 F@132 F@135 F@92 F@97 F@129 F@134 E", rise: { speed: 1.3, from: 2, to: 100, after: "1", delay: 2 } });
