import { Grid, buildLevel } from "./grid.js";

const W = 180;
const H = 86;
const g = new Grid(W, H);
// A 5 s beat.
const FIRE = { kind: "flame", on: 1.5, off: 3.5, warn: 0.6 };
const SHUT = { kind: "crusher", rest: 3, warn: 0.6, slam: 0.25, hold: 0.45, back: 0.7 };
const GUST = { kind: "fan", mode: "cycle", on: 2.5, off: 2.5, warn: 0.5 };
const labels = [..."acdehijklmnopqstuwxzACDHIJKLMNOPQTUVWXZ"];
let next = 0;
const thing = (spec) => {
  const key = JSON.stringify(spec);
  const found = Object.entries(g.things).find(([, s]) => JSON.stringify(s) === key);
  return found ? found[0] : g.thing(labels[next++], spec);
};

// The hall, with the core in the middle and the lava pit under it.
g.air(8, 6, 172, 75);
g.rock(70, 26, 110, 58);
g.pad("S", 12, 75);
g.fill(46, 76, 134, 79, "~");

// The exit: inside the core, up from the pit through three doors.
g.air(76, 44, 82, 58);
g.fill(76, 56, 82, 57, "G");
g.fill(76, 52, 82, 53, "Y");
g.fill(76, 48, 82, 49, "R");
g.air(74, 32, 106, 43);
g.pad("E", 97, 43);

// The pit: fans on islands lift you over it, blobs rise between them, and two
// shuttles slide under the core, half a beat apart.
for (const c of [62, 79, 118]) {
  g.rock(c - 1, 77, c + 1, 79);
  g.set(c - 1, 76, "#").set(c + 1, 76, "#");
  g.set(c, 76, thing({ kind: "fan", facing: "up", length: 16, width: 3, strength: 11 }));
}
[54, 70, 100, 110, 126].forEach((c, k) => g.set(c, 76, thing({ kind: "blob", height: 5, period: 5, offset: [0, 2.5, 1.25, 3.75, 0][k] })));
g.fill(48, 62, 53, 63, thing({ kind: "mover", to: [22, 0], period: 10, offset: 0 }));
g.fill(127, 62, 132, 63, thing({ kind: "mover", to: [-22, 0], period: 10, offset: 5 }));
g.rock(89, 76, 91, 79);
g.set(90, 75, "*"); // on an island between the blobs, under the core: the skilful one
g.pad("F", 139, 75);

// The red key (west): in an alcove high in the wall, which a crusher slams shut.
g.air(0, 18, 7, 24);
g.set(1, 21, "r");
g.fill(5, 25, 7, 31, thing({ ...SHUT, to: [0, 7], offset: 0 }));
g.ledge("F", 9, 32, 3, 2);

// The yellow key (top): on top of the core, under a wave of roof flames, with
// gusts across the top of the hall from both sides.
g.set(90, 23, "y");
[84, 90, 96].forEach((c, k) => g.set(c, 5, thing({ ...FIRE, facing: "down", length: 20, offset: [0, 1.67, 3.33][k] })));
g.set(7, 14, thing({ ...GUST, facing: "right", length: 60, width: 9, strength: 6, offset: 0 }));
g.set(173, 14, thing({ ...GUST, facing: "left", length: 60, width: 9, strength: 6, offset: 2.5 }));
g.pad("F", 72, 25);
g.pad("F", 106, 25);

// The green key (east): at the back of an alcove low in the wall, behind jets
// from its floor and roof at the mouth, firing together; a push magnet guards
// the pad by it.
g.air(173, 46, 179, 52);
g.set(178, 49, "g");
g.set(174, 53, thing({ ...FIRE, facing: "up", length: 7, offset: 0 }));
g.set(175, 45, thing({ ...FIRE, facing: "down", length: 7, offset: 0 }));
g.ledge("F", 165, 60, 3, 2);
g.set(173, 58, thing({ kind: "magnet", push: true, strength: 7, range: 10 }));

// Crystals: one floating in the hall, one up a passage from its top corner.
g.set(40, 48, "*");
g.air(8, 1, 16, 5);
g.set(10, 2, "*");

g.roughen(3, 0.3);
const header = `7-7: One huge hall round a lava pit with blobs, fans and blocks crossing it; three keys, any order.

A hall with a rock core in the middle. The exit is inside the core, up from the
lava pit under it through a red, a yellow and a green door. The keys are round
the hall, in any order. Everything runs on a 5 s beat.

Sections (the keys in any order):
1. The red key (west): in an alcove high in the wall that a crusher slams shut.
   A pad on a ledge under it. A crystal up a passage from the hall's top corner.
2. The yellow key (top): on top of the core, under a wave of roof flames, with
   gusts coming and going across the top of the hall. Pads on the core at both
   ends.
3. The green key (east): at the back of an alcove low in the wall, behind jets
   from its floor and roof at the mouth that fire together. A push magnet
   guards the pad by it.
4. The pit: over the lava under the core, on the lift of fans on islands, past
   blobs and two shuttles that slide under the core, and up through the three
   doors to the exit. A crystal floats in the hall, and another sits on an
   island in the pit, between the blobs.`;
await buildLevel("7-7", g, { header, name: "The forge", fuel: 20, par: 130, route: "F@10 r F@73 y F@107 F@166 g F@140 E" });
