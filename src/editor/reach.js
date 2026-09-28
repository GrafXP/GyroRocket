import { TILE, FLAME, STALACTITE } from "../sim/level.js";
import { charAt, isSolidChar } from "./grid.js";
import { thingDefaults, thingShapes } from "./things.js";

const DIRS = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] };
const FACING = { ">": "right", "<": "left", "^": "up", v: "down" };

// Overlay primitives in editor tiles. Derived directly from the editable map so
// incomplete switch/gate pairs and other parser errors don't hide the preview.
export function reachOf(grid) {
  const shapes = thingShapes(grid);
  for (let r = 0; r < grid.height; r++)
    for (let c = 0; c < grid.width; c++) {
      const ch = charAt(grid, c, r);
      if (FACING[ch]) shapes.push({ ch, kind: "flame", c: c + 0.5, r: r + 0.5, c0: c, c1: c, r0: r, r1: r });
      if (ch === "!" && charAt(grid, c, r - 1) !== "!") {
        let bottom = r;
        while (charAt(grid, c, bottom + 1) === "!") bottom++;
        shapes.push({ ch, kind: "stalactite", c: c + 0.5, r: (r + bottom + 1) / 2, c0: c, c1: c, r0: r, r1: bottom });
      }
    }
  const result = [];
  for (const shape of shapes) {
    const { ch, kind, c, r, c0, c1, r0, r1 } = shape;
    const t = ch === "!" ? STALACTITE : FACING[ch] ? { ...FLAME, facing: FACING[ch] } : { ...thingDefaults(kind), ...grid.things[ch] };
    const color = ["flame", "blob", "stalactite"].includes(kind) ? "#ffac57" : ["laser", "turret", "crusher"].includes(kind) ? "#ff6573" : "#77d9ff";
    const add = (p) => result.push({ ...p, color, ch });
    if (["flame", "laser", "fan"].includes(kind)) {
      const [dx, dy] = DIRS[t.facing] ?? [0, 0];
      const limit = kind === "laser" ? 60 : t.length;
      let length = 0;
      while ((dx || dy) && length < limit) {
        const nc = c0 + dx * (length + 1),
          nr = r0 + dy * (length + 1);
        if (!(grid.settings.sky && nr < 0) && isSolidChar(grid, charAt(grid, nc, nr))) break;
        length++;
      }
      const [x, y] = [c + dx / 2, r + dy / 2];
      if (kind === "fan") {
        add({
          type: "rect",
          x: Math.min(x, x + dx * length) - (Math.abs(dy) * t.width) / 2,
          y: Math.min(y, y + dy * length) - (Math.abs(dx) * t.width) / 2,
          w: Math.abs(dx) * length + Math.abs(dy) * t.width,
          h: Math.abs(dy) * length + Math.abs(dx) * t.width,
        });
      } else add({ type: "line", x, y, x1: x + dx * length, y1: y + dy * length, width: kind === "flame" ? 0.65 : 0.15 });
      if (kind === "flame" && t.mode === "near") add({ type: "capsule", x, y, x1: x + dx * length, y1: y + dy * length, radius: t.reach / TILE });
    } else if (kind === "magnet" || kind === "turret") add({ type: "circle", x: c, y: r, radius: t.range / TILE });
    else if (kind === "blob") add({ type: "arrow", x: c, y: r0, x1: c, y1: r0 - t.height });
    else if (kind === "stalactite") add({ type: "rect", x: c - t.reach / TILE, y: r1 + 1, w: (t.reach * 2) / TILE, h: Math.max(0, grid.height - r1 - 1) });
    else if (kind === "mover" || kind === "crusher") {
      const [dx, dy] = t.to;
      add({ type: "arrow", x: c, y: r, x1: c + dx, y1: r - dy });
      add({ type: "rect", x: c0 + dx, y: r0 - dy, w: c1 - c0 + 1, h: r1 - r0 + 1 });
    } else if (kind === "switch") {
      for (const target of shapes.filter((s) => s.ch === String(t.opens))) add({ type: "link", x: c, y: r, x1: target.c, y1: target.r });
    }
  }
  return result;
}

export function drawReach(ctx, shapes, X, Y, scale) {
  ctx.save();
  for (const p of shapes) {
    ctx.strokeStyle = ctx.fillStyle = p.color;
    ctx.lineWidth = p.width ? Math.max(2, p.width * scale) : 1.5;
    ctx.setLineDash(p.type === "link" ? [5, 4] : []);
    ctx.beginPath();
    if (p.type === "circle") ctx.arc(X(p.x), Y(p.y), p.radius * scale, 0, Math.PI * 2);
    else if (p.type === "capsule") {
      const angle = Math.atan2(p.y1 - p.y, p.x1 - p.x);
      const radius = p.radius * scale;
      const dx = Math.sin(angle) * radius,
        dy = -Math.cos(angle) * radius;
      ctx.moveTo(X(p.x) + dx, Y(p.y) + dy);
      ctx.lineTo(X(p.x1) + dx, Y(p.y1) + dy);
      ctx.arc(X(p.x1), Y(p.y1), radius, angle - Math.PI / 2, angle + Math.PI / 2);
      ctx.lineTo(X(p.x) - dx, Y(p.y) - dy);
      ctx.arc(X(p.x), Y(p.y), radius, angle + Math.PI / 2, angle + Math.PI * 1.5);
      ctx.closePath();
    } else if (p.type === "rect") ctx.rect(X(p.x), Y(p.y), p.w * scale, p.h * scale);
    else {
      ctx.moveTo(X(p.x), Y(p.y));
      ctx.lineTo(X(p.x1), Y(p.y1));
    }
    if (p.type === "circle" || p.type === "rect" || p.type === "capsule") {
      ctx.globalAlpha = 0.08;
      ctx.fill();
    }
    ctx.globalAlpha = 0.8;
    ctx.stroke();
    if (p.type === "arrow") {
      const angle = Math.atan2(p.y1 - p.y, p.x1 - p.x);
      const len = Math.max(6, Math.min(12, scale));
      ctx.beginPath();
      ctx.moveTo(X(p.x1) - len * Math.cos(angle - 0.5), Y(p.y1) - len * Math.sin(angle - 0.5));
      ctx.lineTo(X(p.x1), Y(p.y1));
      ctx.lineTo(X(p.x1) - len * Math.cos(angle + 0.5), Y(p.y1) - len * Math.sin(angle + 0.5));
      ctx.stroke();
      if (p.handle) {
        ctx.beginPath();
        ctx.arc(X(p.x1), Y(p.y1), 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}
