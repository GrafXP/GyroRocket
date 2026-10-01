import { Grid, buildLevel } from "./grid.js";

const W = 200;
const H = 150;
const SKY = 12; // rows open to the sky at the top
const g = new Grid(W, H);
// The 3 s beat of world 10, and warnings of 0.4 s. Flame walls fire 1 s in 3,
// flames across a shaft flash 0.5 s in 3, blobs are thrown once every 3 s, and
// hammers slam once every 3 s; beams keep the beat too, and magnets and the vent
// are on for 1.5 s in 3. A flame that fires as you come near rests 1.5 s, or
// 2 s across a shaft. Stalactites shake for 0.4 s once you're within 9 m of
// being under them. Crumbling rock falls 0.6 s after you touch it. The red key
// at the bottom of the heart wakes the lava: it rises 1.8 m/s from 2 s after
// you take it, up the first shaft of the climb, and stops below its top.
const WARN = 0.4;
const WALL = { kind: "flame", on: 1, off: 2, warn: WARN, length: 20 };
const FLASH = { kind: "flame", on: 0.5, off: 2.5, warn: WARN, length: 20 };
const NEAR = { kind: "flame", mode: "near", on: 1, off: 1.5, warn: WARN, reach: 5, length: 20 };
const SIDE = { ...NEAR, off: 2 };
const BLOB = { kind: "blob", height: 3, period: 3, warn: WARN };
const HAMMER = { kind: "crusher", rest: 1.6, warn: WARN, slam: 0.15, hold: 0.7, back: 0.15, to: [0, -10] };
const BEAM = { kind: "laser", facing: "down", mode: "cycle", on: 1, off: 2, warn: WARN };
const TURRET = { kind: "turret", range: 36, speed: 9, windup: 0.5, reload: 0.8 };
const SLAB = { kind: "mover", period: 6 };
const PULL = { kind: "magnet", mode: "cycle", on: 1.5, off: 1.5, warn: WARN, strength: 9, range: 20 };
// Named first, before label() hands out characters.
const sw = g.thing("1", { kind: "switch", opens: "2", time: 30 });
const gate = g.thing("2", { kind: "gate" });
const drop = g.label({ kind: "stalactite", reach: 6, warn: WARN });
const fall = g.label({ kind: "stalactite", reach: 9, warn: WARN });

// A gallery 10 rows high, from row r0, columns c0 to c1.
const gallery = (c0, c1, r0) => g.air(c0, r0, c1, r0 + 9);
// Things in a gallery whose air starts on row r0 (its roof on r0 - 1, its floor
// on r0 + 10).
const wall = (c, r0, offset, up = false) => g.set(c, up ? r0 + 10 : r0 - 1, g.label({ ...WALL, facing: up ? "up" : "down", offset }));
const near = (c, r0, up = false) => g.set(c, up ? r0 + 10 : r0 - 1, g.label({ ...NEAR, facing: up ? "up" : "down" }));
const hammer = (c, r0, offset) => g.fill(c, r0 - 2, c, r0 - 1, g.label({ ...HAMMER, offset }));
const beam = (c, r0, offset) => g.set(c, r0 - 1, g.label({ ...BEAM, offset }));
const stalactites = (cols, r0, s = fall) => cols.forEach((c) => g.set(c, r0, s));
// A turret in a pocket in the roof over column c.
const turret = (c, r0) => g.air(c - 1, r0 - 3, c + 1, r0 - 1).set(c, r0 - 4, g.label(TURRET));
// Lava in the floor from c0 to c1, with a blob at each of `cols`, a stalactite
// over each if `over`.
const pool = (c0, c1, r0, cols, over = true) => {
  g.fill(c0, r0 + 10, c1, r0 + 10, "~");
  cols.forEach((c, k) => {
    g.set(c, r0 + 10, g.label({ ...BLOB, offset: k % 3 }));
    if (over) g.set(c, r0, fall);
  });
};
// A blob in a little pool under what's at column c in a gallery from row r0:
// it throws up into the flame's, beam's or hammer's column.
const under = (c, r0, offset) => g.set(c - 1, r0 + 10, "~").set(c + 1, r0 + 10, "~").set(c, r0 + 10, g.label({ ...BLOB, offset }));
// Flames across a shaft from column c0 to c1: from its west wall (facing
// right) or its east one.
const flash = (c0, c1, r, west, offset) => g.set(west ? c0 - 1 : c1 + 1, r, g.label({ ...FLASH, facing: west ? "right" : "left", offset }));
const side = (c0, c1, r, west) => g.set(west ? c0 - 1 : c1 + 1, r, g.label({ ...SIDE, facing: west ? "right" : "left" }));
const plug = (c0, c1, r) => g.fill(c0, r, c1, r + 1, "%");
// Magnets on the beat, in turn (k): in a shaft's wall, pushing you off it, or
// in a roof, pulling you up.
const push = (c, r, k) => g.set(c, r, g.label({ ...PULL, push: true, offset: (k % 2) * 1.5 }));
const pull = (c, r, k) => g.set(c, r, g.label({ ...PULL, offset: (k % 2) * 1.5 }));
// A stalactite under a ledge on a shaft's west or east wall, hanging on row r.
const ledgeDrop = (c0, c1, r, west) => g.rock(west ? c0 : c1 - 1, r - 2, west ? c0 + 1 : c1, r - 1).set(west ? c0 + 1 : c1 - 1, r, drop);

// The surface, under the stars: the start, by the hole down into the world.
g.air(0, 0, W - 1, SKY - 1);
g.pad("S", 3, SKY - 1);

// DOWN THE WEST SIDE, INTO THE HEART

// 1. The way down: a shaft from the surface, through a plug of crumbling rock,
//    a flash across it and a flame across it that fires as you come near,
//    between magnets in its walls that push you about.
g.air(9, SKY, 18, 33);
plug(9, 18, 16);
flash(9, 18, 22, true, 0);
side(9, 18, 28, false);
push(8, 19, 0);
push(19, 25, 1);

// 2. The first gallery: east under a row of stalactites and a wall of flame,
//    then over a lava channel with a stalactite over every blob, to a pad on a
//    ledge, and past another wall of flame.
gallery(9, 68, 34);
stalactites([19, 22, 25, 28], 34);
wall(32, 34, 0);
under(32, 34, 1);
pool(36, 48, 34, [37, 42, 47]);
g.ledge("F", 51, 38, 3, 5);
wall(55, 34, 1.5);
g.set(56, 44, "~").set(55, 44, g.label({ ...BLOB, offset: 0 }));
g.air(34, 30, 35, 33); // an alcove over the gallery, with a crystal: the easy one
g.set(34, 31, "*");

// 3. The slabs: down a shaft past slabs sliding across it, between magnets.
g.air(57, 44, 68, 61);
g.fill(57, 47, 61, 48, g.label({ ...SLAB, to: [7, 0], offset: 0 }));
g.fill(64, 56, 68, 57, g.label({ ...SLAB, to: [-7, 0], offset: 3 }));
push(56, 52, 0);
push(69, 52, 1);

// 4. The forge: west along a gallery through beams and a hammer on the beat,
//    with a blob under each, past a flame that fires down as you come near and
//    under stalactites, to a pad by the next shaft, under a magnet.
gallery(9, 68, 62);
beam(54, 62, 0);
hammer(48, 62, 0.5);
beam(42, 62, 1);
[54, 48, 42].forEach((c, k) => under(c, 62, k));
g.set(48, 69, "*"); // a crystal under a hammer, over the lava: the skilful one
near(37, 62);
stalactites([32, 29, 27], 62);
beam(25, 62, 2);
g.ledge("F", 20, 66, 3, 5);
pull(14, 61, 0);

// 5. The drop: down a shaft through a plug of crumbling rock and flames across
//    it, between magnets.
g.air(9, 72, 18, 89);
plug(9, 18, 74);
side(9, 18, 80, true);
flash(9, 18, 87, false, 1);
push(19, 77, 0);
push(8, 84, 1);

// 6. The furnace: east along a gallery past a flame that fires as you come
//    near, stalactites, a wall of flame from the floor, over a sill and blobs
//    under stalactites, and through a wall of crumbling rock, to a pad under a
//    magnet.
gallery(9, 68, 90);
near(21, 90);
stalactites([26, 29, 32], 90);
wall(36, 90, 1, true);
g.rock(38, 96, 39, 99); // a sill: the way on is over it, and over the blobs
pool(40, 47, 90, [41, 46]);
g.fill(50, 90, 51, 99, "%");
g.ledge("F", 53, 94, 3, 5);
pull(58, 89, 1);
g.air(1, 93, 8, 96); // a side tunnel west, with a crystal at its end
g.set(2, 94, "*");

// 7. Into the heart: down a shaft through flashes across it, a plug and a
//    flame that fires as you come near, between magnets.
g.air(57, 100, 68, 121);
flash(57, 68, 101, false, 0);
plug(57, 68, 107);
side(57, 68, 113, true);
flash(57, 68, 119, false, 0.5);
push(56, 104, 0);
push(69, 110, 1);
push(56, 116, 0);

// 8. The heart: east over the lava lake, under rows of stalactites, one over
//    every blob, and through a wall of flame, past a pad on an island, to the
//    red key under the way up, which wakes the lava and opens the red door
//    over it.
g.air(20, 122, 141, 134);
g.fill(20, 135, 141, 136, "~");
const blob = (c, k) => g.set(c, 135, g.label({ ...BLOB, height: 4, offset: k % 3 }));
[60, 65, 91, 101, 131, 136].forEach(blob);
[72, 77, 82, 87, 106, 111, 116, 121, 126].forEach((c, k) => {
  g.set(c, 122, fall);
  blob(c, k);
});
[90, 129].forEach((c, k) => g.set(c, 121, g.label({ ...WALL, facing: "down", offset: k * 1.5 })));
[74, 79, 84, 108, 113, 118, 123].forEach((c) => g.set(c, 122, fall));
g.rock(93, 130, 99, 136);
g.pad("F", 95, 129);
g.set(133, 128, "r");

// UP THE EAST SIDE, TO THE SKY

// 9. The chase (Fault line, Core): through the red door and up a shaft ahead of
//    the lava, through flames across it that fire as you come near and a plug
//    of crumbling rock, between magnets, to a pad.
g.air(128, 96, 139, 121);
g.fill(128, 120, 139, 121, "R");
side(128, 139, 116, true);
side(128, 139, 110, false);
plug(128, 139, 103);
side(128, 139, 97, true);
push(140, 118, 0);
push(127, 106, 1);
push(140, 100, 0);

// 10. The vaults (Vaults, Deep dark): east along a gallery through a wall of
//     flame and beams on the beat, with a blob under each, to switch 1, which
//     opens gate 2 for 30 s, and on under a turret and through more beams, up
//     past flashes and magnets and through gate 2.
gallery(128, 196, 86);
g.ledge("F", 141, 91, 3, 4);
wall(147, 86, 0, true);
g.rock(149, 92, 150, 95); // a sill: the way on is over it, and over the blobs
beam(153, 86, 1);
beam(159, 86, 2);
g.ledge(sw, 164, 91, 3, 4);
beam(170, 86, 0);
beam(176, 86, 1);
beam(182, 86, 2);
[153, 159, 170, 176].forEach((c, k) => under(c, 86, k + 1));
turret(173, 86);
pull(136, 85, 0);
g.air(185, 72, 196, 85);
flash(185, 196, 82, true, 2);
g.fill(185, 78, 196, 79, gate);
flash(185, 196, 75, false, 0.5);
push(184, 81, 0);
push(197, 76, 1);

// 11. The foundry (Foundry): west along a gallery over lava, through walls of
//     flame and hammers on one beat, with blobs between, under a turret, past a
//     pad halfway.
gallery(85, 196, 62);
wall(180, 62, 0);
hammer(174, 62, 1);
g.ledge("F", 166, 66, 3, 5);
wall(160, 62, 2);
pool(148, 155, 62, [154, 149]);
hammer(143, 62, 0.5);
wall(137, 62, 1);
hammer(131, 62, 1.5);
pool(119, 126, 62, [125, 120]);
wall(114, 62, 0);
g.ledge("F", 107, 66, 3, 5);
wall(103, 62, 1.5, true);
hammer(98, 62, 2);
[174, 160, 143, 137, 131, 114, 98].forEach((c, k) => under(c, 62, k));

// 12. The works (Works): up a shaft on a vent that blows 1.5 s in 3, weaker
//     than gravity, past slabs sliding across it and a flash across it, with
//     the yellow key in a nook in its wall.
g.air(85, 36, 96, 61);
g.set(90, 72, g.label({ kind: "fan", facing: "up", length: 36, width: 6, strength: 9, mode: "cycle", on: 1.5, off: 1.5, warn: WARN }));
g.fill(85, 55, 89, 56, g.label({ ...SLAB, to: [7, 0], offset: 0 }));
flash(85, 96, 49, true, 1);
g.air(97, 44, 100, 48); // a nook in the east wall, with the yellow key
g.set(99, 46, "y");
g.fill(92, 41, 96, 42, g.label({ ...SLAB, to: [-7, 0], offset: 3 }));

// 13. The furnace (Furnace): east along a gallery past flames that fire as you
//     come near, walls of flame, blobs and stalactites, past a pad.
gallery(85, 196, 26);
g.ledge("F", 99, 31, 3, 5);
wall(104, 26, 1, true);
near(110, 26);
stalactites([115, 118, 121], 26);
wall(123, 26, 0, true);
pool(126, 140, 26, [128, 133, 138]);
stalactites([130, 135], 26);
near(143, 26, true);
g.ledge("F", 150, 31, 3, 5);
pull(154, 25, 1);
stalactites([155], 26);
near(158, 26);
wall(164, 26, 2);
under(164, 26, 1);
stalactites([169, 172, 175], 26);
near(180, 26, true);

// 14. The way out (Mine, Training caves): up the last shaft through a flash,
//     the yellow door and a flame across it that fires as you come near,
//     between magnets, to the surface and the exit under the sky.
g.air(185, SKY, 196, 25);
flash(185, 196, 23, false, 2);
g.fill(185, 18, 196, 19, "Y");
side(185, 196, 14, true);
push(184, 21, 0);
push(197, 16, 1);
g.pad("E", 180, SKY - 1);

g.roughen(108, 0.3);
const header = `10-8: The finale: down into the heart, where a key wakes the lava, then all the way up through every world's caves to the sky.

From the surface down the west side to the heart at the bottom of the world,
east over its lava lake to the red key, which wakes the lava, then up the east
side ahead of it, through a section for each world, to the surface again and
the exit under the sky. World 10's 3 s beat for everything on a cycle, and
warnings of 0.4 s: walls of flame, beams and hammers are on 1 s in 3, a flash
across a shaft 0.5 s in 3, blobs are thrown every 3 s, magnets and the vent
are on for 1.5 s in 3, and slabs slide over and back in 6 s. A flame that
fires as you come near rests 1.5 s, or 2 s across a shaft; stalactites shake
once you're within 9 m of being under them. Crumbling rock falls 0.6 s after
you touch it. Switch 1 opens gate 2 for 30 s. The lava rises 1.8 m/s from 2 s
after you take the red key, and stops below the top of the first shaft up.

Sections, in order:
1. The way down: a shaft from the surface, through a plug of crumbling rock,
   a flash across it and a flame across it that fires as you come near,
   between magnets that push you about.
2. The first gallery: east under stalactites and a wall of flame, then over a
   lava channel with a stalactite over every blob, to a pad. A crystal in an
   alcove over it: the easy one.
3. The slabs: down a shaft past slabs sliding across it, between magnets.
4. The forge: west along a gallery through beams and a hammer on the beat, a
   blob under each, past a flame that fires as you come near and under
   stalactites, to a pad. A crystal under the hammer, over the lava: the
   skilful one.
5. The drop: down a shaft through crumbling rock and flames across it,
   between magnets.
6. The furnace: east past a flame that fires as you come near, stalactites, a
   wall of flame, over a sill and blobs under stalactites, and through a wall
   of crumbling rock, to a pad. A crystal at the end of a side tunnel west.
7. Into the heart: down a shaft through flashes, a plug and a flame that fires
   as you come near, between magnets.
8. The heart: east over the lava lake under rows of stalactites, one over
   every blob, and through walls of flame, past a pad on an island, to the red
   key, which wakes the lava.
9. The chase: through the red door and up a shaft ahead of the lava, through
   flames that fire as you come near and a plug, between magnets, to a pad.
10. The vaults: a wall of flame and beams on the beat with blobs under them,
    switch 1, a turret and more beams, and up past flashes through gate 2
    before it shuts.
11. The foundry: west over lava through walls of flame and hammers on one
    beat, a blob under each, and stalactites over blobs, past two pads.
12. The works: up a shaft on a vent, past slabs and a flash, with the yellow
    key in a nook in its wall.
13. The furnace: east past flames that fire as you come near, walls of flame,
    blobs and rows of stalactites, past two pads.
14. The way out: up the last shaft through a flash, the yellow door and a
    flame that fires as you come near, between magnets, to the surface and
    the exit under the sky.`;
await buildLevel("10-8", g, {
  header,
  name: "Heart of the world",
  fuel: 34,
  par: 440,
  sky: SKY,
  crumble: 0.6,
  route: "F@52 F@21 F@56 F@96 r F@144 1 F@168 F@108 y F@100 F@153 E",
  rise: { speed: 1.8, from: 15, to: 49, after: "r", delay: 2 },
});
