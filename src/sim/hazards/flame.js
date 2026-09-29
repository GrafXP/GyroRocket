import { TICK_RATE } from "../rocket.js";
import { hypot } from "../fmath.js";

export const FLAME_DAMAGE = 120; // hull a second in the flame: a quick pass hurts, lingering kills
export const RADIUS = [0.45, 0.75]; // m: the flame's radius at the nozzle and at its tip

// A flamethrower (level.flames) at `tick`: "off", "warn" (flickering: about to
// fire) or "on". A "near" one's `state.fired` is the tick the rocket set it off.
export function flamePhase(flame, state, tick) {
  if (flame.mode === "always") return "on";
  if (flame.mode === "near") {
    if (state.fired < 0) return "off";
    const s = (tick - state.fired) / TICK_RATE;
    return s < flame.warn ? "warn" : s < flame.warn + flame.on ? "on" : "off";
  }
  const period = flame.on + flame.off;
  const t = (((tick / TICK_RATE - flame.offset) % period) + period) % period;
  return t < flame.off - flame.warn ? "off" : t < flame.off ? "warn" : "on";
}

// Sets off a "near" flame once the rocket's centre comes within `reach` of its
// flame, unless it's still firing or resting.
export function armFlame(flame, state, tick, r) {
  if (flame.mode !== "near") return;
  const busy = state.fired >= 0 && (tick - state.fired) / TICK_RATE < flame.warn + flame.on + flame.off;
  if (!busy && distanceToFlame(flame, r.x, r.y) < flame.reach) state.fired = tick;
}

// How far (x, y) is from the flame's centre line, and how far along it (0 at the
// nozzle, 1 at the tip).
function along(flame, x, y) {
  const [dx, dy] = [flame.x1 - flame.x0, flame.y1 - flame.y0];
  const t = Math.max(0, Math.min(1, ((x - flame.x0) * dx + (y - flame.y0) * dy) / (dx * dx + dy * dy)));
  return { t, d: hypot(flame.x0 + dx * t - x, flame.y0 + dy * t - y) };
}

export const distanceToFlame = (flame, x, y) => along(flame, x, y).d;

// Whether any of `circles` is in the flame's shape: a cone from RADIUS[0] at the
// nozzle to RADIUS[1] at the tip, which is how it's drawn. `margin` widens it.
export function inFlame(flame, circles, margin = 0) {
  return circles.some((c) => {
    const { t, d } = along(flame, c.x, c.y);
    return d < c.r + RADIUS[0] + (RADIUS[1] - RADIUS[0]) * t + margin;
  });
}
