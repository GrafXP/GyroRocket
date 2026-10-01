import { Grid, buildLevel } from "./grid.js";

const W = 200;
const H = 46;
const g = new Grid(W, H);
// A 3 s beat, warnings of 0.4 s. Walls of flame and beams are on 1 s in 3,
// hammers rest 1.6 s and presses 2.2 s, blobs come up every 3 s, gusts and
// magnets are on for 1.5 s in 3, and slabs slide down and back in 6 s. A flame
// that fires as you come near rests 1.5 s, or 2 s across the shaft; stalactites
// shake for 0.4 s once you're within 9 m of being under them. Crumbling rock
// falls 0.6 s after you touch it. The turret's shots fly at 9 m/s.
const WARN = 0.4;
const WALL = { kind: "flame", on: 1, off: 2, warn: WARN };
const FLASH = { kind: "flame", on: 0.5, off: 2.5, warn: WARN };
const NEAR = { kind: "flame", mode: "near", on: 1, off: 1.5, warn: WARN, reach: 5 };
const SIDE = { ...NEAR, off: 2 };
const BLOB = { kind: "blob", height: 4, period: 3, warn: WARN };
const HAMMER = { kind: "crusher", rest: 1.6, warn: WARN, slam: 0.15, hold: 0.7, back: 0.15 };
const PRESS = { kind: "crusher", rest: 2.2, warn: WARN, slam: 0.15, hold: 0.1, back: 0.15 };
const BEAM = { kind: "laser", mode: "cycle", on: 1, off: 2, warn: WARN };
const GUST = { kind: "fan", mode: "cycle", on: 1.5, off: 1.5, warn: WARN, length: 12, width: 3 };
const PULL = { kind: "magnet", mode: "cycle", on: 1.5, off: 1.5, warn: WARN, strength: 9, range: 20 };
const TURRET = { kind: "turret", range: 24, speed: 9, windup: 0.5, reload: 0.8 };
const SLAB = { kind: "mover", period: 6 };
const fall = g.label({ kind: "stalactite", reach: 9, warn: WARN });

// The hall, along the bottom, and the gallery over it: each 12 rows high. `r0`
// is the row a hall's air starts on (its roof on r0 - 1, its floor on r0 + 12).
const HALL = 30;
const GALLERY = 10;
const wall = (c, r0, k) => g.set(c, r0 - 1, g.label({ ...WALL, facing: "down", length: 12, offset: k % 3 }));
const near = (c, r0, up = false) => g.set(c, up ? r0 + 12 : r0 - 1, g.label({ ...NEAR, facing: up ? "up" : "down", length: 12 }));
const hammer = (c, r0, k) => g.fill(c, r0 - 2, c, r0 - 1, g.label({ ...HAMMER, to: [0, -12], offset: k % 3 }));
const press = (c, r0, k) => g.fill(c, r0 - 2, c + 1, r0 - 1, g.label({ ...PRESS, to: [0, -12], offset: k % 3 }));
const beam = (c, r0, k) => g.set(c, r0 - 1, g.label({ ...BEAM, facing: "down", offset: k % 3 }));
const stal = (c, r0) => g.set(c, r0, fall);
const blob = (c, r0, k) => g.set(c - 1, r0 + 12, "~").set(c + 1, r0 + 12, "~").set(c, r0 + 12, g.label({ ...BLOB, offset: k % 3 }));
// A stalactite over a blob.
const pair = (c, r0, k) => (stal(c, r0), blob(c, r0, k));
// Gusts down from the roof and up from the floor in turn, in the same columns,
// both weaker than gravity.
const gusts = (c, r0) =>
  g.set(c, r0 - 1, g.label({ ...GUST, facing: "down", strength: 6, offset: 0 })).set(c, r0 + 12, g.label({ ...GUST, facing: "up", strength: 8, offset: 1.5 }));
// Magnets in the roof and the floor, pulling in turn.
const roofPull = (c, r0) => g.set(c, r0 - 1, g.label({ ...PULL, offset: 0 }));
const floorPull = (c, r0) => g.set(c, r0 + 12, g.label({ ...PULL, offset: 1.5 }));
// A pad on a ledge, high enough that the way along the hall is over the blobs.
const pad = (ch, c, r0) => g.ledge(ch, c, r0 + 7, 3, 4);

g.air(3, HALL, 196, HALL + 11);
g.air(3, GALLERY, 196, GALLERY + 11);
pad("S", 4, HALL);

// 1. The mine: east under flames from the roof that fire as you come near and
//    rows of stalactites, one over a blob, to a pad.
[12, 25, 38].forEach((c, k) => {
  near(c, HALL);
  stal(c + 5, HALL);
  pair(c + 7, HALL, k);
  stal(c + 9, HALL);
});
pad("F", 52, HALL);
g.air(22, 24, 24, 29); // an alcove over the hall, with a crystal: the easy one
g.set(23, 25, "*");

// 2. The works: on through hammers, gusts down from the roof and up from the
//    floor in turn, and rows of stalactites, to a pad.
[60, 73, 86, 99].forEach((c, k) => {
  hammer(c, HALL, k);
  gusts(c + 4, HALL);
  [7, 9, 11].forEach((d) => stal(c + d, HALL));
});
hammer(112, HALL, 1);
pad("F", 116, HALL);
// A pit in the floor under a row of stalactites, with a crystal: the skilful
// one.
g.air(68, 42, 70, 44);
g.set(69, 43, "*");

// 3. The furnace: walls of flame and beams on the beat, in turn, with gusts
//    between them, under a turret, then through a wall of crumbling rock, past
//    a flame that fires as you come near and under stalactites, to a pad.
[124, 134, 144, 154].forEach((c, k) => wall(c, HALL, k));
[129, 139, 149, 159].forEach((c, k) => beam(c, HALL, k + 1));
[127, 137, 147, 157].forEach((c) => gusts(c, HALL));
g.air(140, 26, 142, 29).set(141, 25, g.label(TURRET));
g.fill(164, HALL, 165, HALL + 11, "%");
near(169, HALL);
[174, 176].forEach((c) => stal(c, HALL));
pad("F", 180, HALL);

// 4. The turn: up the shaft at the east end through a flash across it and a
//    flame that fires as you come near, between magnets that push you about.
g.air(185, GALLERY, 196, HALL + 11);
g.set(197, 28, g.label({ ...FLASH, facing: "left", length: 12, offset: 0 }));
g.set(184, 22, g.label({ ...SIDE, facing: "right", length: 12 }));
g.set(197, 33, g.label({ ...PULL, push: true, offset: 0 }));
g.set(184, 25, g.label({ ...PULL, push: true, offset: 1.5 }));

// 5. The pull: west along the gallery through presses, between magnets in the
//    roof and the floor pulling in turn, under stalactites, to a pad.
[178, 167, 156].forEach((c, k) => {
  press(c - 1, GALLERY, k);
  roofPull(c - 4, GALLERY);
  [7, 9].forEach((d) => stal(c - d, GALLERY));
  floorPull(c - 9, GALLERY);
});
pad("F", 139, GALLERY);

// 6. The slabs: on under slabs that slide down from the roof, through gusts,
//    past flames up from the floor that fire as you come near and under
//    stalactites, then through a wall of crumbling rock, to a pad.
[133, 117, 101].forEach((c, k) => {
  g.fill(c - 1, GALLERY, c, GALLERY + 2, g.label({ ...SLAB, to: [0, -5], offset: (k % 2) * 3 }));
  gusts(c - 3, GALLERY);
  near(c - 7, GALLERY, true);
  [12, 14].forEach((d) => stal(c - d, GALLERY));
});
g.fill(82, GALLERY, 83, GALLERY + 11, "%");
pad("F", 76, GALLERY);
g.air(110, 2, 112, 9); // a side branch up from the gallery, with a crystal at its end
g.set(111, 3, "*");

// 7. The last run: hammers, stalactites, one over a blob, and flames from the
//    roof that fire as you come near, four times over, to the exit.
[70, 55, 40, 25].forEach((c, k) => {
  hammer(c, GALLERY, k);
  pair(c - 5, GALLERY, k);
  stal(c - 7, GALLERY);
  near(c - 10, GALLERY);
});
pad("E", 5, GALLERY);

g.roughen(107, 0.3);
const header = `10-7: One 200-column hall with every kind of hazard in a row, most of them set off by you, and pads between: a race for par.

East along the hall at the bottom, up a shaft at its east end, and back west
along the gallery over it to the exit. A 3 s beat, warnings of 0.4 s: walls of
flame and beams are on 1 s in 3, hammers rest 1.6 s and presses 2.2 s, blobs
come up every 3 s, gusts and magnets are on for 1.5 s in 3, and slabs slide
down and back in 6 s. A flame that fires as you come near rests 1.5 s, or 2 s
across the shaft; stalactites shake for 0.4 s once you're within 9 m of being
under them. Crumbling rock falls 0.6 s after you touch it. The turret's shots
fly at 9 m/s. The pads stand on ledges: the way along the hall is over the
blobs.

Sections, in order:
1. The mine: east under flames from the roof that fire as you come near and
   rows of stalactites, one over a blob, to a pad. A crystal in an alcove over
   the hall: the easy one.
2. The works: on through hammers, gusts down from the roof and up from the
   floor in turn, and rows of stalactites, to a pad. A crystal in a pit in the
   floor, under a row of stalactites: the skilful one.
3. The furnace: walls of flame and beams on the beat, in turn, with gusts
   between them, under a turret, then through a wall of crumbling rock, past
   a flame that fires as you come near and under stalactites, to a pad.
4. The turn: up the shaft at the east end through a flash across it and a
   flame that fires as you come near, between magnets that push you about.
5. The pull: west along the gallery through presses, between magnets in the
   roof and the floor pulling in turn, under stalactites, to a pad.
6. The slabs: on under slabs that slide down from the roof, through gusts,
   past flames up from the floor that fire as you come near and under
   stalactites, then through a wall of crumbling rock, to a pad. A crystal at
   the end of a side branch up from the gallery.
7. The last run: hammers, stalactites, one over a blob, and flames from the
   roof that fire as you come near, four times over, to the exit.`;
await buildLevel("10-7", g, {
  header,
  name: "The long hall",
  fuel: 30,
  par: 250,
  crumble: 0.6,
  route: "F@54 F@118 F@182 F@141 F@78 E",
});
