import { Grid, buildLevel } from "./grid.js";

const W = 168;
const H = 94;
const g = new Grid(W, H);
// The maze: junction rooms on a 6 × 4 grid, numbered across then down,
//
//    0 ── 1 ── 2    3 ── 4 ── 5
//    │         │    │         │
//    6    7 ── 8 ── 9   10 ── 11
//    │    │              │
//   12 ─ 13   14 ── 15 ─ 16   17
//         │    │         │    │
//   18 ─ 19 ─ 20   21 ─ 22 ─ 23
//
// with the start in 0, the red key at the end of 18, the green key at the end of
// 21, and the exit in 17, up from 23 through the red and green doors. Two ways
// run from the start to 16: along the top and down the east, or down the west and
// along the bottom.
const at = (n) => [14 + 28 * (n % 6), 12 + 24 * Math.floor(n / 6)];
const edges = [
  [0, 1], [1, 2], [3, 4], [4, 5],
  [0, 6], [2, 8], [3, 9], [5, 11],
  [7, 8], [8, 9], [10, 11],
  [6, 12], [7, 13], [10, 16],
  [12, 13], [14, 15], [15, 16],
  [13, 19], [14, 20], [16, 22], [17, 23],
  [18, 19], [19, 20], [21, 22], [22, 23],
];
for (let n = 0; n < 24; n++) {
  const [c, r] = at(n);
  g.air(c - 7, r - 5, c + 7, r + 4);
}
for (const [a, b] of edges) {
  const [[ca, ra], [cb, rb]] = [at(a), at(b)];
  if (ra === rb) g.air(ca, ra - 3, cb, ra + 2);
  else g.air(ca - 3, ra, ca + 3, rb);
}
// A 5 s beat.
const beam = (facing, offset) => g.label({ kind: "laser", mode: "cycle", on: 1.5, off: 3.5, warn: 0.6, facing, offset });
const turret = g.label({ kind: "turret", range: 30 });
const wall = (facing, length, offset) => g.label({ kind: "flame", on: 1.5, off: 3.5, warn: 0.6, facing, length, offset });
// Where a room's floor is, and a pad on it clear of any corridor down.
const floor = (n) => at(n)[1] + 4;
const pad = (ch, n) => g.pad(ch, at(n)[0] + 5, floor(n));

pad("S", 0);
g.set(at(1)[0], at(1)[1] - 3, "*"); // easy: in the room next to the start
// Pads through the maze.
pad("F", 12);
pad("F", 20);
pad("F", 16);
pad("F", 23);
// Turrets in the roofs of the rooms where three ways meet.
for (const n of [8, 13, 16, 19, 22]) g.set(at(n)[0] - 5, at(n)[1] - 6, turret);
// Beams across the corridors into those rooms, on the beat.
{
  const [c, r] = at(13); // across the way down from 13 to 19
  g.set(c - 4, r + 12, beam("right", 0));
}
{
  const [c, r] = at(19); // across the way east from 19 to 20
  g.set(c + 14, r - 4, beam("down", 2.5));
}
{
  const [c, r] = at(15); // across the way east from 15 to 16
  g.set(c + 14, r - 4, beam("down", 0));
}
{
  const [c, r] = at(16); // across the way down from 16 to 22
  g.set(c - 4, r + 12, beam("right", 2.5));
}
{
  const [c, r] = at(9); // across the way down from 3 to 9
  g.set(c - 4, r - 12, beam("right", 1.25));
}
// Walls of flame across the long ways down the west and the east.
{
  const [c, r] = at(6);
  g.set(c - 4, r + 12, wall("right", 7, 0));
  const [c2, r2] = at(10);
  g.set(c2 + 14, r2 - 4, wall("down", 6, 2.5));
}
// The keys at the ends of 18 and 21, and a crystal deep in the maze at the end of
// a stub up from 4.
g.set(at(18)[0] - 4, at(18)[1] - 1, "r");
g.set(at(21)[0] + 3, at(21)[1] - 1, "g");
g.air(at(4)[0] - 3, at(4)[1] - 10, at(4)[0] + 3, at(4)[1] - 5);
g.set(at(4)[0], at(4)[1] - 8, "*");
g.set(at(15)[0], at(15)[1] + 1, "*"); // in 15, between a turret and a beam: the skilful one
// The exit in 17, up from 23 through the red and the green door.
{
  const [c, r] = at(17);
  g.fill(c - 3, r + 9, c + 3, r + 10, "G");
  g.fill(c - 3, r + 15, c + 3, r + 16, "R");
  pad("E", 17);
}

g.roughen(7, 0.3);
const header = `8-7: Dark: a big maze where the map earns its place; lasers and turrets at the crossings, crystals deep in it.

Junction rooms on a 6 × 4 grid, with two ways from the start to the far side: along
the top and down the east, or down the west and along the bottom. The keys and
the exit are at the ends of the dead ends. Sections, in order:
1. Down the west: from the start, past a wall of flame, to a pad. A crystal in the
   room next to the start.
2. The red key: past a turret and a flickering beam into the crossing at the
   bottom west, and out to the end of the passage beyond it.
3. Along the bottom: through the crossing again and a beam, to a pad, then up
   and along to the pad in the east crossing, past a turret and a beam. A
   crystal in the room before it, between the two.
4. The green key: down past a beam to the bottom east crossing, and out to the
   end of the passage west of it.
5. The exit: up from the corner through the green door and the red door. A
   crystal at the end of a stub up from the top of the maze, the long way round.`;
await buildLevel("8-7", g, { header, name: "Labyrinth", fuel: 26, par: 120, dark: true, route: "F@21 r F@77 F@133 g F@161 E" });
