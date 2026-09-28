import { segmentsNear } from "./outline.js";

const near = []; // reused, to keep the hot path free of garbage

// The deepest overlap between any of `circles` ({ x, y, r, foot }) and rock, or the
// rectangles in `boxes` ({ x0, y0, x1, y1 }: shut doors and gates, moving blocks),
// or null if none touch. A box with a `poly` (a convex polygon, anticlockwise, as
// [x, y] points inside its rectangle) is that shape instead: a stalactite. Returns
// { depth, nx, ny, px, py, foot, box }: moving the circle `depth` along (nx, ny)
// frees it, (px, py) is the point it touches, and `box` is the box it touches, if
// it's one.
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
      if (b.poly) {
        const hit = polyContact(b.poly, c);
        if (hit && (!best || hit.depth > best.depth)) best = { ...hit, foot: c.foot, box: b };
        continue;
      }
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
      if (!best || depth > best.depth) best = { depth, nx, ny, px, py, foot: c.foot, box: b };
    }
  }
  return best;
}

// How deep circle `c` is in the convex polygon `poly` (anticlockwise), as
// { depth, nx, ny, px, py } like deepestContact, or null if it isn't.
export function polyContact(poly, c) {
  let inside = true;
  let nearest = null; // the closest edge, from inside: { d, nx, ny }
  let closest = null; // the closest point on the edges, from outside: { d, px, py }
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % poly.length];
    const [dx, dy] = [bx - ax, by - ay];
    const len = Math.hypot(dx, dy);
    const [nx, ny] = [dy / len, -dx / len]; // outwards
    const d = (c.x - ax) * nx + (c.y - ay) * ny;
    if (d > 0) inside = false;
    if (!nearest || d > nearest.d) nearest = { d, nx, ny };
    const t = Math.max(0, Math.min(1, ((c.x - ax) * dx + (c.y - ay) * dy) / (len * len)));
    const [px, py] = [ax + dx * t, ay + dy * t];
    const e = Math.hypot(c.x - px, c.y - py);
    if (!closest || e < closest.d) closest = { d: e, px, py };
  }
  if (inside) {
    const { d, nx, ny } = nearest;
    return { depth: c.r - d, nx, ny, px: c.x - nx * d, py: c.y - ny * d };
  }
  const { d, px, py } = closest;
  if (d >= c.r) return null;
  return { depth: c.r - d, nx: (c.x - px) / d, ny: (c.y - py) / d, px, py };
}
