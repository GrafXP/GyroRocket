import { Grid, buildLevel } from "./grid.js";

const W = 180;
const H = 124;
const g = new Grid(W, H);
// Dark. A 3 s beat: gusts and magnets on 1.5 s, off 1.5 s, one way then the
// other; hammers rest 1.6 s and presses 2.2 s; flames across the shaft flash
// 0.5 s in 3. Everything warns for 0.4 s. Stalactites shake for 0.4 s once
// you're within 9 m of being under them, or 3 m in pockets in a shaft's walls,
// shedding dust: in the dark, that's how you see them go.
const WARN = 0.4;
const GUST = { kind: "fan", mode: "cycle", on: 1.5, off: 1.5, warn: WARN };
const PULL = { kind: "magnet", mode: "cycle", on: 1.5, off: 1.5, warn: WARN };
const HAMMER = { kind: "crusher", rest: 1.6, warn: WARN, slam: 0.15, hold: 0.7, back: 0.15 };
const PRESS = { kind: "crusher", rest: 2.2, warn: WARN, slam: 0.15, hold: 0.1, back: 0.15 };
const FLASH = { kind: "flame", on: 0.5, off: 2.5, warn: WARN };
const NEAR = { kind: "flame", mode: "near", on: 1, off: 1.5, warn: WARN, reach: 5 };
const SIDE = { ...NEAR, off: 2 };
const SLAB = { kind: "mover", period: 6 };
const fall = g.label({ kind: "stalactite", reach: 9, warn: WARN });
const edge = g.label({ kind: "stalactite", reach: 3, warn: WARN });

// The start, bottom left.
g.air(3, 106, 12, 115);
g.pad("S", 5, 115);

// 1. Crosswinds: east along a corridor where gusts blow down from the roof and
//    up from the floor in turn, in the same columns, with hammers between them
//    and rows of stalactites, to a pad halfway and on into the pull.
g.air(13, 106, 112, 115);
// The gusts blow weaker than gravity, and clear of the hammers' travel.
const roofGust = g.label({ ...GUST, facing: "down", length: 10, width: 3, strength: 6, offset: 0 });
const floorGust = g.label({ ...GUST, facing: "up", length: 10, width: 3, strength: 8, offset: 1.5 });
const hammer = (c, k) => g.air(c, 104, c, 105).fill(c, 104, c, 105, g.label({ ...HAMMER, to: [0, -10], offset: k % 3 }));
[16, 29, 42, 64, 77, 90].forEach((c0, k) => {
  hammer(c0, k);
  g.set(c0 + 4, 105, roofGust).set(c0 + 4, 116, floorGust);
  g.set(c0 + 7, 106, fall).set(c0 + 9, 106, fall).set(c0 + 11, 106, fall);
});
hammer(103, 0);
g.set(107, 105, roofGust).set(107, 116, floorGust);
g.pad("F", 57, 115);
g.air(60, 101, 62, 105); // an alcove over the corridor, with a crystal: the easy one
g.set(61, 102, "*");

// 2. The pull: east through a hall where magnets in the roof and floor pull in
//    turn, presses slamming down between them, under stalactites.
g.air(113, 100, 162, 115);
g.pad("F", 113, 115);
const roofPull = g.label({ ...PULL, strength: 12, range: 20, offset: 0 });
const floorPull = g.label({ ...PULL, strength: 12, range: 20, offset: 1.5 });
const press = (c, k) => g.air(c, 98, c + 1, 99).fill(c, 98, c + 1, 99, g.label({ ...PRESS, to: [0, -16], offset: k % 3 }));
[120, 131, 142, 153].forEach((c0, k) => {
  press(c0, k);
  g.set(c0 + 4, 99, roofPull);
  g.set(c0 + 7, 100, fall).set(c0 + 9, 100, fall);
  g.set(c0 + 9, 116, floorPull);
});

// 3. The undertow: up the east shaft on a vent that blows 1.5 s in 3, weaker
//    than gravity, through flames that flash across it every 16 m from
//    alternate walls, in a wave, past push magnets in its walls in turn and
//    stalactites in pockets, to a pad in a nook halfway and one on a ledge at
//    the top.
g.air(163, 34, 174, 115);
g.set(168, 116, g.label({ ...GUST, facing: "up", length: 60, width: 8, strength: 9 }));
// 16 m apart, so you can stop between them.
[96, 88, 80, 72, 64, 56, 48, 40].forEach((r, k) => {
  const west = k % 2 === 0;
  g.set(west ? 162 : 175, r, g.label({ ...FLASH, facing: west ? "right" : "left", length: 12, offset: k % 3 }));
});
[92, 60, 44].forEach((r) => g.set(175, r, g.label({ ...PULL, push: true, strength: 8, range: 12, offset: 0 })));
[84, 68, 52].forEach((r) => g.set(162, r, g.label({ ...PULL, push: true, strength: 8, range: 12, offset: 1.5 })));
[100, 76, 52].forEach((r) => g.rock(163, r, 164, r + 1).set(164, r + 2, edge));
// Presses from pockets in the walls, opposite the magnets, slamming half way
// across: the magnets push you towards them.
const wallPress = (west, r, k) => {
  const c = west ? 160 : 176;
  g.air(c, r, c + 1, r + 1).fill(c, r, c + 1, r + 1, g.label({ ...PRESS, to: [west ? 6 : -6, 0], offset: k % 3 }));
};
[[true, 91], [false, 83], [false, 67], [true, 59], [false, 51], [true, 43]].forEach(([west, r], k) => wallPress(west, r, k));
g.air(175, 75, 179, 79);
g.pad("F", 176, 79);
g.ledge("F", 164, 34);

// 4. Headwind: west along an upper corridor against gusts blowing along it from
//    rocks that hang from its roof, under pairs of stalactites, past presses and
//    slabs that slide down from the roof, to a pad halfway.
g.air(30, 22, 174, 33);
const headwind = (c) => g.rock(c, 22, c + 1, 26).set(c + 1, 26, g.label({ ...GUST, facing: "right", length: 14, width: 6, strength: 8, offset: 0 }));
[156, 139, 122, 88, 71, 54].forEach((c, k) => {
  headwind(c);
  g.set(c - 4, 22, fall).set(c - 7, 22, fall);
  g.air(c - 11, 20, c - 10, 21).fill(c - 11, 20, c - 10, 21, g.label({ ...PRESS, to: [0, -12], offset: k % 3 }));
  g.air(c - 15, 18, c - 14, 21).fill(c - 15, 18, c - 14, 21, g.label({ ...SLAB, to: [0, -6], offset: k % 2 ? 0 : 3 }));
});
headwind(105);
g.pad("F", 98, 33);
g.pad("F", 31, 33);

// 5. The last drop: down a shaft past flames across it every 12 m that fire as
//    you come near and stalactites in pockets in its walls, through an updraft
//    that blows 1.5 s in 3, to the exit beside a pool that throws up blobs.
g.air(18, 22, 29, 90);
// The updraft blows only below the flames: crossing a flame going down, an
// updraft that comes on would hold you in it. Beside the exit, lava throws up
// blobs on the beat.
g.set(28, 91, g.label({ ...GUST, facing: "up", length: 8, width: 2, strength: 9, offset: 0 }));
g.fill(23, 91, 26, 91, "~");
g.set(24, 91, g.label({ kind: "blob", height: 4, period: 3, warn: WARN }));
[38, 50, 62, 74].forEach((r) => g.set(30, r, g.label({ ...SIDE, facing: "left", length: 12 })));
[44, 56, 68, 80].forEach((r) => g.set(17, r, g.label({ ...SIDE, facing: "right", length: 12 })));
g.rock(18, 40, 19, 41).set(19, 42, edge);
g.rock(28, 46, 29, 47).set(28, 48, edge);
g.rock(18, 64, 19, 65).set(19, 66, edge);
g.rock(28, 70, 29, 71).set(28, 72, edge);
g.pad("E", 19, 90);
// A side branch off the shaft, with a crystal at its end.
g.air(4, 58, 17, 62);
g.set(6, 60, "*");
// A crystal under a press in the pull hall: the skilful one.
g.set(143, 113, "*");

g.roughen(103, 0.3);
const header = `10-3: Dark: fans and magnets pushing different ways at once, crushers where they meet, and stalactites you only see in your headlight.

East along the bottom, up the east shaft, west along the top and down the last
drop to the exit. Dark. A 3 s beat: gusts and magnets on 1.5 s, off 1.5 s, one
way then the other; hammers rest 1.6 s and presses 2.2 s; flames across the
shaft flash 0.5 s in 3, and blobs come up every 3 s. Everything warns for
0.4 s. Stalactites shake for 0.4 s once you're within 9 m of being under them,
or 3 m in pockets in the shafts' walls, shedding dust: in the dark, that's how
you see them go. A flame that fires as you come near rests for 2 s.

Sections, in order:
1. Crosswinds: east along a corridor where gusts blow down from the roof and
   up from the floor in turn, in the same columns, with hammers between them
   and rows of stalactites, to a pad halfway and on into the pull. A crystal in
   an alcove over it.
2. The pull: east through a hall where magnets in the roof and floor pull in
   turn, presses slamming down between them, under stalactites. A crystal
   under a press.
3. The undertow: up the east shaft on a vent that blows 1.5 s in 3, weaker
   than gravity, through flames that flash across it every 16 m from alternate
   walls, in a wave, past push magnets in its walls in turn that push you
   towards presses slamming halfway across, and stalactites in pockets, to a
   pad in a nook halfway and one on a ledge at the top.
4. Headwind: west along an upper corridor against gusts blowing along it from
   rocks that hang from its roof, under pairs of stalactites, past presses and
   slabs that slide down from the roof, to a pad halfway and one at the end.
5. The last drop: down a shaft past flames across it every 12 m that fire as
   you come near and stalactites in pockets in its walls, through an updraft
   that blows 1.5 s in 3, to the exit beside a pool that throws up blobs. A
   crystal at the end of a side branch.`;
await buildLevel("10-3", g, { header, name: "Undertow", fuel: 29, par: 265, dark: true, route: "F@58 F@114 F@177 F@165 F@99 F@32 E" });
