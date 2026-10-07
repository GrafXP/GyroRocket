import { LEVELS } from "./levels/index.js";
import { parseLevel } from "./sim/level.js";
import { finishOf } from "./runs.js";
import { starsOf, beatsStarRun } from "./stars.js";

export { starsOf, starCount } from "./stars.js";

// What the player has done, and their settings, kept in localStorage. Everything
// here works on plain objects so the tests can run it without storage.
//
// progress = { levels: { "1-3": { best: seconds, run: { time, crystals } } } }:
// a level is in `levels` once finished. `best` is its fastest finish, while `run`
// is its finish with the most stars (the faster one when stars are tied).

const PROGRESS_KEY = "gyrorocket:progress";
const SETTINGS_KEY = "gyrorocket:settings";
const UNLOCK_KEY = "gyrorocket:unlock";

// fullTilt: degrees of tilt that steer all the way; fps: show the frame rate
// display (a debug option in the pause menu).
export const DEFAULT_SETTINGS = { fullTilt: 35, fps: false };

// Adds a finished run ({ time, crystals: true if it collected every crystal }) to
// `progress`: previous best stars, this run's stars, saved best stars, and whether
// it set a new fastest time. Stars from different runs are never combined.
export function recordRun(progress, level, { time, crystals }) {
  const old = progress.levels[level.id];
  const before = starsOf(level, old);
  const run = { time, crystals: !!crystals };
  const record = {
    best: Math.min(time, old?.best ?? Infinity),
    run: beatsStarRun(level, run, old?.run) ? run : old.run,
  };
  progress.levels[level.id] = record;
  return { before, after: starsOf(level, run), best: starsOf(level, record), newBest: !old || time < old.best };
}

// The first level is always open; each after it opens once the one before is finished.
export function isUnlocked(progress, id, levels = LEVELS) {
  const i = levels.findIndex((l) => l.id === id);
  return i === 0 || (i > 0 && !!progress.levels[levels[i - 1].id]);
}

// The level Continue plays: the first one not finished yet, or the last.
export function nextToPlay(progress, levels = LEVELS) {
  return levels.find((l) => !progress.levels[l.id]) ?? levels.at(-1);
}

export function loadProgress() {
  const p = read(PROGRESS_KEY);
  const progress = { levels: p?.levels && typeof p.levels === "object" ? p.levels : {} };
  // Old saves combined achievements across runs. Their surviving replay is the
  // actual run we can recover; without it, the next finish starts the run record.
  for (const level of LEVELS) {
    const record = progress.levels[level.id];
    if (!record || record.run) continue;
    const replay = finishOf(level.id, level);
    if (replay) {
      progress.levels[level.id] = {
        best: record.best,
        run: { time: replay.time, crystals: replay.crystals === parseLevel(level).crystals.length },
      };
    }
  }
  return progress;
}

export const saveProgress = (progress) => write(PROGRESS_KEY, progress);

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...read(SETTINGS_KEY) };
}

export const saveSettings = (settings) => write(SETTINGS_KEY, settings);

// A debug flag, for a device that hasn't got the progress: ?unlock in the URL
// opens every level on this device, and ?unlock=off locks them again.
export const allUnlocked = () => read(UNLOCK_KEY) === true;
export const setAllUnlocked = (on) => write(UNLOCK_KEY, on);

// localStorage can be missing, full or blocked (private windows, node); then
// nothing is remembered, and nothing breaks.
function read(key) {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {}
}
