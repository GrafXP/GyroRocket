import { Grid, buildLevel } from "./grid.js";

const W = 200;
const H = 120;
const g = new Grid(W, H);
// A 5 s beat, and vault doors on 10 s.
const FLICKER = { kind: "laser", mode: "cycle", on: 1.5, off: 3.5, warn: 0.6 };
const WALL = { kind: "flame", on: 1.5, off: 3.5, warn: 0.6 };
const DOOR = { kind: "crusher", rest: 4.5, warn: 0.8, slam: 1.2, hold: 2.3, back: 1.2 };
const PUSH = { kind: "magnet", push: true, strength: 7, range: 10 };
const PULL = { kind: "magnet", strength: 8, range: 14 };
// The switches, and what they work: 1 and 2 turn beams off for good, 3 opens the
// last gate for a while.
const alarm = g.thing("a", { kind: "laser", facing: "down" });
const maze = g.thing("c", { kind: "laser", facing: "right" });
const switch1 = g.thing("1", { kind: "switch", opens: "a" });
const switch2 = g.thing("2", { kind: "switch", opens: "c" });
const switch3 = g.thing("3", { kind: "switch", opens: "4", time: 22 });
const gate4 = g.thing("4", { kind: "gate" });
const turret = g.label({ kind: "turret", range: 44 });

// ---- Band 1 (top), east: the alarm, then the watch hall ----
g.air(3, 12, 24, 26);
g.pad("S", 6, 26);
g.set(12, 15, "*"); // easy: up by the start
// Switch 1, up and along a passage through a wall of flame.
g.air(18, 4, 24, 11);
g.air(18, 4, 46, 10);
g.set(33, 3, g.label({ ...WALL, facing: "down", length: 7, offset: 0 }));
g.pad(switch1, 42, 10);
// The beams it turns off, across the low way on to the red vault.
g.air(25, 18, 45, 26);
for (const c of [32, 36, 40]) g.set(c, 17, alarm);
g.air(46, 12, 60, 26);
g.pad("F", 48, 26);
g.set(55, 17, "r");
g.fill(61, 18, 62, 26, "R");
// The watch hall: turrets in the roof, pillars with caps to shelter under.
g.air(63, 4, 150, 26);
for (const c of [93, 115, 137]) g.set(c, 3, turret);
for (const c of [82, 104, 126]) {
  g.rock(c - 1, 17, c + 1, 26);
  g.rock(c - 6, 15, c + 6, 16);
}
g.pad("F", 98, 26);
g.set(104, 12, "*"); // on top of a cap, in the turrets' sight: the skilful one
g.set(146, 9, "y");
// Down through the yellow door at the hall's east end.
g.air(140, 27, 146, 33);
g.fill(140, 29, 146, 30, "Y");

// ---- Band 2, west: the airlock and the inner vault ----
g.air(140, 34, 170, 56);
g.pad("F", 150, 56);
g.set(155, 57, g.label(PUSH));
g.air(100, 44, 139, 56);
for (const [c, offset] of [
  [132, 0],
  [112, 5],
]) {
  g.air(c, 30, c + 3, 43);
  g.fill(c, 30, c + 3, 36, g.label({ ...DOOR, to: [0, -20], offset }));
}
g.air(70, 34, 99, 56);
g.set(76, 38, "g");
g.set(84, 33, turret);
g.set(96, 33, g.label({ ...FLICKER, facing: "down", offset: 0 }));
g.fill(68, 46, 69, 56, "G");
g.air(30, 46, 67, 56);
g.pad("F", 40, 56);
g.set(52, 57, g.label(PULL));
g.air(30, 57, 37, 65); // down to band 3

// ---- Band 3, east: a small maze, with the blue key and switch 2 ----
//   A0 ── A1    A2 ── A3
//   │     │     │     │
//   B0    B1 ── B2    B3
const room = (i, j) => [40 + 30 * i, 70 + 18 * j];
for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
  const [c, r] = room(i, j);
  g.air(c - 8, r - 4, c + 8, r + 4);
}
const way = ([i0, j0], [i1, j1]) => {
  const [[c0, r0], [c1, r1]] = [room(i0, j0), room(i1, j1)];
  if (r0 === r1) g.air(c0, r0 - 2, c1, r0 + 3);
  else g.air(c0 - 3, r0, c0 + 3, r1);
};
way([0, 0], [1, 0]);
way([2, 0], [3, 0]);
way([0, 0], [0, 1]);
way([1, 0], [1, 1]);
way([1, 1], [2, 1]);
way([2, 1], [2, 0]);
way([3, 0], [3, 1]);
g.set(room(0, 1)[0] - 3, room(0, 1)[1], "b");
g.pad("F", room(1, 0)[0] + 5, room(1, 0)[1] + 4);
g.set(room(1, 1)[0] - 4, room(1, 1)[1] - 5, turret);
g.set(room(2, 0)[0] - 4, room(2, 0)[1] - 5, turret);
g.set(room(1, 1)[0] + 15, room(1, 1)[1] - 3, g.label({ ...FLICKER, facing: "down", offset: 2.5 }));
g.set(room(2, 0)[0] + 15, room(2, 0)[1] - 3, g.label({ ...FLICKER, facing: "down", offset: 0 }));
g.pad("F", room(2, 1)[0] + 5, room(2, 1)[1] + 4);
g.pad(switch2, room(3, 1)[0] - 1, room(3, 1)[1] + 4);
g.air(room(2, 0)[0] - 2, room(2, 0)[1] - 11, room(2, 0)[0] + 2, room(2, 0)[1] - 5); // a stub up, with a crystal
g.set(room(2, 0)[0], room(2, 0)[1] - 9, "*");
// Out of the maze east, past the beams switch 2 turns off, and down to band 4.
g.air(137, 84, 160, 92);
g.air(153, 93, 160, 99);
g.set(152, 96, maze);

// ---- Band 4 (bottom), west: the blue door, switch 3 and the last gate ----
g.air(20, 100, 190, 116);
g.pad("F", 168, 116);
g.fill(150, 100, 151, 116, "B");
g.pad(switch3, 140, 116);
g.set(128, 99, g.label({ ...FLICKER, facing: "down", offset: 0 }));
g.set(112, 117, g.label(PULL));
g.set(116, 99, g.label({ ...FLICKER, facing: "down", offset: 3 }));
g.fill(100, 100, 101, 116, gate4);
g.pad("F", 60, 116);
// ---- The way out: up a shaft through walls of flame, to the exit ----
g.air(20, 72, 27, 99);
[94, 86, 78].forEach((r, k) => g.set(19, r, g.label({ ...WALL, facing: "right", length: 8, offset: k * 2.5 })));
g.air(6, 64, 27, 71);
g.pad("E", 10, 71);

g.roughen(8, 0.3);
const header = `8-8: The world's test, dark: four keys, three switches, lasers, turrets and magnets, and a last timed gate.

A section from each level before it, in four bands. Sections, in order:
1. The alarm: beams bar the low way to the red vault; switch 1 that turns them
   off for good is up and along a passage through a wall of flame. A pad and the
   red key in the vault. A crystal up by the start.
2. The watch hall: through the red door, under three turrets in the roof, from
   the shelter of one pillar's cap to the next, to the yellow key in the far
   corner. A pad under the middle cap, and a crystal on top of it.
3. The airlock: down through the yellow door to a pad that a magnet pushes you
   off, then west through two vault doors that come down from the roof in turn.
4. The inner vault: the green key up high under a turret, past a flickering
   beam; through the green door to a pad by a magnet.
5. The maze: down into a small maze with turrets and beams at its crossings,
   two pads, the blue key at the end of one dead end and switch 2 at the end of
   another. A crystal up a stub off the maze.
6. Switch 2 turned off the beam on the way out of the maze: down to a pad, and
   through the blue door onto switch 3.
7. The last gate: switch 3 opens gate 4 for 22 s, past two flickering beams and
   a magnet in the floor, to a pad beyond it.
8. The way out: up a shaft through three walls of flame, to the exit.`;
await buildLevel("8-8", g, { header, name: "The vaults", fuel: 24, par: 260, dark: true, route: "1 F@49 r F@99 y F@151 g F@41 b F@76 F@106 2 F@169 3 F@61 E" });
