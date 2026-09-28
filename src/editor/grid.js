import { mapRows, parseLevel, RESERVED } from "../sim/level.js";
import { validateLevel } from "../sim/validate.js";

// A level being edited: its map as a grid of character codes, row 0 at the top
// as the map is written, with its things and settings as they are in a level
// (sim/level.js). Column c, row r is cells[r * width + c].

export const ROCK = "#".charCodeAt(0);
export const AIR = ".".charCodeAt(0);

// The characters that are rock to the outline (sim/level.js), and the kinds of
// thing that are.
const SOLID_TILES = new Set([..."#%~<>^v"]);
const SOLID_KINDS = new Set(["flame", "blob", "fan", "magnet", "laser", "turret"]);

export function gridFromLevel({ map, things = {}, ...settings }) {
  const rows = mapRows(map);
  const width = Math.max(...rows.map((r) => r.length));
  const height = rows.length;
  const cells = new Uint8Array(width * height).fill(ROCK); // short rows are filled with rock
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) cells[r * width + c] = row.charCodeAt(c);
  });
  return { width, height, cells, things: structuredClone(things), settings: structuredClone(settings) };
}

export const rowOf = (grid, r) => String.fromCharCode(...grid.cells.subarray(r * grid.width, (r + 1) * grid.width));

// The level again: the map as rows of text, and only the things still on it.
export function levelFromGrid(grid) {
  const rows = Array.from({ length: grid.height }, (_, r) => rowOf(grid, r));
  const used = new Set(rows.join(""));
  const things = Object.fromEntries(Object.entries(grid.things).filter(([ch]) => used.has(ch)));
  const def = structuredClone(grid.settings);
  if (Object.keys(things).length) def.things = structuredClone(things);
  def.map = rows.join("\n");
  return def;
}

export const cloneGrid = (grid) => ({ ...grid, cells: grid.cells.slice(), things: structuredClone(grid.things), settings: structuredClone(grid.settings) });

export const inside = (grid, c, r) => c >= 0 && r >= 0 && c < grid.width && r < grid.height;
export const charAt = (grid, c, r) => (inside(grid, c, r) ? String.fromCharCode(grid.cells[r * grid.width + c]) : "#");

// The kind of thing a character is set up as, if it is one.
export const kindOf = (grid, ch) => (RESERVED.has(ch) ? null : (grid.things[ch]?.kind ?? null));

// Whether tile (c, r) is rock to the outline, as parseLevel would make it.
export function isSolidChar(grid, ch) {
  return SOLID_TILES.has(ch) || SOLID_KINDS.has(kindOf(grid, ch));
}

// Which tiles are rock, in the sim's order (row 0 at the bottom), for buildOutline.
export function solidOf(grid) {
  const { width, height } = grid;
  const solid = new Uint8Array(width * height);
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (isSolidChar(grid, String.fromCharCode(grid.cells[r * width + c]))) solid[(height - 1 - r) * width + c] = 1;
    }
  }
  return solid;
}

// A new grid with rows and columns added (more than 0: rock) or taken away (less
// than 0) on each side. Rising lava keeps its height in the cave, and the
// autopilot's route its fuel pads' columns.
export function resizeGrid(grid, { top = 0, bottom = 0, left = 0, right = 0 }) {
  const width = grid.width + left + right;
  const height = grid.height + top + bottom;
  const cells = new Uint8Array(width * height).fill(ROCK);
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const [oc, or] = [c - left, r - top];
      if (inside(grid, oc, or)) cells[r * width + c] = grid.cells[or * grid.width + oc];
    }
  }
  const settings = structuredClone(grid.settings);
  if (settings.rise) {
    const { from = 0, to } = settings.rise;
    settings.rise.from = Math.max(0, from + bottom);
    if (to !== undefined) settings.rise.to = Math.max(settings.rise.from + 1, to + bottom);
  }
  if (settings.route) settings.route = settings.route.replace(/F@(\d+)/g, (_, n) => `F@${Math.max(1, Number(n) + left)}`);
  return { ...grid, width, height, cells, settings };
}

// What's wrong with the level, if anything: the first problem validateLevel or
// parseLevel finds, as { text, at }, where `at` is the tile ({ c, r }) it names.
export function problemOf(grid) {
  const level = levelFromGrid(grid);
  try {
    validateLevel(level);
    parseLevel(level);
    return null;
  } catch (e) {
    const prefix = `${level.name ?? "level"}: `;
    const text = e.message.startsWith(prefix) ? e.message.slice(prefix.length) : e.message;
    const m = text.match(/^row (\d+), column (\d+): /);
    return { text: text[0].toUpperCase() + text.slice(1), at: m ? { c: Number(m[2]) - 1, r: Number(m[1]) - 1 } : null };
  }
}
