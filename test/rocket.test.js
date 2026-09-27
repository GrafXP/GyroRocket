import { test } from "node:test";
import assert from "node:assert/strict";
import { createRocket, step, TICK_RATE, MAX_LEAN, SAFE_SPEED } from "../src/sim/rocket.js";

const run = (r, input, ticks) => {
  for (let i = 0; i < ticks; i++) step(r, input);
  return r;
};

test("a new rocket stands on the ground", () => {
  const r = run(createRocket(), {}, TICK_RATE);
  assert.equal(r.state, "landed");
  assert.equal(r.y, 0);
  assert.equal(r.vy, 0);
});

test("burning lifts off and climbs", () => {
  const r = run(createRocket(), { thrust: true }, 2 * TICK_RATE);
  assert.equal(r.state, "flying");
  assert.ok(r.y > 10, `only ${r.y} m up`);
  assert.ok(r.vy > 0);
  assert.equal(r.best, r.y);
});

test("steering leans the rocket, no further than MAX_LEAN, and pushes it sideways", () => {
  const r = run(createRocket(), { thrust: true }, 10);
  run(r, { thrust: true, steer: 5 }, TICK_RATE);
  assert.equal(r.angle, MAX_LEAN);
  assert.ok(r.vx > 0);
  run(r, { thrust: true, steer: -1 }, 2 * TICK_RATE);
  assert.equal(r.angle, -MAX_LEAN);
});

test("the lean only changes in flight", () => {
  const r = run(createRocket(), { steer: 1 }, TICK_RATE);
  assert.equal(r.angle, 0);
});

test("a gentle touchdown lands", () => {
  const r = run(createRocket(), { thrust: true }, 20);
  // Hover down: burn only when falling faster than half the safe speed.
  for (let i = 0; i < 60 * TICK_RATE && r.state === "flying"; i++) step(r, { thrust: r.vy < -SAFE_SPEED / 2 });
  assert.equal(r.state, "landed");
  assert.equal(r.y, 0);
});

test("falling fast crashes, and a crashed rocket stays put", () => {
  const r = run(createRocket(), { thrust: true }, 3 * TICK_RATE);
  run(r, {}, 30 * TICK_RATE);
  assert.equal(r.state, "crashed");
  const { x, y } = r;
  run(r, { thrust: true, steer: 1 }, TICK_RATE);
  assert.deepEqual([r.x, r.y, r.burning], [x, y, false]);
});

test("touching down leaning over crashes", () => {
  const r = run(createRocket(), { thrust: true }, 20);
  run(r, { thrust: true, steer: 1 }, TICK_RATE);
  for (let i = 0; i < 60 * TICK_RATE && r.state === "flying"; i++) step(r, { steer: 1, thrust: r.vy < -1 });
  assert.equal(r.state, "crashed");
});

test("best height carries over to a new rocket", () => {
  const r = run(createRocket(), { thrust: true }, TICK_RATE);
  assert.equal(createRocket({ best: r.best }).best, r.best);
});
