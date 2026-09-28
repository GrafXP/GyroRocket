import { FLAME, BLOB, FAN, MAGNET, MOVER, CRUSHER, LASER, TURRET, STALACTITE } from "../sim/level.js";
import { isThingLabel, MAX_THINGS, THING_SETTINGS, validateLevel } from "../sim/validate.js";
import { charAt, inside, levelFromGrid } from "./grid.js";

const DEFAULTS = {
  switch: { time: 0 },
  gate: {},
  flame: { ...FLAME, facing: "up" },
  blob: BLOB,
  fan: { ...FAN, facing: "up" },
  magnet: MAGNET,
  mover: { ...MOVER, to: [3, 0] },
  crusher: { ...CRUSHER, to: [0, -3] },
  laser: { ...LASER, facing: "up" },
  turret: TURRET,
  stalactite: STALACTITE,
};
const LABELS = [..."1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"].filter(isThingLabel);
export const thingDefaults = (kind) => {
  if (!Object.hasOwn(THING_SETTINGS, kind)) throw new Error("Unknown kind of thing");
  return { kind, ...structuredClone(DEFAULTS[kind]) };
};
export const targetsFor = (grid) =>
  Object.entries(grid.things)
    .filter(([ch, t]) => (t.kind === "gate" || t.kind === "laser") && grid.cells.includes(ch.charCodeAt(0)))
    .map(([ch]) => ch);
export const triggersFor = (grid) =>
  [..."rygb"]
    .filter((ch) => grid.cells.includes(ch.charCodeAt(0)))
    .concat(
      Object.entries(grid.things)
        .filter(([ch, t]) => t.kind === "switch" && grid.cells.includes(ch.charCodeAt(0)))
        .map(([ch]) => ch),
    );

// Keeps unused definitions while the session is open: undo and the palette may
// still need them. Never reuses an existing or as-yet undefined map character.
export function addThing(grid, kind) {
  if (Object.keys(grid.things).length >= MAX_THINGS) throw new Error("This level has too many things");
  const ch = LABELS.find((c) => !Object.hasOwn(grid.things, c) && !grid.cells.includes(c.charCodeAt(0)));
  if (!ch) throw new Error("All the available thing labels are in use");
  const thing = thingDefaults(kind);
  if (kind === "switch" && targetsFor(grid).length) thing.opens = targetsFor(grid)[0];
  grid.things[ch] = thing;
  return ch;
}

// Inspecting a plain flame or stalactite gives that instance its own settings.
// A stalactite's complete column is one instance.
export function customizeTile(grid, c, r) {
  const tile = charAt(grid, c, r);
  if (grid.things[tile]) return tile;
  const facing = { ">": "right", "<": "left", "^": "up", v: "down" }[tile];
  if (!facing && tile !== "!") return null;
  const ch = addThing(grid, facing ? "flame" : "stalactite");
  if (facing) grid.things[ch].facing = facing;
  else while (r > 0 && charAt(grid, c, r - 1) === tile) r--;
  do {
    grid.cells[r * grid.width + c] = ch.charCodeAt(0);
    r++;
  } while (!facing && inside(grid, c, r) && charAt(grid, c, r) === tile);
  return ch;
}

export function validateThingEdit(grid, ch, thing) {
  validateLevel({ ...levelFromGrid(grid), things: { ...grid.things, [ch]: thing } });
  if (thing.to && !thing.to.some(Boolean)) throw new Error("Move at least one tile from the starting position");
  if (thing.kind === "switch" && !targetsFor(grid).includes(String(thing.opens))) throw new Error("Choose a gate or laser for this switch");
  return thing;
}

export function validateSettingsEdit(grid, settings) {
  validateLevel({ ...settings, map: levelFromGrid(grid).map, things: grid.things });
  if (settings.sky >= grid.height) throw new Error(`Sky must be fewer than ${grid.height} rows`);
  if (settings.rise) {
    const { speed, from = 0, to = grid.height, after } = settings.rise;
    if (!speed) throw new Error("Choose a speed for the rising lava");
    if (to <= from) throw new Error("Rising lava must finish above where it starts");
    if (after !== undefined && !triggersFor(grid).includes(String(after))) throw new Error("Choose a key or switch on the map to start the lava");
  }
  return settings;
}

// Connected shapes, in editor tiles. Movers/gates can have several disconnected
// instances of the same label; paths and handles belong to the tapped instance.
export function thingShapes(grid, label = null) {
  const seen = new Uint8Array(grid.cells.length);
  const shapes = [];
  for (let i = 0; i < grid.cells.length; i++) {
    const ch = String.fromCharCode(grid.cells[i]);
    if (seen[i] || (label !== null ? ch !== label : !grid.things[ch])) continue;
    const kind = grid.things[ch]?.kind;
    const grouped = ["gate", "mover", "crusher", "switch", "stalactite"].includes(kind);
    const todo = [i];
    let [c0, c1, r0, r1] = [i % grid.width, i % grid.width, Math.floor(i / grid.width), Math.floor(i / grid.width)];
    seen[i] = 1;
    while (todo.length) {
      const n = todo.pop();
      const [c, r] = [n % grid.width, Math.floor(n / grid.width)];
      c0 = Math.min(c0, c);
      c1 = Math.max(c1, c);
      r0 = Math.min(r0, r);
      r1 = Math.max(r1, r);
      if (!grouped) continue;
      const dirs =
        kind === "switch"
          ? [
              [-1, 0],
              [1, 0],
            ]
          : kind === "stalactite"
            ? [
                [0, -1],
                [0, 1],
              ]
            : [
                [-1, 0],
                [1, 0],
                [0, -1],
                [0, 1],
              ];
      for (const [dc, dr] of dirs) {
        const j = (r + dr) * grid.width + c + dc;
        if (inside(grid, c + dc, r + dr) && !seen[j] && grid.cells[j] === grid.cells[i]) {
          seen[j] = 1;
          todo.push(j);
        }
      }
    }
    shapes.push({ ch, kind, c0, c1, r0, r1, c: (c0 + c1 + 1) / 2, r: (r0 + r1 + 1) / 2 });
  }
  return shapes;
}
