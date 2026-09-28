import { test } from "node:test";
import assert from "node:assert/strict";
import { LEVELS, WORLDS, levelById, nextLevel } from "../src/levels/index.js";
import { parseLevel } from "../src/sim/level.js";
import { checkLevel } from "../src/sim/check.js";
import { flyLevel } from "../scripts/autopilot.js";

test("levels have ids in order, and know what comes next", () => {
  assert.deepEqual(
    WORLDS[0].levels.map((l) => l.id),
    ["1-1", "1-2", "1-3", "1-4", "1-5", "1-6", "1-7", "1-8"],
  );
  assert.equal(levelById("1-3").name, LEVELS[2].name);
  assert.equal(levelById("test").id, "test");
  assert.equal(levelById("9-9"), null);
  assert.equal(nextLevel("1-1").id, "1-2");
  assert.equal(nextLevel(LEVELS.at(-1).id), null);
});

for (const def of LEVELS) {
  test(`${def.id} ${def.name}: can be flown from start to finish`, () => {
    const level = parseLevel(def);
    assert.ok(def.par > 0, "no par time");
    assert.ok(def.fuel > 0, "no tank size");
    assert.ok(level.crystals.length >= 1 && level.crystals.length <= 3, `${level.crystals.length} crystals`);

    assert.deepEqual(checkLevel(def), []);
  });
}

test("the autopilot can fly every level within its tank", () => {
  for (const def of LEVELS) {
    const { failed } = flyLevel(def);
    assert.equal(failed, undefined, `${def.id} ${def.name}: ${failed}`);
  }
});
