import { Grid, buildLevel } from "./grid.js";

const W = 180;
const H = 90;
const g = new Grid(W, H);
// World 10's 3 s beat, and warnings of 0.4 s. Flame walls fire 1 s in 3, beams
// shine 1 s in 3, blobs are thrown every 3 s, the vent blows 1.5 s in 3 and
// hammers slam every 3 s. A flame that fires as you come near rests 1.5 s, or
// 2 s where you cross it going up; stalactites shake once you're within 6 m of
// being under them, or 9 m where the roof is high. The yellow key wakes the
// lava, which rises 0.8 m/s from 2 s after you take it.
const WARN = 0.4;
const WALL = { kind: "flame", on: 1, off: 2, warn: WARN };
const NEAR = { kind: "flame", mode: "near", on: 1, off: 1.5, warn: WARN, reach: 5 };
const SIDE = { ...NEAR, off: 2 };
const BLOB = { kind: "blob", height: 3, period: 3, warn: WARN };
const HAMMER = { kind: "crusher", rest: 1.6, warn: WARN, slam: 0.15, hold: 0.7, back: 0.15 };
const PRESS = { kind: "crusher", rest: 2.2, warn: WARN, slam: 0.15, hold: 0.1, back: 0.15 };
const BEAM = { kind: "laser", mode: "cycle", on: 1, off: 2, warn: WARN };
const SLAB = { kind: "mover", period: 6 };
const PUSH = { kind: "magnet", push: true, strength: 7, range: 10, mode: "cycle", on: 1.5, off: 1.5, warn: WARN };
const TURRET = { kind: "turret", range: 36, speed: 9, windup: 0.5, reload: 0.8 };
g.thing("1", { kind: "switch", opens: "2", time: 16 });
g.thing("2", { kind: "gate" });
const drop = g.label({ kind: "stalactite", reach: 6, warn: WARN });
const fall = g.label({ kind: "stalactite", reach: 9, warn: WARN });
const edge = g.label({ kind: "stalactite", reach: 3, warn: WARN });

// 1. The mine (Old mine): from the start, down into a side gallery under
//    stalactites, past a flame that fires up from the floor as you come near,
//    to the red key, up into the main gallery, through the red door, onto
//    switch 1, which opens gate 2 for 16 s, and through it.
g.air(18, 6, 31, 16);
g.pad("S", 20, 16);
[24, 29].forEach((c) => g.set(c, 5, drop));
g.air(27, 17, 31, 19); // down into the side gallery
g.air(27, 20, 56, 28);
[33, 36, 49].forEach((c) => g.set(c, 20, fall));
g.set(40, 29, g.label({ ...NEAR, facing: "up", length: 8 }));
g.set(46, 26, "r");
g.air(52, 15, 56, 19); // up into the main gallery
g.set(57, 17, g.label({ ...SIDE, facing: "left", length: 5 }));
g.air(48, 4, 80, 14);
g.fill(58, 4, 59, 14, "R");
[50, 61, 70, 73].forEach((c) => g.set(c, 4, fall));
g.pad("1", 64, 14);
g.set(74, 15, g.label({ ...NEAR, facing: "up", length: 11 }));
g.air(66, 1, 69, 3); // an alcove over the main gallery, with a crystal: the easy one
g.set(67, 2, "*");
g.fill(76, 4, 77, 14, "2");
g.ledge("F", 79, 10, 3, 5);

// 2. The furnace (Furnace): east over a lava channel under walls of flame from
//    the roof that fire in a wave, with a stalactite over every blob between
//    them, to a pad on a ledge at the far end.
g.air(82, 4, 150, 16);
g.fill(84, 17, 150, 18, "~");
[86, 98, 110, 122, 134].forEach((c, k) => g.set(c, 3, g.label({ ...WALL, facing: "down", length: 13, offset: k * 0.5 })));
[92, 104, 116, 128, 140].forEach((c, k) => {
  g.set(c, 4, fall);
  g.set(c, 17, g.label({ ...BLOB, offset: (k * 0.75) % 3 }));
});
g.rock(146, 10, 150, 18);
g.pad("F", 147, 9);
// A crystal low over the lava between two walls of flame, over a crumbling
// ledge: the skilful one.
g.fill(118, 15, 120, 15, "%");
g.set(119, 13, "*");

// 3. The works (Works): down a shaft against a vent that blows 1.5 s in 3, a
//    little weaker than gravity, past slabs sliding across it, push magnets in
//    its walls that push in turn, and a press in a pocket.
g.air(151, 4, 162, 62);
g.rock(155, 63, 160, 64).set(157, 63, g.label({ kind: "fan", facing: "up", mode: "cycle", on: 1.5, off: 1.5, warn: WARN, strength: 9, length: 44, width: 6 }));
// Two flashes across it together, crossed as one.
[14, 18].forEach((r) => g.set(163, r, g.label({ kind: "flame", on: 0.5, off: 2.5, warn: WARN, facing: "left", length: 12 })));
g.fill(151, 24, 155, 25, g.label({ ...SLAB, to: [7, 0], offset: 0 }));
g.set(163, 29, g.label({ ...PUSH, offset: 0 }));
g.set(150, 35, g.label({ ...PUSH, offset: 1.5 }));
g.fill(158, 41, 162, 42, g.label({ ...SLAB, to: [-7, 0], offset: 3 }));
[33, 55].forEach((r) => g.set(163, r, g.label({ kind: "flame", on: 0.5, off: 2.5, warn: WARN, facing: "left", length: 12, offset: 1.5 })));
g.air(163, 48, 164, 48);
g.fill(163, 48, 164, 48, g.label({ ...PRESS, to: [-6, 0] }));
// A side branch off the shaft, with a crystal at its end.
g.air(163, 14, 176, 18);
g.set(174, 16, "*");

// 4. The deep dark (Deep dark): west along a hall where beams shine down from
//    the roof on the beat in a wave, with gusts between them down from the
//    roof and up from the floor in turn, watched by a turret, and a hammer at
//    either end.
g.air(40, 50, 150, 62);
g.pad("F", 152, 62);
// (The hammers are out of the turret's range: dodging a shot can take you
// under one.)
[142, 136, 130, 124, 118, 112, 106, 100, 94, 88].forEach((c, k) => g.set(c, 49, g.label({ ...BEAM, facing: "down", offset: (k * 0.5) % 3 })));
// Gusts between the beams, down from the roof and up from the floor in turn.
[139, 133, 127, 121, 115, 109, 103, 97, 91].forEach((c, k) =>
  g.set(c, k % 2 ? 63 : 49, g.label({ kind: "fan", mode: "cycle", on: 1.5, off: 1.5, warn: WARN, facing: k % 2 ? "up" : "down", length: 13, width: 2, strength: 6, offset: (k % 2) * 1.5 })),
);
[148, 82].forEach((c, k) => g.fill(c, 50, c, 51, g.label({ ...HAMMER, to: [0, -11], offset: k * 1.5 })));
g.air(113, 46, 115, 49).set(114, 45, g.label(TURRET));
g.pad("F", 78, 62);

// 5. The core (Core): on west under rows of stalactites, down through a
//    crumbling floor to the yellow key over a lava pool, which wakes the lava,
//    and up the last shaft ahead of it, past flames right across it that fire
//    as you come near and stalactites in pockets in its walls, through a plug
//    of crumbling rock, to the exit.
g.air(31, 50, 39, 62);
[72, 69, 66, 60, 57, 54, 51, 48].forEach((c) => g.set(c, 50, fall));
g.fill(33, 63, 44, 64, "%");
g.air(13, 65, 48, 76);
g.fill(3, 77, 48, 78, "~");
[42, 36, 30, 24].forEach((c, k) => g.set(c, 77, g.label({ ...BLOB, offset: k * 0.75 })));
[30, 24, 19].forEach((c) => g.set(c, 65, fall));
g.set(16, 70, "y");
g.air(3, 4, 12, 76);
[73, 61, 49, 37, 29].forEach((r, k) => g.set(k % 2 ? 2 : 13, r, g.label({ ...SIDE, facing: k % 2 ? "right" : "left", length: 10 })));
g.ledge("F", 4, 44, 3, 2);
[56, 33].forEach((r) => g.air(13, r, 14, r).set(13, r - 1, edge));
g.fill(3, 23, 12, 24, "%");
[18, 12].forEach((r, k) => g.set(k % 2 ? 2 : 13, r, g.label({ ...SIDE, facing: k % 2 ? "right" : "left", length: 10 })));
g.pad("E", 6, 8);

g.roughen(101, 0.3);
const header = `10-1: The way in: one section from each world in order, mine to core, a reminder of everything.

From the top left, east through the mine and the furnace, down the works'
shaft, west along the deep dark's hall to the core, down to the yellow key and
up the last shaft to the exit, back at the top left. World 10's 3 s beat, and
warnings of 0.4 s: flame walls fire 1 s in 3, beams shine 1 s in 3, blobs are
thrown every 3 s, the vent blows 1.5 s in 3 and hammers slam every 3 s. A
flame that fires as you come near rests 1.5 s, or 2 s where you cross it going
up; stalactites shake once you're within 9 m of being under them, or 3 m in
pockets in a shaft's walls. The yellow key wakes the lava, which rises 0.8 m/s
from 2 s after you take it.

Sections, in order:
1. The mine (Old mine): from the start, down into a side gallery under
   stalactites, past a flame that fires up from the floor as you come near, to
   the red key, up into the main gallery, through the red door, onto switch 1,
   which opens gate 2 for 16 s, and through it. A crystal in an alcove over the
   main gallery.
2. The furnace (Furnace): east over a lava channel under walls of flame from
   the roof that fire in a wave, with a stalactite over every blob between
   them, to a pad on a ledge at the far end. A crystal low over the lava between two
   walls of flame, over a crumbling ledge.
3. The works (Works): down a shaft against a vent that blows 1.5 s in 3, a
   little weaker than gravity, past slabs sliding across it, push magnets in
   its walls that push in turn, and a press in a pocket. A crystal at the end
   of a side branch.
4. The deep dark (Deep dark): west along a hall where beams shine down from the
   roof on the beat in a wave, with gusts between them down from the roof and
   up from the floor in turn, watched by a turret, and a hammer at either end.
5. The core (Core): on west under rows of stalactites, down through a crumbling
   floor to the yellow key over a lava pool, which wakes the lava, and up the
   last shaft ahead of it, past flames right across it that fire as you come
   near and stalactites in pockets in its walls, to a pad on a ledge, and
   through a plug of crumbling rock to the exit.`;
await buildLevel("10-1", g, {
  header,
  name: "Threshold",
  fuel: 32,
  par: 245,
  crumble: 0.6,
  route: "r 1 F@82 F@148 F@153 F@79 y F@5 E",
  rise: { speed: 0.8, from: 13, to: 76, after: "y", delay: 2 },
});
