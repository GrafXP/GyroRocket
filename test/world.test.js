import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, step, clock } from "../src/sim/world.js";
import { TICK_RATE, CENTRE_Y } from "../src/sim/rocket.js";
import { room } from "./helpers.js";

const run = (w, input, ticks) => {
  for (let i = 0; i < ticks; i++) step(w, input);
  return w;
};

// Puts the rocket just above a pad's middle, falling slowly enough to land.
const dropOnto = (w, pad) => Object.assign(w.rocket, { x: (pad.x0 + pad.x1) / 2, y: pad.y + CENTRE_Y + 1, vx: 0, vy: 0, angle: 0 });

test("the rocket starts on the start pad, and the clock waits for lift-off", () => {
  const { level } = room();
  const w = run(createWorld(level), {}, TICK_RATE);
  assert.equal(w.rocket.x, (level.start.x0 + level.start.x1) / 2);
  assert.equal(w.rocket.state, "landed");
  assert.equal(clock(w), 0);
  run(w, { thrust: true }, TICK_RATE);
  assert.equal(clock(w), 1 - 1 / TICK_RATE);
});

test("landing on the exit pad finishes and stops the clock", () => {
  const { level } = room();
  const w = run(createWorld(level), { thrust: true }, 30);
  dropOnto(w, level.exit);
  run(w, {}, TICK_RATE);
  assert.equal(w.done, true);
  const t = clock(w);
  run(w, { thrust: true }, TICK_RATE);
  assert.equal(clock(w), t);
  assert.equal(w.rocket.state, "landed");
  assert.equal(w.rocket.burning, false);
});

test("landing back on the start pad doesn't finish", () => {
  const { level } = room();
  const w = run(createWorld(level), { thrust: true }, 30);
  dropOnto(w, level.start);
  run(w, {}, TICK_RATE);
  assert.equal(w.rocket.state, "landed");
  assert.equal(w.done, false);
});

test("a crash stops the clock", () => {
  const { level } = room();
  const w = run(createWorld(level), { thrust: true }, 2 * TICK_RATE);
  run(w, {}, 5 * TICK_RATE);
  assert.equal(w.rocket.state, "crashed");
  const t = clock(w);
  run(w, {}, TICK_RATE);
  assert.equal(clock(w), t);
});
