import { mapRows, RESERVED } from "./level.js";

// What a level from outside src/levels may hold: one made in the editor, pasted
// in, or downloaded. parseLevel trusts what it's given and spreads a thing's
// settings into its own objects, so a setting it doesn't expect, or a period of 0,
// could break the sim. This refuses anything it doesn't know, and numbers out of
// range, before parseLevel sees it.

export const MAX_WIDTH = 200; // tiles
export const MAX_HEIGHT = 150;
export const MIN_WIDTH = 16;
export const MIN_HEIGHT = 12;
export const MAX_THINGS = 60;
export const MAX_NAME = 40;
export const LOOKS = 7; // one per world: its rock colours and background

const number = (min, max) => ({ type: "number", min, max });
const whole = (min, max) => ({ type: "whole", min, max });
const oneOf = (...values) => ({ type: "oneOf", values });
const FACING = oneOf("left", "right", "up", "down");
const TIME = number(0.05, 60); // on, off, period and the like: seconds
const WARN = number(0, 10);
const OFFSET = number(0, 600);
const CYCLE = { on: TIME, off: TIME, warn: WARN, offset: OFFSET };

// Each kind of thing's settings (sim/level.js has what they mean, and their defaults).
export const THING_SETTINGS = {
  switch: { opens: { type: "label" }, time: number(0, 600) },
  gate: {},
  flame: { facing: FACING, length: whole(1, 40), mode: oneOf("cycle", "always", "near"), reach: number(0.5, 40), ...CYCLE },
  blob: { height: whole(1, 40), period: TIME, warn: WARN, offset: OFFSET },
  fan: { facing: FACING, length: whole(1, 60), width: whole(1, 12), strength: number(0, 60), mode: oneOf("always", "cycle"), ...CYCLE },
  magnet: { strength: number(0, 60), range: number(1, 60), push: { type: "boolean" }, mode: oneOf("always", "cycle"), ...CYCLE },
  mover: { to: { type: "vector" }, period: number(0.5, 60), offset: OFFSET },
  crusher: { to: { type: "vector" }, rest: number(0, 60), warn: WARN, slam: number(0.05, 10), hold: number(0, 60), back: number(0.05, 30), offset: OFFSET },
  laser: { facing: FACING, mode: oneOf("always", "cycle"), ...CYCLE },
  turret: { range: number(1, 100), windup: number(0.1, 10), reload: number(0.1, 30), speed: number(0.5, 40), damage: number(1, 100), offset: OFFSET },
  stalactite: { reach: number(0.5, 40), warn: WARN, damage: number(1, 100) },
};

// The level's own settings.
export const LEVEL_SETTINGS = {
  format: whole(1, 1),
  name: { type: "string", max: MAX_NAME },
  look: whole(1, LOOKS),
  fuel: number(1, 300),
  par: number(1, 3600),
  route: { type: "string", max: 200, pattern: /^[0-9A-Za-z@ ]*$/ },
  dark: { type: "boolean" },
  sky: whole(1, MAX_HEIGHT - 1),
  crumble: number(0.1, 10),
  rise: { type: "rise" },
  map: { type: "map" },
  things: { type: "things" },
};
export const RISE_SETTINGS = { speed: number(0.1, 20), from: number(0, MAX_HEIGHT), to: number(0, MAX_HEIGHT), after: { type: "label" }, delay: number(0, 600) };

// A character that can name a thing on the map.
export const isThingLabel = (ch) => typeof ch === "string" && /^[0-9A-Za-z]$/.test(ch) && !RESERVED.has(ch);
const TILES = /^[#.*~SEF<>^vrygbRYGB!%0-9A-Za-z]*$/;

const plain = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

// Checks one value against its spec; returns what's wrong with it, or null.
function problem(spec, v) {
  switch (spec.type) {
    case "number":
    case "whole": {
      const ok = typeof v === "number" && Number.isFinite(v) && v >= spec.min && v <= spec.max && (spec.type === "number" || Number.isInteger(v));
      if (ok) return null;
      const what = spec.type === "whole" ? "a whole number" : "a number";
      return spec.min === spec.max ? `must be ${spec.min}` : `must be ${what} from ${spec.min} to ${spec.max}`;
    }
    case "oneOf":
      return spec.values.includes(v) ? null : `must be ${spec.values.join(", ").replace(/, ([^,]*)$/, " or $1")}`;
    case "boolean":
      return typeof v === "boolean" ? null : "must be true or false";
    case "string":
      if (typeof v !== "string") return "must be text";
      if (v.length > spec.max) return `must be at most ${spec.max} characters`;
      return spec.pattern && !spec.pattern.test(v) ? "has characters it can't have" : null;
    case "label":
      return (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 9) || (typeof v === "string" && /^[0-9A-Za-z]$/.test(v))
        ? null
        : "must be a letter or digit on the map";
    case "vector":
      return Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n) && Math.abs(n) <= MAX_WIDTH)
        ? null
        : "must be [dx, dy]: two whole numbers of tiles";
  }
  return "isn't allowed";
}

// Checks a level from outside, and throws an Error saying what's wrong with the
// first problem it finds. Returns the level if it's fine.
export function validateLevel(def) {
  if (!plain(def)) throw new Error("that isn't a level");
  for (const [key, v] of Object.entries(def)) {
    const spec = Object.hasOwn(LEVEL_SETTINGS, key) ? LEVEL_SETTINGS[key] : null;
    if (!spec) throw new Error(`a level has no setting "${key}"`);
    if (spec.type === "map") checkMap(v);
    else if (spec.type === "things") checkThings(v);
    else if (spec.type === "rise") checkRise(v);
    else {
      const wrong = problem(spec, v);
      if (wrong) throw new Error(`${key} ${wrong}`);
    }
  }
  if (def.map === undefined) throw new Error("a level needs a map");
  return def;
}

function checkMap(map) {
  if (typeof map !== "string") throw new Error("the map must be text");
  if (map.length > (MAX_WIDTH + 8) * (MAX_HEIGHT + 2)) throw new Error("the map is too big");
  const rows = map.trim() ? mapRows(map) : [];
  const width = Math.max(0, ...rows.map((r) => r.length));
  if (width < MIN_WIDTH || width > MAX_WIDTH) throw new Error(`the map must be ${MIN_WIDTH} to ${MAX_WIDTH} tiles wide, not ${width}`);
  if (rows.length < MIN_HEIGHT || rows.length > MAX_HEIGHT) throw new Error(`the map must be ${MIN_HEIGHT} to ${MAX_HEIGHT} tiles high, not ${rows.length}`);
  rows.forEach((row, r) => {
    if (!TILES.test(row)) {
      let c = 0;
      while (TILES.test(row[c])) c++;
      throw new Error(`row ${r + 1}, column ${c + 1}: "${row[c]}" isn't a tile`);
    }
  });
}

function checkThings(things) {
  if (!plain(things)) throw new Error("things must be a list of things by their letter");
  const labels = Object.keys(things);
  if (labels.length > MAX_THINGS) throw new Error(`a level can have at most ${MAX_THINGS} things`);
  for (const label of labels) {
    if (!isThingLabel(label)) throw new Error(`"${label}" can't name a thing: use a digit, or a letter the map doesn't use for something else`);
    const thing = things[label];
    if (!plain(thing)) throw new Error(`thing ${label} must be a list of settings`);
    const settings = Object.hasOwn(THING_SETTINGS, thing.kind) ? THING_SETTINGS[thing.kind] : null;
    if (!settings) throw new Error(`thing ${label}: "${thing.kind}" isn't a kind of thing`);
    for (const [key, v] of Object.entries(thing)) {
      if (key === "kind") continue;
      if (!Object.hasOwn(settings, key)) throw new Error(`thing ${label} (${thing.kind}) has no setting "${key}"`);
      const wrong = problem(settings[key], v);
      if (wrong) throw new Error(`thing ${label} (${thing.kind}): ${key} ${wrong}`);
    }
  }
}

function checkRise(rise) {
  if (!plain(rise)) throw new Error("rise must be the rising lava's settings");
  for (const [key, v] of Object.entries(rise)) {
    if (!Object.hasOwn(RISE_SETTINGS, key)) throw new Error(`rising lava has no setting "${key}"`);
    const wrong = problem(RISE_SETTINGS[key], v);
    if (wrong) throw new Error(`rising lava's ${key} ${wrong}`);
  }
}
