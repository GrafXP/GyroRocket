import { test } from "node:test";
import assert from "node:assert/strict";
import { summarize } from "../src/ui/summary.js";
import { WORLDS, LEVELS } from "../src/levels/index.js";

// Three small worlds, the last one a part of its own.
const level = (id, par, map = "*") => ({ id, name: `Level ${id}`, par, map });
const worlds = [
  { number: 1, name: "One", about: "The first.", part: 1, levels: [level("1-1", 10), level("1-2", 20, ".*.*.")] },
  { number: 2, name: "Two", about: "The second.", part: 1, colors: { rim: 0x123456 }, levels: [level("2-1", 30), level("2-2", 40)] },
  { number: 3, name: "Three", about: "The third.", part: 2, levels: [level("3-1", 50)] },
];
const finished = (...ids) => ({ levels: Object.fromEntries(ids.map((id) => [id, { best: 15, crystals: false }])) });
const states = (s) => s.worlds.map((w) => `${w.state}: ${w.levels.map((l) => l.state).join(" ")}`);

test("a new player is at the first level, with everything after it locked", () => {
  const s = summarize({ levels: {} }, { worlds });
  assert.equal(s.here, "1-1");
  assert.deepEqual([s.stars, s.of], [0, 15]);
  assert.deepEqual(states(s), ["open: open locked", "locked: locked locked", "locked: locked"]);
  assert.deepEqual(s.worlds.map((w) => w.here), [true, false, false]);
  assert.equal(s.worlds[0].levels[0].here, true);
  assert.equal(s.worlds[0].levels[0].opens, null);
});

test("a locked level says which one opens it, and so does a locked world", () => {
  const s = summarize({ levels: {} }, { worlds });
  assert.deepEqual(s.worlds[0].levels[1].opens, { id: "1-1", name: "Level 1-1" });
  assert.equal(s.worlds[0].opens, null);
  assert.deepEqual(s.worlds[1].opens, { id: "1-2", name: "Level 1-2" });
  assert.deepEqual(s.worlds[2].opens, { id: "2-2", name: "Level 2-2" });
});

test("finishing a world opens the next, and here moves on", () => {
  const s = summarize(finished("1-1", "1-2"), { worlds });
  assert.equal(s.here, "2-1");
  assert.deepEqual(states(s), ["done: done done", "open: open locked", "locked: locked"]);
  assert.deepEqual(s.worlds.map((w) => w.here), [false, true, false]);
  assert.equal(s.worlds[1].opens, null);
});

test("stars and best times are each level's, and add up", () => {
  const progress = { levels: { "1-1": { best: 8, crystals: true }, "1-2": { best: 25, crystals: false } } };
  const s = summarize(progress, { worlds });
  const [a, b] = s.worlds[0].levels;
  assert.deepEqual(a.stars, [true, true, true]);
  assert.deepEqual(b.stars, [true, false, false]);
  assert.deepEqual([a.best, b.best, s.worlds[1].levels[0].best], [8, 25, undefined]);
  assert.deepEqual([s.worlds[0].stars, s.worlds[0].of], [4, 6]);
  assert.deepEqual([s.stars, s.of], [4, 15]);
});

test("a level says its par and how many crystals it has", () => {
  const [a, b] = summarize({ levels: {} }, { worlds }).worlds[0].levels;
  assert.deepEqual([a.par, a.crystals], [10, 1]);
  assert.deepEqual([b.par, b.crystals], [20, 2]);
});

test("a part starts at its first world, and is done when every level in it is", () => {
  let s = summarize(finished("1-1", "1-2", "2-1"), { worlds });
  assert.deepEqual(s.worlds.map((w) => w.startsPart), [false, false, true]);
  assert.deepEqual(s.worlds.map((w) => w.partDone), [false, false, false]);
  s = summarize(finished("1-1", "1-2", "2-1", "2-2"), { worlds });
  assert.deepEqual(s.worlds.map((w) => w.partDone), [true, true, false]);
  assert.equal(s.here, "3-1");
});

test("with everything finished, here is the last level", () => {
  const s = summarize(finished("1-1", "1-2", "2-1", "2-2", "3-1"), { worlds });
  assert.equal(s.here, "3-1");
  assert.deepEqual(states(s), ["done: done done", "done: done done", "done: done"]);
  assert.equal(s.worlds[2].levels[0].here, true);
});

test("with every level opened, nothing is locked, and here stays where it was", () => {
  const s = summarize(finished("1-1"), { worlds, all: true });
  assert.equal(s.here, "1-2");
  assert.deepEqual(states(s), ["open: done open", "open: open open", "open: open"]);
  assert.ok(s.worlds.every((w) => w.opens === null && w.levels.every((l) => l.opens === null)));
});

test("the game's own worlds: ten of eight, two parts, and a new player's way in", () => {
  const s = summarize({ levels: {} });
  assert.equal(s.worlds.length, WORLDS.length);
  assert.equal(s.of, LEVELS.length * 3);
  assert.equal(s.here, "1-1");
  assert.deepEqual(s.worlds.filter((w) => w.startsPart).map((w) => w.number), [7]);
  assert.deepEqual(s.worlds.map((w) => w.state), ["open", ...Array(9).fill("locked")]);
  assert.deepEqual(s.worlds[1].opens, { id: "1-8", name: WORLDS[0].levels[7].name });
  assert.ok(s.worlds.every((w) => w.levels.every((l) => l.crystals >= 1 && l.par > 0)));
});
