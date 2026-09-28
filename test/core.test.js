import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLevel, TILE, isSolid, CRUMBLE } from "../src/sim/level.js";
import { buildOutline, solidAt, tileSolid } from "../src/sim/outline.js";
import { createWorld, step, restart } from "../src/sim/world.js";
import { TICK_RATE, CENTRE_Y, HULL } from "../src/sim/rocket.js";
import { shaking, below } from "../src/sim/hazards/stalactite.js";
import { crackAt, CASCADE } from "../src/sim/hazards/crumble.js";
import { rising } from "../src/sim/hazards/rise.js";

const lvl = (map, settings = {}) => parseLevel({ name: "core", map, ...settings });
const run = (w, input, ticks) => {
  for (let i = 0; i < ticks; i++) step(w, input);
  return w;
};
// Keeps the rocket still at (x, y) for `ticks`, or until it's gone.
const hold = (w, x, y, ticks) => {
  for (let i = 0; i < ticks && w.rocket.state !== "crashed"; i++) {
    Object.assign(w.rocket, { x, y, vx: 0, vy: 0, angle: 0, state: "flying" });
    step(w, {});
  }
  return w;
};
// Puts the rocket just above a pad, coming down gently, and lets it land.
const land = (w, pad) => {
  Object.assign(w.rocket, { x: (pad.x0 + pad.x1) / 2, y: pad.y + CENTRE_Y + 0.3, vx: 0, vy: -1, angle: 0, state: "flying" });
  return run(w, {}, 20);
};

// A cave with stalactites in the roof (one 2 tiles long), a crumbling bridge over
// a pit, with a column of crumbling rock at its left end, a crumbling lump in the
// roof, and a fuel pad. The floor is at y = 6 m and the roof at 16 m.
const CAVE = `
  ################################
  ################################
  #....!......!.............%%...#
  #...........!..................#
  #..............................#
  #..............................#
  #.SSS..........%%%%%%.FFF..EEE.#
  ###############%#....#########
  ###############%.....##########
  ################################
`;

test("stalactites hang from rock, crumbling rock is rock, and a level can rise and have sky", () => {
  const l = lvl(CAVE, { rise: { speed: 1.5, from: 1, delay: 2 }, sky: 2 });
  assert.deepEqual(
    l.stalactites.map((s) => [s.x, s.top, s.tip]),
    [
      [5.5 * TILE, 8 * TILE, 7 * TILE],
      [12.5 * TILE, 8 * TILE, 6 * TILE],
    ],
  );
  assert.equal(isSolid(l, 5, 7), false, "a stalactite's tile is air to the outline");
  assert.equal(l.crumbles.length, 10);
  assert.equal(isSolid(l, 16, 3), true);
  assert.equal(l.crumbly[3 * l.width + 16], 1);
  assert.deepEqual(l.rise, { speed: 1.5, from: 2, to: l.height * TILE, after: null, delay: 2 });
  // Above a level with sky is air; beside it, rock.
  assert.equal(isSolid(l, 3, l.height + 5), false);
  assert.equal(isSolid(l, -1, l.height - 1), true);
  assert.equal(solidAt(buildOutline(l), 20, (l.height + 3) * TILE), false);
  assert.equal(isSolid(lvl(CAVE), 3, 99), true);
});

test("the parser refuses stalactites in mid-air, pads on crumbling rock, and lava after nothing", () => {
  assert.throws(() => lvl(CAVE.replace("#..............................#", "#......!.......................#")), /row 5, column 8: a stalactite must hang from rock/);
  assert.throws(() => lvl(CAVE.replace("  ###############%#....", "  ##%############%#....")), /row 7, column 3: a pad can't stand on crumbling rock/);
  assert.throws(() => lvl(CAVE, { rise: { speed: 1, after: "r" } }), /after "r", which isn't a key or switch/);
  assert.throws(() => lvl(CAVE, { rise: { speed: 0 } }), /needs a speed/);
  assert.throws(() => lvl(CAVE, { sky: 0 }), /sky must be/);
  const custom = parseLevel({ name: "core", map: CAVE.replace("#....!", "#....k"), things: { k: { kind: "stalactite", reach: 9, warn: 2 } } });
  assert.deepEqual([custom.stalactites[0].reach, custom.stalactites[0].warn, custom.stalactites[1].warn], [9, 2, 0.7]);
});

test("a hanging stalactite is rock to fly into", () => {
  const l = lvl(CAVE);
  const s = l.stalactites[1]; // from 16 m down to 12 m
  const w = createWorld(l);
  // Across into it, the nose up by its thick end: bounced off, not through.
  Object.assign(w.rocket, { x: s.x - 2.5, vx: 4, state: "flying" });
  let furthest = -Infinity;
  for (let i = 0; i < 40; i++) {
    Object.assign(w.rocket, { y: 12.9, vy: 0 });
    step(w, {});
    furthest = Math.max(furthest, w.rocket.x);
  }
  assert.ok(furthest < s.x - 0.8, `got to ${furthest.toFixed(2)}, the stalactite's at ${s.x}`);
  assert.equal(w.rocket.state, "flying");
});

test("a stalactite shakes when the rocket's below it, then drops, and a hit costs hull", () => {
  const l = lvl(CAVE);
  const s = l.stalactites[0]; // at x = 11, its tip at 14 m
  const w = createWorld(l);
  // Beside it, out of reach: nothing.
  hold(w, s.x + s.reach + 1, 9, 30);
  assert.equal(w.stalactites[0].shook, -1);
  // Under it: it shakes for `warn`, then falls onto the rocket.
  hold(w, s.x + 2, 9, 2);
  const shook = w.stalactites[0].shook;
  assert.ok(shook > 0);
  assert.equal(shaking(s, w.stalactites[0], w.tick), true);
  hold(w, s.x + 0.5, 9, 2 * TICK_RATE);
  assert.ok(w.stalactites[0].gone > shook + s.warn * TICK_RATE, "it didn't fall");
  assert.equal(w.rocket.hull, HULL - s.damage);
});

test("a dropped stalactite shatters on the floor; rock in between hides the rocket from one", () => {
  const l = lvl(CAVE);
  const s = l.stalactites[0];
  const w = createWorld(l);
  hold(w, s.x + 4, 9, 3);
  hold(w, s.x + 10, 9, 2 * TICK_RATE); // away before it lands
  assert.ok(w.stalactites[0].gone > 0);
  assert.equal(w.rocket.hull, HULL);
  // From its tip at 14 m to the floor at 6 m.
  assert.ok(w.stalactites[0].drop >= 8 && w.stalactites[0].drop < 8.5, `dropped ${w.stalactites[0].drop}`);
  const outline = buildOutline(l);
  assert.equal(below(outline, s, s.x, 9), true);
  assert.equal(below(outline, s, s.x, 3), false, "under the floor");
  assert.equal(below(outline, s, s.x, 15), false, "above its tip");
});

test("crumbling rock cracks where it's landed on, and falls away a moment later", () => {
  const l = lvl(CAVE);
  const outline = buildOutline(l);
  const w = createWorld(l, outline);
  // The bridge's top is at 8 m. Feet at x = 32.5 and 35.5: tiles 16 and 17.
  Object.assign(w.rocket, { x: 17 * TILE, y: 4 * TILE + CENTRE_Y + 0.5, vx: 0, vy: -1, state: "flying" });
  run(w, {}, 20);
  assert.equal(w.rocket.state, "landed");
  assert.deepEqual(
    l.crumbles.filter((t, i) => w.crumbles[i].cracked >= 0).map((t) => [t.c, t.j]),
    [
      [16, 3],
      [17, 3],
    ],
  );
  assert.equal(tileSolid(outline, 16, 3), true);
  run(w, {}, CRUMBLE * TICK_RATE);
  assert.equal(tileSolid(outline, 16, 3), false);
  assert.equal(tileSolid(outline, 17, 3), false);
  assert.equal(tileSolid(outline, 18, 3), true, "the rest of the bridge goes a moment later");
  run(w, {}, 5);
  assert.equal(w.rocket.state, "flying", "its floor fell away");
});

test("crumbling rock takes the crumbling rock joined to it along, a tile at a time", () => {
  const l = lvl(CAVE);
  const w = createWorld(l);
  crackAt(w, 15.5 * TILE, 1.5 * TILE); // the bottom of the column at the bridge's end
  run(w, {}, CRUMBLE * TICK_RATE);
  const fell = (c, j) => w.crumbles[l.crumbles.findIndex((t) => t.c === c && t.j === j)].fell;
  assert.ok(fell(15, 1) > 0);
  assert.equal(fell(15, 2), -1);
  run(w, {}, 7 * CASCADE * TICK_RATE + 2);
  // Up the column, then along the bridge.
  const step = CASCADE * TICK_RATE;
  assert.deepEqual(
    [[15, 2], [15, 3], [16, 3], [17, 3], [20, 3]].map(([c, j]) => (fell(c, j) - fell(15, 1)) / step),
    [1, 2, 3, 4, 7],
  );
});

test("a restart puts back crumbling rock and stalactites that fell since the checkpoint", () => {
  const l = lvl(CAVE);
  const outline = buildOutline(l);
  const w = createWorld(l, outline);
  const fuel = l.pads.find((p) => p.kind === "fuel");
  hold(w, l.stalactites[0].x, 9, 3 * TICK_RATE); // down on the rocket
  crackAt(w, 18.5 * TILE, 3.5 * TILE); // the bridge, and all joined to it
  run(w, {}, 3 * TICK_RATE);
  // Land on the fuel pad: a checkpoint with both gone.
  land(w, fuel);
  assert.equal(w.checkpoint.pad, fuel);
  assert.equal(tileSolid(outline, 15, 1), false);
  // Now knock down the second stalactite and the lump in the roof, then restart.
  hold(w, l.stalactites[1].x + 1, 9, 3 * TICK_RATE);
  crackAt(w, 26.5 * TILE, 7.5 * TILE);
  run(w, {}, 2 * TICK_RATE);
  assert.equal(tileSolid(outline, 27, 7), false);
  restart(w);
  assert.ok(w.stalactites[0].gone >= 0, "fell before the checkpoint: stays down");
  assert.equal(w.stalactites[1].gone, -1, "fell after: back up");
  assert.equal(tileSolid(outline, 15, 1), false);
  assert.equal(tileSolid(outline, 26, 7), true);
  assert.equal(tileSolid(outline, 27, 7), true);
  // A new world on the same outline has it all back.
  const again = createWorld(l, outline);
  assert.ok(again.crumbles.every((c) => c.fell < 0));
  assert.equal(tileSolid(outline, 15, 1), true);
});

test("rising lava rises from lift-off, and destroys what it touches", () => {
  const l = lvl(CAVE, { rise: { speed: 2, from: 0.5 } });
  const w = createWorld(l);
  run(w, {}, 30);
  assert.equal(w.rise.y, TILE / 2, "not before lift-off");
  run(w, { thrust: true }, 10); // a hop: lift-off at tick 31
  run(w, {}, 50);
  assert.ok(Math.abs(w.rise.y - (1 + (2 * 59) / TICK_RATE)) < 1e-9, `at ${w.rise.y}`);
  assert.equal(rising(w), true);
  run(w, {}, 3 * TICK_RATE); // up to the floor the rocket's standing on
  assert.equal(w.rocket.state, "crashed");
  assert.equal(w.rocket.cause, "lava");
});

test("rising lava can wait for a key; a restart takes it back to the checkpoint and holds it till lift-off", () => {
  const keyRow = `#${".".repeat(7)}r${".".repeat(22)}#`;
  const map = CAVE.replace(`#..............................#\n  #.SSS`, `${keyRow}\n  #.SSS`);
  const l = lvl(map, { rise: { speed: 3, after: "r", delay: 1 } });
  const fuel = l.pads.find((p) => p.kind === "fuel");
  const w = createWorld(l);
  run(w, { thrust: true }, 10);
  run(w, {}, 60);
  assert.equal(w.rise.from, -1);
  hold(w, l.keys[0].x, l.keys[0].y, 1);
  assert.deepEqual(w.keys, ["red"]);
  assert.equal(w.rise.from, w.tick + TICK_RATE);
  // A checkpoint on the fuel pad, with the lava part way up.
  hold(w, 40, 12, 1.5 * TICK_RATE);
  land(w, fuel);
  assert.equal(w.checkpoint.pad, fuel);
  const saved = w.checkpoint.rise.y;
  assert.ok(saved > 1, `saved at ${saved}`);
  hold(w, 40, 12, TICK_RATE);
  assert.ok(w.rise.y > saved + 2);
  restart(w);
  assert.equal(w.rise.y, saved);
  run(w, {}, 30);
  assert.equal(w.rise.y, saved, "held while the rocket sits on the pad");
  run(w, { thrust: true }, 30);
  assert.ok(w.rise.y > saved);
});
