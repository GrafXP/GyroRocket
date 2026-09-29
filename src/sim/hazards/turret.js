import { TICK_RATE } from "../rocket.js";
import { hypot } from "../fmath.js";
import { solidAt } from "../outline.js";

export const SHOT_RADIUS = 0.45; // m
const MUZZLE = 1.3; // m from a turret's middle that its shots start
const SHOT_LIFE = 10 * TICK_RATE; // long enough to cross a turret's range, slow as shots are

// Whether a turret (level.turrets) can see the point (x, y): within its range,
// with no rock in between.
export function canSee(outline, turret, x, y) {
  const d = hypot(x - turret.x, y - turret.y);
  if (d > turret.range) return false;
  for (let s = MUZZLE; s < d; s += 0.5) {
    if (solidAt(outline, turret.x + ((x - turret.x) * s) / d, turret.y + ((y - turret.y) * s) / d)) return false;
  }
  return true;
}

// Steps the turrets and their shots, with the rocket's shape as `circles`. A turret
// that can see the rocket winds up (`state.charge` is when it started) and fires at
// where the rocket is then, if it can still see it, then reloads; shots fly
// straight until they hit rock or the rocket, or run out. Returns the damage the
// rocket took.
export function stepTurrets(world, circles) {
  const { level, outline, tick, rocket: r } = world;
  const alive = r.state !== "crashed";
  level.turrets.forEach((t, i) => {
    const state = world.turrets[i];
    const sees = alive && canSee(outline, t, r.x, r.y);
    if (state.charge < 0) {
      if (sees && tick >= state.ready) state.charge = tick;
    } else if (tick - state.charge >= t.windup * TICK_RATE) {
      state.charge = -1;
      state.ready = tick + t.reload * TICK_RATE;
      if (!sees) return; // it ducked out of sight: no shot
      const d = hypot(r.x - t.x, r.y - t.y) || 1;
      const [ux, uy] = [(r.x - t.x) / d, (r.y - t.y) / d];
      world.shots.push({ x: t.x + ux * MUZZLE, y: t.y + uy * MUZZLE, vx: ux * t.speed, vy: uy * t.speed, damage: t.damage, born: tick });
    }
  });
  let damage = 0;
  world.shots = world.shots.filter((s) => {
    s.x += s.vx / TICK_RATE;
    s.y += s.vy / TICK_RATE;
    if (tick - s.born > SHOT_LIFE || solidAt(outline, s.x, s.y)) return false;
    if (alive && circles.some((c) => hypot(c.x - s.x, c.y - s.y) < c.r + SHOT_RADIUS)) {
      damage += s.damage;
      return false;
    }
    return true;
  });
  return damage;
}
