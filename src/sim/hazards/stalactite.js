import { TICK_RATE, GRAVITY } from "../rocket.js";
import { solidAt } from "../outline.js";
import { polyContact } from "../collide.js";

// Stalactites (level.stalactites). Each one's state is { shook, drop, vy, gone }:
// the tick it started shaking (or -1), how far it has fallen (m) and how fast
// it's falling, and the tick it shattered (or -1). It hangs until the rocket is
// below it and within its `reach` to either side, with no rock in between; then
// it shakes for `warn`, drops, and shatters on whatever it hits first.
export const hangingState = () => ({ shook: -1, drop: 0, vy: 0, gone: -1 });

// The stalactite's shape, fallen `drop` metres: a box round it with its `poly`, a
// triangle from its top corners down to its tip, for collide.js.
export function stalactiteShape(s, drop = 0) {
  const [top, tip] = [s.top - drop, s.tip - drop];
  return { x0: s.x0, x1: s.x1, y0: tip, y1: top, poly: [[s.x0, top], [s.x, tip], [s.x1, top]], stalactite: s };
}

// Whether it's shaking, about to fall, at `tick`.
export const shaking = (s, state, tick) => state.gone < 0 && state.shook >= 0 && tick - state.shook < s.warn * TICK_RATE;

// Whether the rocket's centre (x, y) is where a stalactite drops for it.
export function below(outline, s, x, y) {
  if (Math.abs(x - s.x) >= s.reach || y >= s.tip) return false;
  const d = Math.hypot(x - s.x, y - s.tip);
  for (let k = 0.5; k < d; k += 0.5) {
    if (solidAt(outline, s.x + ((x - s.x) * k) / d, s.tip + ((y - s.tip) * k) / d)) return false;
  }
  return true;
}

// Steps the stalactites, with the rocket's shape as `circles` and `blocks` the
// boxes it could land on (shut doors, moving blocks) and `lavaY` the rising lava
// (or -Infinity). Returns the damage the rocket took.
export function stepStalactites(world, circles, blocks, lavaY) {
  const { level, outline, tick, rocket: r } = world;
  const alive = r.state !== "crashed";
  let damage = 0;
  level.stalactites.forEach((s, i) => {
    const state = world.stalactites[i];
    if (state.gone >= 0) return;
    if (state.shook < 0) {
      if (alive && below(outline, s, r.x, r.y)) state.shook = tick;
      return;
    }
    if (shaking(s, state, tick)) return;
    state.vy += GRAVITY / TICK_RATE;
    state.drop += state.vy / TICK_RATE;
    const tip = s.tip - state.drop;
    const onBlock = blocks.some((b) => !b.poly && s.x >= b.x0 && s.x <= b.x1 && tip >= b.y0 && tip <= b.y1);
    if (solidAt(outline, s.x, tip) || onBlock || tip <= lavaY) {
      state.gone = tick;
      return;
    }
    const { poly } = stalactiteShape(s, state.drop);
    if (alive && circles.some((c) => polyContact(poly, c))) {
      damage += s.damage;
      state.gone = tick;
    }
  });
  return damage;
}

const shapes = new WeakMap(); // each stalactite's shape where it hangs

// The stalactites still hanging (shaking or not), as shapes that block the rocket.
export function hangingShapes(world) {
  const out = [];
  world.level.stalactites.forEach((s, i) => {
    const state = world.stalactites[i];
    if (state.gone >= 0 || (state.shook >= 0 && !shaking(s, state, world.tick))) return;
    if (!shapes.has(s)) shapes.set(s, stalactiteShape(s));
    out.push(shapes.get(s));
  });
  return out;
}
