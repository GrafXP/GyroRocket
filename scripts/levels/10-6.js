import { Grid, buildLevel } from "./grid.js";

const W = 170;
const H = 130;
const g = new Grid(W, H);
// Switch 1 opens gate 2 for 40 s.
const SWITCH = g.thing("1", { kind: "switch", opens: "2", time: 40 });
const GATE = g.thing("2", { kind: "gate" });
// Dark. A 3 s beat for everything on a cycle, and 0.4 s warnings: stalactites
// shake, flames flicker, crushers judder and beams flicker that long before
// they hurt. A flame that fires as you come near rests 1.5 s, or 2 s where you
// cross it going up or down.
const WARN = 0.4;
const WALL = { kind: "flame", on: 1, off: 2, warn: WARN };
const FLASH = { kind: "flame", on: 0.5, off: 2.5, warn: WARN };
const NEAR = { kind: "flame", mode: "near", on: 1, off: 1.5, warn: WARN, reach: 5 };
const SIDE = { ...NEAR, off: 2 };
const BLOB = { kind: "blob", height: 4, period: 3, warn: WARN };
const HAMMER = { kind: "crusher", rest: 1.6, warn: WARN, slam: 0.15, hold: 0.7, back: 0.15 };
const PRESS = { kind: "crusher", rest: 2.2, warn: WARN, slam: 0.15, hold: 0.1, back: 0.15 };
const BEAM = { kind: "laser", mode: "cycle", on: 1, off: 2, warn: WARN };
const GUST = { kind: "fan", mode: "cycle", on: 1.5, off: 1.5, warn: WARN, length: 10, width: 4, strength: 9 };
const PULL = { kind: "magnet", mode: "cycle", on: 1.5, off: 1.5, warn: WARN, strength: 9, range: 20 };
const TURRET = { kind: "turret", range: 24, speed: 9, windup: 0.5, reload: 0.8 };
const SLAB = { kind: "mover", period: 6 };
const UPDRAFT = { ...GUST, facing: "up", width: 2, strength: 8 };
const drop = g.label({ kind: "stalactite", reach: 6, warn: WARN });
const fall = g.label({ kind: "stalactite", reach: 9, warn: WARN });
// In a pocket in a shaft's wall: it shakes only once you're right under it.
const pocket = g.label({ kind: "stalactite", reach: 3, warn: WARN });
// Crumbling floors over lava, on row r from column c0 to c1.
const brittle = (c0, c1, r) => g.fill(c0, r, c1, r, "%").fill(c0, r + 1, c1, r + 1, "~");
// A blob from a pool in the floor on row r, on the beat.
const blob = (c, r, k) => g.set(c, r, g.label({ ...BLOB, offset: k % 3 }));

// The start, top left.
g.air(3, 5, 128, 14);
g.pad("S", 5, 14);

// 1. The first gallery: east under rows of stalactites, over crumbling floors,
//    past flames that fire from the floor and the roof as you come near, to a
//    pad.
[11, 14, 17, 20].forEach((c) => g.set(c, 5, fall));
brittle(13, 18, 15);
g.set(25, 15, g.label({ ...NEAR, facing: "up", length: 10 }));
[30, 33].forEach((c) => g.set(c, 5, fall));
g.set(28, 4, g.label({ ...PULL, offset: 0 }));
g.set(38, 4, g.label({ ...NEAR, facing: "down", length: 10 }));
brittle(40, 44, 15);
[43, 46, 49].forEach((c) => g.set(c, 5, fall));
g.air(22, 1, 24, 4); // an alcove over the gallery, with a crystal: the easy one
g.set(23, 2, "*");
g.pad("F", 52, 14);

// 2. The vault: walls of flame and beams on the beat, in turn, in a wave, under
//    a turret in the roof and between magnets in the floor, the red key in an
//    alcove over the gallery, then blobs from a pool in the floor with a
//    stalactite over each, to a pad on a ledge, and stalactites over the next
//    shaft.
[58, 71, 83].forEach((c, k) => g.set(c, 4, g.label({ ...WALL, facing: "down", length: 10, offset: k })));
[65, 77].forEach((c, k) => g.set(c, 4, g.label({ ...BEAM, facing: "down", offset: k + 0.5 })));
g.air(73, 2, 75, 4).set(74, 1, g.label(TURRET));
[61, 80].forEach((c, k) => g.set(c, 15, g.label({ ...PULL, offset: k * 1.5 })));
g.set(86, 15, g.label({ ...UPDRAFT, offset: 1.5 }));
g.air(88, 1, 91, 4);
g.set(89, 4, "r");
g.fill(91, 15, 107, 16, "~");
[93, 99, 105].forEach((c, k) => {
  g.set(c, 5, fall);
  blob(c, 15, k);
});
g.ledge("F", 110, 9, 3, 6);
[117, 120, 124].forEach((c) => g.set(c, 5, fall));

// 3. The drop: down a shaft past slabs sliding across it, one way then the
//    other, a flame that flashes across it on the beat and one that fires as
//    you come near, between magnets in its walls that push you about.
g.air(117, 15, 128, 40);
g.fill(117, 18, 120, 19, g.label({ ...SLAB, to: [8, 0], offset: 0 }));
g.set(129, 25, g.label({ ...FLASH, facing: "left", length: 12, offset: 0 }));
g.set(116, 31, g.label({ ...SIDE, facing: "right", length: 12 }));
g.fill(125, 37, 128, 38, g.label({ ...SLAB, to: [-8, 0], offset: 3 }));
g.set(116, 22, g.label({ ...PULL, push: true, offset: 0 }));
g.set(129, 28, g.label({ ...PULL, push: true, offset: 1.5 }));
g.set(129, 34, g.label({ ...PULL, push: true, offset: 0 }));

// 4. The furnace: west along the second gallery under walls of flame firing in
//    a wave on the beat, over a lava channel with blobs between them, under a
//    turret, past a flame that never goes out, through the red door and under
//    stalactites, to a pad.
g.air(16, 41, 128, 50);
g.fill(80, 51, 114, 52, "~");
[112, 102, 92, 82].forEach((c, k) => g.set(c, 40, g.label({ ...WALL, facing: "down", length: 10, offset: k * 0.5 })));
[107, 97, 87].forEach((c, k) => blob(c, 51, k));
[110, 100, 90].forEach((c, k) => g.set(c, 51, g.label({ ...UPDRAFT, offset: (k % 2) * 1.5 })));
g.air(96, 37, 98, 39).set(97, 36, g.label(TURRET));
g.set(105, 48, "*"); // low over the lava between flames and blobs: the skilful one
g.set(76, 40, g.label({ kind: "flame", mode: "always", facing: "down", length: 4 }));
g.fill(71, 41, 72, 50, "R");
[77, 74, 68].forEach((c) => g.set(c, 41, fall));
g.pad("F", 62, 50);

// 5. The works: on west under gusts blowing down from the roof and up from the
//    floor in turn, with hammers between them, under a turret, to the next
//    shaft.
[56, 40].forEach((c) => g.set(c, 40, g.label({ ...GUST, facing: "down", offset: 0 })));
[48, 32].forEach((c) => g.set(c, 51, g.label({ ...GUST, facing: "up", offset: 1.5 })));
[60, 52, 44, 36].forEach((c, k) => g.set(c, 41, g.label({ ...HAMMER, to: [0, -8], offset: k % 2 ? 1.5 : 0 })));
g.air(45, 37, 47, 39).set(46, 36, g.label(TURRET));

// 6. The magnets: down a shaft through a plug of crumbling rock, past magnets
//    in its walls that push you about in turn and flames right across it that
//    fire as you come near, to a pad at the foot and switch 1 beside it, which
//    opens gate 2 for 40 s.
g.air(16, 51, 26, 72);
g.fill(16, 52, 26, 53, "%");
g.set(15, 56, g.label({ ...PULL, push: true, offset: 0 }));
g.set(27, 58, g.label({ ...SIDE, facing: "left", length: 11 }));
g.set(27, 61, g.label({ ...PULL, push: true, offset: 1.5 }));
g.set(15, 64, g.label({ ...SIDE, facing: "right", length: 11 }));
g.set(15, 67, g.label({ ...PULL, push: true, offset: 0 }));
g.set(27, 70, g.label({ ...SIDE, facing: "left", length: 11 }));

// 7. The press: east along the third gallery under stalactites and past a
//    flame that fires up from the floor as you come near, through crushers
//    from floor and roof with stalactites, gusts and magnets between them,
//    and through gate 2 before it shuts, to a pad; then blobs, updrafts and
//    walls of flame on the beat under a turret, a flame from the roof that
//    fires as you come near and stalactites, to a pad. A crystal up a side
//    branch.
g.air(16, 73, 150, 82);
g.pad("F", 17, 82);
g.pad(SWITCH, 22, 82);
[30, 33].forEach((c) => g.set(c, 73, fall));
g.set(38, 83, g.label({ ...NEAR, facing: "up", length: 10 }));
g.fill(43, 81, 44, 82, g.label({ ...PRESS, to: [0, 7], offset: 0 }));
g.set(50, 73, fall);
g.fill(53, 73, 54, 74, g.label({ ...PRESS, to: [0, -7], offset: 1.5 }));
g.set(60, 73, fall);
g.fill(62, 81, 63, 82, g.label({ ...PRESS, to: [0, 7], offset: 0 }));
g.set(48, 83, g.label({ ...PULL, offset: 0 }));
g.set(58, 72, g.label({ ...PULL, offset: 1.5 }));
g.set(46, 72, g.label({ ...GUST, facing: "down", offset: 0 }));
g.set(56, 83, g.label({ ...GUST, facing: "up", offset: 1.5 }));
g.set(15, 76, g.label({ ...PULL, offset: 0 }));

g.fill(67, 73, 68, 82, GATE);
g.ledge("F", 71, 78, 3, 4);
[78, 81].forEach((c) => g.set(c, 73, fall));
g.fill(82, 83, 120, 84, "~");
[84, 94, 104, 114].forEach((c, k) => blob(c, 83, k));
g.set(84, 73, fall);
// Updrafts from the lava between them, in turn, a little weaker than gravity.
[87, 97, 107, 117].forEach((c, k) => g.set(c, 83, g.label({ ...UPDRAFT, offset: (k % 2) * 1.5 })));
[89, 99, 109, 119].forEach((c, k) => g.set(c, 72, g.label({ ...WALL, facing: "down", length: 10, offset: k * 0.5 })));
g.air(94, 69, 96, 71).set(95, 68, g.label(TURRET));
g.air(105, 62, 107, 72); // a side branch up from the gallery, with a crystal at its end
g.set(106, 64, "*");
g.set(125, 72, g.label({ ...NEAR, facing: "down", length: 10 }));
[130, 133].forEach((c) => g.set(c, 73, fall));
g.pad("F", 135, 82);
[141, 144, 147].forEach((c) => g.set(c, 73, fall));

// 8. The plugs: down a shaft through plugs of crumbling rock and a flash of
//    flame across it, between magnets that push you about, and a flame that
//    fires as you come near at its foot.
g.air(140, 83, 150, 102);
g.fill(140, 86, 150, 87, "%");
g.set(139, 93, g.label({ ...FLASH, facing: "right", length: 11, offset: 0 }));
g.fill(140, 98, 150, 99, "%");
g.set(139, 90, g.label({ ...PULL, push: true, offset: 0 }));
g.set(151, 96, g.label({ ...PULL, push: true, offset: 1.5 }));
g.set(151, 105, g.label({ ...SIDE, facing: "left", length: 11 }));

// 9. The deep: west along the bottom gallery through a wall of flame and a
//    beam, under a gust, over blobs with a stalactite over each, between
//    magnets in roof and floor, to a pad on a ledge; under slabs that slide
//    down from the roof, rows of stalactites and flames that fire from floor
//    and roof as you come near, over a sill and more blobs under stalactites,
//    to a pad on a ledge; then under stalactites over a crumbling floor.
g.air(16, 103, 150, 112);
g.set(137, 102, g.label({ ...WALL, facing: "down", length: 10, offset: 0 }));
g.set(131, 102, g.label({ ...BEAM, facing: "down", offset: 1 }));
g.fill(116, 113, 127, 114, "~");
[125, 118].forEach((c, k) => {
  blob(c, 113, k);
  g.set(c, 103, fall);
});
g.set(121, 113, g.label({ ...PULL, offset: 1.5 }));
g.set(128, 102, g.label({ ...GUST, facing: "down", offset: 0 }));
[114, 111].forEach((c) => g.set(c, 103, fall));
[112].forEach((c) => g.set(c, 102, g.label({ ...PULL, offset: 0 })));
g.ledge("F", 104, 107, 3, 5);
g.set(100, 103, fall);
g.fill(93, 103, 94, 106, g.label({ ...SLAB, to: [0, -4], offset: 0 }));
g.fill(86, 103, 87, 106, g.label({ ...SLAB, to: [0, -4], offset: 3 }));
g.set(90, 102, g.label({ ...PULL, offset: 1.5 }));
[81, 78, 75, 72, 69].forEach((c) => g.set(c, 103, fall));
g.set(64, 113, g.label({ ...NEAR, facing: "up", length: 10 }));
[58, 55, 52].forEach((c) => g.set(c, 103, fall));
g.set(47, 102, g.label({ ...NEAR, facing: "down", length: 10 }));
g.set(50, 102, g.label({ ...PULL, offset: 1.5 }));
g.rock(44, 108, 45, 112); // a sill: the way on is over it, and over the blobs
g.fill(34, 113, 43, 114, "~");
[41, 36].forEach((c, k) => {
  blob(c, 113, k);
  g.set(c, 103, fall);
});
g.ledge("F", 28, 107, 3, 5);
brittle(14, 21, 113);
[24, 21, 18, 15].forEach((c) => g.set(c, 103, fall));

// 10. The chase: the yellow key at the foot of the last shaft wakes the lava,
//     and up ahead of it past flames right across the shaft that fire as you
//     come near, stalactites in pockets, and a plug of crumbling rock, to the
//     exit.
g.air(12, 103, 15, 112);
g.air(2, 52, 11, 112);
g.set(6, 106, "y");
[102, 90, 67].forEach((r) => g.set(12, r, g.label({ ...SIDE, facing: "left", length: 10 })));
[96, 73].forEach((r) => g.set(1, r, g.label({ ...SIDE, facing: "right", length: 10 })));
g.rock(10, 85, 11, 86).set(10, 87, pocket);
g.set(1, 84, g.label({ ...PULL, push: true, offset: 1.5 }));
g.set(12, 60, g.label({ ...PULL, push: true, offset: 0 }));
g.set(12, 96, g.label({ ...PULL, push: true, offset: 0 }));
g.set(12, 73, g.label({ ...PULL, push: true, offset: 1.5 }));
g.fill(2, 79, 11, 80, "%");
g.rock(2, 61, 3, 62).set(3, 63, pocket);
g.ledge("E", 7, 57, 3, 2);

g.roughen(106, 0.3);
const header = `10-6: Dark, and the longest yet: every hazard in the game, and pads you find by their glow.

Four galleries, one under the other, joined by shafts at their ends: east
along the top, down, west, down, east, down, west along the bottom, and up a
last shaft at the west end to the exit. A 3 s beat for everything on a cycle,
and 0.4 s warnings: walls of flame and beams are on 1 s in 3, a flash across a
shaft 0.5 s in 3, blobs are thrown every 3 s, crushers slam every 3 s, gusts
and magnets are on for 1.5 s in 3, and slabs slide over and back in 6 s. A
flame that fires as you come near rests 1.5 s, or 2 s across a shaft.
Stalactites shake once you're within 9 m of being under them, or 3 m in
pockets up the last shaft. Crumbling rock falls 0.6 s after you touch it.
Switch 1 opens gate 2 for 40 s. The yellow key wakes the lava, which rises
1.8 m/s from 2 s after you take it, up to just below the exit.

Sections, in order:
1. The first gallery: east under rows of stalactites, over crumbling floors,
   past flames that fire from the floor and the roof as you come near, to a
   pad. A crystal in an alcove over it: the easy one.
2. The vault: walls of flame and beams on the beat, in turn, under a turret
   and between magnets, the red key in an alcove over the gallery, then blobs
   with a stalactite over each, to a pad on a ledge, and stalactites over the
   next shaft.
3. The drop: down a shaft past slabs sliding across it, a flash of flame and a
   flame that fires as you come near, between magnets that push you about.
4. The furnace: west under walls of flame firing in a wave, over a lava
   channel with blobs and updrafts between them, under a turret, past a flame
   that never goes out, through the red door and under stalactites, to a pad.
   A crystal low over the lava between flames and blobs: the skilful one.
5. The works: on west under gusts from roof and floor in turn, with hammers
   between them, under a turret.
6. The magnets: down a shaft through a plug of crumbling rock, past magnets
   that push you about and flames right across it that fire as you come near,
   to a pad at the foot, and switch 1 beside it.
7. The press: east under stalactites, past a flame from the floor that fires
   as you come near, through crushers from floor and roof with stalactites,
   gusts and magnets between them, and through gate 2 before it shuts, to a
   pad; then blobs, updrafts and walls of flame on the beat under a turret, a
   flame from the roof and stalactites, to a pad. A crystal up a side branch.
8. The plugs: down a shaft through plugs of crumbling rock and a flash of
   flame, between magnets, and a flame that fires as you come near at its
   foot.
9. The deep: west through a wall of flame and a beam, under a gust, over blobs
   with a stalactite over each, to a pad on a ledge; under slabs that slide
   down from the roof, rows of stalactites and flames that fire as you come
   near, over a sill and more blobs under stalactites, to a pad on a ledge;
   then under stalactites over a crumbling floor.
10. The chase: the yellow key at the foot of the last shaft wakes the lava,
    and up ahead of it past flames right across the shaft that fire as you
    come near, magnets, stalactites in pockets and a plug of crumbling rock,
    to the exit.`;
await buildLevel("10-6", g, {
  header,
  name: "Deep night",
  fuel: 35,
  par: 395,
  dark: true,
  crumble: 0.6,
  route: "F@53 r F@111 F@63 F@18 1 F@72 F@136 F@105 F@29 y E",
  rise: { speed: 1.8, from: 15, to: 66, after: "y", delay: 2 },
});
