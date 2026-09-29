import { Grid, buildLevel } from "./grid.js";

const W = 184;
const H = 46;
const g = new Grid(W, H);
// One beat for everything: 5 s. A crusher rests 3 s, shakes 0.6, slams, holds
// and goes back; a flame fires for 1.5 s after flickering for 0.6. Blobs are
// thrown every other beat.
const BEAT = 5;
const HAMMER = { kind: "crusher", rest: 3, warn: 0.6, slam: 0.2, hold: 0.5, back: 0.7 };
const FIRE = { kind: "flame", on: 1.5, off: 3.5, warn: 0.6 };
const at = (beats) => Math.round(((beats * BEAT) % BEAT) * 100) / 100; // an offset, in beats
const labels = [..."acdehijklmnopqstuwxzACDHIJKLMNOPQTUVWXZ"];
let next = 0;
const thing = (spec) => {
  const key = JSON.stringify(spec);
  const found = Object.entries(g.things).find(([, s]) => JSON.stringify(s) === key);
  return found ? found[0] : g.thing(labels[next++], spec);
};
const hammer = (c, r0, r1, to, offset, w = 4) => g.fill(c, r0, c + w - 1, r1, thing({ ...HAMMER, to, offset }));
const flame = (c, r, facing, length, offset) => g.set(c, r, thing({ ...FIRE, facing, length, offset }));

// The start, with the exit in sight through a gate, and the way out behind it.
g.air(16, 4, 30, 13);
g.pad("S", 20, 13);
g.air(26, 1, 30, 3);
g.set(28, 2, "*"); // easy: up over the start
g.air(2, 2, 12, 39); // the way out: a shaft with an updraft
g.set(8, 40, thing({ kind: "fan", facing: "up", length: 28, width: 5, strength: 8 }));
g.ledge("E", 2, 6, 3, 2);
g.fill(13, 6, 15, 11, "3");
g.thing("3", { kind: "gate" });
g.rock(13, 4, 15, 5);
g.rock(13, 12, 15, 13);

// Run 1, to the right.
g.air(31, 4, 170, 13);
// 1. The anvils: crushers slam down from the roof onto the floor, a beat apart,
//    with walls of flame between them firing in between.
[40, 60, 80].forEach((c, k) => hammer(c, 4, 7, [0, -6], at(k / 4)));
[52, 72].forEach((c, k) => flame(c, 14, "up", 10, at((k + 2.5) / 4)));
g.pad("F", 96, 13);
// 2. The tongs: crushers from the roof and the floor that close on each other,
//    a third of a beat apart, with blob pits between.
[118, 134, 150].forEach((c, k) => {
  const offset = at(k / 3);
  hammer(c, 4, 5, [0, -3], offset);
  hammer(c, 12, 13, [0, 3], offset);
});
g.fill(125, 14, 127, 15, "~");
g.fill(141, 14, 143, 15, "~");
g.set(126, 14, thing({ kind: "blob", height: 3, period: 2 * BEAT, offset: 3 }));
g.set(142, 14, thing({ kind: "blob", height: 3, period: 2 * BEAT, offset: 4.67 }));

// 3. The quench: down a shaft past jets from its walls, taking turns on the beat.
g.air(162, 14, 170, 29);
flame(161, 17, "right", 9, 0);
flame(171, 21, "left", 9, at(1 / 3));
flame(161, 25, "right", 9, at(2 / 3));
// A side passage off the shaft, with a crystal at its end.
g.air(171, 22, 180, 25);
g.air(177, 18, 181, 25);
g.set(179, 19, "*");

// Run 2, back to the left.
g.air(16, 30, 170, 39);
g.pad("F", 164, 39);
// 4. The hammer mill: crushers over the floor, lava pits and blobs between them.
[144, 128, 112].forEach((c, k) => hammer(c, 30, 33, [0, -6], at(k / 3)));
g.fill(136, 40, 139, 41, "~");
g.fill(120, 40, 123, 41, "~");
g.set(137, 40, thing({ kind: "blob", height: 3, period: 2 * BEAT, offset: 1.25 }));
g.set(121, 40, thing({ kind: "blob", height: 3, period: 2 * BEAT, offset: 7.9 }));
g.pad("F", 92, 39);
// 5. The drop forge: crushers and walls of flame close together, the wave running
//    at you.
[78, 62, 46].forEach((c, k) => hammer(c, 30, 33, [0, -6], at((k * 3) / 8)));
[72, 56, 40].forEach((c, k) => flame(c, 40, "up", 10, at((k * 3 + 5) / 8)));
// A crystal in a notch in the floor under a crusher: the skilful one.
g.air(63, 40, 64, 41);
g.set(63, 40, "*");
g.set(64, 40, ".");
g.pad("2", 20, 39);
g.thing("2", { kind: "switch", opens: 3 });
g.fill(13, 30, 15, 39, "3");

g.roughen(4, 0.3);
const header = `7-4: Crushers and flame waves on one beat, down a long tunnel; a switch opens the way out.

Everything runs on a 5 s beat, and the blobs every other beat. The exit is in sight from the start, through a
gate; the switch that opens it is at the far end of the tunnel.

Sections, in order:
1. The anvils (along the top): crushers slam down from the roof a beat apart,
   with walls of flame between them firing in between. A crystal over the
   start.
2. The tongs: crushers from the roof and the floor close on each other, a
   third of a beat apart, with blob pits between.
3. The quench: down a shaft past jets from its walls, taking turns. A crystal
   at the end of a side passage off it.
4. The hammer mill (back along the bottom): crushers over the floor, and lava
   pits throwing blobs between them.
5. The drop forge: crushers and walls of flame close together, the wave
   running at you, to switch 2, which opens gate 3. A crystal in a notch under
   a crusher.
6. The way out: through gate 3 and up the updraft to the exit.`;
await buildLevel("7-4", g, { header, name: "Hammer and tongs", fuel: 27, par: 140, route: "F@98 F@165 F@94 2 E" });
