import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { levelById } from "../src/levels/index.js";
import { parseLevel } from "../src/sim/level.js";
import {
  starsOf,
  starCount,
  recordRun,
  isUnlocked,
  nextToPlay,
  loadProgress,
  saveProgress,
  loadSettings,
  allUnlocked,
  setAllUnlocked,
  DEFAULT_SETTINGS,
} from "../src/progress.js";

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

test("completion stars describe this run while the most-star run is kept", () => {
  const p = { levels: {} };
  const [level] = LEVELS;
  recordRun(p, level, { time: 18, crystals: true });
  const r = recordRun(p, level, { time: 25, crystals: false });
  assert.deepEqual(r, {
    before: [true, true, true],
    after: [true, false, false],
    best: [true, true, true],
    newBest: false,
  });
  assert.deepEqual(p.levels["1-1"], { best: 18, run: { time: 18, crystals: true } });
});

test("stars from separate runs never combine; tied stars keep the faster run", () => {
  const p = { levels: {} };
  const [level] = LEVELS;
  recordRun(p, level, { time: 30, crystals: true });
  const r = recordRun(p, level, { time: 18, crystals: false });
  assert.deepEqual(r, {
    before: [true, false, true],
    after: [true, true, false],
    best: [true, true, false],
    newBest: true,
  });
  assert.equal(starCount(level, p.levels[level.id]), 2);
  recordRun(p, level, { time: 25, crystals: true });
  assert.deepEqual(p.levels[level.id].run, { time: 18, crystals: false });
  recordRun(p, level, { time: 18, crystals: true });
  assert.equal(starCount(level, p.levels[level.id]), 3, "more stars wins even at the same time");
});

test("a slower run with more stars wins while the fastest time is remembered", () => {
  const p = { levels: {} };
  const [level] = LEVELS;
  recordRun(p, level, { time: 10, crystals: false });
  const r = recordRun(p, level, { time: 19, crystals: true });
  assert.equal(r.newBest, false);
  assert.deepEqual(r.best, [true, true, true]);
  recordRun(p, level, { time: 9, crystals: false });
  assert.deepEqual(p.levels[level.id], { best: 9, run: { time: 19, crystals: true } });
});

function withStorage(fn) {
  const stored = new Map();
  globalThis.localStorage = { getItem: (k) => stored.get(k) ?? null, setItem: (k, v) => stored.set(k, v) };
  try {
    fn(stored);
  } finally {
    delete globalThis.localStorage;
  }
}

test("the best star run and fastest time survive a reload", () => {
  withStorage(() => {
    const p = { levels: {} };
    recordRun(p, LEVELS[0], { time: 19, crystals: true });
    recordRun(p, LEVELS[0], { time: 10, crystals: false });
    saveProgress(p);
    assert.deepEqual(loadProgress(), p);
    assert.deepEqual(starsOf(LEVELS[0], loadProgress().levels["1-1"]), [true, true, true]);
  });
});

test("old combined progress recovers a single run from its saved replay", () => {
  withStorage((stored) => {
    const replay = JSON.parse(readFileSync(new URL("./replays/1-8.json", import.meta.url), "utf8"));
    const level = levelById("1-8");
    stored.set("gyrorocket:progress", JSON.stringify({ levels: { "1-8": { best: 1, crystals: true } } }));
    stored.set("gyrorocket:run:1-8", JSON.stringify(replay));
    const p = loadProgress();
    assert.deepEqual(p.levels["1-8"], {
      best: 1,
      run: { time: replay.time, crystals: replay.crystals === parseLevel(level).crystals.length },
    });
    assert.deepEqual(starsOf(level, p.levels["1-8"]), [true, replay.time <= level.par, false]);
    saveProgress(p);
    assert.deepEqual(loadProgress(), p);
  });
});

test("an old record without a replay keeps the level open and starts a run record on its next finish", () => {
  const p = { levels: { "1-1": { best: 10, crystals: true } } };
  assert.equal(isUnlocked(p, "1-2", LEVELS), true);
  const r = recordRun(p, LEVELS[0], { time: 25, crystals: false });
  assert.deepEqual(r.after, [true, false, false]);
  assert.deepEqual(r.best, [true, false, false]);
  assert.deepEqual(p.levels["1-1"], { best: 10, run: { time: 25, crystals: false } });
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

test("the unlock flag is off until set, and remembered", () => {
  assert.equal(allUnlocked(), false);
  const stored = new Map();
  globalThis.localStorage = { getItem: (k) => stored.get(k) ?? null, setItem: (k, v) => stored.set(k, v) };
  try {
    assert.equal(allUnlocked(), false);
    setAllUnlocked(true);
    assert.equal(allUnlocked(), true);
    setAllUnlocked(false);
    assert.equal(allUnlocked(), false);
  } finally {
    delete globalThis.localStorage;
  }
});
