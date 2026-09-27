import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLevel, TILE, isSolid } from "../src/sim/level.js";
import { createWorld, step } from "../src/sim/world.js";
import { TICK_RATE, CENTRE_Y, GRAVITY } from "../src/sim/rocket.js";
import { fieldAt, cyclePhase, travel, crusherWarning, moverBox } from "../src/sim/machines.js";

const lvl = (map, things) => parseLevel({ name: "machines", map, things });
const run = (w, input, ticks) => {
  for (let i = 0; i < ticks; i++) step(w, input);
  return w;
};
// A world with the rocket flying still at (x, y).
const at = (level, x, y) => {
  const w = run(createWorld(level), { thrust: true }, 3);
  Object.assign(w.rocket, { x, y, vx: 0, vy: 0, angle: 0, state: "flying" });
  return w;
};

// A room with a fan in the floor blowing up (f), a magnet in the right wall (m),
// and a pushing one in the roof (p).
const ROOM = `
  ##############p#############
  #..........................#
  #..........................#
  #..........................m
  #..........................#
  #..........................#
  #..........................#
  #.SSS....................E.#
  #######f############EEEEE###
`.replace("E.#\n  #######f############EEEEE###", "..#\n  #######f####################").replace("#.SSS....................", "#.SSS.EEE................");
const THINGS = {
  f: { kind: "fan", facing: "up", length: 4 },
  m: { kind: "magnet", strength: 16, range: 12 },
  p: { kind: "magnet", push: true, range: 10 },
};

test("fans, magnets, movers and crushers parse, named by any free letter", () => {
  const l = lvl(ROOM, THINGS);
  const [fan] = l.fans;
  // 3 tiles wide round column 8, from the housing's top up 4 tiles.
  assert.deepEqual([fan.x0, fan.x1, fan.y0, fan.y1, fan.strength, fan.mode], [6 * TILE, 9 * TILE, 1 * TILE, 5 * TILE, 14, "always"]);
  assert.equal(isSolid(l, 7, 0), true);
  const [pull, push] = l.magnets.sort((a, b) => a.push - b.push);
  assert.deepEqual([pull.x, pull.y, pull.range, pull.push], [27.5 * TILE, 5.5 * TILE, 12, false]);
  assert.equal(push.push, true);
  const moving = lvl(
    `
    #..........#
    #..aa......#
    #..aa....cc#
    #.SSS.EEE..#
    ############`,
    { a: { kind: "mover", to: [3, 0], period: 4 }, c: { kind: "crusher", to: [-5, 0] } },
  );
  const [mover, crusher] = moving.movers;
  assert.deepEqual([mover.kind, mover.x0, mover.y0, mover.x1, mover.y1, mover.to], ["mover", 3 * TILE, 2 * TILE, 5 * TILE, 4 * TILE, [6, 0]]);
  assert.deepEqual([crusher.kind, crusher.to, crusher.slam], ["crusher", [-10, 0], 0.15]);
  assert.equal(moving.solid[2 * moving.width + 3], 0, "a mover's tiles are air to the rock");
  const bad = (map, things, message) => assert.throws(() => lvl(map, things), message);
  const room = (row) => `#...............#\n#...............#\n${row}\n#################`;
  bad(room("#.SSS.EEE......f#"), { f: { kind: "fan", facing: "right" } }, /blows into rock/);
  bad(room("#.SSS.EEE..aa...#"), { a: { kind: "mover" } }, /needs to: \[dx, dy\]/);
  bad(room("#.SSS.EEE..q....#"), {}, /"q" isn't set up in things/);
  bad(room("#.SSS.EEE..q....#"), { q: { kind: "teleporter" } }, /isn't a kind of thing/);
});

test("a fan pushes inside its column, and only there; a cycling one takes turns", () => {
  const l = lvl(ROOM, THINGS);
  assert.deepEqual(fieldAt(l, 0, 15, 6), { ax: 0, ay: 14 });
  assert.deepEqual(fieldAt(l, 0, 25, 6), { ax: 0, ay: 0 });
  // Without a burn, the fan holds the rocket up better than gravity.
  const w = at(l, 15, 6);
  run(w, {}, TICK_RATE / 2);
  assert.ok(w.rocket.vy > 0, `${w.rocket.vy}`);
  const cycling = { ...l.fans[0], mode: "cycle", on: 2, off: 3, warn: 0.5, offset: 0 };
  assert.deepEqual([0, 2.6, 3.1].map((s) => cyclePhase(cycling, s * TICK_RATE)), ["off", "warn", "on"]);
});

test("a magnet pulls hardest close up, nothing past its range; a pushing one pushes", () => {
  const l = lvl(ROOM, THINGS);
  const [pull] = l.magnets.filter((m) => !m.push);
  const near = fieldAt(l, 0, pull.x - 3, pull.y);
  const far = fieldAt(l, 0, pull.x - 9, pull.y);
  assert.ok(near.ax > far.ax && far.ax > 0, `${near.ax}, ${far.ax}`);
  assert.ok(Math.abs(near.ax - 16 * (1 - 3 / 12)) < 1e-9);
  assert.equal(fieldAt(l, 0, pull.x - 13, pull.y).ax, 0);
  const [push] = l.magnets.filter((m) => m.push);
  assert.ok(fieldAt(l, 0, push.x, push.y - 4).ay < 0, "the roof magnet pushes down");
});

test("a mover carries a rocket landed on it, and crushes one against the roof", () => {
  const l = lvl(
    `
    ##################
    #................#
    #................#
    #................#
    #................#
    #................#
    #......aaaa......#
    #.SSS......EEE...#
    ##################`,
    { a: { kind: "mover", to: [4, 0], period: 8 } },
  );
  const [m] = l.movers;
  // Land on it: it moves right, and takes the rocket along.
  const w = at(l, (m.x0 + m.x1) / 2, m.y1 + CENTRE_Y + 0.3);
  run(w, {}, 20);
  assert.equal(w.rocket.state, "landed");
  const x = w.rocket.x;
  const box = moverBox(m, w.tick);
  run(w, {}, 2 * TICK_RATE);
  const moved = moverBox(m, w.tick).x0 - box.x0;
  assert.ok(moved > 2 && Math.abs(w.rocket.x - x - moved) < 1e-6, `moved ${moved}, rocket ${w.rocket.x - x}`);
  assert.equal(w.rocket.state, "landed");

  // A mover rising under a rocket against the roof crushes it.
  const lift = lvl(
    `
    ##########
    #........#
    #........#
    #........#
    #........#
    #...aa...#
    #.SSS.EEE#
    ##########`,
    { a: { kind: "mover", to: [0, 4], period: 4 } },
  );
  const [l2] = lift.movers;
  const c = at(lift, (l2.x0 + l2.x1) / 2, l2.y1 + CENTRE_Y + 0.3);
  run(c, {}, 20);
  for (let i = 0; i < 3 * TICK_RATE && c.rocket.state !== "crashed"; i++) step(c, {});
  assert.equal(c.rocket.cause, "crush");
});

test("a crusher rests, shakes, slams, holds and goes back, and a slam destroys", () => {
  const l = lvl(
    `
    ##############
    #............#
    #............#
    #..........cc#
    #..........cc#
    #.SSS.EEE....#
    ##############`,
    { c: { kind: "crusher", to: [-8, 0], rest: 1, warn: 0.5, slam: 0.2, hold: 0.5, back: 1 } },
  );
  const [c] = l.movers;
  const at_ = (s) => travel(c, s * TICK_RATE);
  assert.deepEqual([0.5, 1.2, 1.6, 1.9, 2.7].map(at_).map((p) => Math.round(p * 100) / 100), [0, 0, 0.5, 1, 0.5]);
  assert.equal(crusherWarning(c, 1.2 * TICK_RATE), true);
  assert.equal(crusherWarning(c, 0.5 * TICK_RATE), false);
  // In its path as it slams: gone.
  const w = at(l, c.x0 - 9, (c.y0 + c.y1) / 2);
  for (let i = 0; i < 2 * TICK_RATE && w.rocket.state !== "crashed"; i++) {
    Object.assign(w.rocket, { x: c.x0 - 9, y: (c.y0 + c.y1) / 2, vx: 0, vy: 0 });
    step(w, {});
  }
  assert.equal(w.rocket.cause, "crush");
});
