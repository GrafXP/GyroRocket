import { TICK_RATE } from "../rocket.js";
import { hypot } from "../fmath.js";

export const BEAM = 0.15; // m: a beam's half-width, for what touches it

// A laser gate (level.lasers) at `tick`: "off", "warn" (flickering: about to come
// on) or "on". `state` is its switch's doing: `open` while it's switched off.
export function laserPhase(laser, state, tick) {
  if (state.open) return "off";
  if (laser.mode === "always") return "on";
  const period = laser.on + laser.off;
  const t = (((tick / TICK_RATE - laser.offset) % period) + period) % period;
  return t < laser.off - laser.warn ? "off" : t < laser.off ? "warn" : "on";
}

// Whether any of `circles` touches the beam; `margin` widens it.
export function inLaser(laser, circles, margin = 0) {
  const [dx, dy] = [laser.x1 - laser.x0, laser.y1 - laser.y0];
  return circles.some((c) => {
    const t = Math.max(0, Math.min(1, ((c.x - laser.x0) * dx + (c.y - laser.y0) * dy) / (dx * dx + dy * dy)));
    return hypot(laser.x0 + dx * t - c.x, laser.y0 + dy * t - c.y) < c.r + BEAM + margin;
  });
}
