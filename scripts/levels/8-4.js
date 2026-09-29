import { Grid, buildLevel } from "./grid.js";

const W = 190;
const H = 84;
const g = new Grid(W, H);
// A 5 s beat.
const FLICKER = { kind: "laser", mode: "cycle", on: 1.5, off: 3.5, warn: 0.6 };
const WALL = { kind: "flame", on: 1.5, off: 3.5, warn: 0.6 };
const switch6 = g.thing("6", { kind: "switch", opens: "7", time: 16 });
const gate7 = g.thing("7", { kind: "gate" });

// ---- The gatehouse (west): a flickering beam, then a pad ----
g.air(3, 56, 33, 72);
g.pad("S", 6, 72);
g.set(10, 59, "*"); // easy: up in the gatehouse
g.set(20, 55, g.label({ ...FLICKER, facing: "down", offset: 0 }));
g.pad("F", 28, 72);

// ---- The watch hall: turrets in the roof, and pillars with caps to shelter under ----
g.air(34, 38, 150, 72);
const turret = g.label({ kind: "turret", range: 60 });
for (const c of [71, 97, 123]) g.set(c, 37, turret);
for (const c of [58, 84, 110, 136]) {
  g.rock(c - 1, 58, c + 1, 72); // the stem
  g.rock(c - 7, 56, c + 7, 57); // the cap
}
g.pad("F", 51, 72);
g.pad("F", 103, 72);
g.set(84, 53, "*"); // on top of a cap, in the turrets' sight: the skilful one
g.air(90, 73, 95, 78); // a pit in the floor between pillars, with a crystal
g.set(92, 76, "*");
g.air(144, 62, 149, 70); // the red key in a nook in the east wall
g.set(147, 66, "r");

// ---- Up through the red door at the hall's east end ----
g.air(140, 31, 146, 37);
g.fill(140, 34, 146, 35, "R");
// ---- The gallery over the hall, back west: switch 6 opens gate 7 for 16 s, past
// magnets and a wall of flame ----
g.air(40, 18, 150, 30);
g.pad("F", 147, 30);
g.pad(switch6, 130, 30);
g.set(116, 17, g.label({ kind: "magnet", strength: 8, range: 14 }));
g.set(104, 31, g.label({ kind: "magnet", strength: 8, range: 14 }));
g.set(90, 17, g.label({ ...WALL, facing: "down", length: 13, offset: 0 }));
g.fill(76, 18, 77, 30, gate7);
// ---- Beyond the gate, the exit ----
g.pad("E", 46, 30);

g.roughen(4, 0.3);
const header = `8-4: Dark: turrets watch a big hall, and you hop from one rock pillar's cover to the next.

Sections, in order:
1. The gatehouse: under a flickering beam, to a pad. A crystal up in the
   gatehouse.
2. The watch hall: three turrets in the roof, and four pillars with wide caps
   to shelter under; pads under the first and third. The red key in a nook at
   the far end. A crystal on top of the second pillar's cap, in the turrets'
   sight, and another in a pit in the floor.
3. Up through the red door at the hall's east end, to a pad.
4. The gallery, back west over the hall: switch 6 opens gate 7 for 16 s, and the
   way there is past magnets in the roof and floor and a wall of flame on the beat.
5. Through the gate to the exit.`;
await buildLevel("8-4", g, { header, name: "Night watch", fuel: 23, par: 100, dark: true, route: "F@29 F@52 F@104 r F@148 6 E" });
