import { Grid, buildLevel } from "./grid.js";

const W = 160;
const H = 150;
const g = new Grid(W, H);
// A 4 s beat for everything on a cycle. Stalactites shake for half a second once
// you're within 6 m of being under them; a flame that fires as you come near
// rests for 1.5 s, or 2 s where you cross it going up or down. Switch 1, at the
// bottom, wakes the lava: it rises 2.5 m/s from 2 s after you land on it, up
// to just below the top of the vents.
const drop = g.label({ kind: "stalactite", reach: 6, warn: 0.5 });
const NEAR = { kind: "flame", mode: "near", on: 1, off: 1.5, warn: 0.5, reach: 5 };
const SIDE = { ...NEAR, off: 2 };
const BLOB = { kind: "blob", height: 5, period: 4, warn: 0.6 };
const WAVE = { kind: "flame", on: 1, off: 3, warn: 0.5 };
const VENT = { kind: "fan", facing: "up", strength: 12, mode: "cycle", on: 2, off: 2, warn: 0.5 };
const SLAB = { kind: "mover", period: 8 };
// Flames across a shaft from its west wall at column c0 - 1 or its east wall at
// c1 + 1, alternately, on rows `rows`, firing `step` seconds one after another.
const wave = (c0, c1, rows, step) =>
  rows.forEach((r, k) => {
    const west = k % 2 === 0;
    g.set(west ? c0 - 1 : c1 + 1, r, g.label({ ...WAVE, facing: west ? "right" : "left", length: c1 - c0 + 1, offset: k * step }));
  });

// West of the fault, down; east of it, up.

// 1. The gallery (from Tremor): east along the top under a row of stalactites.
g.air(3, 5, 69, 14);
g.pad("S", 5, 14);
for (let c = 14; c <= 50; c += 6) g.set(c, 5, drop);
g.air(34, 1, 36, 4); // an alcove over the gallery, with a crystal: the easy one
g.set(35, 2, "*");
g.pad("F", 55, 14);

// 2. The first floor (from Landslide): down a shaft onto crumbling rock, past a
//    flame that fires as you come near and a stalactite, into a chamber of
//    blob pools under stalactites, west to a pad.
g.air(60, 15, 69, 40);
g.fill(60, 22, 69, 23, "%");
g.set(70, 32, g.label({ ...SIDE, facing: "left", length: 5 }));
g.rock(60, 36, 61, 37).set(61, 38, drop);
g.air(8, 41, 69, 52);
g.fill(24, 53, 58, 54, "~");
[28, 38, 48, 56].forEach((c, k) => g.set(c, 53, g.label({ ...BLOB, offset: k * 2 })));
[33, 43, 51].forEach((c) => g.set(c, 41, drop));
g.air(8, 53, 21, 54);
g.ledge("F", 9, 46);

// 3. The slabs (from Shifting ground): down a shaft through a wall of flame on
//    the beat, past slabs sliding across it and stalactites under ledges.
g.air(8, 53, 21, 84);
g.set(7, 55, g.label({ ...WAVE, facing: "right", length: 14, offset: 0 }));
g.fill(8, 62, 14, 63, g.label({ ...SLAB, to: [7, 0], offset: 0 }));
g.fill(15, 74, 21, 75, g.label({ ...SLAB, to: [-7, 0], offset: 4 }));
g.rock(8, 67, 9, 68).set(9, 69, drop);
g.rock(8, 78, 9, 79).set(9, 80, drop);

// 4. The cellar (from Aftershock): from a pad at the foot of the slabs, east
//    along a tunnel under stalactites, through
//    a wall of crumbling rock and past flames that fire as you come near, to a
//    pad. A crystal at the end of a side branch.
g.air(8, 85, 69, 96);
g.pad("F", 12, 96);
[27, 40, 62].forEach((c) => g.set(c, 85, drop));
g.fill(33, 85, 34, 96, "%");
g.set(46, 84, g.label({ ...NEAR, facing: "down", length: 12 }));
g.pad("F", 52, 96);
g.air(0 + 1, 88, 7, 92);
g.set(2, 90, "*");

// 5. The rift (from The rift): down a shaft through a wave of flames across it.
g.air(58, 97, 69, 125);
wave(58, 69, [102, 110, 118], 1);

// 6. The bottom of the fault: from a pad at the foot of the rift, east over the
//    lava, between blobs and under stalactites, to switch 1 on an island, which
//    wakes the lava.
g.air(20, 126, 142, 140);
g.fill(20, 141, 142, 142, "~");
[74, 84, 104, 114, 124].forEach((c, k) => g.set(c, 141, g.label({ ...BLOB, offset: k * 2 })));
[72, 80, 90, 110, 120].forEach((c) => g.set(c, 126, drop));
g.rock(61, 136, 67, 142);
g.pad("F", 63, 135);
g.rock(92, 136, 98, 142);
g.pad(g.thing("1", { kind: "switch", opens: "2" }), 93, 135);
g.fill(30, 137, 34, 137, "%"); // a crystal low over the lava, over a crumbling ledge: the skilful one
g.set(32, 135, "*");

// 7. The climb (from Lava tube): up the east side ahead of the lava, from a pad
//    on a ledge, past flames that fire as you come near and through a plug of
//    crumbling rock, to a pad.
g.air(128, 76, 139, 125);
g.ledge("F", 129, 116, 3, 2);
g.set(140, 110, g.label({ ...SIDE, facing: "left", length: 6 }));
g.fill(128, 102, 139, 103, "%");
g.set(127, 96, g.label({ ...SIDE, facing: "right", length: 6 }));
g.ledge("F", 134, 88, 3, 2);

// 8. Past a beam on the beat, through gate 2 (opened for good by switch 1), and
//    west along a passage under a stalactite and a flame that fires as you come
//    near.
g.air(95, 76, 127, 87);
g.fill(122, 76, 123, 87, g.thing("2", { kind: "gate" }));
g.set(126, 75, g.label({ kind: "laser", facing: "down", mode: "cycle", on: 1.5, off: 2.5, warn: 0.5 }));
g.set(118, 76, drop);
g.set(110, 75, g.label({ ...NEAR, facing: "down", length: 12 }));

// 9. The vents (from Vents): up a shaft on a vent that blows 2 s in 4, under
//    stalactites that hang from ledges and past a flame that fires as you come
//    near, to a pad.
g.air(95, 26, 106, 75);
g.rock(98, 88, 103, 89);
g.set(100, 88, g.label({ ...VENT, length: 30, width: 6 }));
g.rock(95, 64, 97, 65).set(97, 66, drop);
g.rock(104, 52, 106, 53).set(104, 54, drop);
g.set(107, 46, g.label({ ...SIDE, facing: "left", length: 6 }));
g.rock(104, 38, 106, 39).set(104, 40, drop);
g.ledge("F", 96, 36, 3, 2);

// 10. The top of the fault: east under stalactites, then up the last shaft
//     through a wave of flames across it, and under more stalactites to the
//     exit.
g.air(107, 26, 155, 35);
[114, 124, 134].forEach((c) => g.set(c, 26, drop));
g.air(144, 8, 155, 25);
wave(144, 155, [20, 12], 1);
g.air(110, 2, 155, 7);
[140, 130, 122].forEach((c) => g.set(c, 2, drop));
g.pad("E", 114, 7);

g.roughen(98, 0.3);
const header = `9-8: The world's test: zigzag down one side of the fault and up the other, under falling rock all the way; a switch at the bottom wakes the lava.

Down the west side of the fault in a zigzag, east along its bottom to switch 1,
which wakes the lava and opens gate 2, then up the east side ahead of the lava
to the exit at the top. A section from each level before it. A 4 s beat for
everything on a cycle. Stalactites shake for half a second once you're within
6 m of being under them; a flame that fires as you come near rests for 1.5 s,
or 2 s where you cross it going up or down. The lava rises 2.5 m/s from 2 s
after you land on switch 1, and fills the fault to just below the top of the
vents.

Sections, in order:
1. The gallery (from Tremor): east along the top under a row of stalactites. A
   crystal in an alcove over it.
2. The first floor (from Landslide): down a shaft onto crumbling rock, past a
   flame that fires as you come near and a stalactite, into a chamber of blob
   pools under stalactites, west to a pad.
3. The slabs (from Shifting ground): down a shaft through a wall of flame on
   the beat, past slabs sliding across it and stalactites under ledges.
4. The cellar (from Aftershock): from a pad at the foot of the slabs, east
   along a tunnel under stalactites, through
   a wall of crumbling rock and past a flame that fires as you come near, to a
   pad. A crystal at the end of a side branch.
5. The rift (from The rift): down a shaft through a wave of flames across it.
6. The bottom of the fault: from a pad at the foot of the rift, east over the
   lava, between blobs and under stalactites, to switch 1 on an island, which
   wakes the lava. A crystal low over the lava, over a crumbling ledge.
7. The climb (from Lava tube): up the east side ahead of the lava, from a pad
   on a ledge, past flames that fire as you come near and through a plug of
   crumbling rock, to a pad.
8. Past a beam on the beat, through gate 2, opened by switch 1, and west along
   a passage under a stalactite and a flame that fires as you come near.
9. The vents (from Vents): up a shaft on a vent that blows 2 s in 4, under
   stalactites that hang from ledges and past a flame that fires as you come
   near, to a pad.
10. The top of the fault: east under stalactites, then up the last shaft
    through a wave of flames across it, and under more stalactites to the
    exit.`;
await buildLevel("9-8", g, { header, name: "The fault", fuel: 29, par: 250, route: "F@56 F@10 F@13 F@53 F@64 1 F@130 F@135 F@97 E", rise: { speed: 2.5, from: 2, to: 100, after: "1", delay: 2 } });
