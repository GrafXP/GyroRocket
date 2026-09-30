import { Grid, buildLevel } from "./grid.js";

const W = 140;
const H = 100;
const g = new Grid(W, H);
// A slow 5 s beat and stalactites that shake for 0.7 s, for a way back in.
// Where the roof is high they shake once you're within 9 m, so they come down
// in front of you, not behind; in the shafts within 7 m, so they come down
// beside you; the long one within 5 m (plain `!`).
const BLOB = { kind: "blob", height: 6, period: 5, warn: 0.8 };
const fall = g.label({ kind: "stalactite", reach: 9, warn: 0.7 });
// Flames across the updraft fire as you come near, and rest 2 s: you cross
// them going up, and the rocket is tall.
const SIDE = { kind: "flame", mode: "near", on: 1, off: 2, warn: 0.5, reach: 5 };

// 1. The gallery, along the top from the start, under a row of stalactites.
g.air(3, 6, 74, 16);
g.pad("S", 5, 16);
[12, 16, 20, 24, 36, 40, 44, 48, 52, 66, 72].forEach((c) => g.set(c, 6, fall));
g.set(32, 7, "!").set(32, 6, "!"); // a longer one
g.air(28, 2, 31, 5); // an alcove over the gallery, with a crystal: the easy one
g.set(29, 3, "*");
g.pad("F", 58, 16);

// 2. The drop: down a shaft, past stalactites under ledges jutting from its
//    walls in turn, and through a plug of crumbling rock.
g.air(66, 17, 74, 50);
const shake = g.label({ kind: "stalactite", reach: 7, warn: 0.7 });
// (Below the plug only on the east wall: from the west one they'd fall beside
// the pad at the foot.)
[22, 39, 46].forEach((r) => g.rock(73, r, 74, r + 1).set(73, r + 2, shake));
g.rock(66, 28, 67, 29).set(67, 30, shake);
g.fill(66, 34, 74, 35, "%");

// 3. The upper deck: west from the foot of the shaft, under more stalactites, to
//    the red key at its end.
g.air(20, 51, 80, 62);
g.pad("F", 68, 62);
[28, 32, 36, 40, 44, 48, 52, 56, 60].forEach((c) => g.set(c, 51, fall));
[21].forEach((c) => g.set(c, 51, fall)); // over the key
g.set(24, 57, "r");

// 4. The lava hall, under the deck: down at its west end, through a crumbling
//    floor, and back east, low over the lava on crumbling bridges, where blobs
//    are thrown up between them and stalactites hang over them, to a pad on an
//    island and the red door at the far end.
g.air(20, 63, 35, 69); // the way down from the deck
g.fill(20, 66, 35, 66, "%");
g.air(20, 70, 128, 83);
g.fill(20, 84, 128, 85, "~");
[
  [38, 46],
  [52, 57],
  [70, 80],
  [86, 94],
  [100, 108],
].forEach(([c0, c1]) => g.fill(c0, 81, c1, 82, "%"));
[32, 49, 67, 83, 97, 110].forEach((c, k) => g.set(c, 84, g.label({ ...BLOB, offset: (k % 2) * 2.5 })));
[40, 44, 55, 73, 77, 89, 103, 107].forEach((c) => g.set(c, 70, fall));
g.rock(59, 80, 65, 85);
g.pad("F", 60, 79);
// A crystal low between two blobs, under a crumbling ledge: the skilful one.
g.fill(88, 76, 92, 76, "%");
g.set(90, 79, "*");
g.fill(112, 70, 113, 83, "R");

// 5. The updraft: up a tall shaft on a fan, past stalactites under ledges and
//    three flames right across it that fire as you come near, with a pad on a
//    ledge halfway and one near the top, under a plug of crumbling rock.
g.air(114, 10, 128, 84);
g.rock(114, 85, 128, 88);
g.set(121, 85, g.label({ kind: "fan", facing: "up", length: 60, width: 7, strength: 7 }));
g.ledge("F", 125, 64, 3, 2);
// (Stalactites on the east wall only below the pad, so none come down on it.)
[70, 50, 34].forEach((r) => g.rock(114, r, 118, r + 1).set(118, r + 2, shake));
g.rock(125, 76, 128, 77).set(125, 78, shake);
g.set(113, 46, g.label({ ...SIDE, facing: "right", length: 15 }));
[58, 28].forEach((r) => g.set(129, r, g.label({ ...SIDE, facing: "left", length: 15 })));
// A pad in a nook near the top, under a plug of crumbling rock.
g.ledge("F", 115, 24, 3, 2);
g.fill(114, 14, 128, 15, "%");

// 6. The way out: west along the top to the exit, under stalactites, with a
//    crystal down a side branch.
g.air(84, 4, 113, 12);
[93, 97, 101, 105, 109].forEach((c) => g.set(c, 4, fall));
g.air(97, 13, 100, 20);
g.set(98, 18, "*");
g.pad("E", 87, 12);

g.roughen(91, 0.3);
const header = `9-1: A wide warm-up: stalactites, crumbling bridges over lava, a fan lifting you up a shaft.

Down from the top left, west to the red key, back east over the lava hall to
its door, and up a fan shaft to the exit. A slow 5 s beat and stalactites
that shake for 0.7 s, as a way back in; where the roof is high they shake
once you're within 9 m, so they come down in front of you, and in the shafts
within 7 m, so they come down beside you.

Sections, in order:
1. The gallery: along the top under a row of stalactites. A crystal in an
   alcove over it.
2. The drop: down a shaft past stalactites under ledges jutting from its walls
   in turn, and through a plug of crumbling rock.
3. The upper deck: west from the pad at the foot of the shaft, under more
   stalactites, to the red key.
4. The lava hall: down at the west end through a crumbling floor and back
   east, low over the lava on crumbling bridges, where blobs are thrown up
   between them and stalactites hang over them, to a pad on an island and the
   red door. A crystal low between two blobs, under a crumbling ledge.
5. The updraft: through the red door and up a tall shaft on a fan, past
   stalactites under ledges and three flames right across it that fire as you
   come near, with a pad on a ledge halfway and one near the top, under a plug
   of crumbling rock.
6. The way out: west along the top under stalactites to the exit. A crystal
   down a side branch.`;
await buildLevel("9-1", g, { header, name: "Tremor", fuel: 24, par: 165, route: "F@59 F@69 r F@61 F@126 F@116 E" });
