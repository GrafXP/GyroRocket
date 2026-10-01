import { Grid, buildLevel } from "./grid.js";

const W = 162;
const H = 112;
const g = new Grid(W, H);
// A 3 s beat: flame walls fire 1 s in 3, beams shine 1 s in 3, flames across a
// shaft flash 0.5 s in 3, hammers rest 1.6 s and presses 2.2 s, blobs come up
// every 3 s, magnets pull or push and gusts blow 1.5 s in 3. Everything warns
// for 0.4 s.
// Stalactites shake for 0.4 s once you're within 9 m of being under them; a
// flame that fires as you come near rests 1.5 s, or 2 s across a shaft.
// Crumbling rock falls 0.6 s after you touch it. Switch 1 opens gate 2 for
// 30 s. Taking the blue key wakes the lava below the hub.
const WARN = 0.4;
const WALL = { kind: "flame", on: 1, off: 2, warn: WARN };
const FLASH = { kind: "flame", on: 0.5, off: 2.5, warn: WARN };
const NEAR = { kind: "flame", mode: "near", on: 1, off: 1.5, warn: WARN, reach: 5 };
const SIDE = { ...NEAR, off: 2 };
const BLOB = { kind: "blob", period: 3, warn: WARN };
const HAMMER = { kind: "crusher", rest: 1.6, warn: WARN, slam: 0.15, hold: 0.7, back: 0.15 };
const PRESS = { kind: "crusher", rest: 2.2, warn: WARN, slam: 0.15, hold: 0.1, back: 0.15 };
const BEAM = { kind: "laser", mode: "cycle", on: 1, off: 2, warn: WARN };
const PULL = { kind: "magnet", mode: "cycle", on: 1.5, off: 1.5, warn: WARN, strength: 9, range: 14 };
const GUST = { kind: "fan", mode: "cycle", on: 1.5, off: 1.5, warn: WARN, length: 12, width: 3 };
const TURRET = { kind: "turret", range: 36, speed: 9, windup: 0.5, reload: 0.8 };
g.thing("1", { kind: "switch", opens: "2", time: 30 });
g.thing("2", { kind: "gate" });
const fall = g.label({ kind: "stalactite", reach: 9, warn: WARN });

// In a tunnel whose air starts on row r0, h rows high (its roof on r0 - 1,
// its floor on r0 + h): a wall of flame from the roof or up from the floor, a
// flame that fires as you come near, a hammer or a press in a pocket in the
// roof, a beam, a stalactite, and a blob from a little pool in the floor.
const wall = (c, r0, k, up = false, h = 12) => g.set(c, up ? r0 + h : r0 - 1, g.label({ ...WALL, facing: up ? "up" : "down", length: h, offset: k % 3 }));
const near = (c, r0, up = false, h = 12) => g.set(c, up ? r0 + h : r0 - 1, g.label({ ...NEAR, facing: up ? "up" : "down", length: h }));
const hammer = (c, r0, k, h = 12) => g.fill(c, r0 - 2, c, r0 - 1, g.label({ ...HAMMER, to: [0, -h], offset: k % 3 }));
const press = (c, r0, k, h = 12) => g.fill(c, r0 - 2, c + 1, r0 - 1, g.label({ ...PRESS, to: [0, -h], offset: k % 3 }));
const beam = (c, r0, k) => g.set(c, r0 - 1, g.label({ ...BEAM, facing: "down", offset: k % 3 }));
const stal = (c, r0) => g.set(c, r0, fall);
const blob = (c, r0, k, h = 12, height = 4) => g.set(c - 1, r0 + h, "~").set(c + 1, r0 + h, "~").set(c, r0 + h, g.label({ ...BLOB, height, offset: k % 3 }));
// A stalactite over a blob.
const pair = (c, r0, k, h = 12, height = 4) => (stal(c, r0), blob(c, r0, k, h, height));
// Across a shaft from column c0 to c1 on row r, from its west wall or its east
// one: a flash on the beat, or a flame that fires as you come near.
const across = (c0, c1, r, west, spec) => g.set(west ? c0 - 1 : c1 + 1, r, g.label({ ...spec, facing: west ? "right" : "left", length: c1 - c0 + 1 }));
// Gusts on the beat, both weaker than gravity: down from a roof (on row r),
// and up from a floor; and both in the same columns of a tunnel, in turn.
const gustDown = (c, r) => g.set(c, r, g.label({ ...GUST, facing: "down", strength: 6, offset: 0 }));
const gustUp = (c, r) => g.set(c, r, g.label({ ...GUST, facing: "up", strength: 8, offset: 1.5 }));
const gusts = (c, r0, h = 12) => (gustDown(c, r0 - 1), gustUp(c, r0 + h));
// Magnets on the beat, in turn (k): pulling, or pushing you off a wall.
const pull = (c, r, k, push = false, range = 14) => g.set(c, r, g.label(push ? { ...PULL, range, push: true, offset: (k % 2) * 1.5 } : { ...PULL, range, offset: (k % 2) * 1.5 }));

// The hub, in the middle: the start on a balcony, a pad on a pillar, the ways
// down to the blue key and back up, the way up to the yellow key, and the four
// doors to the exit over it. Magnets in its roof, floor and walls pull and
// push in turn, and gusts blow down from its roof and up from its floor. The
// tunnels are 12 rows high, and the pads at their ends, like the
// hub's, stand high enough that the way along them is over the blobs.
g.air(70, 44, 98, 71);
g.rock(70, 51, 74, 59);
g.pad("S", 71, 50);
g.ledge("F", 86, 66, 3, 5);
g.rock(90, 44, 92, 53); // a column hanging from its roof, with a magnet at its tip
pull(91, 54, 1, false, 20);
pull(80, 43, 0, false, 20);
pull(73, 72, 0, false, 20);
pull(99, 72, 1, false, 20);
pull(74, 57, 1, true, 20);
pull(99, 57, 0, true, 20);
[78, 96].forEach((c) => gustDown(c, 43));
[84, 90].forEach((c) => gustUp(c, 72));

// 1. Red, west (Foundry): out along the upper tunnel through flame walls and
//    hammers on the beat, with stalactites between them, one over a blob, to a
//    pad at the far end and the red key under it; back along the lower tunnel,
//    which the red door shuts off from the hub, through presses and walls of
//    flame up from the floor, with stalactites and blobs between them.
g.air(22, 44, 69, 55);
[66, 46, 26].forEach((c, k) => wall(c, 44, k));
[56, 36].forEach((c, k) => hammer(c, 44, k + 1));
[61, 51, 41, 31].forEach((c, k) => {
  pair(c, 44, k);
  stal(c - 2, 44);
});
[64, 44, 34].forEach((c) => gusts(c, 44));
g.air(13, 44, 21, 71);
g.ledge("F", 14, 50, 3, 7);
across(18, 21, 58, false, SIDE);
pull(20, 43, 0);
pull(12, 63, 0, true);
g.set(19, 65, "r");
g.air(22, 60, 69, 71);
[26, 47].forEach((c, k) => press(c, 60, k));
[37, 58].forEach((c, k) => wall(c, 60, k + 1, true));
[32, 42, 53].forEach((c, k) => {
  pair(c, 60, k, 12, 3);
  stal(c + 2, 60);
});
stal(63, 60);
[29, 39, 60].forEach((c) => gusts(c, 60));
g.fill(66, 60, 67, 71, "R");

// 2. Yellow, north (The Vaults): up a shaft from the hub through flashes
//    across it, west along the top gallery through beams and hammers on the
//    beat under a turret, past magnets, to a pad and switch 1 at the far end,
//    which opens gate 2 for a while; back east along the lower gallery, through
//    the gate to the yellow key behind it, past more hammers and beams, and
//    down the shaft.
g.air(70, 10, 77, 43);
across(70, 77, 41, false, { ...FLASH, offset: 0 });
across(70, 77, 35, true, { ...FLASH, offset: 1.5 });
across(70, 77, 21, false, { ...FLASH, offset: 0 });
pull(78, 38, 0, true);
pull(78, 31, 1, true);
pull(78, 24, 0, true);
pull(78, 16, 1, true);
g.air(24, 10, 69, 19);
[66, 56, 46, 36, 26].forEach((c, k) => beam(c, 10, k));
[61, 51, 41, 31].forEach((c, k) => hammer(c, 10, k + 1, 10));
[62, 46, 30].forEach((c, k) => pull(c, 20, k));
g.air(47, 5, 49, 9).set(48, 4, g.label(TURRET));
g.air(14, 10, 23, 33);
g.ledge("F", 20, 19, 3, 2);
g.pad("1", 15, 33);
pull(13, 29, 1, true);
g.air(24, 24, 69, 33);
g.fill(28, 24, 29, 33, "2");
stal(31, 24);
g.set(33, 29, "y");
[38, 48, 58].forEach((c, k) => hammer(c, 24, k, 10));
[43, 53, 63].forEach((c, k) => beam(c, 24, k + 1));
[40, 50, 60].forEach((c, k) => pull(c, 34, k));

// 3. Green, east (Fault line): over a sill and out along the upper tunnel past
//    flames from the roof that fire as you come near, stalactites over blobs
//    and walls of crumbling rock, to a pad at the far end and the green key
//    under it; back along the lower tunnel, which the green door shuts off
//    from the hub, under stalactites, some over blobs, and past flames up from
//    the floor that fire as you come near. (The crumbling walls are on the
//    way out, where there's no way round them: the autopilot won't break
//    through rock it can fly round.)
g.air(99, 44, 148, 55);
g.rock(99, 51, 101, 55);
[105, 118, 131].forEach((c, k) => {
  near(c, 44);
  pair(c + 5, 44, k);
  if (k < 2) g.fill(c + 8, 44, c + 9, 55, "%");
  else stal(c + 8, 44);
});
near(144, 44);
[116, 133, 141].forEach((c) => gusts(c, 44));
g.air(149, 44, 157, 71);
g.ledge("F", 154, 50, 3, 7);
across(149, 152, 58, true, SIDE);
pull(151, 43, 1);
pull(158, 63, 1, true);
g.set(151, 65, "g");
g.air(99, 60, 148, 71);
[145, 130, 115].forEach((c, k) => {
  stal(c, 60);
  pair(c - 7, 60, k, 12, 3);
  near(c - 10, 60, true);
});
[142, 127, 112].forEach((c) => gusts(c, 60));
g.fill(101, 60, 102, 71, "G");

// 4. Blue, below (the Core): down a shaft from the hub past a flame across it
//    that fires as you come near, west along a passage past flames from the
//    roof that fire as you come near and under stalactites, some over blobs,
//    to a pad at its end, down a pit and back east along the lower passage
//    over lava, through
//    walls of flame with blobs between them, to the blue key under the other
//    shaft; taking it wakes the lava, which chases you up that shaft, past
//    flames across it that fire as you come near, to the hub.
g.air(76, 72, 83, 88);
across(76, 83, 76, true, SIDE);
pull(84, 81, 0, true);
g.air(34, 78, 83, 88);
near(70, 78, false, 11);
[65, 51].forEach((c, k) => {
  pair(c, 78, k, 11, 3);
  stal(c - 3, 78);
});
stal(59, 78);
near(57, 78, false, 11);
gusts(54, 78, 11);
g.ledge("F", 42, 85, 3, 3);
g.air(34, 89, 40, 106);
pull(41, 100, 1, true);
g.air(34, 98, 98, 106);
g.fill(43, 107, 90, 107, "~");
[46, 54, 62, 70, 78, 86].forEach((c, k) => g.set(c, 107, g.label({ ...BLOB, height: 3, offset: k % 3 })));
[50, 58, 66, 74, 82].forEach((c, k) => g.set(c, 97, g.label({ ...WALL, facing: "down", length: 9, offset: (k + 1) % 3 })));
g.set(94, 102, "b");
g.air(91, 72, 98, 97);
across(91, 98, 92, false, SIDE);
across(91, 98, 85, true, SIDE);
across(91, 98, 78, false, SIDE);
pull(90, 89, 0, true);
pull(99, 81, 1, true);

// 5. The way out: up the shaft over the hub through the four doors, past flames
//    across it between them that fire as you come near, to the exit.
g.air(82, 12, 88, 43);
g.fill(82, 40, 88, 41, "R");
g.fill(82, 33, 88, 34, "Y");
g.fill(82, 26, 88, 27, "G");
g.fill(82, 19, 88, 20, "B");
[37, 23].forEach((r) => across(82, 88, r, true, SIDE));
[30, 15].forEach((r) => across(82, 88, r, false, SIDE));
[34, 27, 19].forEach((r, k) => pull(k % 2 ? 81 : 89, r, k, true));
g.air(82, 3, 100, 11);
g.pad("E", 95, 11);
stal(90, 3);

// Crystals: in an alcove over the red tunnel (the easy one), at the end of a
// side branch off the green tunnel, and low over the lava between two blobs on
// the way to the blue key (the skilful one).
g.air(52, 39, 54, 43);
g.set(53, 40, "*");
g.air(120, 34, 122, 43);
g.set(121, 36, "*");
g.set(58, 104, "*");

g.roughen(104, 0.3);
const header = `10-4: All four keys, each behind a set piece from a different world, in any order.

From the hub in the middle, out along a loop for each key and back, then up
through the four doors to the exit. Each loop goes out one way and comes back
another: the red and green doors shut the lower tunnels off from the hub, so
the way out is along the upper one, and the key is at the foot of the far
chamber, by the lower one. A 3 s beat: flame walls fire 1 s in 3, beams shine
1 s in 3, flames across a shaft flash 0.5 s in 3, hammers rest 1.6 s and
presses 2.2 s, blobs come up every 3 s, and magnets pull or push and gusts
blow 1.5 s in 3. Everything warns for 0.4 s. Stalactites shake for 0.4 s once
you're within 9 m of being under them; a flame that fires as you come near
rests 1.5 s, or 2 s across a shaft. Crumbling rock falls 0.6 s after you touch it. Switch 1 opens
gate 2 for 30 s. Taking the blue key wakes the lava, which rises 1.5 m/s from
2 s later, up to just below the hub.

Sections, in order (the keys can be taken in any order):
0. The hub: the start on a balcony, a pad on a pillar, magnets in its roof,
   floor and walls pulling and pushing in turn, and gusts down from its roof
   and up from its floor. Gusts blow across the red, green and blue tunnels
   too, down and up in turn.
1. Red, west (Foundry): out along the upper tunnel through flame walls and
   hammers on the beat, with stalactites between them, one over a blob, to a
   pad at the far end; down past a flame that fires as you come near to the
   red key; back along the lower tunnel through presses and walls of flame up
   from the floor, with stalactites and blobs between them, and the red door.
   A crystal in an alcove over the upper tunnel: the easy one.
2. Yellow, north (The Vaults): up a shaft from the hub through flashes across
   it, past magnets, west along the top gallery through beams and hammers on
   the beat under a turret, to a pad and switch 1 at the far end, which opens
   gate 2; back east along the lower gallery, through the gate to the yellow
   key behind it, past more hammers and beams, and down the shaft.
3. Green, east (Fault line): over a sill and out along the upper tunnel past
   flames from the roof that fire as you come near, stalactites over blobs
   and walls of crumbling rock, to a pad at the far end; down to the green
   key; back along the lower tunnel under stalactites, some over blobs, past
   flames up from the floor that fire as you come near, and through the green
   door. A crystal at the end of a side branch off the upper tunnel.
4. Blue, below (the Core): down a shaft from the hub past a flame across it
   that fires as you come near, west along a passage past flames from the roof
   and under stalactites, some over blobs, to a pad at its end, down a pit and
   back east along the lower passage over lava, through walls of flame with
   blobs between them, to the blue key under the other shaft; taking it wakes
   the lava, which chases you up that shaft, past flames across it that fire
   as you come near, to the hub. A crystal low over the lava between two
   blobs: the skilful one.
5. The way out: up the shaft over the hub through the four doors, past flames
   across it between them that fire as you come near and magnets, to the exit.`;
await buildLevel("10-4", g, {
  header,
  name: "Keyring",
  fuel: 38,
  par: 410,
  crumble: 0.6,
  route: "F@16 r F@88 F@22 1 y F@88 F@156 g F@88 F@44 b F@88 E",
  rise: { speed: 1.5, from: 5, to: 39, after: "b", delay: 2 },
});
