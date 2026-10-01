import { test } from "node:test";
import assert from "node:assert/strict";
import { levelById } from "../src/levels/index.js";
import { parseLevel } from "../src/sim/level.js";
import { createWorld, step, advance } from "../src/sim/world.js";
import { inputCode } from "../src/sim/input.js";
import { createPilot } from "../src/autopilot.js";
import { TICK_RATE, CENTRE_Y } from "../src/sim/rocket.js";

const world = (id) => createWorld(parseLevel(levelById(id)));

// Flies with `pilot` until the level's done, or `seconds` run out, as the game
// does (restarting on its tap after a crash).
const fly = (w, pilot, seconds = 120) => {
  for (let i = 0; i < seconds * TICK_RATE && !w.done; i++) advance(w, inputCode(pilot.input()));
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

// Flies a level made of `map` and `things` with the autopilot, without restarts:
// { w, pilot, seconds }.
const flyMap = (name, map, things = {}, limit = 90) => {
  const w = createWorld(parseLevel({ name, map, things, fuel: 30 }));
  const pilot = createPilot(w, { restart: false });
  for (let i = 0; i < limit * TICK_RATE && !w.done && !pilot.failed; i++) step(w, pilot.input());
  return { w, pilot, seconds: w.tick / TICK_RATE };
};

test("under a row of stalactites it flies on through, not stopping at each, where none would hit it", () => {
  const { w, pilot, seconds } = flyMap(
    "row",
    `
    ##################################################
    #.....!...!...!...!...!...!...!...!..............#
    #................................................#
    #................................................#
    #................................................#
    #................................................#
    #................................................#
    #.SSS.........................................EEE#
    ##################################################`,
  );
  assert.equal(w.done, true, pilot.failed);
  assert.equal(w.rocket.hull, 100, "hurt");
  assert.ok(seconds < 30, `${seconds.toFixed(1)} s`);
  assert.ok(w.stalactites.every((s) => s.shook > 0), "it didn't set them all off");
});

test("it sets off a flame that fires as it comes near, from out of its way, and crosses while it rests", () => {
  const { w, pilot } = flyMap(
    "near",
    `
    #######1#######1#######1###########
    #.................................#
    #.................................#
    #.................................#
    #.................................#
    #.................................#
    #.................................#
    #.SSS.........................EEE.#
    ###################################`,
    { 1: { kind: "flame", facing: "down", mode: "near", length: 7, on: 1, off: 1.5, warn: 0.5, reach: 5 } },
  );
  assert.equal(w.done, true, pilot.failed);
  assert.equal(w.rocket.hull, 100, "burned");
});

test("crossing flames under a turret, it dodges the shots without stopping in a flame or backing into one", () => {
  // Getting out of the way of a shot from overhead that passes in front of it
  // used to mean stopping dead, in the flame it was crossing.
  const { w, pilot } = flyMap(
    "turret",
    `
    ############################################
    ############################################
    #####################2######################
    ####################...#####################
    ####################...#####################
    ####################...#####################
    ############1#####1#...#1#####1#############
    ##........................................##
    ##........................................##
    ##........................................##
    ##........................................##
    ##........................................##
    ##........................................##
    ##........................................##
    ##........................................##
    ##........................................##
    ##.SSS..............................EEE...##
    ############################################`,
    {
      1: { kind: "flame", mode: "near", facing: "down", length: 10, on: 1, off: 1.5, warn: 0.4, reach: 5 },
      2: { kind: "turret", range: 36, speed: 9, windup: 0.5, reload: 1 },
    },
  );
  assert.equal(w.done, true, pilot.failed);
});

test("it goes under a blob thrown high while the blob's up out of its way", () => {
  // Low over the lava, it's only in the blob's way at the start and end of each
  // throw: waiting for the blob to be down for long enough, it would never go.
  const { w, pilot } = flyMap(
    "blob",
    `
    ##############################
    #............................#
    #............................#
    #............................#
    #............................#
    #............................#
    #............................#
    #............................#
    #.SSS...................EEE..#
    ##############1###############`,
    { 1: { kind: "blob", height: 8, period: 5 } },
  );
  assert.equal(w.done, true, pilot.failed);
});

test("up a shaft that a slab slides across, it passes at the side, where the slab is gone half the time", () => {
  // Straight up the middle, from the start to the exit, the slab is always in
  // the way.
  const { w, pilot } = flyMap(
    "slab",
    `
    ################
    #..............#
    #..............#
    #..............#
    #.EEE..........#
    #####..........#
    #..............#
    #..............#
    #..............#
    #..............#
    #aaaaaaa.......#
    #aaaaaaa.......#
    #..............#
    #..............#
    #..............#
    #..............#
    #..............#
    #..............#
    #..............#
    #..............#
    #..............#
    #.....SSS......#
    ################`,
    { a: { kind: "mover", to: [7, 0], period: 8 } },
  );
  assert.equal(w.done, true, pilot.failed);
  assert.equal(w.rocket.hull, 100, "hurt");
});
