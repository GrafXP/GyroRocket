import { TILE, isSolid } from "./level.js";

// The rock's outline, by marching squares over the tile centres. Cell (c, j) spans
// the centres of tiles (c, j) to (c+1, j+1), so the outline runs along tile edges
// where walls are straight and cuts every corner at 45°, half a tile each way.
// Two tiles touching only at a corner count as joined, so there are no pinholes.
//
// Corners of a cell: 1 bottom-left, 2 bottom-right, 4 top-right, 8 top-left (rock).
// Points in a cell, in cell units: the corners, then the middles of its sides.
const [BL, BR, TR, TL, B, R, T, L] = [0, 1, 2, 3, 4, 5, 6, 7];
export const POINTS = [
  [0, 0], [1, 0], [1, 1], [0, 1],
  [0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5],
];

// Rock surfaces in each case, as [from, to] with the air on the left.
const EDGES = [
  [], [[L, B]], [[B, R]], [[L, R]],
  [[R, T]], [[L, T], [R, B]], [[B, T]], [[L, T]],
  [[T, L]], [[T, B]], [[B, L], [T, R]], [[T, R]],
  [[R, L]], [[R, B]], [[B, L]], [],
];

// The rock in each case, as one convex polygon, anticlockwise.
export const SOLID = [
  [], [BL, B, L], [B, BR, R], [BL, BR, R, L],
  [R, TR, T], [BL, B, R, TR, T, L], [B, BR, TR, T], [BL, BR, TR, T, L],
  [L, T, TL], [BL, B, T, TL], [B, BR, R, T, TL, L], [BL, BR, R, T, TL],
  [L, R, TR, TL], [BL, B, R, TR, TL], [B, BR, TR, TL, L], [BL, BR, TR, TL],
];

const NONE = Object.freeze([]);

// Builds the outline of a parsed level. It keeps its own copy of which tiles are
// rock (`solid`), so crumbling rock can fall away (setTile) while the level stays
// as parsed. Each cell's segments are { ax, ay, bx, by, nx, ny } in metres, with
// (nx, ny) the unit normal pointing into the air. The cells cover the level and
// half a tile past its edges; beyond that is all rock, but for the sky above a
// level with one (level.sky).
export function buildOutline(level) {
  const cols = level.width + 1;
  const rows = level.height + 1;
  const outline = {
    level,
    cols,
    rows,
    solid: level.solid.slice(),
    cases: new Uint8Array(cols * rows),
    cells: new Array(cols * rows).fill(NONE), // each cell's segments
    version: 0, // goes up whenever a tile changes, for the renderer
    // Every segment, for tests.
    get segs() {
      return this.cells.flat();
    },
  };
  for (let jj = 0; jj < rows; jj++) {
    for (let cc = 0; cc < cols; cc++) buildCell(outline, cc, jj);
  }
  return outline;
}

// Whether tile (c, j) is rock now: like isSolid, but crumbled tiles are air.
export function tileSolid(outline, c, j) {
  const { level, solid } = outline;
  if (c < 0 || j < 0 || c >= level.width || j >= level.height) return isSolid(level, c, j);
  return solid[j * level.width + c] === 1;
}

function buildCell(outline, cc, jj) {
  const [c, j] = [cc - 1, jj - 1];
  const at = (c, j) => tileSolid(outline, c, j);
  const k = at(c, j) | (at(c + 1, j) << 1) | (at(c + 1, j + 1) << 2) | (at(c, j + 1) << 3);
  const i = jj * outline.cols + cc;
  outline.cases[i] = k;
  const segs = EDGES[k].map(([p, q]) => {
    const ax = (c + 0.5 + POINTS[p][0]) * TILE;
    const ay = (j + 0.5 + POINTS[p][1]) * TILE;
    const bx = (c + 0.5 + POINTS[q][0]) * TILE;
    const by = (j + 0.5 + POINTS[q][1]) * TILE;
    const len = Math.hypot(bx - ax, by - ay);
    return { ax, ay, bx, by, nx: (ay - by) / len, ny: (bx - ax) / len };
  });
  outline.cells[i] = segs.length ? segs : NONE;
}

// Makes tile (c, j) rock or air, and redoes the four cells it's a corner of.
export function setTile(outline, c, j, solid) {
  const i = j * outline.level.width + c;
  if (outline.solid[i] === (solid ? 1 : 0)) return;
  outline.solid[i] = solid ? 1 : 0;
  for (const jj of [j, j + 1]) for (const cc of [c, c + 1]) buildCell(outline, cc, jj);
  outline.version++;
}

// The cell holding point (x, y), as its column and row in the outline's grid.
const cellCol = (x) => Math.floor(x / TILE - 0.5) + 1;

// Adds the segments of every cell touching the box to `out`, and returns it.
export function segmentsNear(outline, x0, y0, x1, y1, out = []) {
  const { cols, rows, cells } = outline;
  const cMin = Math.max(0, cellCol(x0));
  const cMax = Math.min(cols - 1, cellCol(x1));
  const jMin = Math.max(0, cellCol(y0));
  const jMax = Math.min(rows - 1, cellCol(y1));
  for (let jj = jMin; jj <= jMax; jj++) {
    for (let cc = cMin; cc <= cMax; cc++) {
      const segs = cells[jj * cols + cc];
      for (let s = 0; s < segs.length; s++) out.push(segs[s]);
    }
  }
  return out;
}

// Whether the point (x, y) is inside rock.
export function solidAt(outline, x, y) {
  const cc = cellCol(x);
  const jj = cellCol(y);
  if (cc < 0 || jj < 0 || cc >= outline.cols || jj >= outline.rows) return !(outline.level.sky && jj >= outline.rows);
  const poly = SOLID[outline.cases[jj * outline.cols + cc]];
  if (!poly.length) return false;
  const u = x / TILE - 0.5 - (cc - 1);
  const v = y / TILE - 0.5 - (jj - 1);
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = POINTS[poly[i]];
    const [bx, by] = POINTS[poly[(i + 1) % poly.length]];
    if ((bx - ax) * (v - ay) - (by - ay) * (u - ax) < 0) return false;
  }
  return true;
}

// Whether there's flat floor (rock below, air above) at height y under x: rock, or
// the top of one of `boxes` (shut doors and gates, moving blocks; not the shapes
// with a `poly`, which hang from the roof).
export function floorAt(outline, x, y, tolerance = 0.05, boxes = []) {
  if (boxes.some((b) => !b.poly && Math.abs(b.y1 - y) <= tolerance && x >= b.x0 && x <= b.x1)) return true;
  const e = 0.01; // so a point on a cell's edge sees both cells
  for (const s of segmentsNear(outline, x - e, y - e, x + e, y + e)) {
    if (s.ny > 0.99 && Math.abs(s.ay - y) <= tolerance && x >= Math.min(s.ax, s.bx) && x <= Math.max(s.ax, s.bx)) return true;
  }
  return false;
}
