import { Grid, buildLevel } from "./grid.js";

const W = 180;
const H = 60;
const g = new Grid(W, H);
const BEAT = 8; // s: every platform goes and comes back once a beat

// The start, up on the left.
g.air(3, 3, 24, 12);
g.pad("S", 6, 12);
g.set(21, 5, "*"); // easy: up in the start room

// 1. Shutters: down a shaft that shutters slam across from pockets in its
//    walls, one after another, on a 6 s beat.
g.air(13, 13, 23, 30);
const SHUT = { kind: "crusher", rest: 3.45, warn: 0.6, slam: 0.25, hold: 0.5, back: 1.2 };
g.fill(2, 17, 12, 18, g.thing("a", { ...SHUT, to: [11, 0], offset: 0 }));
g.fill(24, 22, 34, 23, g.thing("c", { ...SHUT, to: [-11, 0], offset: 2 }));
g.fill(2, 27, 12, 28, g.thing("o", { ...SHUT, to: [11, 0], offset: 4 }));

// 2. The conveyor: a lava hall with platforms that slide along it, each meeting
//    the next at the end of its run, and walls of flame from the lava where they
//    meet, which burn while they're apart. Ride and hop, or fly and time them.
g.air(13, 31, 137, 48);
g.fill(26, 44, 128, 49, "~");
g.rock(13, 41, 25, 49);
g.pad("F", 17, 40);
g.rock(129, 41, 137, 49);
g.pad("F", 131, 40);
// Platforms, 6 wide: each runs 14 to the right and back, meeting the next one at
// its far end, half a beat out from it.
const plats = ["d", "e"];
[27, 47, 67, 87, 107].forEach((c, k) => {
  const ch = g.thing(plats[k % 2], { kind: "mover", to: [14, 0], period: BEAT, offset: (k % 2) * (BEAT / 2) });
  g.fill(c, 41, c + 5, 41, ch);
});
// Walls of flame where they meet, off while two platforms meet there (at 4 s into
// the beat for the first, 0 for the next), on for 3 s while they're apart.
const walls = ["h", "i"];
[46, 66, 86, 106].forEach((c, k) => g.set(c, 44, g.thing(walls[k % 2], { kind: "flame", facing: "up", length: 14, on: 3, off: 5, warn: 0.8, offset: (k % 2 ? 5.5 : 1.5) })));
// A crystal on a rock in the lava, under a platform's run: the skilful one.
g.rock(56, 43, 58, 43);
g.set(57, 42, "*");

// 3. The pools: up the right, over terraces of blob pools, with an updraft.
g.air(138, 14, 176, 44);
g.air(164, 10, 176, 13);
g.set(160, 45, g.thing("j", { kind: "fan", facing: "up", length: 35, width: 5, strength: 8 }));
g.rock(138, 38, 150, 44); // lower terrace
g.fill(141, 38, 148, 38, "~");
g.set(144, 38, g.thing("1", { kind: "blob", height: 5, period: 4, offset: 0 }));
g.rock(166, 30, 176, 44); // middle terrace
g.fill(168, 30, 175, 30, "~");
g.set(171, 30, g.thing("2", { kind: "blob", height: 5, period: 4, offset: 2 }));
g.rock(138, 22, 152, 26); // upper terrace
g.fill(141, 22, 149, 22, "~");
g.set(145, 22, "1");
g.ledge("F", 168, 18, 3, 3);


// 4. Pistons: back along the top, through blocks that rise and fall across the
//    corridor, to the yellow door and the exit.
g.air(30, 1, 176, 9);
g.set(172, 5, "y");
const up = ["k", "l"];
const PISTON = { kind: "crusher", to: [0, -5], rest: 3, warn: 0.6, slam: 0.25, hold: 0.5, back: 1.15 };
[150, 136, 122].forEach((c, k) => g.fill(c, 1, c + 3, 4, g.thing(up[k % 2], { ...PISTON, offset: (k % 2) * 2.75 })));
g.pad("F", 104, 9);
[88, 74, 60].forEach((c, k) => g.fill(c, 1, c + 3, 4, g.thing(up[k % 2], { ...PISTON, offset: (k % 2) * 2.75 })));
g.set(29, 5, g.thing("m", { kind: "fan", facing: "right", length: 20, width: 9, strength: 5, mode: "cycle", on: 2.5, off: 2.5, warn: 0.5 }));
g.fill(46, 1, 47, 9, "Y");
g.pad("E", 36, 9);
// A side room off the top corridor with a crystal.
g.air(108, 10, 118, 20);
g.air(110, 21, 116, 23);
g.set(113, 22, "*");

g.roughen(5, 0.3);
const header = `7-3: Ride moving blocks through a hall of lava blobs and flamethrowers; a pad at each end.

Sections, in order:
1. Shutters: down from the start through shutters that slam across the shaft
   from pockets in its walls, one after another. A crystal up in the start
   room.
2. The conveyor: a lava hall where five platforms slide back and forth, each
   meeting the next at the end of its run. Walls of flame rise from the lava
   where they meet, and burn while they're apart: ride and hop, or fly and time
   them. A crystal on a rock in the lava, under the second platform's run.
3. The pools: up past terraces of blob pools, with an updraft beside them, to a
   pad and the yellow key.
4. Pistons: back along the top, under pistons that slam down across the
   corridor, past a pad, into a gust, to the yellow door and the exit.
   A crystal in a side room below the pad.`;
await buildLevel("7-3", g, { header, name: "Conveyor", fuel: 26, par: 140, route: "F@18 F@132 F@169 y F@105 E" });
