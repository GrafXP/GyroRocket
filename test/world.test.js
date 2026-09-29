import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, step, advance, clock, restart, padUnder, crystalCount, REFUEL_TIME, RETRY_AFTER } from "../src/sim/world.js";
import { inputCode } from "../src/sim/input.js";
import { TICK_RATE, CENTRE_Y, HULL, TANK } from "../src/sim/rocket.js";
import { room } from "./helpers.js";
import { parseLevel } from "../src/sim/level.js";

const run = (w, input, ticks) => {
  for (let i = 0; i < ticks; i++) step(w, input);
  return w;
};

// Puts the rocket just above a pad's middle, falling slowly enough to land.
const dropOnto = (w, pad) => Object.assign(w.rocket, { x: (pad.x0 + pad.x1) / 2, y: pad.y + CENTRE_Y + 1, vx: 0, vy: 0, angle: 0 });

const fuelPad = (level) => level.pads.find((p) => p.kind === "fuel");

// A world whose rocket has lifted off and been dropped onto `pad`, with the clock running.
const flownTo = (pad) => {
  const { level } = room();
  const w = run(createWorld(level), { thrust: true }, 30);
  dropOnto(w, pad(level));
  return w;
};

test("the rocket starts on the start pad with a full tank, and the clock waits for lift-off", () => {
  const { level } = room();
  const w = run(createWorld(level), {}, TICK_RATE);
  assert.equal(w.rocket.x, (level.start.x0 + level.start.x1) / 2);
  assert.equal(w.rocket.state, "landed");
  assert.equal(w.rocket.fuel, TANK);
  assert.equal(w.checkpoint.pad, level.start);
  assert.equal(clock(w), 0);
  run(w, { thrust: true }, TICK_RATE);
  assert.equal(clock(w), 1 - 1 / TICK_RATE);
});

test("the level sets the tank size", () => {
  const { level } = room();
  assert.equal(createWorld({ ...level, fuel: 7 }).rocket.tank, 7);
});

test("landing on the exit pad finishes and stops the clock", () => {
  const w = flownTo((l) => l.exit);
  run(w, {}, TICK_RATE);
  assert.equal(w.done, true);
  const t = clock(w);
  run(w, { thrust: true }, TICK_RATE);
  assert.equal(clock(w), t);
  assert.equal(w.rocket.state, "landed");
  assert.equal(w.rocket.burning, false);
});

test("landing back on the start pad doesn't finish", () => {
  const w = flownTo((l) => l.start);
  run(w, {}, TICK_RATE);
  assert.equal(w.rocket.state, "landed");
  assert.equal(w.done, false);
});

test("a fuel pad fills the tank and mends the hull, and becomes the checkpoint", () => {
  const w = flownTo(fuelPad);
  Object.assign(w.rocket, { fuel: 0.1, hull: 10 });
  run(w, {}, TICK_RATE / 2);
  assert.equal(padUnder(w.level, w.rocket), fuelPad(w.level));
  assert.equal(w.checkpoint.pad, fuelPad(w.level));
  assert.equal(w.refuelling, true);
  assert.equal(w.stranded, false);
  run(w, {}, REFUEL_TIME * TICK_RATE);
  assert.equal(w.rocket.fuel, TANK);
  assert.equal(w.rocket.hull, HULL);
  assert.equal(w.refuelling, false);
});

test("after a crash, a restart goes back to the checkpoint, full, with the clock still running", () => {
  const w = flownTo(fuelPad);
  run(w, {}, TICK_RATE);
  // Fly up and fall back hard: a crash.
  run(w, { thrust: true }, 2 * TICK_RATE);
  run(w, {}, 5 * TICK_RATE);
  assert.equal(w.rocket.state, "crashed");
  assert.ok(w.downTick > 0);
  const t = clock(w);
  run(w, {}, TICK_RATE);
  assert.equal(clock(w), t + 1);
  restart(w);
  assert.equal(w.restarts, 1);
  assert.equal(w.downTick, -1);
  assert.equal(padUnder(w.level, w.rocket), fuelPad(w.level));
  assert.deepEqual([w.rocket.fuel, w.rocket.hull], [TANK, HULL]);
  run(w, {}, TICK_RATE);
  assert.equal(clock(w), t + 2);
});

test("landed with an empty tank away from a fuel pad is stranded", () => {
  const w = flownTo((l) => l.start);
  w.rocket.fuel = 0;
  run(w, {}, TICK_RATE);
  assert.equal(w.stranded, true);
  assert.ok(w.downTick > 0);
  restart(w);
  assert.equal(w.stranded, false);
  assert.equal(w.rocket.fuel, TANK);
  assert.equal(padUnder(w.level, w.rocket), w.level.start);
});

test("an empty tank on a fuel pad isn't stranded", () => {
  const w = flownTo(fuelPad);
  w.rocket.fuel = 0;
  run(w, {}, TICK_RATE);
  assert.equal(w.stranded, false);
  assert.equal(w.downTick, -1);
});

test("stuck still with an empty tank, somewhere it can't land, is stranded too", () => {
  // A V-shaped pit whose bottom is too narrow to land on.
  const level = parseLevel({
    name: "pit",
    map: `
      ####################
      #..................#
      #..................#
      #..................#
      #..................#
      #..................#
      #.SSS.EEE..........#
      ##########........##
      ###########......###
      ############....####
      #############..#####
      ####################
    `,
  });
  const w = run(createWorld(level), { thrust: true }, 10);
  Object.assign(w.rocket, { x: 28, y: 14, vx: 0, vy: 0, fuel: 0 });
  run(w, {}, 5 * TICK_RATE);
  assert.equal(w.rocket.state, "flying");
  assert.equal(w.stranded, true);
});

test("flying through a crystal collects it, and a restart puts back any since the checkpoint", () => {
  const level = parseLevel({
    name: "crystals",
    map: `
      ##########################
      #........................#
      #........................#
      #........................#
      #...*.............*......#
      #........................#
      #........................#
      #.SSS....FFF......EEE....#
      ##########################
    `,
  });
  const w = createWorld(level);
  const [first, second] = level.crystals;
  run(w, { thrust: true }, 5);
  Object.assign(w.rocket, { x: first.x, y: first.y - 1 });
  step(w, {});
  assert.deepEqual(w.got.map((t) => t >= 0), [true, false]);
  assert.equal(crystalCount(w), 1);
  // Land on the fuel pad (a checkpoint with the first crystal), take the second, crash.
  dropOnto(w, level.pads.find((p) => p.kind === "fuel"));
  run(w, {}, TICK_RATE);
  Object.assign(w.rocket, { x: second.x, y: second.y - 1, vx: 0, vy: 0, state: "flying" });
  step(w, {});
  assert.equal(crystalCount(w), 2);
  Object.assign(w.rocket, { vy: -30 });
  run(w, {}, TICK_RATE);
  assert.equal(w.rocket.state, "crashed");
  restart(w);
  assert.deepEqual(w.got.map((t) => t >= 0), [true, false]);
});

test("the dev cheats: no damage, and a tank that never empties", () => {
  const { level } = room();
  const w = createWorld(level);
  w.cheats.god = true;
  w.cheats.fuel = true;
  run(w, { thrust: true }, 3 * TICK_RATE);
  run(w, {}, 5 * TICK_RATE);
  assert.notEqual(w.rocket.state, "crashed");
  assert.equal(w.rocket.hull, HULL);
  assert.equal(w.rocket.fuel, TANK);
});

test("advance: after a crash, a new tap once RETRY_AFTER is up goes back to the checkpoint", () => {
  const { level } = room();
  const w = createWorld(level);
  const go = (input, ticks = 1) => {
    for (let i = 0; i < ticks; i++) advance(w, inputCode(input));
  };
  const crash = () => {
    go({ thrust: true }, 30);
    Object.assign(w.rocket, { vy: -30 });
    go({ thrust: true }, 30);
    assert.equal(w.rocket.state, "crashed");
    assert.equal(w.rocket.burning, false, "no burning while it's down");
  };
  crash();
  // A burn held from before the crash isn't a tap.
  go({ thrust: true }, RETRY_AFTER + 5);
  assert.equal(w.restarts, 0);
  go({});
  go({ thrust: true });
  assert.equal(w.restarts, 1);
  assert.equal(w.rocket.state, "landed");
  assert.equal(w.rocket.burning, false, "the tap that restarts doesn't burn");
  go({ thrust: true });
  assert.equal(w.rocket.burning, true);
  // A tap too soon does nothing.
  crash();
  go({});
  go({ thrust: true });
  assert.equal(w.restarts, 1);
  go({}, RETRY_AFTER);
  go({ thrust: true });
  assert.equal(w.restarts, 2);
});

test("advance: the restart input goes back to the checkpoint, but not after the finish", () => {
  const { level } = room();
  const w = createWorld(level);
  advance(w, inputCode({ thrust: true }));
  advance(w, inputCode({ restart: true }));
  assert.equal(w.restarts, 1);
  dropOnto(w, level.pads.find((p) => p.kind === "exit"));
  for (let i = 0; i < TICK_RATE && !w.done; i++) advance(w, inputCode({}));
  assert.equal(w.done, true);
  advance(w, inputCode({ restart: true }));
  assert.equal(w.restarts, 1);
  assert.equal(w.done, true);
});
