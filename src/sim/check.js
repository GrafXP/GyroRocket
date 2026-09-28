import { parseLevel, TILE } from "./level.js";
import { buildOutline, setTile } from "./outline.js";
import { deepestContact } from "./collide.js";
import { circlesAt, canStand, CENTRE_Y } from "./rocket.js";
import { touches } from "./world.js";
import { inFlame } from "./hazards/flame.js";
import { inLaser } from "./hazards/laser.js";
import { stalactiteShape } from "./hazards/stalactite.js";

// Everywhere an upright rocket can get to from the start pad, moving in 1 m steps
// without touching rock, the shut doors and gates in `boxes`, a flame that's always
// on, or a laser beam in `beams`. Returns a list of reachable [x, y] centres.
function flood(level, outline, boxes, beams) {
  const walls = level.flames.filter((f) => f.mode === "always");
  const { start } = level;
  const [sx, sy] = [(start.x0 + start.x1) / 2, start.y + CENTRE_Y + 0.05];
  const [gx0, gy0] = [Math.floor(-sx), Math.floor(-sy)];
  const cols = Math.ceil(level.width * 2 - sx) - gx0 + 1;
  const rows = Math.ceil(level.height * 2 - sy) - gy0 + 1;
  const seen = new Uint8Array(cols * rows); // 1 seen and fits, 2 seen and doesn't
  const fits = (x, y) => {
    const circles = circlesAt(x, y, 0);
    return !deepestContact(outline, circles, boxes) && !walls.some((f) => inFlame(f, circles)) && !beams.some((l) => inLaser(l, circles));
  };
  const found = [];
  const queue = [[0, 0]];
  seen[(0 - gy0) * cols + (0 - gx0)] = 1;
  while (queue.length) {
    const [gx, gy] = queue.pop();
    found.push([sx + gx, sy + gy]);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const [nx, ny] = [gx + dx, gy + dy];
      if (nx < gx0 || ny < gy0 || nx - gx0 >= cols || ny - gy0 >= rows) continue;
      const i = (ny - gy0) * cols + (nx - gx0);
      if (seen[i]) continue;
      seen[i] = fits(sx + nx, sy + ny) ? 1 : 2;
      if (seen[i] === 1) queue.push([nx, ny]);
    }
  }
  return found;
}

// Whether any of `spots` is where the rocket stands over a pad's middle.
const onPad = (spots, pad) => {
  const [x, y] = [(pad.x0 + pad.x1) / 2, pad.y + CENTRE_Y];
  return spots.some(([sx, sy]) => Math.abs(sx - x) <= 0.5 && sy - y >= 0 && sy - y <= 1.5);
};

// Everywhere the rocket can get to, opening each door once its key has been
// reached, and each gate (or laser that's always on) once its switch has.
// Cycling lasers are no bar: they go off; nor is crumbling rock, which falls away
// once it's touched. Stalactites are: some might never fall.
function reachable(level) {
  const outline = buildOutline(level);
  for (const t of level.crumbles) setTile(outline, t.c, t.j, false);
  const stalactites = level.stalactites.map((s) => stalactiteShape(s));
  const open = new Set();
  const off = new Set();
  for (;;) {
    const spots = flood(
      level,
      outline,
      [...level.doors.filter((d, i) => !open.has(i)), ...stalactites],
      level.lasers.filter((l, i) => l.mode === "always" && !off.has(i)),
    );
    const keys = level.keys.filter((k) => spots.some(([x, y]) => touches({ x, y, angle: 0 }, k))).map((k) => k.color);
    const switches = level.pads.filter((p) => p.kind === "switch" && onPad(spots, p)).map((p) => p.opens);
    const doors = level.doors.filter((d, i) => !open.has(i) && (keys.includes(d.key) || switches.includes(d.gate)));
    const lasers = level.lasers.filter((l, i) => !off.has(i) && switches.includes(l.label));
    if (!doors.length && !lasers.length) return spots;
    for (const d of doors) open.add(level.doors.indexOf(d));
    for (const l of lasers) off.add(level.lasers.indexOf(l));
  }
}

// Geometry checks shared by the built-in tests, editor and verifier. These
// check space and lock order; flight timing, moving hazards and fuel need a run.
// Locations use editor coordinates: columns from the left, rows from the top.
export function checkLevel(def) {
  let level;
  try {
    level = parseLevel(def);
  } catch (e) {
    const m = e.message.match(/row (\d+), column (\d+):/);
    return [{ text: e.message, at: m ? { c: Number(m[2]) - 1, r: Number(m[1]) - 1 } : null }];
  }
  const problems = [];
  const at = (x, y) => ({ c: Math.floor(x / TILE), r: level.height - 1 - Math.floor(y / TILE) });
  const padAt = (p) => ({ c: Math.floor((p.c0 + p.c1) / 2), r: level.height - 1 - p.j });
  const outline = buildOutline(level);
  for (const pad of level.pads) {
    if (!canStand(outline, (pad.x0 + pad.x1) / 2, pad.y)) {
      problems.push({ text: `Can't stand on the ${pad.kind} pad at column ${pad.c0 + 1}`, at: padAt(pad) });
    }
  }
  const spots = reachable(level);
  for (const pad of level.pads) {
    if (!onPad(spots, pad)) problems.push({ text: `Can't reach the ${pad.kind} pad at column ${pad.c0 + 1}`, at: padAt(pad) });
  }
  for (const key of level.keys) {
    if (!spots.some(([x, y]) => touches({ x, y, angle: 0 }, key))) {
      problems.push({ text: `Can't reach the ${key.color} key`, at: at(key.x, key.y) });
    }
  }
  level.crystals.forEach((crystal, i) => {
    if (!spots.some(([x, y]) => touches({ x, y, angle: 0 }, crystal))) {
      problems.push({ text: `Can't reach crystal ${i + 1}`, at: at(crystal.x, crystal.y) });
    }
  });
  return problems;
}
