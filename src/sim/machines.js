import { TICK_RATE } from "./rocket.js";

// Fans, magnets, movers and crushers (level.fans, .magnets, .movers), all on the
// level clock like everything else.

const mod = (a, n) => ((a % n) + n) % n;

// A fan or magnet at `tick`: "off", "warn" (winding up) or "on".
export function cyclePhase(m, tick) {
  if (m.mode !== "cycle") return "on";
  const t = mod(tick / TICK_RATE - m.offset, m.on + m.off);
  return t < m.off - m.warn ? "off" : t < m.off ? "warn" : "on";
}

// The push on the rocket at (x, y), in m/s²: from any fan whose column it's in,
// and any magnet within range.
export function fieldAt(level, tick, x, y) {
  let [ax, ay] = [0, 0];
  for (const f of level.fans) {
    if (x < f.x0 || x > f.x1 || y < f.y0 || y > f.y1 || cyclePhase(f, tick) !== "on") continue;
    ax += f.dir[0] * f.strength;
    ay += f.dir[1] * f.strength;
  }
  for (const m of level.magnets) {
    const [dx, dy] = [m.x - x, m.y - y];
    const d = Math.hypot(dx, dy);
    if (d >= m.range || d < 1e-6 || cyclePhase(m, tick) !== "on") continue;
    const a = m.strength * (1 - d / m.range) * (m.push ? -1 : 1);
    ax += (dx / d) * a;
    ay += (dy / d) * a;
  }
  return { ax, ay };
}

// How far along its travel a mover or crusher is at `tick`: 0 where it's drawn,
// 1 at `to`. A tick can be fractional.
export function travel(m, tick) {
  const t = tick / TICK_RATE - m.offset;
  if (m.kind === "mover") return (1 - Math.cos((2 * Math.PI * t) / m.period)) / 2;
  let s = mod(t, m.rest + m.warn + m.slam + m.hold + m.back);
  if (s < m.rest + m.warn) return 0;
  s -= m.rest + m.warn;
  if (s < m.slam) return s / m.slam;
  s -= m.slam;
  if (s < m.hold) return 1;
  return 1 - (s - m.hold) / m.back;
}

// Whether a crusher's shaking, about to slam, at `tick`.
export function crusherWarning(m, tick) {
  const s = mod(tick / TICK_RATE - m.offset, m.rest + m.warn + m.slam + m.hold + m.back);
  return s >= m.rest && s < m.rest + m.warn;
}

// A mover's or crusher's rectangle at `tick`, with the velocity it's moving at
// then (m/s): { x0, y0, x1, y1, vx, vy, mover }.
export function moverBox(m, tick) {
  const p = travel(m, tick);
  const q = travel(m, tick - 1);
  const [dx, dy] = m.to;
  return {
    x0: m.x0 + dx * p,
    y0: m.y0 + dy * p,
    x1: m.x1 + dx * p,
    y1: m.y1 + dy * p,
    vx: dx * (p - q) * TICK_RATE,
    vy: dy * (p - q) * TICK_RATE,
    mover: m,
  };
}
