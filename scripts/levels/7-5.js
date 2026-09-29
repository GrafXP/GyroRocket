import { Grid, buildLevel } from "./grid.js";

const W = 170;
const H = 70;
const g = new Grid(W, H);
// A 5 s beat: magnets pull for 2.5 s of it, and the flames by them fire then.
const PULL = { kind: "magnet", strength: 9, range: 18, mode: "cycle", on: 2.5, off: 2.5, warn: 0.5 };
const FIRE = { kind: "flame", on: 2.5, off: 2.5, warn: 0.6 };
const labels = [..."acdehijklmnopqstuwxzACDHIJKLMNOPQTUVWXZ"];
let next = 0;
const thing = (spec) => {
  const key = JSON.stringify(spec);
  const found = Object.entries(g.things).find(([, s]) => JSON.stringify(s) === key);
  return found ? found[0] : g.thing(labels[next++], spec);
};

// The hub: the start, a pad, and the way up to the exit through two doors.
g.air(70, 36, 100, 62);
g.pad("S", 77, 62);
g.ledge("F", 72, 41, 3, 2);
g.set(97, 39, "*"); // easy: up in the hub's corner
g.air(76, 25, 82, 35); // up to the exit, through the red door and the green one
g.fill(76, 32, 82, 33, "R");
g.fill(76, 28, 82, 29, "G");
g.air(66, 6, 98, 24); // the exit room
g.pad("E", 90, 24);
// A push magnet in the floor by the exit pad, and another over it.
g.set(95, 25, thing({ kind: "magnet", push: true, strength: 8, range: 12 }));
g.set(88, 5, thing({ kind: "magnet", push: true, strength: 6, range: 12 }));

// 1. The crane (west): a lava lake under magnets in the roof that pull you up
//    towards flames beside them, while blobs rise from the lava when they rest.
//    The red key's high up at the far end.
g.air(60, 55, 69, 62); // the way from the hub
g.air(8, 44, 59, 63);
g.fill(8, 64, 47, 66, "~");
g.rock(48, 60, 59, 66);
g.pad("F", 52, 59);
g.set(57, 60, thing({ kind: "magnet", push: true, strength: 7, range: 10 })); // guarding the pad
[40, 28, 16].forEach((c, k) => {
  const offset = [0, 1.67, 3.33][k];
  g.set(c, 43, thing({ ...PULL, offset }));
  g.set(c - 3, 43, thing({ ...FIRE, facing: "down", length: 5, offset }));
  g.set(c + 3, 43, thing({ ...FIRE, facing: "down", length: 5, offset }));
});
[44, 34, 22, 12].forEach((c, k) => g.set(c, 64, thing({ kind: "blob", height: 5, period: 5, offset: [0.2, 2, 3.7, 0.2][k] })));
g.set(10, 46, "r");
// The way back: up through the roof at the far end and along a quiet tunnel.
g.air(8, 30, 13, 43);
g.air(8, 30, 69, 35);
g.air(62, 36, 69, 38);
// A side room off the tunnel, with a crystal.
g.air(38, 22, 48, 29);
g.set(46, 24, "*");

// 2. The swing (east): up a shaft with magnets in its walls that pull you from
//    side to side, each with a flame over it that fires while it pulls. The green
//    key's at the top.
g.air(101, 55, 112, 62);
g.air(113, 8, 125, 62);
g.pad("F", 115, 62);
[56, 46, 36, 26].forEach((r, k) => {
  const right = k % 2 === 1;
  const offset = right ? 2.5 : 0;
  g.set(right ? 126 : 112, r, thing({ ...PULL, offset }));
  g.set(right ? 126 : 112, r - 3, thing({ ...FIRE, facing: right ? "left" : "right", length: 5, offset }));
});
g.set(120, 10, "g");
// A crystal in a nook behind the top right magnet: the skilful one.
g.air(126, 48, 130, 51);
g.air(127, 47, 130, 52);
g.set(129, 50, "*");
// The way back: along the top, past a pad a push magnet guards, and down a
// second shaft into the hub.
g.air(101, 8, 112, 13);
g.pad("F", 108, 13);
g.set(104, 7, thing({ kind: "magnet", push: true, strength: 7, range: 10 }));
g.air(101, 14, 106, 40);
g.air(99, 36, 100, 40);

g.roughen(9, 0.3);
const header = `7-5: Magnets pull you out over lava and towards the flames; push magnets guard the pads; two keys.

The exit is up from the hub, behind a red door and a green one. Everything runs
on a 5 s beat: the magnets pull for half of it, and the flames by them fire then.

Sections, in order:
1. The hub: the start, a pad on a ledge, and the doors. A crystal up in its
   corner.
2. The crane (west): a lava lake under magnets in the roof that pull you up
   towards flames beside them, while blobs rise from the lava when they rest.
   A push magnet guards the pad at the near end, and the red key is high up at
   the far end. Back to the hub up through the roof and along a quiet tunnel,
   with a crystal in a side room.
3. The swing (east): up a shaft with magnets in its walls that pull you from
   side to side, each with a flame over it that fires while it pulls, to the
   green key. A crystal in a nook behind the top right magnet.
4. The way out: along the top past a pad a push magnet guards, down a second
   shaft into the hub, through the doors, and onto the exit, which push magnets
   guard too.`;
await buildLevel("7-5", g, { header, name: "Magnet crane", fuel: 24, par: 95, route: "F@53 r F@73 F@116 g F@109 E" });
