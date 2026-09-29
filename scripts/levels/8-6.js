import { Grid, buildLevel } from "./grid.js";

const W = 170;
const H = 96;
const g = new Grid(W, H);
// Vault doors slide shut and open again on a 10 s beat, resting open for 4.5 s
// of it; a magnet by a pad pushes you off it.
const DOOR = { kind: "crusher", rest: 4.5, warn: 0.8, slam: 1.2, hold: 2.3, back: 1.2 };
const PUSH = { kind: "magnet", push: true, strength: 7, range: 10 };

// ---- The way in (top west), and down the shaft past the first vault door ----
g.air(3, 8, 66, 20);
g.pad("S", 6, 20);
g.set(12, 11, "*"); // easy: up by the start
g.air(58, 21, 65, 40);
// The door slides across the shaft from a pocket in its west wall, and back.
g.air(50, 28, 57, 31);
g.fill(50, 28, 57, 31, g.label({ ...DOOR, to: [8, 0], offset: 0 }));

// ---- The outer vault: the red key, and a pad a magnet pushes you off ----
g.air(36, 41, 92, 55);
g.pad("F", 44, 55);
g.set(40, 51, g.label(PUSH));
g.set(88, 48, "r");
g.air(36, 34, 42, 40); // a pocket up in the vault's roof, with a crystal
g.set(39, 36, "*");

// ---- Through the red door, the airlock: two doors coming down from the roof in
// turn, and a pad between them that a magnet pushes you off ----
g.fill(93, 46, 94, 55, "R");
g.air(95, 44, 150, 55);
for (const [c, offset] of [
  [104, 0],
  [126, 5],
]) {
  g.air(c, 30, c + 3, 43);
  g.fill(c, 30, c + 3, 35, g.label({ ...DOOR, to: [0, -14], offset }));
}
g.pad("F", 113, 55);
g.set(116, 43, g.label(PUSH));

// ---- The inner vault: the yellow key up high, under a turret's eye and past a
// flickering beam ----
g.air(135, 18, 165, 55);
g.set(166, 30, g.label({ kind: "turret", range: 40 }));
g.set(134, 36, g.label({ kind: "laser", mode: "cycle", on: 1.5, off: 3.5, warn: 0.6, facing: "right", offset: 0 }));
g.set(150, 23, "y");
g.set(162, 24, "*"); // tucked in the corner by the turret: the skilful one

// ---- Down through the yellow door, and back west under the vaults to the exit ----
g.fill(140, 56, 146, 57, "Y");
g.air(140, 58, 146, 62);
g.air(10, 63, 150, 76);
g.pad("F", 136, 76);
g.set(110, 77, g.label(PUSH));
g.set(96, 62, g.label({ kind: "magnet", strength: 8, range: 14 }));
g.set(80, 62, g.label({ kind: "laser", mode: "cycle", on: 1.5, off: 3.5, warn: 0.6, facing: "down", offset: 2.5 }));
g.set(64, 77, g.label({ kind: "magnet", strength: 8, range: 14 }));
g.pad("E", 16, 76);

g.roughen(6, 0.3);
const header = `8-6: Dark: sliding blocks as vault doors, magnets that hold you off the pads, keys behind both.

Vault doors slide shut and open again on a 10 s beat. Sections, in order:
1. The way in: east from the start, and down a shaft that a vault door slides
   across. A crystal up by the start.
2. The outer vault: a pad that a magnet pushes you off, and the red key at the
   far end. A crystal in a pocket up in the vault's roof.
3. The airlock: through the red door, two doors come down from the roof in turn,
   with a pad between them that a magnet pushes you off.
4. The inner vault: the yellow key up high, past a flickering beam and under a
   turret. A crystal tucked in the corner by the turret.
5. The way out: down through the yellow door, to a pad, then back west under the
   vaults, past magnets pulling up and down and a flickering beam, to the exit.`;
await buildLevel("8-6", g, { header, name: "Strongroom", fuel: 23, par: 115, dark: true, route: "F@45 r F@114 y F@137 E" });
