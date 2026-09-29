import { Grid, buildLevel } from "./grid.js";

const W = 170;
const H = 112;
const g = new Grid(W, H);
// A 5 s beat.
const WALL = { kind: "flame", on: 1.5, off: 3.5, warn: 0.6 };
const BLOB = { kind: "blob", height: 4, period: 5 };
// The beams by the green key, which switch 5 turns off for good.
const beams = g.thing("k", { kind: "laser", mode: "cycle", on: 1.5, off: 3.5, warn: 0.6, facing: "down", offset: 0 });
const switch5 = g.thing("5", { kind: "switch", opens: "k" });

// ---- The hub: the start, a pad, a door in each wall, floor and roof ----
g.air(66, 34, 104, 70);
g.pad("S", 70, 70);
g.pad("F", 96, 70);
g.rock(100, 44, 104, 45); // a shelf with a crystal over it: the easy one
g.set(102, 41, "*");

// ---- West: the red key, out low over blob pools, back high through fire ----
g.air(22, 62, 65, 70);
[32, 46, 58].forEach((c, k) => {
  g.fill(c - 2, 70, c + 2, 71, "~");
  g.set(c, 70, g.label({ ...BLOB, offset: k * 1.67 }));
});
g.air(8, 38, 21, 70);
g.pad("F", 10, 70);
g.set(15, 52, "r");
g.air(22, 38, 65, 46);
[34, 46, 58].forEach((c, k) => g.set(c, 37, g.label({ ...WALL, facing: "down", length: 9, offset: (2 - k) * 1.67 })));
g.air(40, 31, 44, 37); // a nook up from the way back, with a crystal
g.set(42, 33, "*");

// ---- East, through the red door: the yellow key, under presses and past magnets ----
g.fill(105, 62, 106, 70, "R");
g.air(107, 62, 150, 70);
for (const c of [116, 134]) {
  g.air(c, 51, c + 3, 61);
  g.fill(c, 51, c + 3, 56, g.label({ kind: "mover", to: [0, -14], period: 8, offset: c === 116 ? 0 : 4 }));
}
g.air(134, 71, 137, 71); // a notch under the second press, with a crystal: the skilful one
g.set(135, 70, "*");
g.air(151, 38, 165, 70);
g.pad("F", 159, 70);
g.set(158, 52, "y");
g.air(107, 38, 150, 46);
g.set(120, 37, g.label({ kind: "magnet", strength: 8, range: 14 }));
g.set(138, 47, g.label({ kind: "magnet", strength: 8, range: 14 }));

// ---- Down through the yellow door in the hub's floor, to the south hall ----
g.air(82, 71, 88, 75);
g.fill(82, 72, 88, 73, "Y");
g.air(30, 76, 112, 88);
g.pad("F", 92, 88);
// West to the green key: turrets in the roof, beams on the beat, and switch 5,
// which turns the beams off for the way back, and a pad.
const turret = g.label({ kind: "turret", range: 30 });
g.set(66, 75, turret).set(52, 75, turret);
for (const c of [74, 59, 45]) g.set(c, 75, beams);
g.set(35, 82, "g");
g.pad("F", 31, 88);
g.pad(switch5, 39, 88);

// ---- Down through the green door in the south hall's floor, and east under
// falling rock to the blue key ----
g.air(100, 89, 104, 93);
g.fill(100, 90, 104, 91, "G");
g.air(96, 94, 142, 104);
for (const c of [110, 124]) g.fill(c, 94, c, 95, "!");
g.fill(117, 94, 118, 104, "%"); // a wall that gives way
g.pad("F", 130, 104);
g.set(139, 98, "b");

// ---- Up through the blue door in the hub's roof, to the exit ----
g.fill(82, 32, 88, 33, "B");
g.air(80, 16, 90, 31);
g.air(56, 6, 112, 15);
g.pad("E", 104, 15);

g.roughen(3, 0.3);
const header = `8-3: All four keys, hub and spokes; each key's branch has its own mix of hazards, blue opens the exit.

The hub has a door in each wall, floor and roof, and the keys open them in
order. Sections, in order:
1. West, the red key: out low over pools that throw up blobs on the beat, and
   back high through a wave of flame walls. A crystal on a shelf in the hub, and
   another in a nook over the way back.
2. East, through the red door: the yellow key, out under two presses coming down
   from the roof, and back past magnets in the roof and floor. A crystal in a
   notch under the second press.
3. South, through the yellow door in the hub's floor: west under turrets and
   beams flickering on the beat, to the green key and switch 5, which turns the
   beams off for the way back.
4. Down through the green door in the south hall's floor, and east under
   stalactites and through a wall of crumbling rock, to a pad and the blue key.
   What's fallen stays down for the way back.
5. Up through the blue door in the hub's roof, to the exit.`;
await buildLevel("8-3", g, { header, name: "Four keys", fuel: 22, par: 235, route: "F@11 r F@97 F@160 y F@97 F@93 g 5 F@32 F@93 F@131 b F@93 E" });
