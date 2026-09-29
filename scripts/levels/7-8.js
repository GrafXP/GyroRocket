import { Grid, buildLevel } from "./grid.js";

const W = 200;
const H = 96;
const g = new Grid(W, H);
// A 5 s beat, but the conveyor's 8.
const GUST = { kind: "fan", mode: "cycle", on: 2.5, off: 2.5, warn: 0.5, offset: 0 };
const JET = { kind: "flame", on: 2.5, off: 2.5, warn: 0.6 };
const FIRE = { kind: "flame", on: 1.5, off: 3.5, warn: 0.6 };
const HAMMER = { kind: "crusher", rest: 3, warn: 0.6, slam: 0.2, hold: 0.5, back: 0.7 };
const PULL = { kind: "magnet", strength: 9, range: 18, mode: "cycle", on: 2.5, off: 2.5, warn: 0.5 };
const labels = [..."acdehijklmnopqstuwxzACDHIJKLMNOPQTUVWXZ03456789"];
let next = 0;
const thing = (spec) => {
  const key = JSON.stringify(spec);
  const found = Object.entries(g.things).find(([, s]) => JSON.stringify(s) === key);
  return found ? found[0] : g.thing(labels[next++], spec);
};

// ---- Band 1 (top), to the right ----
g.air(3, 4, 198, 20);
g.pad("S", 5, 20);
g.air(6, 1, 12, 3);
g.set(9, 2, "*"); // easy: up over the start
// 1. Bellows: a gust along the band from a pillar, and jets from the floor that
//    fire while it rests.
g.rock(16, 10, 18, 20);
g.set(18, 15, thing({ ...GUST, facing: "right", length: 50, width: 11, strength: 7 }));
[30, 42, 54, 66].forEach((c) => g.set(c, 21, thing({ ...JET, facing: "up", length: 17, offset: 2.5 })));
g.pad("F", 76, 20);
// 2. The conveyor: platforms over lava, meeting end to end, and walls of flame
//    where they meet that burn while they're apart.
g.fill(86, 18, 168, 21, "~");
g.rock(82, 18, 85, 21);
[89, 109, 129, 149].forEach((c, k) => g.fill(c, 15, c + 5, 15, thing({ kind: "mover", to: [14, 0], period: 8, offset: (k % 2) * 4 })));
[108, 128, 148].forEach((c, k) => g.set(c, 18, thing({ kind: "flame", facing: "up", length: 14, on: 3, off: 5, warn: 0.8, offset: k % 2 ? 5.5 : 1.5 })));
g.rock(169, 18, 184, 21);
g.pad("F", 172, 17);
g.set(196, 8, "r");

// 3. The quench: down a shaft past jets from its walls, and through the red door.
g.air(186, 21, 196, 34);
g.set(185, 24, thing({ ...FIRE, facing: "right", length: 11, offset: 0 }));
g.set(197, 31, thing({ ...FIRE, facing: "left", length: 11, offset: 2.5 }));
g.fill(186, 27, 196, 28, "R");

// ---- Band 2 (middle), to the left ----
g.air(3, 35, 198, 53);
g.pad("F", 188, 53);
// 4. The anvils: crushers slam down from the roof, with walls of flame between.
[168, 148, 128].forEach((c, k) => g.fill(c, 35, c + 3, 38, thing({ ...HAMMER, to: [0, -15], offset: [0, 1.67, 3.33][k] })));
[158, 138].forEach((c, k) => g.set(c, 54, thing({ ...FIRE, facing: "up", length: 19, offset: [0.83, 2.5][k] })));
// A crystal in a notch in the floor under the middle anvil: the skilful one.
g.air(149, 54, 150, 55);
g.set(149, 54, "*");
g.set(150, 54, ".");
// 5. The crane: a lava lake under magnets in the roof that pull you up towards
//    flames beside them, and blobs rising when they rest.
g.rock(101, 51, 116, 56);
g.pad("F", 107, 50);
g.fill(24, 51, 100, 54, "~");
[90, 70, 50, 30].forEach((c, k) => {
  const offset = [0, 1.25, 2.5, 3.75][k];
  g.set(c, 34, thing({ ...PULL, offset }));
  g.set(c - 3, 34, thing({ ...FIRE, facing: "down", length: 6, on: 2.5, off: 2.5, offset }));
  g.set(c + 3, 34, thing({ ...FIRE, facing: "down", length: 6, on: 2.5, off: 2.5, offset }));
});
[80, 60, 40].forEach((c, k) => g.set(c, 51, thing({ kind: "blob", height: 5, period: 5, offset: [2.2, 3.5, 4.7][k] })));
g.rock(15, 51, 23, 56);
g.set(6, 40, "y");
// A side passage up from the band, with a crystal.
g.air(116, 26, 122, 34);
g.air(116, 26, 130, 29);
g.set(128, 27, "*");

// 6. The swing: down a shaft with magnets in its walls and flames over them, and
//    through the yellow door.
g.air(4, 51, 14, 67);
g.fill(4, 57, 14, 58, "Y");
g.set(3, 64, thing({ ...PULL, offset: 0 }));
g.set(3, 61, thing({ ...FIRE, facing: "right", length: 5, on: 2.5, off: 2.5, offset: 0 }));
g.set(15, 64, thing({ ...PULL, offset: 2.5 }));
g.set(15, 61, thing({ ...FIRE, facing: "left", length: 5, on: 2.5, off: 2.5, offset: 2.5 }));

// ---- Band 3 (bottom), to the right ----
g.air(3, 68, 198, 86);
g.pad("F", 17, 86);
// 7. The tongs: crushers from the roof and the floor that close on each other,
//    and blob pits between.
[30, 50, 70].forEach((c, k) => {
  const offset = [0, 1.67, 3.33][k];
  g.fill(c, 68, c + 3, 71, thing({ ...HAMMER, to: [0, -6], offset }));
  g.fill(c, 83, c + 3, 86, thing({ ...HAMMER, to: [0, 6], offset }));
});
[41, 61].forEach((c, k) => {
  g.fill(c - 1, 87, c + 1, 88, "~");
  g.set(c, 87, thing({ kind: "blob", height: 3, period: 10, offset: [3, 6.3][k] }));
});
g.pad("F", 92, 86);
// 8. The forge pit: fans on islands lift you over lava, blobs rise between them,
//    and shuttles slide across. The green key's up over the middle fan.
g.fill(100, 87, 166, 89, "~");
for (const c of [110, 133, 156]) {
  g.rock(c - 1, 88, c + 1, 89);
  g.set(c - 1, 87, "#").set(c + 1, 87, "#");
  g.set(c, 87, thing({ kind: "fan", facing: "up", length: 16, width: 3, strength: 11 }));
}
[104, 121, 145, 162].forEach((c, k) => g.set(c, 87, thing({ kind: "blob", height: 5, period: 5, offset: [0, 2.5, 1.25, 3.75][k] })));
g.fill(101, 76, 106, 77, thing({ kind: "mover", to: [22, 0], period: 10, offset: 0 }));
g.fill(160, 76, 165, 77, thing({ kind: "mover", to: [-22, 0], period: 10, offset: 5 }));
g.set(127, 73, "g");
// 9. The last run: through the green door, onto switch 1, and through a hammer
//    and a wall of flame to gate 2 before it shuts again.
g.fill(170, 68, 171, 86, "G");
g.pad("1", 174, 86);
g.thing("1", { kind: "switch", opens: 2, time: 15 });
g.fill(181, 68, 184, 71, thing({ ...HAMMER, to: [0, -14], offset: 0 }));
g.set(188, 87, thing({ ...FIRE, facing: "up", length: 19, offset: 2.5 }));
g.fill(191, 68, 192, 86, "2");
g.thing("2", { kind: "gate" });
g.pad("E", 194, 86);

g.roughen(8, 0.3);
const header = `7-8: The world's test: 200 columns of everything above, three keys and a timed gate to the exit.

Three bands, flown right, left and right again, each ending at a key that opens
the door on the way down to the next. Everything runs on a 5 s beat but the
conveyor, which runs on 8.

Sections, in order:
1. Bellows (top): a gust along the band from a pillar, and jets from the floor
   that fire while it rests. A crystal up over the start.
2. The conveyor: platforms over lava that meet end to end, and walls of flame
   where they meet, burning while they're apart. The red key past the far pad.
3. The quench: down a shaft past jets from its walls, through the red door.
4. The anvils (middle): crushers slam down from the roof, with walls of flame
   between. A crystal in a notch under the middle anvil.
5. The crane: a lava lake under magnets that pull you up towards roof flames,
   and blobs that rise when they rest; the yellow key at the far end. A crystal
   up a side passage before the lake.
6. The swing: down a shaft between magnets and flames, through the yellow door.
7. The tongs (bottom): crushers from the roof and the floor that close on each
   other, with blob pits between.
8. The forge pit: fans on islands over lava, blobs and two shuttles; the green
   key up over the middle fan.
9. The last run: through the green door onto switch 1, which opens gate 2 for
   15 s, then under a hammer and through a wall of flame to the gate and the
   exit.`;
await buildLevel("7-8", g, { header, name: "The foundry", fuel: 26, par: 235, route: "F@77 F@173 r F@189 F@108 y F@18 F@93 g 1 E" });
