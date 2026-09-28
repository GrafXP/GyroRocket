import { kindOf, inside, AIR } from "./grid.js";

// Painting the grid. Every change goes through a stroke, which remembers what
// each tile was, so a stroke can be undone (or dropped, when a second finger turns
// it into a pinch) as one step.

const PAD_WIDTH = 3;
const UNIQUE = new Set([..."SErygb"]); // a level has one of each: painting one moves it
const AREA_TILES = new Set([..."#.%~RYGB"]);
const AREA_KINDS = new Set(["gate", "mover", "crusher"]);

// How a tile is painted: "pad" (a row PAD_WIDTH wide, the least a pad can be),
// "area" (a square as big as the brush), or "single" (one tile, whatever the brush).
export function paintStyle(grid, ch) {
  const kind = kindOf(grid, ch);
  if ("SEF".includes(ch) || kind === "switch") return "pad";
  if (AREA_TILES.has(ch) || AREA_KINDS.has(kind)) return "area";
  return "single";
}

export const createStroke = (grid) => ({ grid, from: new Map(), cleared: false });

function set(stroke, i, code) {
  const { cells } = stroke.grid;
  if (cells[i] === code) return;
  if (!stroke.from.has(i)) stroke.from.set(i, cells[i]);
  cells[i] = code;
}

function setAt(stroke, c, r, code) {
  if (inside(stroke.grid, c, r)) set(stroke, r * stroke.grid.width + c, code);
}

// Paints `ch` at tile (c, r) with a brush `size` tiles across.
export function paintAt(stroke, c, r, ch, size = 1) {
  const { grid } = stroke;
  const code = ch.charCodeAt(0);
  // There's only one start, exit and key of each colour: the others go.
  if (UNIQUE.has(ch) && (!stroke.cleared || !"SE".includes(ch))) {
    stroke.cleared = true;
    for (let i = 0; i < grid.cells.length; i++) {
      if (grid.cells[i] === code && (!"SE".includes(ch) || !stroke.from.has(i))) set(stroke, i, AIR);
    }
  }
  const style = paintStyle(grid, ch);
  if (style === "pad") {
    for (let k = 0; k < PAD_WIDTH; k++) setAt(stroke, c - 1 + k, r, code);
  } else if (style === "single" || size <= 1) {
    setAt(stroke, c, r, code);
  } else {
    const d = Math.floor((size - 1) / 2);
    for (let dr = -d; dr < size - d; dr++) for (let dc = -d; dc < size - d; dc++) setAt(stroke, c + dc, r + dr, code);
  }
}

// Paints along the line from (c0, r0) to (c1, r1), so a quick drag leaves no gaps.
export function paintLine(stroke, c0, r0, c1, r1, ch, size) {
  const n = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0));
  for (let k = 1; k <= n; k++) {
    paintAt(stroke, Math.round(c0 + ((c1 - c0) * k) / n), Math.round(r0 + ((r1 - r0) * k) / n), ch, size);
  }
}

// Fills the rectangle with corners (c0, r0) and (c1, r1) with `ch`.
export function paintRect(stroke, c0, r0, c1, r1, ch) {
  const code = ch.charCodeAt(0);
  for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r++) {
    for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++) setAt(stroke, c, r, code);
  }
}

// Fills the tiles joined to (c, r) (side by side, not across corners) that are
// the same as it with `ch`.
export function floodFill(stroke, c, r, ch) {
  const { grid } = stroke;
  if (!inside(grid, c, r)) return;
  const { width, cells } = grid;
  const old = cells[r * width + c];
  const code = ch.charCodeAt(0);
  if (old === code) return;
  const todo = [r * width + c];
  set(stroke, todo[0], code);
  while (todo.length) {
    const i = todo.pop();
    const [tc, tr] = [i % width, Math.floor(i / width)];
    for (const [nc, nr] of [
      [tc + 1, tr],
      [tc - 1, tr],
      [tc, tr + 1],
      [tc, tr - 1],
    ]) {
      const n = nr * width + nc;
      if (inside(grid, nc, nr) && cells[n] === old) {
        set(stroke, n, code);
        todo.push(n);
      }
    }
  }
}

// The stroke's changes as [index, from, to] triples, for undo and redo; none if
// it changed nothing in the end.
export function strokeChanges(stroke) {
  const { cells } = stroke.grid;
  return [...stroke.from].filter(([i, from]) => cells[i] !== from).map(([i, from]) => [i, from, cells[i]]);
}

// Puts back every tile the stroke changed.
export function revertStroke(stroke) {
  for (const [i, from] of stroke.from) stroke.grid.cells[i] = from;
  stroke.from.clear();
  stroke.cleared = false;
}
