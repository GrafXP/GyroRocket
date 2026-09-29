import { Grid, buildLevel } from "./grid.js";

const W = 164;
const H = 64;
const g = new Grid(W, H);
// The world's beat here: 5 s, the bellows blowing for 2.5 of it, the jets firing
// for the other 2.5.
const GUST = { mode: "cycle", on: 2.5, off: 2.5, warn: 0.5, offset: 0 };
const JET = { on: 2.5, off: 2.5, warn: 0.6, offset: 2.5 };

// 1. The bellows: a tunnel with a gust along it, and jets up from the floor
//    that fire while it rests.
g.air(3, 34, 22, 44); // the start room, over the tunnel
g.pad("S", 5, 44);
g.air(3, 30, 8, 33);
g.set(5, 31, "*"); // easy: up in the start room's corner
g.air(12, 45, 20, 45); // the way down
g.air(10, 46, 76, 56); // the tunnel
g.set(9, 51, g.thing("a", { kind: "fan", facing: "right", length: 40, width: 11, strength: 7, ...GUST }));
[24, 34, 44].forEach((c) => g.set(c, 57, g.thing("c", { kind: "flame", facing: "up", length: 11, ...JET })));
g.pad("F", 55, 56);

// 2. The updraft: a shaft with a bellows under it, lifting you while it blows,
//    and jets across it from the walls while it rests.
g.air(66, 6, 74, 45);
g.set(70, 57, g.thing("d", { kind: "fan", facing: "up", length: 60, width: 9, strength: 13, ...GUST }));
g.set(65, 38, g.thing("e", { kind: "flame", facing: "right", length: 9, ...JET }));
g.set(75, 28, g.thing("h", { kind: "flame", facing: "left", length: 9, ...JET }));
g.set(65, 18, "e");
// A crystal in a nook between two jets: the skilful one.
g.air(75, 21, 80, 25);
g.set(78, 23, "*");

// 3. The headwind: a gallery along the top, a bellows blowing against you from
//    the far end, and roof and floor jets over lava that fire while it rests.
g.air(28, 4, 152, 14);
g.pad("F", 78, 14);
g.set(153, 9, g.thing("i", { kind: "fan", facing: "left", length: 60, width: 11, strength: 5, ...GUST }));
[96, 112, 128].forEach((c) => g.set(c, 3, g.thing("j", { kind: "flame", facing: "down", length: 6, ...JET })));
[104, 120, 136].forEach((c) => g.set(c, 15, g.thing("k", { kind: "flame", facing: "up", length: 6, ...JET })));
g.fill(99, 15, 101, 16, "~");
g.fill(115, 15, 117, 16, "~");
g.set(100, 15, g.thing("1", { kind: "blob", height: 5, period: 5, offset: 1.25 }));
g.set(116, 15, "1");
// Behind you as you come up: a quiet side gallery with a crystal at its end.
g.set(31, 9, "*");
g.pad("2", 140, 14);
g.thing("2", { kind: "switch", opens: 3 });

// 4. The tailwind: down the far shaft, then back along the middle with a gust
//    behind you, across floor jets and blobs, to the gate and the exit.
g.air(145, 15, 152, 24);
g.air(84, 24, 158, 38);
g.pad("F", 146, 38);
g.set(159, 31, g.thing("l", { kind: "fan", facing: "left", length: 50, width: 11, strength: 6, ...GUST }));
[134, 124, 114].forEach((c) => g.set(c, 39, g.thing("m", { kind: "flame", facing: "up", length: 7, ...JET })));
g.fill(128, 39, 130, 40, "~");
g.fill(118, 39, 120, 40, "~");
g.set(129, 39, g.thing("4", { kind: "blob", height: 4, period: 5, offset: 1.25 }));
g.set(119, 39, "4");
g.fill(98, 24, 99, 38, g.thing("3", { kind: "gate" }));
g.pad("E", 89, 38);

g.roughen(11, 0.3);
const header = `7-2: Fans that switch on and off blow across flame jets: ride the gust while the flame rests.

Every bellows here blows for 2.5 s and rests for 2.5, and every jet fires while
they rest.

Sections, in order:
1. The bellows: drop from the start into a tunnel with a gust along it, over
   three jets from the floor. A crystal up in the start room's corner.
2. The updraft: a shaft with a bellows under it that lifts you while it blows,
   and jets across it from the walls. A crystal in a nook between two jets.
3. The headwind: along the top, into a gust from the far end, past roof and
   floor jets and blobs over lava, to switch 2, which opens gate 3 for good.
   A crystal at the end of the quiet gallery behind you as you come up.
4. The tailwind: down the far shaft, and back along the middle with a gust
   behind you, over floor jets and blobs, to gate 3 and the exit.`;
await buildLevel("7-2", g, { header, name: "Bellows", fuel: 24, par: 100, route: "F@56 F@79 2 F@147 E" });
