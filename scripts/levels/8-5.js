import { Grid, buildLevel } from "./grid.js";

const W = 140;
const H = 80;
const g = new Grid(W, H);
// Everything on a 5 s beat. The beams after a switch are staggered by the time it
// takes to fly between them, so leaving the switch at the right moment catches
// every one of them off.
const beam = (offset) => g.label({ kind: "laser", mode: "cycle", on: 1.5, off: 3.5, warn: 0.6, facing: "down", offset });
const clock = (n, time) => [g.thing(String(n), { kind: "switch", opens: String(n + 1), time }), g.thing(String(n + 1), { kind: "gate" })];
const [switch1, gate2] = clock(1, 18);
const [switch3, gate4] = clock(3, 20);
const [switch5, gate6] = clock(5, 24);

// ---- The first clock (top, east): switch 1 opens gate 2 ----
g.air(3, 4, 132, 18);
g.pad("S", 5, 18);
g.set(8, 7, "*"); // easy: up over the start
g.pad(switch1, 12, 18);
g.set(26, 3, beam(0));
g.set(38, 3, beam(3));
g.fill(50, 4, 51, 18, gate2);
g.pad("F", 110, 18);
g.air(124, 19, 132, 30); // down to the second band

// ---- The second clock (middle, west): switch 3 opens gate 4, past a wall of
// flame and two beams ----
g.air(8, 31, 132, 45);
g.pad(switch3, 120, 45);
g.set(107, 30, g.label({ kind: "flame", on: 1.5, off: 3.5, warn: 0.6, facing: "down", length: 15, offset: 0 }));
g.set(95, 30, beam(3));
g.set(83, 30, beam(1));
g.fill(70, 31, 71, 45, gate4);
g.air(76, 46, 81, 52); // a nook down between the beams, with a crystal
g.set(78, 49, "*");
g.pad("F", 30, 45);
g.air(8, 46, 16, 57); // down to the third band

// ---- The third clock (bottom, east): switch 5 opens gate 6, under a block
// coming down from the roof, past beams and a turret ----
g.air(8, 58, 132, 74);
g.pad(switch5, 20, 74);
g.air(38, 50, 42, 57);
g.fill(38, 50, 42, 55, g.label({ kind: "mover", to: [0, -17], period: 10, offset: 0 }));
g.set(40, 72, "*"); // under the block: the skilful one
g.set(52, 57, beam(0));
g.set(64, 57, beam(3));
g.set(75, 57, g.label({ kind: "turret", range: 36 }));
g.fill(86, 58, 87, 74, gate6);
g.pad("E", 122, 74);

g.roughen(5, 0.3);
const header = `8-5: Timed gates one after another, through lasers on a cycle; the countdowns and the beams fit together.

Everything runs on a 5 s beat, and the beams after each switch are staggered by
the time it takes to fly from one to the next: lift off on the right beat and
they're all off as you get to them. Sections, in order:
1. The first clock (top, east): switch 1 opens gate 2 for 18 s, past two beams.
   Then a breather to a pad. A crystal up over the start.
2. The second clock (middle, west): switch 3 opens gate 4 for 20 s, past a wall
   of flame and two beams. A crystal in a nook down between the beams. Then a
   pad.
3. The third clock (bottom, east): switch 5 opens gate 6 for 24 s, under a block
   that comes down from the roof, past two beams and a turret, to the exit. A
   crystal on the floor under the block.`;
await buildLevel("8-5", g, { header, name: "Clockwork", fuel: 27, par: 115, route: "1 F@111 3 F@31 5 E" });
