import { Grid, buildLevel } from "./grid.js";

const W = 160;
const H = 90;
const g = new Grid(W, H);
// A slow 5 s beat, for a way back in.
const WALL = { kind: "flame", on: 1.5, off: 3.5, warn: 0.8 };
const BEAM = { kind: "laser", mode: "cycle", on: 1.5, off: 3.5, warn: 0.8 };

// The hub: a tall hall, the start on its floor, the red door in its east wall,
// the yellow door in its roof, and a hole in its floor down to the cellar.
g.air(60, 30, 100, 68);
g.pad("S", 64, 68);
g.pad("F", 86, 68);
g.air(76, 69, 82, 73); // the hole down to the cellar
// A shelf up the west wall with a crystal over it: the easy one.
g.rock(60, 46, 63, 47);
g.set(61, 43, "*");

// The west passage, out of the hub low down, with walls of flame across it on the beat.
g.air(26, 58, 59, 68);
[48, 38].forEach((c, k) => g.set(c, 57, g.label({ ...WALL, facing: "down", length: 11, offset: k * 2.5 })));
// A side nook up from its roof, with a crystal.
g.air(29, 50, 34, 57);
g.set(31, 52, "*");
g.air(26, 69, 33, 73); // down to the cellar

// The cellar, under it all: a press comes down from the roof, a beam flickers
// across, and the red key waits at the west end.
g.air(6, 74, 82, 84);
g.air(46, 70, 51, 73); // the press's pocket
g.fill(46, 70, 51, 73, g.label({ kind: "mover", to: [0, -6], period: 10, offset: 0 }));
g.set(18, 73, g.label({ ...BEAM, facing: "down", offset: 0 }));
g.set(8, 80, "r");
g.pad("F", 13, 84);

// The red door, and the strongbox behind it: a gallery with pillars to hide
// behind from the turret at its far end, the yellow key on a shelf, and switch 1,
// which opens gate 2 up to the way back.
g.fill(101, 58, 102, 68, "R");
g.air(103, 45, 154, 68);
g.rock(117, 55, 120, 68);
g.rock(133, 51, 136, 68);
g.set(155, 50, g.label({ kind: "turret", range: 36, windup: 0.8 }));
g.rock(145, 50, 152, 51);
g.set(149, 47, "y");
g.pad(g.thing("1", { kind: "switch", opens: "2" }), 140, 68);
g.pad("F", 146, 68);
g.fill(144, 41, 149, 44, g.thing("2", { kind: "gate" }));

// The way back: a passage over the strongbox, west into the hub high up, with a
// beam across it, to a pad on a ledge in the hub.
g.air(101, 32, 150, 40);
g.set(125, 31, g.label({ ...BEAM, facing: "down", offset: 2.5 }));
g.ledge("F", 93, 40);

// The yellow door in the hub's roof, the shaft up with walls of flame across it,
// and the exit.
g.fill(78, 28, 84, 29, "Y");
g.air(76, 9, 86, 27);
[23, 16].forEach((r, k) => g.set(75, r, g.label({ ...WALL, facing: "right", length: 11, offset: k * 2.5 })));
g.air(87, 18, 90, 21); // a nook between the walls of flame, with a crystal: the skilful one
g.set(89, 19, "*");
g.air(64, 2, 108, 8);
g.pad("E", 100, 8);

g.roughen(8, 0.3);
const header = `8-1: A lit warm-up: a hub with three doors off it, two keys, and pads at the hub.

Sections, in order:
1. The cellar: down through the hole in the hub's floor, under a press that
   comes down from the roof and a beam that flickers across, to a pad and the red key at
   the west end; back up the west passage, through walls of flame on the beat.
   A crystal on a shelf in the hub, another in a nook over the west passage.
2. The strongbox: through the red door, past a turret at the far end, from the
   cover of one pillar to the next, to the yellow key, a pad, and switch 1.
3. The way back: switch 1 opens gate 2 up to a passage over the strongbox, under
   a flickering beam, into the hub high up.
4. The way out: through the yellow door in the hub's roof, up a shaft through
   walls of flame, to the exit. A crystal in a nook between the flames.`;
await buildLevel("8-1", g, { header, name: "Antechamber", fuel: 21, par: 125, route: "F@14 r F@87 y F@147 1 F@95 E" });
