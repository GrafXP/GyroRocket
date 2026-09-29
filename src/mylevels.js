import { WORLDS } from "./levels/index.js";
import { mapRows } from "./sim/level.js";
import { validateLevel } from "./sim/validate.js";
import { forgetRun } from "./runs.js";

// The levels made in the editor, kept in localStorage: the list of them
// (`gyrorocket:mylevels`, [{ id, name, width, height, updated }], last edited
// first) and each one on its own (`gyrorocket:mylevel:<id>`, { id, created,
// updated, level }). `level` is a level as in src/levels, plus `look`: which
// world's colours it borrows. A level's finish is its kept run (runs.js, as
// "my:<id>"), and goes with it.

const INDEX_KEY = "gyrorocket:mylevels";
const levelKey = (id) => `gyrorocket:mylevel:${id}`;

// A new level: a plain cave with a start pad and an exit pad, ready to fly.
export function newLevel(name = "My level") {
  const [w, h] = [48, 24];
  const rows = Array.from({ length: h }, (_, r) => (r === 0 || r === h - 1 ? "#".repeat(w) : `#${".".repeat(w - 2)}#`));
  rows[h - 2] = `#...SSS${".".repeat(w - 15)}EEE...#`;
  return { name, look: 1, fuel: 15, map: rows.join("\n") };
}

// A copy of a built-in level to change: its settings, and its world's look.
export function copyOfLevel({ id, world, colors, ...level }) {
  return { ...structuredClone(level), name: `${level.name} (copy)`.slice(0, 40), look: world ?? 1 };
}

export function listLevels() {
  const list = read(INDEX_KEY);
  return Array.isArray(list) ? list.filter((l) => l && typeof l.id === "string") : [];
}

export function loadLevel(id) {
  const record = read(levelKey(id));
  return record && typeof record.level?.map === "string" ? record : null;
}

// Saves a level under `id`, and says whether it could (the storage can be full).
export function saveLevel(id, level) {
  const old = loadLevel(id);
  const now = Date.now();
  if (!write(levelKey(id), { id, created: old?.created ?? now, updated: now, level })) return false;
  const rows = mapRows(level.map);
  const entry = { id, name: level.name ?? "", width: Math.max(...rows.map((r) => r.length)), height: rows.length, updated: now };
  return write(INDEX_KEY, [entry, ...listLevels().filter((l) => l.id !== id)]);
}

// Adds a level, and returns its new id (or null if it couldn't be saved).
export function createLevel(level) {
  let id;
  do id = Math.random().toString(36).slice(2, 10).padEnd(8, "0");
  while (read(levelKey(id)));
  return saveLevel(id, level) ? id : null;
}

export function duplicateLevel(id) {
  const record = loadLevel(id);
  return record ? createLevel({ ...record.level, name: `${record.level.name ?? ""} (copy)`.slice(0, 40) }) : null;
}

export function deleteLevel(id) {
  try {
    globalThis.localStorage?.removeItem(levelKey(id));
  } catch {}
  forgetRun(`my:${id}`);
  write(INDEX_KEY, listLevels().filter((l) => l.id !== id));
}

// The level with `id`, ready for the play page: its id is "my:<id>", and it has
// its look's colours. Null if there's no such level; throws if it's not a level
// the game can take (validateLevel).
export function playableLevel(id) {
  const record = loadLevel(id);
  if (!record) return null;
  const { look = 1 } = validateLevel(record.level);
  return { ...record.level, id: `my:${id}`, colors: WORLDS[look - 1]?.colors };
}

// localStorage can be missing, full or blocked (private windows, node).
function read(key) {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    if (!globalThis.localStorage) return false;
    globalThis.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
