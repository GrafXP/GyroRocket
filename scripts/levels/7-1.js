import { Grid, buildLevel } from "./grid.js";

const W = 150;
const H = 70;
const g = new Grid(W, H);
const SLOW = { on: 1.5, off: 3, warn: 0.8 };

// Bottom band: the start shelf, the lava lake, the far shore.
g.air(2, 46, 20, 56); // start shelf
g.pad("S", 6, 56);
g.air(21, 44, 92, 60); // the lake
g.fill(21, 61, 92, 63, "~");
// Fans on islands in the lake: a lift over the lava.
const fan = g.thing("a", { kind: "fan", facing: "up", length: 16, width: 3, strength: 11 });
for (const c of [38, 58, 78]) {
  g.rock(c - 1, 62, c + 1, 63);
  g.set(c, 61, fan).set(c - 1, 61, "#").set(c + 1, 61, "#");
}
// Blobs between them.
[28, 48, 68, 88].forEach((c, i) => g.set(c, 61, g.thing(String(i + 1), { kind: "blob", height: 4, period: 5, offset: i * 1.25 })));
g.set(52, 45, "*"); // over the middle fan: easy to see, a little climb
// The far shore, and the pad.
g.air(93, 44, 146, 58);
g.pad("F", 99, 58);
g.rock(93, 59, 146, 63);
// A side cave under the shore, with a crystal.
g.air(108, 59, 113, 62);
g.air(108, 62, 128, 66);
g.set(125, 64, "*");

// The chimney: slow jets across it from both walls, and a draught up it.
g.air(136, 18, 144, 43);
g.set(140, 59, g.thing("h", { kind: "fan", facing: "up", length: 40, width: 5, strength: 6 }));
g.air(138, 44, 142, 58);
const cf = [
  ["c", "right", 135, 38, 0],
  ["d", "left", 145, 32, 1.5],
  ["e", "right", 135, 26, 3],
];
for (const [ch, facing, c, r, offset] of cf) g.set(c, r, g.thing(ch, { kind: "flame", facing, length: 9, ...SLOW, offset }));
// A crystal in a nook just over the middle flame: the skilful one.
g.air(145, 27, 148, 31);
g.set(147, 29, "*");

// Top band: the gallery, right to left.
g.air(4, 4, 145, 17);
g.pad("F", 128, 17);
// A roof wave of flames over two blob pools.
const wave = ["i", "j", "k", "l", "m", "n"];
[112, 108, 104, 100, 96, 92].forEach((c, k) => g.set(c, 3, g.thing(wave[k], { kind: "flame", facing: "down", length: 7, ...SLOW, offset: k * 0.5 })));
g.fill(95, 18, 101, 19, "~");
g.fill(103, 18, 109, 19, "~");
g.set(98, 18, g.thing("5", { kind: "blob", height: 4, period: 4.5, offset: 0 }));
g.set(106, 18, g.thing("6", { kind: "blob", height: 4, period: 4.5, offset: 2.25 }));
g.pad("F", 62, 17);
// Past the pad: floor flames in a slow wave, and blobs between.
const up = ["o", "p", "q"];
[44, 36, 28].forEach((c, k) => g.set(c, 18, g.thing(up[k], { kind: "flame", facing: "up", length: 14, ...SLOW, offset: k * 1.5 })));
g.fill(39, 18, 41, 19, "~");
g.set(40, 18, g.thing("7", { kind: "blob", height: 3, period: 4.5, offset: 0.75 }));
g.fill(31, 18, 33, 19, "~");
g.set(32, 18, g.thing("8", { kind: "blob", height: 3, period: 4.5, offset: 2.25 }));
// The red key at the far end, in a nook.
g.set(6, 10, "r");

// The left shaft down to the middle band.
g.air(4, 18, 12, 24);

// Middle band: back right, to the red door and the exit.
g.air(4, 24, 128, 38);
g.pad("F", 36, 38);
// A headwind that comes and goes, and floor flames to be blown into.
const fw = ["s", "t", "u", "w"];
[60, 70, 80, 90].forEach((c, k) => g.set(c, 39, g.thing(fw[k], { kind: "flame", facing: "up", length: 15, ...SLOW, offset: k * 1.1 })));
g.set(129, 31, g.thing("x", { kind: "fan", facing: "left", length: 40, width: 7, strength: 5, mode: "cycle", on: 2.25, off: 2.25 }));
g.fill(112, 24, 113, 38, "R");
g.pad("E", 120, 38);

g.roughen(7, 0.3);
const header = `7-1: A wide warm-up: fans lift you over a lava lake, slow flamethrowers, a red key and door.

Sections, in order:
1. The lake (bottom, left to right): three fans lift you over a lava lake, and
   blobs rise slowly between them. A crystal floats over the middle fan, and
   another is in a side cave under the far shore.
2. The chimney (up the right): a draught up the shaft and slow jets across it
   from both walls, taking turns. A crystal in a nook just over the middle one.
3. The gallery (top, right to left): a slow wave of roof flames over two blob
   pools, then walls of flame and blobs taking turns, and the red key at the end.
4. The run home (middle, left to right): walls of flame from floor to roof in a
   slow wave, and a headwind on the same beat, to the red door and the exit.`;
await buildLevel("7-1", g, { header, name: "Cold start", fuel: 24, par: 145, route: "F@100 F@129 F@63 r F@37 E" });
