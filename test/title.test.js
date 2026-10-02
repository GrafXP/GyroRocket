import { test } from "node:test";
import assert from "node:assert/strict";
import titleCave from "../src/levels/title.js";
import { WORLDS } from "../src/levels/index.js";
import { parseLevel, isSolid, TILE } from "../src/sim/level.js";
import { createWorld, advance } from "../src/sim/world.js";
import { inputCode } from "../src/sim/input.js";
import { TICK_RATE } from "../src/sim/rocket.js";

test("the title's cave is a level, in any world's colours", () => {
  for (const world of WORLDS) {
    const level = parseLevel({ ...titleCave, colors: world.colors });
    assert.equal(level.colors, world.colors);
    assert.equal(level.pads.filter((p) => p.kind === "start").length, 1);
  }
});

test("its rocket has a chamber round it, and a chimney over it", () => {
  const level = parseLevel(titleCave);
  const pad = level.pads.find((p) => p.kind === "start");
  const [c, j] = [Math.floor((pad.x0 + pad.x1) / 2 / TILE), pad.j];
  for (let up = 0; up < 12; up++) assert.equal(isSolid(level, c, j + up), false, `rock ${up} tiles over the pad`);
  for (let along = 0; along < 6; along++) assert.equal(isSolid(level, c + along, j + 2), false, `rock ${along} tiles right of the rocket`);
  // Crystals to look at, near enough to the rocket to be on the screen with it.
  const near = level.crystals.filter((k) => Math.hypot(k.x - (pad.x0 + pad.x1) / 2, k.y - pad.y) < 12);
  assert.ok(near.length >= 2, `${near.length} crystals near the rocket`);
});

test("left alone, the rocket stays on its pad and the clock never starts", () => {
  const world = createWorld(parseLevel(titleCave));
  const { x, y } = world.rocket;
  for (let i = 0; i < 20 * TICK_RATE; i++) advance(world, inputCode({}));
  assert.equal(world.rocket.state, "landed");
  assert.deepEqual([world.rocket.x, world.rocket.y], [x, y]);
  assert.equal(world.startTick, -1);
  assert.equal(world.tick, 20 * TICK_RATE);
});
