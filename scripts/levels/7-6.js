import { Grid, buildLevel } from "./grid.js";

const W = 150;
const H = 100;
const g = new Grid(W, H);
// A 5 s beat: shutters rest 3 s and slam, flames fire for 1.5 s.
const SHUT = { kind: "crusher", rest: 3, warn: 0.6, slam: 0.25, hold: 0.45, back: 0.7 };
const FIRE = { kind: "flame", on: 1.5, off: 3.5, warn: 0.6 };
const labels = [..."acdehijklmnopqstuwxzACDHIJKLMNOPQTUVWXZ"];
let next = 0;
const thing = (spec) => {
  const key = JSON.stringify(spec);
  const found = Object.entries(g.things).find(([, s]) => JSON.stringify(s) === key);
  return found ? found[0] : g.thing(labels[next++], spec);
};

// The start, top left.
g.air(3, 4, 26, 12);
g.pad("S", 3, 12);
g.set(22, 6, "*"); // easy: in the start room

// 1. The flue (down the left): shutters slam across the shaft from its walls.
g.air(8, 13, 24, 86);
g.fill(25, 22, 41, 23, thing({ ...SHUT, to: [-17, 0], offset: 0 }));
g.fill(25, 32, 41, 33, thing({ ...SHUT, to: [-17, 0], offset: 2.5 }));
g.ledge("F", 19, 44, 3, 2);
// 2. The quench: jets across the shaft from alternate walls, one after another.
[54, 64, 74].forEach((r, k) => g.set(k % 2 ? 25 : 7, r, thing({ ...FIRE, facing: k % 2 ? "left" : "right", length: 17, offset: [0, 1.67, 3.33][k] })));
// A side branch off the quench, with a crystal at its end.
g.air(0 + 1, 58, 7, 61);
g.set(2, 59, "*");

// 3. The ladle: along the bottom to the switch that opens the way up and starts
//    the pour.
g.air(8, 87, 134, 96);
g.pad("F", 11, 96);
g.fill(40, 97, 44, 98, "~");
g.set(42, 97, thing({ kind: "blob", height: 3, period: 5, offset: 0 }));
g.fill(70, 97, 74, 98, "~");
g.set(72, 97, thing({ kind: "blob", height: 3, period: 5, offset: 2.5 }));
g.pad("1", 127, 96);
g.thing("1", { kind: "switch", opens: 2 });
g.fill(114, 85, 128, 86, "2");
g.thing("2", { kind: "gate" });

// 4. The pour: up the right shaft ahead of the lava, through shutters and
//    updrafts, with pads on ledges.
g.air(114, 11, 128, 84);
g.set(119, 87, "#"); // the fan under the shaft blows through the open gate
g.set(119, 97, thing({ kind: "fan", facing: "up", length: 30, width: 7, strength: 7 }));
g.air(116, 87, 122, 96);
g.fill(129, 74, 143, 75, thing({ ...SHUT, to: [-15, 0], offset: 1 }));
g.ledge("F", 115, 64, 3, 2);
g.fill(99, 54, 113, 55, thing({ ...SHUT, to: [15, 0], offset: 3.5 }));
g.set(119, 63, "#");
g.set(124, 60, thing({ kind: "fan", facing: "up", length: 20, width: 5, strength: 11, mode: "cycle", on: 2.5, off: 2.5, warn: 0.5, offset: 0 }));
g.rock(123, 60, 125, 62);
g.fill(129, 44, 143, 45, thing({ ...SHUT, to: [-15, 0], offset: 1 }));
g.ledge("F", 124, 36, 3, 2);
// A crystal behind the ledge: the skilful one, with the lava coming.
g.air(129, 30, 132, 34);
g.set(131, 32, "*");
g.air(129, 34, 129, 35);
// 5. The spout: flames across the top of the shaft, and out to the exit.
[26, 20].forEach((r, k) => g.set(k % 2 ? 129 : 113, r, thing({ ...FIRE, facing: k % 2 ? "left" : "right", length: 15, offset: [0.5, 3][k] })));
g.air(96, 3, 136, 10);
g.pad("E", 100, 10);

g.roughen(6, 0.3);
const header = `7-6: Rising lava (molten metal) from a switch, and a climb through crushers and fans ahead of it.

Down the left, along the bottom to a switch that opens the way up the right and
starts the lava rising, then up ahead of it. Everything runs on a 5 s beat.

Sections, in order:
1. The flue (down the left): shutters slam across the shaft from its walls.
   A crystal in the start room.
2. The quench: jets across the shaft from alternate walls, one after another.
   A crystal at the end of a side branch off it.
3. The ladle: along the bottom, over blob pits, to switch 1, which opens gate 2
   and starts the pour.
4. The pour: up the right shaft ahead of the lava, through shutters, an updraft
   that comes and goes, and pads on ledges. A crystal in a nook behind the top
   ledge, for those who dare.
5. The spout: jets across the top of the shaft, and out to the exit.`;
await buildLevel("7-6", g, { header, name: "The pour", fuel: 26, par: 115, route: "F@20 F@12 1 F@116 F@125 E", rise: { speed: 3.5, after: "1", delay: 2 } });
