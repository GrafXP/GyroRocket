import { segmentsNear } from "./outline.js";

const near = []; // reused, to keep the hot path free of garbage

// The deepest overlap between rock and any of `circles` ({ x, y, r, foot }), or null
// if none touch. Returns { depth, nx, ny, px, py, foot }: moving the circle `depth`
// along (nx, ny) frees it, and (px, py) is the point of rock it touches.
export function deepestContact(outline, circles) {
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
  return best;
}
