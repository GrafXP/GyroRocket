import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createRocket,
  step,
  circlesAt,
  canStand,
  TICK_RATE,
  MAX_LEAN,
  SAFE_SPEED,
  HULL,
  TANK,
  CENTRE_Y,
  FOOT_X,
} from "../src/sim/rocket.js";
import { buildOutline, solidAt } from "../src/sim/outline.js";
import { deepestContact } from "../src/sim/collide.js";
import { parseLevel, TILE } from "../src/sim/level.js";
import testCave from "../src/levels/testcave.js";
import { room, random } from "./helpers.js";

const FLOOR = TILE; // the room's floor height

const run = (r, o, input, ticks) => {
  for (let i = 0; i < ticks; i++) step(r, input, o);
  return r;
};

// A rocket flying free at (x, y) with velocity (vx, vy).
const flying = (x, y, vx = 0, vy = 0) => Object.assign(createRocket(x, 0), { x, y, vx, vy, state: "flying" });

test("a new rocket stands on its floor and stays put", () => {
  const { outline } = room();
  const r = run(createRocket(11, FLOOR), outline, { steer: 1 }, TICK_RATE);
  assert.equal(r.state, "landed");
  assert.deepEqual([r.x, r.y, r.angle], [11, FLOOR + CENTRE_Y, 0]);
});

test("burning lifts off and climbs", () => {
  const { outline } = room();
  const r = run(createRocket(11, FLOOR), outline, { thrust: true }, TICK_RATE);
  assert.equal(r.state, "flying");
  assert.ok(r.y > FLOOR + CENTRE_Y + 3, `only ${r.y} m up`);
  assert.equal(r.hull, HULL);
});

test("burning uses a second of fuel a second, and only while burning", () => {
  const { outline } = room();
  const r = createRocket(11, FLOOR);
  assert.equal(r.fuel, TANK);
  run(r, outline, {}, TICK_RATE);
  assert.equal(r.fuel, TANK);
  run(r, outline, { thrust: true }, TICK_RATE);
  assert.ok(Math.abs(r.fuel - (TANK - 1)) < 1e-9, `${r.fuel}`);
  run(r, outline, {}, TICK_RATE);
  assert.ok(Math.abs(r.fuel - (TANK - 1)) < 1e-9);
});

test("with an empty tank the engine only sputters", () => {
  const { outline } = room();
  const r = run(createRocket(11, FLOOR, 0.5), outline, { thrust: true }, TICK_RATE);
  assert.equal(r.fuel, 0);
  assert.equal(r.burning, false);
  assert.equal(r.sputtering, true);
  // Nothing holds it up: it falls back and lands.
  for (let i = 0; i < 10 * TICK_RATE && r.state === "flying"; i++) step(r, { thrust: true }, outline);
  assert.equal(r.state, "landed");
  assert.equal(r.y, FLOOR + CENTRE_Y);
});

test("steering leans the rocket, no further than MAX_LEAN", () => {
  const { outline } = room();
  const r = run(createRocket(11, FLOOR), outline, { thrust: true }, 10);
  run(r, outline, { thrust: true, steer: 5 }, TICK_RATE / 2);
  assert.equal(r.angle, MAX_LEAN);
  assert.ok(r.vx > 0);
});

test("a gentle touchdown lands, upright", () => {
  const { outline } = room();
  const r = run(createRocket(11, FLOOR), outline, { thrust: true }, 30);
  run(r, outline, { thrust: true, steer: 0.2 }, 10);
  for (let i = 0; i < 20 * TICK_RATE && r.state === "flying"; i++) step(r, { thrust: r.vy < -SAFE_SPEED / 2 }, outline);
  assert.equal(r.state, "landed");
  assert.equal(r.y, FLOOR + CENTRE_Y);
  assert.equal(r.angle, 0);
  assert.equal(r.hull, HULL);
});

test("falling from high up crashes, and a crashed rocket stays put", () => {
  const { outline } = room();
  const r = run(flying(11, 24), outline, {}, 5 * TICK_RATE);
  assert.equal(r.state, "crashed");
  assert.equal(r.hull, 0);
  const { x, y } = r;
  run(r, outline, { thrust: true, steer: 1 }, TICK_RATE);
  assert.deepEqual([r.x, r.y, r.burning], [x, y, false]);
});

test("hitting a wall bounces off and costs hull, by how hard", () => {
  const { outline } = room();
  const hitAt = (speed) => {
    const r = flying(4.5, 16, -speed); // the fins 0.8 m from the wall
    for (let i = 0; i < 2 * TICK_RATE && r.vx < 0; i++) step(r, {}, outline);
    return r;
  };
  const soft = hitAt(6);
  const hard = hitAt(10);
  assert.equal(soft.state, "flying");
  assert.ok(soft.vx > 0, "didn't bounce");
  assert.ok(soft.hull < HULL && hard.hull < soft.hull, `${soft.hull}, ${hard.hull}`);
  assert.equal(hitAt(1).hull, HULL, "a scrape shouldn't hurt");
  assert.equal(hitAt(20).state, "crashed");
});

test("slopes and narrow ledges can't be landed on", () => {
  const { outline } = room();
  // The top of the column (x 62–66 m) is flat but only 2 m wide; the feet are 3 m apart.
  assert.equal(canStand(outline, 64, 5 * TILE), false);
  assert.equal(canStand(outline, 11, FLOOR), true);
  // Dropped onto the pyramid's slope, the rocket slides off before it can land.
  const r = flying(35, 14);
  for (let i = 0; i < 20 * TICK_RATE && r.state === "flying"; i++) step(r, { thrust: r.vy < -2 }, outline);
  assert.equal(r.state, "landed");
  assert.equal(r.y, FLOOR + CENTRE_Y);
  assert.ok(r.x + FOOT_X <= 31, `landed at ${r.x}, on the slope`);
});

test("wild flying never leaves the rocket inside rock", () => {
  const level = parseLevel(testCave);
  const outline = buildOutline(level);
  const rand = random(42);
  const start = () => createRocket((level.start.x0 + level.start.x1) / 2, level.start.y);
  let r = start();
  let input = {};
  let crashes = 0;
  for (let t = 0; t < 30000; t++) {
    if (rand() < 1 / 30) input = { steer: rand() * 2 - 1, thrust: rand() < 0.7 };
    step(r, input, outline);
    const c = deepestContact(outline, circlesAt(r.x, r.y, r.angle));
    assert.ok(!c || c.depth < 0.1, `${c?.depth} m into rock at tick ${t}`);
    for (const p of circlesAt(r.x, r.y, r.angle)) assert.equal(solidAt(outline, p.x, p.y), false, `inside rock at tick ${t}`);
    if (r.state === "crashed") {
      crashes++;
      r = start();
    }
  }
  assert.ok(crashes > 0, "the fuzzing never hit anything hard");
});
