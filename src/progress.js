import { LEVELS } from "./levels/index.js";

// What the player has done, and their settings, kept in localStorage. Everything
// here works on plain objects so the tests can run it without storage.
//
// progress = { levels: { "1-3": { best: seconds, crystals: true } } }: a level is
// in `levels` once finished; `best` is the fastest finish and `crystals` is whether
// any finish collected every crystal.

const PROGRESS_KEY = "gyrorocket:progress";
const SETTINGS_KEY = "gyrorocket:settings";

export const DEFAULT_SETTINGS = { fullTilt: 35 }; // degrees of tilt that steer all the way

// The stars a record earns on a level: [finished, beat par, every crystal].
export function starsOf(level, record) {
  return [!!record, !!record && record.best <= level.par, !!record?.crystals];
}

export const starCount = (level, record) => starsOf(level, record).filter(Boolean).length;

// Adds a finished run ({ time, crystals: true if it collected every crystal }) to
// `progress`, and says what changed: { before, after } stars and whether it's a new best.
export function recordRun(progress, level, { time, crystals }) {
  const old = progress.levels[level.id];
  const before = starsOf(level, old);
  const record = { best: Math.min(time, old?.best ?? Infinity), crystals: !!old?.crystals || crystals };
  progress.levels[level.id] = record;
  return { before, after: starsOf(level, record), newBest: !old || time < old.best };
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
  return { levels: p?.levels && typeof p.levels === "object" ? p.levels : {} };
}

export const saveProgress = (progress) => write(PROGRESS_KEY, progress);

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...read(SETTINGS_KEY) };
}

export const saveSettings = (settings) => write(SETTINGS_KEY, settings);

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
