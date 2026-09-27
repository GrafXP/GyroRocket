import { TILE, isSolid } from "../sim/level.js";
import { KEY_LOOKS, GATE_COLOR, css, drawShape } from "../looks.js";

const COLORS = {
  rock: "#5b4e41",
  air: "#1d2029",
  pad: { start: "#9aa1ad", fuel: "#3fa9f5", exit: "#3fbf6a", switch: css(GATE_COLOR) },
  crystal: "#d86bff",
  rocket: "#ffffff",
};

// Draws the parts of the level the rocket has been near (world.seen) on `canvas`,
// scaled to fit it: rock and air, pads, shut doors and gates, the keys and
// crystals still there, and the rocket.
export function drawMap(canvas, world) {
  const { level, seen } = world;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const { width: cssW, height: cssH } = canvas.getBoundingClientRect();
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);

  const s = Math.min(cssW / level.width, cssH / level.height); // pixels per tile
  const ox = (cssW - level.width * s) / 2;
  const oy = (cssH - level.height * s) / 2;
  const X = (x) => ox + (x / TILE) * s;
  const Y = (y) => oy + (level.height - y / TILE) * s;
  const seenAt = (x, y) => seen[Math.floor(y / TILE) * level.width + Math.floor(x / TILE)] === 1;

  for (let j = 0; j < level.height; j++) {
    for (let c = 0; c < level.width; c++) {
      if (!seen[j * level.width + c]) continue;
      ctx.fillStyle = isSolid(level, c, j) ? COLORS.rock : COLORS.air;
      ctx.fillRect(ox + c * s, oy + (level.height - 1 - j) * s, s + 0.5, s + 0.5);
    }
  }
  for (const pad of level.pads) {
    if (!seenAt(pad.x0, pad.y + 1)) continue;
    ctx.fillStyle = COLORS.pad[pad.kind];
    ctx.fillRect(X(pad.x0), Y(pad.y + 0.8), X(pad.x1) - X(pad.x0), Math.max(2, s * 0.4));
  }
  level.doors.forEach((d, i) => {
    if (world.doors[i].open || !seenAt((d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2)) return;
    ctx.fillStyle = d.key ? css(KEY_LOOKS[d.key].color) : css(GATE_COLOR);
    ctx.fillRect(X(d.x0), Y(d.y1), X(d.x1) - X(d.x0), Y(d.y0) - Y(d.y1));
  });
  level.keys.forEach((k, i) => {
    if (world.keyTicks[i] >= 0 || !seenAt(k.x, k.y)) return;
    ctx.fillStyle = css(KEY_LOOKS[k.color].color);
    drawShape(ctx, KEY_LOOKS[k.color].shape, X(k.x), Y(k.y), Math.max(4, s * 0.9));
  });
  level.crystals.forEach((c, i) => {
    if (world.got[i] >= 0 || !seenAt(c.x, c.y)) return;
    ctx.fillStyle = COLORS.crystal;
    drawShape(ctx, "square", X(c.x), Y(c.y), Math.max(3, s * 0.6));
  });

  // The rocket: a triangle, leaning as it leans.
  const r = world.rocket;
  const size = Math.max(6, s * 1.4);
  ctx.save();
  ctx.translate(X(r.x), Y(r.y));
  ctx.rotate(r.angle);
  ctx.fillStyle = COLORS.rocket;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.6, size * 0.7);
  ctx.lineTo(-size * 0.6, size * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
