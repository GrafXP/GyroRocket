import { Grid, buildLevel } from "./grid.js";

const W = 164;
const H = 76;
const g = new Grid(W, H);
// World 10's 3 s beat, warnings of 0.4 s, and turrets with fast shots (9 m/s)
// that reload in 0.8 s. Walls of flame fire 1 s in 3, in waves half a second
// apart; flames across a shaft flash 0.5 s in 3; beams shine 1 s in 3; blobs
// are thrown every 3 s. A flame that fires as you come near rests 1.5 s;
// stalactites shake once you're within 6 m of being under them, or 9 m where
// the roof is high. The turrets watch the cycles: what you set off is out of
// their sight.
const WARN = 0.4;
const WALL = { kind: "flame", on: 1, off: 2, warn: WARN };
const FLASH = { kind: "flame", on: 0.5, off: 2.5, warn: WARN };
const NEAR = { kind: "flame", mode: "near", on: 1, off: 1.5, warn: WARN, reach: 5 };
const BLOB = { kind: "blob", height: 4, period: 3, warn: WARN };
const BEAM = { kind: "laser", mode: "cycle", on: 1, off: 2, warn: WARN };
const HAMMER = { kind: "crusher", rest: 1.6, warn: WARN, slam: 0.15, hold: 0.7, back: 0.15 };
const TURRET = { kind: "turret", range: 36, speed: 9, windup: 0.5, reload: 0.8 };
const drop = g.label({ kind: "stalactite", reach: 6, warn: WARN });
const fall = g.label({ kind: "stalactite", reach: 9, warn: WARN });
// A wave: walls of flame down from the roof on row r - 1 to the lava on row
// `lava`, at columns `cols`, firing half a second one after another.
const wave = (cols, r, lava, k0 = 0) =>
  cols.forEach((c, k) => g.set(c, r - 1, g.label({ ...WALL, facing: "down", length: lava - r, offset: ((k0 + k) * 0.5) % 3 })));
// Blobs thrown up from the lava on row r, on the beat.
const blobs = (cols, r) => cols.forEach((c, k) => g.set(c, r, g.label({ ...BLOB, offset: (k * 0.75) % 3 })));
const turret = (c, r) => g.set(c, r, g.label(TURRET));

// 1. The first line: east from the start over a lava channel under walls of
//    flame firing in a wave, with blobs between them, and a turret in a pocket
//    in the roof.
g.air(3, 56, 76, 70);
g.fill(3, 71, 76, 72, "~");
g.ledge("S", 4, 66, 3, 6);
wave([12, 20, 28, 36, 44, 52, 60, 68], 56, 71);
blobs([16, 24, 32, 40, 48, 56, 64], 71);
g.air(37, 52, 39, 55);
turret(38, 51);
g.air(31, 52, 33, 55); // a pocket in the roof with a crystal, by the turret: the easy one
g.set(32, 53, "*");
g.ledge("F", 72, 66, 3, 6);

// 2. Under cover: on east behind a wall of rock, out of the turrets' sight, past
//    flames that fire down from the roof as you come near and rows of
//    stalactites, over crumbling floors over the lava, with a pad halfway.
g.rock(77, 56, 79, 57); // the cover
g.air(77, 58, 150, 68);
g.fill(77, 69, 150, 72, "~");
g.fill(84, 68, 95, 68, "%");
g.set(81, 57, g.label({ ...NEAR, facing: "down", length: 10 }));
[86, 89, 92, 95].forEach((c) => g.set(c, 58, fall));
g.ledge("F", 98, 66, 3, 6);
[104, 120, 136].forEach((c) => g.set(c, 57, g.label({ ...NEAR, facing: "down", length: 10 })));
[110, 113, 116, 126, 129, 132, 142, 145].forEach((c) => g.set(c, 58, fall));
g.fill(106, 68, 140, 68, "%");

// 3. Crossfire: up a shaft through flashes right across it, with gusts along
//    them, under turrets in pockets in both walls, to a pad at the top.
g.ledge("F", 147, 66, 3, 6);
g.air(151, 18, 162, 70);
g.fill(151, 71, 162, 72, "~");
[64, 56, 48, 40, 32, 24].forEach((r, k) => {
  const west = k % 2 === 1;
  g.set(west ? 150 : 163, r, g.label({ ...FLASH, facing: west ? "right" : "left", length: 12, offset: (k * 0.5) % 3 }));
  if (r < 64) g.set(west ? 163 : 150, r, g.label({ kind: "fan", mode: "cycle", on: 1.5, off: 1.5, warn: WARN, facing: west ? "left" : "right", length: 12, width: 2, strength: 3, offset: west ? 1.5 : 0 }));
});
g.air(146, 52, 149, 53).air(146, 51, 147, 51);
turret(145, 52);
g.air(163, 36, 163, 37);
g.set(163, 37, "#");
turret(163, 36);

// 4. The gallery: west along the top under walls of flame from the roof and up
//    from the floor in turn, firing in a wave, with gusts between them,
//    watched by two turrets, then through the battery, under cover, where
//    hammers and a beam on the beat cross the way, with rows of stalactites
//    between them.
g.air(8, 4, 162, 17);
g.ledge("F", 157, 17, 3, 2); // at the top of the shaft
[150, 142, 134, 126, 118, 110, 102, 94, 86, 78].forEach((c, k) => {
  const up = k % 2 === 1;
  g.set(c, up ? 18 : 3, g.label({ ...WALL, facing: up ? "up" : "down", length: 14, offset: (k * 0.5) % 3 }));
});
// Gusts between them, down from the roof and up from the floor in turn.
[146, 138, 130, 122, 114, 106, 98, 90, 82].forEach((c, k) => {
  const up = k % 2 === 1;
  g.set(c, up ? 18 : 3, g.label({ kind: "fan", mode: "cycle", on: 1.5, off: 1.5, warn: WARN, facing: up ? "up" : "down", length: 14, width: 2, strength: 6, offset: up ? 1.5 : 0 }));
});
g.air(117, 1, 119, 2);
turret(118, 1);
g.air(93, 1, 95, 2);
turret(94, 1);
g.ledge("F", 70, 14, 3, 2);
// A side branch off the gallery, with a crystal at its end.
g.air(63, 18, 67, 26);
g.set(65, 25, "*");
g.rock(66, 4, 68, 8); // the cover
[62, 36].forEach((c, k) => g.fill(c, 4, c, 5, g.label({ ...HAMMER, to: [0, -11], offset: (k * 1) % 3 })));
g.set(49, 3, g.label({ ...BEAM, facing: "down" }));
[57, 54, 51, 44, 41, 38, 31, 28, 25, 22].forEach((c) => g.set(c, 4, fall));

// 5. The last line: down a shaft at the west end through a crumbling plug,
//    tongs from its walls, a flash across it and a flame that fires as you
//    come near, to a pad, and east along the middle over a lava channel, under
//    walls of flame firing in a wave, with a stalactite, then a stalactite
//    over a blob, and another blob between them, past a pad and three turrets,
//    to the exit.
g.air(8, 18, 19, 44);
g.fill(8, 19, 19, 20, "%");
[7, 20].forEach((c) => g.fill(c, 24, c, 25, g.label({ ...HAMMER, to: [c === 7 ? 3 : -3, 0], offset: 0 })));
g.set(7, 29, g.label({ ...FLASH, facing: "right", length: 12, offset: 1 }));
g.set(7, 36, g.label({ ...NEAR, off: 2, facing: "right", length: 12 }));
g.ledge("F", 9, 41, 3, 2);
g.air(20, 30, 148, 44);
g.fill(8, 45, 148, 46, "~");
wave([30, 46, 62, 78, 94, 110, 126], 30, 45);
[38, 54, 70, 86, 102, 118, 134].forEach((c) => g.set(c, 30, fall));
blobs([38, 54, 70, 86, 102, 118, 134], 45);
[35, 51, 67, 99, 115, 131].forEach((c) => g.set(c, 30, fall));
blobs([58, 74, 90, 122], 45);
g.ledge("F", 81, 40, 3, 6);
[42, 106, 138].forEach((c) => {
  g.air(c - 1, 27, c + 1, 29);
  turret(c, 26);
});
// A crystal low over the lava between two walls of flame, under a crumbling
// ledge: the skilful one.
g.fill(97, 41, 99, 41, "%");
g.set(98, 43, "*");
g.ledge("E", 142, 40, 3, 6);

g.roughen(102, 0.3);
const header = `10-2: Turrets with fast shots cover flame waves over lava: dodge the shots without losing the flames' rhythm.

From the bottom left, east along a lava channel, up a shaft at the east end,
west along the top, down at the west end and east along the middle to the
exit. World 10's 3 s beat, warnings of 0.4 s, and turrets with fast shots
(9 m/s) that reload in 0.8 s. Walls of flame fire 1 s in 3, in waves half a
second apart; flames across the shaft flash 0.5 s in 3; beams shine 1 s in
3; blobs are thrown every 3 s. A flame that fires as you come near rests
1.5 s; stalactites shake once you're within 6 m of being under them, or 9 m
where the roof is high. The turrets watch the cycles: what you set off is out
of their sight.

Sections, in order:
1. The first line: east from the start over a lava channel under walls of
   flame firing in a wave, with blobs between them, and a turret in a pocket
   in the roof. A crystal in a pocket beside the turret.
2. Under cover: on east behind a wall of rock, out of the turrets' sight, past
   flames that fire down from the roof as you come near and rows of
   stalactites, over crumbling floors over the lava.
3. Crossfire: up a shaft through flashes right across it, under turrets in
   pockets in both walls, to a pad at the top.
4. The gallery: west along the top under walls of flame from the roof and up
   from the floor in turn, firing in a wave, with gusts between them, watched
   by two turrets, then through the battery, under cover, where hammers and a
   beam on the beat cross the way, with rows of stalactites between them. A
   crystal at the end of a side branch.
5. The last line: down the west end through a crumbling plug, tongs, a flash
   and a flame that fires as you come near, and east along the middle over a
   lava channel, under walls of flame firing in a wave, with a stalactite, a
   stalactite over a blob and another blob between them, past three turrets,
   to the exit. A crystal low over the lava between two walls of flame, under
   a crumbling ledge.`;
await buildLevel("10-2", g, { header, name: "Firing line", fuel: 30, par: 300, crumble: 0.6, route: "F@73 F@99 F@148 F@158 F@71 F@10 F@82 E" });
