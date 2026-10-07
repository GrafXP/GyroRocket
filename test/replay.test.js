import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { levelById } from "../src/levels/index.js";
import { parseLevel } from "../src/sim/level.js";
import { SIM_VERSION } from "../src/sim/world.js";
import { inputCode } from "../src/sim/input.js";
import { levelHash } from "../src/hash.js";
import { packInput, unpackInput, checkReplay, playBack, counts } from "../src/replay.js";
import { loadRun, keepRun, finishOf, forgetRun } from "../src/runs.js";
import { GOLDEN, WITH_RESTARTS } from "../scripts/golden.js";
import { random } from "./helpers.js";

const dir = new URL("./replays/", import.meta.url);
const golden = (file) => JSON.parse(readFileSync(new URL(file, dir), "utf8"));
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

test("there's a golden replay for each level scripts/golden.js records", () => {
  assert.deepEqual(files.sort(), [...GOLDEN.map((id) => `${id}.json`), `${WITH_RESTARTS}-restarts.json`].sort());
});

// When one of these fails, the sim has changed how runs go. If that was meant,
// bump SIM_VERSION (sim/world.js) and record them again: npm run golden.
for (const file of files) {
  test(`golden replay ${file} lands on the exit on the same tick`, async () => {
    const replay = golden(file);
    assert.equal(replay.sim, SIM_VERSION, "recorded on another SIM_VERSION: npm run golden");
    const result = await checkReplay(levelById(replay.id), replay);
    assert.ok(result.ok, result.why);
    assert.equal(result.tick, replay.ticks);
  });
}

test("the golden run with restarts has a crash and a restart from the menu in it", async () => {
  const replay = golden(`${WITH_RESTARTS}-restarts.json`);
  assert.equal(replay.restarts, 2);
  const codes = await unpackInput(replay.input);
  assert.equal(codes.filter((c) => c === inputCode({ restart: true })).length, 1);
});

test("input packs and unpacks to the same codes", async () => {
  const rand = random(3);
  const codes = Uint16Array.from({ length: 5000 }, (_, i) =>
    inputCode({ steer: i % 97 === 0 ? null : Math.sin(i / 50) + (rand() - 0.5) * 0.05, thrust: rand() < 0.5, slow: i % 300 < 20 }),
  );
  assert.deepEqual(await unpackInput(await packInput(codes)), codes);
  assert.deepEqual(await unpackInput(await packInput(new Uint16Array())), new Uint16Array());
  // Tilt steering changes a little each tick: a minute of it is a few KB.
  const minute = await packInput(codes.subarray(0, 3600));
  assert.ok(minute.length < 6000, `${minute.length} chars a minute`);
});

test("a doctored replay is caught", async () => {
  const replay = golden("1-8.json");
  const def = levelById("1-8");
  const codes = await unpackInput(replay.input);
  const nudged = codes.slice();
  nudged.fill(inputCode({ steer: 1, thrust: true }), 1000, 1030);
  const fail = async (changed, why) => {
    const result = await checkReplay(def, { ...replay, ...changed });
    assert.equal(result.ok, false, JSON.stringify(changed).slice(0, 80));
    assert.match(result.why, why);
  };
  await fail({ input: await packInput(nudged) }, /exit|tick|time|crystals/);
  await fail({ time: replay.time - 1 }, /time/);
  await fail({ crystals: replay.crystals + 1 }, /crystals/);
  await fail({ restarts: 1 }, /restarts/);
  await fail({ ticks: replay.ticks + 1 }, /ticks/);
  const longer = Uint16Array.from([...codes, 0, 0]);
  await fail({ input: await packInput(longer), ticks: longer.length }, /tick/);
  await fail({ input: await packInput(codes.subarray(0, 100)), ticks: 100 }, /doesn't land/);
  await fail({ sim: SIM_VERSION + 1 }, /version of the game/);
  await fail({ level: levelHash(levelById("1-7")) }, /version of the level/);
  await fail({ cheated: true }, /cheat/);
  await fail({ input: "not base64!" }, /damaged|read/);
  assert.equal((await checkReplay(levelById("1-7"), replay)).ok, false);
});

test("playing back stops at the finish", async () => {
  const replay = golden("2-6.json");
  const codes = await unpackInput(replay.input);
  const run = playBack(levelById("2-6"), Uint16Array.from([...codes, ...codes]));
  assert.equal(run.finished, true);
  assert.equal(run.tick, replay.ticks);
  assert.equal(run.world.tick, replay.ticks);
});

test("a level's hash is what's flown, not its name, par, route, look or indent", () => {
  const def = levelById("1-3");
  const hash = levelHash(def);
  assert.match(hash, /^[0-9a-f]{32}$/);
  assert.equal(levelHash({ ...def, name: "Renamed", par: 99, route: "E", look: 4, id: "x", colors: {} }), hash);
  assert.equal(levelHash({ ...def, map: def.map.replace(/\n/g, "\n  ") }), hash);
  assert.notEqual(levelHash({ ...def, map: def.map.replace("*", ".") }), hash);
  assert.notEqual(levelHash({ ...def, fuel: def.fuel + 1 }), hash);
  assert.notEqual(levelHash({ ...def, dark: true }), hash);
  const big = levelById("7-8");
  const [label, thing] = Object.entries(big.things)[0];
  assert.notEqual(levelHash({ ...big, things: { ...big.things, [label]: { ...thing, offset: (thing.offset ?? 0) + 0.5 } } }), levelHash(big));
  assert.equal(levelHash({ ...big, things: Object.fromEntries(Object.entries(big.things).reverse()) }), levelHash(big));
});

// A localStorage kept in a Map.
function withStorage(fn) {
  const stored = new Map();
  globalThis.localStorage = { getItem: (k) => stored.get(k) ?? null, setItem: (k, v) => stored.set(k, v), removeItem: (k) => stored.delete(k) };
  try {
    return fn(stored);
  } finally {
    delete globalThis.localStorage;
  }
}

test("the best run on a level is kept: tied stars use the fastest finish that counts, on this version", () => {
  const replay = golden("1-8.json");
  const def = levelById("1-8");
  withStorage(() => {
    assert.equal(counts(replay), true);
    assert.equal(keepRun("1-8", { ...replay, assisted: true }), false, "the autopilot's");
    assert.equal(keepRun("1-8", { ...replay, cheated: true }), false, "a cheat's");
    assert.equal(keepRun("1-8", { ...replay, finished: false }), false, "unfinished");
    assert.equal(loadRun("1-8"), null);
    assert.equal(keepRun("1-8", replay), true);
    assert.equal(keepRun("1-8", { ...replay, time: replay.time + 1 }), false, "slower");
    assert.equal(keepRun("1-8", { ...replay, time: replay.time - 1 }), true, "faster");
    assert.equal(keepRun("1-8", { ...replay, level: "another", time: replay.time + 5 }), true, "on a changed level, however slow");
    assert.equal(keepRun("1-8", { ...replay, time: replay.time + 5 }), true, "and back");
    assert.equal(finishOf("1-8", def)?.time, replay.time + 5);
    assert.equal(finishOf("1-8", { ...def, map: def.map.replace("*", ".") }), null, "a changed level isn't finished");
    assert.equal(finishOf("1-8", { ...def, name: "Renamed" })?.time, replay.time + 5, "a renamed one is");
    forgetRun("1-8");
    assert.equal(loadRun("1-8"), null);
  });
});

test("saved replays keep the most stars, then the fastest run", () => {
  const replay = golden("1-8.json");
  const def = levelById("1-8");
  const all = parseLevel(def).crystals.length;
  withStorage(() => {
    const fast = { ...replay, time: def.par / 2, crystals: 0 };
    const threeStars = { ...replay, time: def.par, crystals: all };
    assert.equal(keepRun(def.id, fast), true);
    assert.equal(keepRun(def.id, threeStars), true, "a slower three-star run beats a two-star run");
    assert.deepEqual(loadRun(def.id), threeStars);
    assert.equal(keepRun(def.id, { ...fast, time: 1 }), false, "a faster run with fewer stars cannot replace it");
    const fasterThreeStars = { ...threeStars, time: def.par - 1 };
    assert.equal(keepRun(def.id, fasterThreeStars), true, "with three stars tied, faster wins");
    assert.deepEqual(loadRun(def.id), fasterThreeStars);
    assert.equal(keepRun(def.id, fasterThreeStars), false, "an identical result keeps the saved replay");
  });
});

test("my levels continue to keep their fastest finish", () => {
  const replay = golden("1-8.json");
  withStorage(() => {
    assert.equal(keepRun("my:test", { ...replay, time: 30, crystals: 3 }), true);
    assert.equal(keepRun("my:test", { ...replay, time: 20, crystals: 0 }), true);
    assert.equal(keepRun("my:test", { ...replay, time: 25, crystals: 3 }), false);
    assert.equal(loadRun("my:test").time, 20);
  });
});
