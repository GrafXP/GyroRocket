import { segmentsNear } from "./outline.js";

const near = []; // reused, to keep the hot path free of garbage

// The deepest overlap between any of `circles` ({ x, y, r, foot }) and rock, or the
// rectangles in `boxes` ({ x0, y0, x1, y1 }: shut doors and gates), or null if none
// touch. Returns { depth, nx, ny, px, py, foot }: moving the circle `depth` along
// (nx, ny) frees it, and (px, py) is the point it touches.
export function deepestContact(outline, circles, boxes = []) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const c of circles) {
    x0 = Math.min(x0, c.x - c.r);
    y0 = Math.min(y0, c.y - c.r);
    x1 = Math.max(x1, c.x + c.r);
    y1 = Math.max(y1, c.y + c.r);
  }
  near.length = 0;
  segmentsNear(outline, x0, y0, x1, y1, near);

  let best = null;
  for (const c of circles) {
    for (const s of near) {
      const dx = s.bx - s.ax;
      const dy = s.by - s.ay;
      const t = ((c.x - s.ax) * dx + (c.y - s.ay) * dy) / (dx * dx + dy * dy);
      let depth, nx, ny, px, py;
      if (t > 0 && t < 1) {
        // Beside the surface: how far in front of it (or behind it) the centre is.
        const d = (c.x - s.ax) * s.nx + (c.y - s.ay) * s.ny;
        if (d >= c.r || d <= -c.r) continue;
        [depth, nx, ny] = [c.r - d, s.nx, s.ny];
        [px, py] = [s.ax + t * dx, s.ay + t * dy];
      } else {
        // Past an end: the corner. A centre behind this surface is the next one's job.
        [px, py] = t <= 0 ? [s.ax, s.ay] : [s.bx, s.by];
        const ex = c.x - px;
        const ey = c.y - py;
        if (ex * s.nx + ey * s.ny < 0) continue;
        const d = Math.hypot(ex, ey);
        if (d >= c.r) continue;
        [depth, nx, ny] = d > 1e-9 ? [c.r - d, ex / d, ey / d] : [c.r, s.nx, s.ny];
      }
      if (!best || depth > best.depth) best = { depth, nx, ny, px, py, foot: c.foot };
    }
  }

  for (const b of boxes) {
    if (b.x0 > x1 || b.x1 < x0 || b.y0 > y1 || b.y1 < y0) continue;
    for (const c of circles) {
      const px = Math.max(b.x0, Math.min(b.x1, c.x));
      const py = Math.max(b.y0, Math.min(b.y1, c.y));
      let depth, nx, ny;
      if (px !== c.x || py !== c.y) {
        const d = Math.hypot(c.x - px, c.y - py);
        if (d >= c.r) continue;
        [depth, nx, ny] = [c.r - d, (c.x - px) / d, (c.y - py) / d];
      } else {
        // The centre is inside: out through the nearest side.
        const sides = [
          [c.x - b.x0, -1, 0],
          [b.x1 - c.x, 1, 0],
          [c.y - b.y0, 0, -1],
          [b.y1 - c.y, 0, 1],
        ].sort((p, q) => p[0] - q[0]);
        [depth, nx, ny] = [c.r + sides[0][0], sides[0][1], sides[0][2]];
      }
      if (!best || depth > best.depth) best = { depth, nx, ny, px, py, foot: c.foot };
    }
  }
  return best;
}
