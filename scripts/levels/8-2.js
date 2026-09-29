import { Grid, buildLevel } from "./grid.js";

const W = 180;
const H = 80;
const g = new Grid(W, H);
// A 5 s beat.
const WALL = { kind: "flame", on: 1.5, off: 3.5, warn: 0.6 };
const FLICKER = { kind: "laser", mode: "cycle", on: 1.5, off: 3.5, warn: 0.6 };
// The beams each switch turns off.
const alarm1 = g.thing("a", { kind: "laser", facing: "down" });
const alarm2 = g.thing("c", { kind: "laser", facing: "right" });
const alarm3 = g.thing("d", { kind: "laser", facing: "right" });

// ---- The lobby (top left), and switch 1 up a shaft from its roof ----
g.air(3, 16, 44, 30);
g.pad("S", 6, 30);
g.set(12, 19, "*"); // easy: up in the lobby
g.air(30, 9, 36, 15); // up from the lobby
g.air(30, 3, 60, 8); // a passage east, with walls of flame across it
[40, 49].forEach((c, k) => g.set(c, 2, g.label({ ...WALL, facing: "down", length: 6, offset: k * 2.5 })));
g.pad(g.thing("1", { kind: "switch", opens: "a" }), 55, 8);
// The beams across the way on to the red vault, till switch 1 turns them off.
g.air(45, 20, 60, 30);
for (const c of [48, 52, 56]) g.set(c, 19, alarm1);

// ---- The red vault, and the gallery beyond the red door ----
g.air(61, 16, 80, 30);
g.pad("F", 64, 30);
g.set(73, 27, "r");
g.fill(81, 22, 82, 30, "R");
g.air(83, 16, 170, 30);
// Turrets in the roof, with rock hanging between them to hide behind.
const turret = g.label({ kind: "turret", range: 30 });
g.set(104, 15, turret).set(138, 15, turret);
g.rock(112, 16, 114, 22);
g.rock(146, 16, 148, 22);
g.rock(93, 27, 96, 30);
// A block slides down from the roof on the way to switch 2.
g.air(151, 7, 155, 15);
g.fill(151, 7, 155, 12, g.label({ kind: "mover", to: [0, -14], period: 8, offset: 0 }));
g.pad("F", 158, 30);
g.pad(g.thing("2", { kind: "switch", opens: "c" }), 165, 30);

// ---- Down the pit to the yellow vault, past beams that switch 2 turns off ----
g.air(120, 31, 127, 44);
g.set(119, 36, alarm2).set(119, 41, alarm2);
g.air(100, 45, 152, 58);
// A pool that throws up blobs, between the pit and the yellow key.
g.fill(131, 58, 141, 59, "~");
const blob = { kind: "blob", height: 5, period: 5 };
g.set(134, 58, g.label({ ...blob, offset: 0 })).set(138, 58, g.label({ ...blob, offset: 2.5 }));
g.set(136, 54, "*"); // over the pool: the skilful one
g.set(148, 54, "y");
g.pad("F", 103, 58);
g.fill(98, 50, 99, 58, "Y");

// ---- The lower passage, back west: flickering beams and a magnet ----
g.air(20, 49, 97, 58);
g.set(84, 48, g.label({ ...FLICKER, facing: "down", offset: 0 }));
g.set(62, 48, g.label({ ...FLICKER, facing: "down", offset: 2.5 }));
g.set(73, 48, g.label({ kind: "magnet", strength: 7, range: 12 }));
g.air(40, 59, 46, 66); // a side cave with a crystal
g.set(43, 63, "*");
g.air(6, 44, 19, 58);
g.pad(g.thing("3", { kind: "switch", opens: "d" }), 13, 58);

// ---- The exit, up a shaft past the last beams, which switch 3 turns off ----
g.air(6, 39, 12, 43);
g.set(5, 40, alarm3);
g.air(3, 34, 24, 38);
g.pad("E", 18, 38);

g.roughen(2, 0.3);
const header = `8-2: Lasers on switches: each switch turns off the beams guarding the next key, for good.

Sections, in order:
1. The lobby: three beams bar the way to the red vault, and switch 1 that turns
   them off is up from the lobby's roof, along a passage through walls of
   flame. A
   crystal up in the lobby.
2. The gallery: through the red door, under two turrets in the roof, from the
   cover of the rock between them, and under a block sliding down from the
   roof, to a pad and switch 2 at the far end.
3. The yellow vault: switch 2 turned off the beams across the pit in the
   gallery's floor. Down it, over a pool throwing up blobs, to the yellow key.
   A crystal over the pool.
4. The lower passage: through the yellow door and back west, under flickering
   beams and a magnet in the roof between them that tugs you up, to switch 3. A crystal in a
   side cave.
5. The exit: switch 3 turned off the beam across the shaft up to it.`;
await buildLevel("8-2", g, { header, name: "Alarm", fuel: 27, par: 140, route: "1 F@65 r F@159 2 y F@104 3 E" });
