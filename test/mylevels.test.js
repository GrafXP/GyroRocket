import { test } from "node:test";
import assert from "node:assert/strict";
import { levelById, WORLDS } from "../src/levels/index.js";
import { parseLevel } from "../src/sim/level.js";
import { validateLevel } from "../src/sim/validate.js";
import { newLevel, copyOfLevel, listLevels, loadLevel, saveLevel, createLevel, duplicateLevel, deleteLevel, playableLevel } from "../src/mylevels.js";

// A localStorage kept in a Map, that can be made full.
function withStorage(fn) {
  const stored = new Map();
  const storage = { full: false };
  globalThis.localStorage = {
    getItem: (k) => stored.get(k) ?? null,
    setItem: (k, v) => {
      if (storage.full) throw new Error("QuotaExceededError");
      stored.set(k, v);
    },
    removeItem: (k) => stored.delete(k),
  };
  try {
    fn(storage, stored);
  } finally {
    delete globalThis.localStorage;
  }
}

test("a new level is a cave that parses, with a start and an exit", () => {
  const level = newLevel("Mine");
  assert.doesNotThrow(() => validateLevel(level));
  const parsed = parseLevel(level);
  assert.equal(parsed.width, 48);
  assert.equal(parsed.pads.length, 2);
});

test("a copy of a built-in level keeps its settings and its world's look", () => {
  const copy = copyOfLevel(levelById("6-8"));
  assert.equal(copy.name, "Escape (copy)");
  assert.equal(copy.look, 6);
  assert.equal(copy.sky, 14);
  assert.equal(copy.id, undefined);
  assert.doesNotThrow(() => validateLevel(copy));
  copy.rise.speed = 9;
  assert.equal(levelById("6-8").rise.speed, 1.5); // a copy, not the level itself
});

test("levels are saved, listed last edited first, copied and deleted", () => {
  withStorage(() => {
    assert.deepEqual(listLevels(), []);
    const a = createLevel(newLevel("A"));
    const b = createLevel(newLevel("B"));
    assert.deepEqual(listLevels().map((l) => l.name), ["B", "A"]);
    assert.deepEqual(listLevels()[0], { id: b, name: "B", width: 48, height: 24, updated: listLevels()[0].updated });
    assert.ok(saveLevel(a, { ...newLevel("A2"), fuel: 9 }));
    assert.deepEqual(listLevels().map((l) => l.name), ["A2", "B"]);
    assert.equal(loadLevel(a).level.fuel, 9);
    const c = duplicateLevel(a);
    assert.equal(loadLevel(c).level.name, "A2 (copy)");
    deleteLevel(a);
    assert.equal(loadLevel(a), null);
    assert.deepEqual(listLevels().map((l) => l.id), [c, b]);
  });
});

test("a full storage says so, and keeps what was there", () => {
  withStorage((storage) => {
    const a = createLevel(newLevel("A"));
    storage.full = true;
    assert.equal(saveLevel(a, newLevel("B")), false);
    assert.equal(createLevel(newLevel("C")), null);
    assert.equal(loadLevel(a).level.name, "A");
  });
});

test("my levels play with their look's colours, if they're levels the game can take", () => {
  withStorage((storage, stored) => {
    const id = createLevel({ ...newLevel("Blue"), look: 5 });
    const def = playableLevel(id);
    assert.equal(def.id, `my:${id}`);
    assert.equal(def.colors, WORLDS[4].colors);
    assert.equal(playableLevel("nope"), null);
    const record = JSON.parse(stored.get(`gyrorocket:mylevel:${id}`));
    record.level.fuel = -1;
    stored.set(`gyrorocket:mylevel:${id}`, JSON.stringify(record));
    assert.throws(() => playableLevel(id), /fuel must be/);
  });
});
