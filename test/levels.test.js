import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { LEVELS, WORLDS, BIG_CAVE, levelById, nextLevel, endingOf } from "../src/levels/index.js";
import { parseLevel } from "../src/sim/level.js";
import { checkLevel } from "../src/sim/check.js";
import { flyLevel } from "../scripts/autopilot.js";
import { keepsToBigRules } from "./worlds.js";

// Each world's levels are checked and flown in world-<n>.test.js.

test("levels have ids in order, and know what comes next", () => {
  assert.deepEqual(
    WORLDS[0].levels.map((l) => l.id),
    ["1-1", "1-2", "1-3", "1-4", "1-5", "1-6", "1-7", "1-8"],
  );
  assert.equal(levelById("1-3").name, LEVELS[2].name);
  assert.equal(levelById("test").id, "test");
  assert.equal(levelById("big"), BIG_CAVE);
  assert.equal(levelById("9-9"), null);
  assert.equal(nextLevel("1-1").id, "1-2");
  assert.equal(nextLevel(LEVELS.at(-1).id), null);
});

test("every world has a test file of its own", () => {
  for (const world of WORLDS) {
    const file = new URL(`./world-${world.number}.test.js`, import.meta.url);
    assert.ok(existsSync(file) && readFileSync(file, "utf8").includes(`testWorld(${world.number})`), `test/world-${world.number}.test.js`);
  }
});

test("worlds come in parts, in order, and the core ends part one", () => {
  WORLDS.forEach((w, i) => assert.ok(w.part >= (WORLDS[i - 1]?.part ?? 1) && w.part <= (WORLDS[i - 1]?.part ?? 1) + 1, `world ${w.number}`));
  assert.equal(endingOf("6-8").title, "Out of the core!");
  assert.equal(endingOf("6-7"), null);
  assert.equal(endingOf("big"), null);
  assert.deepEqual(
    LEVELS.filter((l) => endingOf(l.id)).map((l) => l.id),
    WORLDS.filter((w) => w.ending).map((w) => w.levels.at(-1).id),
  );
});

test("the big cave is as big as a level can be, and can be flown within its tank", () => {
  const level = parseLevel(BIG_CAVE);
  assert.equal(level.width, 200);
  assert.equal(level.height, 150);
  assert.equal(Object.keys(BIG_CAVE.things).length, 50, "every character a map can name a thing with");
  assert.deepEqual(checkLevel(BIG_CAVE), []);
  const { failed, legs } = flyLevel(BIG_CAVE);
  assert.equal(failed, undefined, failed);
  keepsToBigRules(BIG_CAVE, legs);
});
