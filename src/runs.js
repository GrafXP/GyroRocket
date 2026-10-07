import { counts, unplayable } from "./replay.js";
import { levelById } from "./levels/index.js";
import { parseLevel } from "./sim/level.js";
import { beatsStarRun } from "./stars.js";

// The best run on each level, built-in or mine, kept in localStorage as its replay
// (replay.js), to watch, and to post once there's a server: `gyrorocket:run:<id>`,
// where `id` is the level's ("1-3", or "my:<id>" for my levels). Built-in levels
// keep the most stars, then the fastest; my levels keep the fastest finish.
// A run on another version of the level (its hash differs) or of the game (its sim
// version) is kept until a run on this one replaces it, however slow.

const runKey = (id) => `gyrorocket:run:${id}`;

export function loadRun(id) {
  try {
    const replay = JSON.parse(globalThis.localStorage?.getItem(runKey(id)) ?? "null");
    return replay && typeof replay.input === "string" ? replay : null;
  } catch {
    return null;
  }
}

// Whether `replay` beats the run kept for `id`, which was kept on `old`.
export function beats(replay, old, level = null) {
  if (!counts(replay)) return false;
  if (!counts(old) || old.level !== replay.level || old.sim !== replay.sim) return true;
  if (!level) return replay.time < old.time;
  const run = (r) => ({ time: r.time, crystals: r.crystals === level.crystals.length });
  return beatsStarRun(level, run(replay), run(old));
}

// Keeps `replay` as level `id`'s run if it counts and beats the one kept, and says
// whether it did (the storage can be full).
export function keepRun(id, replay) {
  const def = levelById(id);
  if (!beats(replay, loadRun(id), def ? parseLevel(def) : null)) return false;
  try {
    if (!globalThis.localStorage) return false;
    globalThis.localStorage.setItem(runKey(id), JSON.stringify(replay));
    return true;
  } catch {
    return false;
  }
}

// The kept run on level `def` (whose id is `id`) if it's a finish of this version of
// it, on this version of the game: for my levels, what makes one finished.
export function finishOf(id, def) {
  const replay = loadRun(id);
  return counts(replay) && !unplayable(def, replay) ? replay : null;
}

export function forgetRun(id) {
  try {
    globalThis.localStorage?.removeItem(runKey(id));
  } catch {}
}
