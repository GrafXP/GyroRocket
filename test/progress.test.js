import { test } from "node:test";
import assert from "node:assert/strict";
import { starsOf, starCount, recordRun, isUnlocked, nextToPlay, loadProgress, loadSettings, DEFAULT_SETTINGS } from "../src/progress.js";

const LEVELS = [
  { id: "1-1", par: 20 },
  { id: "1-2", par: 30 },
  { id: "1-3", par: 40 },
];

test("stars: one for finishing, one for par, one for every crystal", () => {
  const [level] = LEVELS;
  assert.deepEqual(starsOf(level, undefined), [false, false, false]);
  assert.deepEqual(starsOf(level, { best: 25, crystals: false }), [true, false, false]);
  assert.deepEqual(starsOf(level, { best: 20, crystals: true }), [true, true, true]);
  assert.equal(starCount(level, { best: 19, crystals: false }), 2);
});

test("runs add up: the best time, and crystals from any run", () => {
  const p = { levels: {} };
  const [level] = LEVELS;
  let r = recordRun(p, level, { time: 30, crystals: true });
  assert.deepEqual(r, { before: [false, false, false], after: [true, false, true], newBest: true });
  r = recordRun(p, level, { time: 18, crystals: false });
  assert.deepEqual(r, { before: [true, false, true], after: [true, true, true], newBest: true });
  r = recordRun(p, level, { time: 25, crystals: false });
  assert.equal(r.newBest, false);
  assert.deepEqual(p.levels["1-1"], { best: 18, crystals: true });
});

test("levels unlock one at a time, and Continue picks the first unfinished", () => {
  const p = { levels: {} };
  assert.deepEqual(
    LEVELS.map((l) => isUnlocked(p, l.id, LEVELS)),
    [true, false, false],
  );
  assert.equal(nextToPlay(p, LEVELS).id, "1-1");
  recordRun(p, LEVELS[0], { time: 50, crystals: false });
  assert.deepEqual(
    LEVELS.map((l) => isUnlocked(p, l.id, LEVELS)),
    [true, true, false],
  );
  assert.equal(nextToPlay(p, LEVELS).id, "1-2");
  for (const l of LEVELS) recordRun(p, l, { time: 1, crystals: true });
  assert.equal(nextToPlay(p, LEVELS).id, "1-3");
  assert.equal(isUnlocked(p, "nope", LEVELS), false);
});

test("with no storage, there's no progress and the default settings", () => {
  assert.deepEqual(loadProgress(), { levels: {} });
  assert.deepEqual(loadSettings(), DEFAULT_SETTINGS);
});
