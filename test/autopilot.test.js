import { test } from "node:test";
import assert from "node:assert/strict";
import { levelById } from "../src/levels/index.js";
import { parseLevel } from "../src/sim/level.js";
import { createWorld, step, restart, RETRY_AFTER } from "../src/sim/world.js";
import { createPilot } from "../src/autopilot.js";
import { TICK_RATE, CENTRE_Y } from "../src/sim/rocket.js";

const world = (id) => createWorld(parseLevel(levelById(id)));

// Flies with `pilot` until the level's done, or `seconds` run out, restarting on a
// tap after a crash as the game does (game.js).
const fly = (w, pilot, seconds = 120) => {
  let was = false;
  for (let i = 0; i < seconds * TICK_RATE && !w.done; i++) {
    const input = pilot.input();
    const pressed = input.thrust && !was;
    was = input.thrust;
    if (w.downTick >= 0 && pressed && w.tick - w.downTick >= RETRY_AFTER) restart(w);
    step(w, input);
  }
  return w;
};

test("switched on mid-level, it picks up the route after the checkpoint", () => {
  // 2-2's route is "r F y F E". Hold the red key and stand on the first fuel pad.
  const w = world("2-2");
  const fuel = w.level.pads.find((p) => p.kind === "fuel");
  step(w, { thrust: true });
  Object.assign(w.rocket, { x: (fuel.x0 + fuel.x1) / 2, y: fuel.y + CENTRE_Y + 0.3, vx: 0, vy: 0, angle: 0 });
  w.keys.push("red");
  w.keyTicks[w.level.keys.findIndex((k) => k.color === "red")] = w.tick;
  for (let i = 0; i < TICK_RATE; i++) step(w, {});
  assert.equal(w.checkpoint.pad, fuel);
  const pilot = createPilot(w);
  pilot.input();
  assert.equal(pilot.status, "Autopilot: to the yellow key");
  fly(w, pilot);
  assert.equal(w.done, true, pilot.failed);
});

test("after a crash it taps to go again, and carries on", () => {
  const w = world("1-1");
  step(w, { thrust: true });
  Object.assign(w.rocket, { y: 30, vy: -60 });
  for (let i = 0; i < TICK_RATE && w.rocket.state !== "crashed"; i++) step(w, {});
  assert.equal(w.rocket.state, "crashed");
  const pilot = createPilot(w);
  fly(w, pilot);
  assert.equal(w.done, true, pilot.failed);
  assert.equal(w.restarts, 1);
});

test("without restarts, a crash is a failure, saying where", () => {
  const w = world("1-1");
  const pilot = createPilot(w, { restart: false });
  step(w, pilot.input());
  Object.assign(w.rocket, { y: 30, vy: -60 }); // too fast for it to save
  for (let i = 0; i < TICK_RATE && !pilot.failed; i++) step(w, pilot.input());
  assert.match(pilot.failed, /^start → exit: crashed at \d+, \d+$/);
});

test("it waits out stalactites, and breaks through crumbling rock only where it must, unhurt", () => {
  const maps = {
    // Two stalactites over the way.
    stalactites: `
      ################################
      ################################
      #....!......!..................#
      #...........!..................#
      #..............................#
      #..............................#
      #..............................#
      #.SSS...................FFF.EEE#
      ################################`,
    // A plug of crumbling rock right across the cave.
    plug: `
      ##################################
      #................%%..............#
      #................%%..............#
      #................%%..............#
      #................%%..............#
      #................%%..............#
      #.SSS............%%..........EEE.#
      ##################################`,
    // A crumbling floor to drop through, and a crumbling lump off to the side,
    // which is left alone.
    trapdoor: `
      ########################
      #......................#
      #......................#
      #..................%%..#
      #..................%%..#
      #.SSS..................#
      ##########%%%%%%########
      #######..........#######
      #######..........#######
      #######..........#######
      #######..EEE.....#######
      ########################`,
  };
  for (const [name, map] of Object.entries(maps)) {
    const w = createWorld(parseLevel({ name, map, fuel: 20 }));
    const pilot = createPilot(w, { restart: false });
    for (let i = 0; i < 60 * TICK_RATE && !w.done && !pilot.failed; i++) step(w, pilot.input());
    assert.equal(w.done, true, `${name}: ${pilot.failed}`);
    assert.equal(w.rocket.hull, 100, `${name}: hurt`);
    if (name === "stalactites") assert.ok(w.stalactites.every((s) => s.gone > 0), "it didn't set them off");
    if (name === "trapdoor") assert.equal(w.crumbles.filter((c) => c.fell >= 0).length, 6, "it broke the lump too");
  }
});
