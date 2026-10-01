import { Grid, buildLevel } from "./grid.js";

const W = 124;
const H = 128;
const g = new Grid(W, H);
// A 3 s beat, warnings of 0.4 s. Flame walls, beams and hammers fire 1 s in 3,
// flames across a shaft flash 0.5 s in 3, and a flame that fires as you come
// near rests 1.5 s, or 2 s across a shaft. Stalactites shake for 0.4 s once
// you're within 9 m of being under them, or 3 m in pockets up the shafts.
// Crumbling rock falls 0.6 s after you touch it. Switch 1, at the bottom, opens
// gate 2 for 20 s and wakes the lava, which rises 2 m/s from 2 s after you land
// on it, up to just below the pad near the top of the climb.
const WARN = 0.4;
const gate = g.thing("2", { kind: "gate" });
const sw = g.thing("1", { kind: "switch", opens: "2", time: 20 });
const WALL = { kind: "flame", on: 1, off: 2, warn: WARN };
const FLASH = { kind: "flame", on: 0.5, off: 2.5, warn: WARN };
const NEAR = { kind: "flame", mode: "near", on: 1, off: 1.5, warn: WARN, reach: 5 };
const SIDE = { ...NEAR, off: 2 };
const DROP = { kind: "stalactite", reach: 6, warn: WARN };
const fall = g.label({ ...DROP, reach: 9 });
const edge = g.label({ ...DROP, reach: 3 });
const BLOB = { kind: "blob", height: 4, period: 3, warn: WARN };
const HAMMER = { kind: "crusher", rest: 1.6, warn: WARN, slam: 0.15, hold: 0.7, back: 0.15 };
const BEAM = { kind: "laser", mode: "cycle", on: 1, off: 2, warn: WARN };

// A pool in the floor (row r) from c - 1 to c + 1 with a blob in the middle,
// thrown on the beat (offset k s), and a stalactite over it in the roof (row
// roof) if given: it comes down as you come up to it, and then the blob's to
// get past.
const pool = (c, r, k, roof, height = 4) => {
  g.fill(c - 1, r, c + 1, r, "~").set(c, r, g.label({ ...BLOB, height, offset: k % 3 }));
  if (roof !== undefined) g.set(c, roof, fall);
};
// A flame right across a shaft from column c0 to c1 on row r, from its west
// wall or its east one.
const across = (c0, c1, r, west, spec = SIDE) => g.set(west ? c0 - 1 : c1 + 1, r, g.label({ ...spec, facing: west ? "right" : "left", length: c1 - c0 + 1 }));
// A plug of crumbling rock across a shaft, two rows thick.
const plug = (c0, c1, r) => g.fill(c0, r, c1, r + 1, "%");
// A stalactite in a pocket in a shaft's west or east wall, under an overhang:
// it shakes only once you're within 3 m.
const pocket = (c0, c1, r, west) => g.rock(west ? c0 : c1 - 1, r - 2, west ? c0 + 1 : c1, r - 1).set(west ? c0 + 1 : c1 - 1, r, edge);
// A hammer in a pocket in a shaft's wall, slamming `reach` tiles out across it.
const hammer = (c0, c1, r, west, reach, k) => {
  const c = west ? c0 - 1 : c1 + 1;
  g.fill(c, r, c, r + 1, g.label({ ...HAMMER, to: [west ? reach : -reach, 0], offset: k % 3 }));
};

// 1. The way in: east along the top gallery under a hammer from the roof and
//    stalactites, past a flame that fires up from the floor as you come near
//    and a stalactite over a blob thrown up from a pool in the floor, more
//    stalactites and a flame that fires down from the roof as you come near,
//    to a pad, and on under another hammer and more stalactites.
g.air(2, 3, 72, 12);
g.ledge("S", 4, 7);
g.fill(9, 1, 9, 2, g.label({ ...HAMMER, to: [0, -10], offset: 1.5 }));
[14, 17, 20].forEach((c) => g.set(c, 3, fall));
g.set(26, 13, g.label({ ...NEAR, facing: "up", length: 10 }));
pool(33, 13, 0, 3);
[37, 40].forEach((c) => g.set(c, 3, fall));
g.set(44, 2, g.label({ ...NEAR, facing: "down", length: 10 }));
g.ledge("F", 47, 7);
g.fill(53, 1, 53, 2, g.label({ ...HAMMER, to: [0, -10], offset: 0 }));
[58, 61].forEach((c) => g.set(c, 3, fall));
g.air(28, 0, 30, 2); // an alcove over the gallery, with a crystal: the easy one
g.set(29, 1, "*");

// A hammer in a pocket in a shaft's wall, on row r, slamming 3 tiles out, and
// tongs: one from each wall, slamming together.
const side = (c0, c1, r, west, k) => hammer(c0, c1, r, west, 3, k);
const tongs = (c0, c1, r, k) => (side(c0, c1, r, true, k), side(c0, c1, r, false, k));
// A drop: down a shaft from columns c0 to c1, from row r0, through a crumbling
// plug, tongs and flashes across it from alternate walls, and another plug
// (with room to slow down for it).
const drop = (c0, c1, r0) => {
  plug(c0, c1, r0 + 2);
  tongs(c0, c1, r0 + 6, 0);
  across(c0, c1, r0 + 9, true, FLASH);
  tongs(c0, c1, r0 + 12, 1.5);
  across(c0, c1, r0 + 15, false, FLASH);
  tongs(c0, c1, r0 + 18, 0);
  plug(c0, c1, r0 + 21);
};

// 2. The first drop: down a shaft through crumbling plugs, flashes across it
//    from alternate walls, and tongs from its walls, to a pad on a ledge.
g.air(63, 13, 72, 37);
drop(63, 72, 13);

// 3. The second gallery: west under walls of flame from the roof firing in a
//    wave, with stalactites over blobs between them, to a pad on a ledge.
g.air(6, 38, 72, 48);
g.ledge("F", 66, 43);
[58, 46, 34, 22].forEach((c, k) => {
  g.set(c, 37, g.label({ ...WALL, facing: "down", length: 11, offset: (k * 0.75) % 3 }));
  pool(c - 5, 49, k, 38, 3);
  pool(c - 8, 49, k + 1, 38, 3);
});
g.ledge("F", 9, 43);

// 4. The second drop, like the first.
g.air(6, 49, 15, 73);
drop(6, 15, 49);

// 5. The third gallery: east through beams on the beat and hammers from the
//    roof under a turret, past a blob, a stalactite and a flame that fires up
//    from the floor as you come near, and more hammers and beams, to a pad on
//    a ledge.
g.air(6, 74, 72, 84);
g.ledge("F", 59, 79);
const beam = (c, k) => g.set(c, 73, g.label({ ...BEAM, facing: "down", offset: k % 3 }));
const roofHammer = (c, k) => g.fill(c, 72, c, 73, g.label({ ...HAMMER, to: [0, -11], offset: k % 3 }));
beam(17, 0);
roofHammer(23, 1);
beam(28, 2);
g.air(32, 70, 34, 73).set(33, 69, g.label({ kind: "turret", range: 16, speed: 9, windup: 0.5, reload: 0.8 }));
roofHammer(33, 0);
pool(38, 85, 0, undefined, 3);
g.set(43, 74, fall);
g.set(48, 85, g.label({ ...NEAR, facing: "up", length: 11 }));
roofHammer(53, 1);
beam(58, 2);
// A crystal in a nook in the roof, beside a hammer: the skilful one.
g.air(54, 69, 57, 73);
g.set(56, 70, "*");

// 6. The third drop, like the others, and a flash at its foot.
g.air(63, 85, 72, 115);
drop(63, 72, 85);
across(63, 72, 112, true, FLASH);

// 7. The bottom: from a pad on a pillar at the foot of the drop, east over
//    the lava under stalactites over blobs, then walls of flame down to the
//    lava firing in a wave, with blobs between and a turret over them, to
//    switch 1 on a pillar at the far end, watched by a turret in the far wall.
g.air(56, 116, 72, 124);
g.air(73, 110, 120, 124);
g.fill(56, 125, 120, 126, "~");
g.rock(60, 120, 66, 126);
g.pad("F", 62, 119);
[57, 69].forEach((c, k) => pool(c, 125, k));
[76, 81].forEach((c, k) => pool(c, 125, k, 110));
[87, 93, 99].forEach((c, k) => g.set(c, 109, g.label({ ...WALL, facing: "down", length: 15, offset: (k * 0.75) % 3 })));
[90, 96].forEach((c, k) => pool(c, 125, k + 2));
g.air(92, 106, 94, 109).set(93, 105, g.label({ kind: "turret", range: 36, speed: 9, windup: 0.5, reload: 0.8 }));
g.rock(103, 120, 109, 126);
g.pad(sw, 105, 119);
[113, 117].forEach((c, k) => pool(c, 125, k + 1));
g.set(121, 116, g.label({ kind: "turret", range: 30, speed: 9, windup: 0.5, reload: 0.8 }));

// 8. The race: switch 1 opens gate 2 and wakes the lava. Up a shaft through
//    flashes across it and tongs from its walls, through gate 2.
g.air(110, 88, 120, 109);
tongs(110, 120, 108, 1.5);
across(110, 120, 105, true, FLASH);
tongs(110, 120, 101, 0);
across(110, 120, 97, false, FLASH);
tongs(110, 120, 93, 1.5);
g.fill(110, 89, 120, 90, gate);

// 9. The first tube: west under stalactites, past blobs and a flame that
//    fires down as you come near, to a pad on a ledge.
g.air(78, 76, 120, 87);
g.set(107, 76, fall);
pool(103, 88, 0, undefined, 3);
g.set(98, 76, fall);
g.set(93, 75, g.label({ ...NEAR, facing: "down", length: 12 }));
pool(88, 88, 1, undefined, 3);
g.ledge("F", 80, 83);

// 10. The climb: up a shaft ahead of the lava through flames right across it
//     that fire as you come near, from alternate walls, past tongs, a crumbling
//     plug and stalactites in pockets, to a pad on a ledge, and past one more.
g.air(78, 40, 88, 75);
across(78, 88, 72, false);
pocket(78, 88, 69, true);
pocket(78, 88, 57, false);
across(78, 88, 66, true);
tongs(78, 88, 63, 0);
plug(78, 88, 59);
across(78, 88, 54, false);
pocket(78, 88, 51, true);
g.ledge("F", 85, 50, 3, 2);
across(78, 88, 44, true);
// A side branch off the climb, with a crystal at its end, which the lava soon fills.
g.air(89, 62, 100, 65);
g.set(99, 63, "*");

// 11. The top tube: east above the lava under a flame that fires as you come
//     near and stalactites, over crumbling floors, and through a wall of flame
//     between blobs, then up a last shaft past flames across it, tongs and a
//     stalactite in a pocket, and west under more stalactites, a flame that
//     fires as you come near and a blob to the exit.
g.air(78, 28, 120, 39);
g.set(91, 27, g.label({ ...NEAR, facing: "down", length: 12 }));
[96, 99].forEach((c) => g.set(c, 28, fall));
g.fill(94, 40, 100, 40, "%");
g.fill(94, 41, 100, 41, "~");
pool(103, 40, 0, undefined, 3);
g.set(106, 27, g.label({ ...WALL, facing: "down", length: 12 }));
pool(109, 40, 1, undefined, 3);
g.air(110, 12, 120, 27);
across(110, 120, 26, true, FLASH);
tongs(110, 120, 23, 0);
across(110, 120, 20, false);
pocket(110, 120, 17, true);
across(110, 120, 14, true);
g.air(86, 3, 120, 11);
[108, 105].forEach((c) => g.set(c, 3, fall));
g.set(100, 2, g.label({ ...NEAR, facing: "down", length: 9 }));
pool(95, 12, 2, undefined, 3);
g.pad("E", 88, 11);

g.roughen(105, 0.3);
const header = `10-5: One switch starts a timed gate and the rising lava together, and a long climb follows through crumbling rock and flames that fire as you come near.

Down a zigzag of galleries and shafts on the west side to switch 1 at the
bottom, which opens gate 2 for 20 s and wakes the lava, then up the east side
ahead of it, through the gate, to the exit at the top. A 3 s beat, warnings of
0.4 s: flame walls, beams and hammers fire 1 s in 3, flames across a shaft
flash 0.5 s in 3, and a flame that fires as you come near rests 1.5 s, or 2 s
across a shaft. Stalactites shake for 0.4 s once you're within 9 m of being
under them, or 3 m in pockets up the shafts. Crumbling rock falls 0.6 s after
you touch it. The lava rises 2 m/s from 2 s after you land on switch 1, up to
just below the pad near the top of the climb.

Sections, in order:
1. The way in: east along the top gallery under a hammer from the roof and
   stalactites, past flames that fire as you come near from floor and roof and
   a stalactite over a blob, to a pad, and on under another hammer and more
   stalactites. A crystal in an alcove over it: the easy one.
2. The first drop: down a shaft through crumbling plugs, flashes across it from
   alternate walls and tongs from its walls, to a pad on a ledge.
3. The second gallery: west under walls of flame from the roof firing in a
   wave, with stalactites over blobs between them, to a pad on a ledge.
4. The second drop, like the first.
5. The third gallery: east through beams on the beat and hammers from the roof
   under a turret, past a blob, a stalactite and a flame that fires up from the
   floor as you come near, and more hammers and beams, to a pad on a ledge. A
   crystal in a nook in the roof beside a hammer: the skilful one.
6. The third drop, like the others, and a flash at its foot.
7. The bottom: from a pad on a pillar, east over the lava under stalactites
   over blobs, then walls of flame down to the lava firing in a wave, with
   blobs between and a turret over them, to switch 1 on a pillar, watched by a
   turret in the far wall.
8. The race: switch 1 opens gate 2 and wakes the lava. Up a shaft through
   flashes across it and tongs from its walls, through gate 2.
9. The first tube: west under stalactites, past blobs and a flame that fires
   down as you come near, to a pad on a ledge.
10. The climb: up a shaft ahead of the lava through flames right across it
    that fire as you come near, from alternate walls, past tongs, a crumbling
    plug and stalactites in pockets, to a pad on a ledge, and past one more. A
    crystal at the end of a side branch, which the lava soon fills.
11. The top: east along a tube above the lava under a flame that fires as you
    come near and stalactites, over a crumbling floor, through a wall of flame
    between blobs, then up a last shaft past flashes, tongs and flames that
    fire as you come near, and west under more stalactites, a flame and a blob
    to the exit.`;
await buildLevel("10-5", g, {
  header,
  name: "Pressure",
  fuel: 34,
  par: 325,
  crumble: 0.6,
  route: "F@48 F@67 F@10 F@60 F@63 1 F@81 F@86 E",
  rise: { speed: 2, from: 3, to: 78, after: "1", delay: 2 },
});
