// A cautious autopilot that flies a level pad to pad along its main route, for
// setting par times and tank sizes (scripts/fly.js) and for checking every level
// can be finished within its tank (test/levels.test.js). A good player is faster
// than this, and should use less fuel.
import { parseLevel } from "../src/sim/level.js";
import { buildOutline } from "../src/sim/outline.js";
import { deepestContact } from "../src/sim/collide.js";
import { circlesAt, CENTRE_Y, GRAVITY, THRUST, DRAG, MAX_LEAN, TICK_RATE } from "../src/sim/rocket.js";
import { createWorld, step, padUnder } from "../src/sim/world.js";

const MAX_SPEED = 9; // m/s the autopilot flies at, at most
const BRAKE = 3; // m/s² it plans to slow down at
const LOOK = 5; // m ahead along the path it steers for
const HOVER = 2; // m above a pad it flies to before letting down
const LEG_LIMIT = 90 * TICK_RATE;

// A path from (x0, y0) to (x1, y1) for the upright rocket, in 1 m steps, keeping
// `margin` metres clear of rock where it can. Returns a list of [x, y], or null.
function findPath(outline, level, [x0, y0], [x1, y1]) {
  for (const margin of [2, 1.5, 1, 0.5, 0]) {
    const fits = (x, y) => !deepestContact(outline, circlesAt(x, y, 0).map((c) => ({ ...c, r: c.r + margin })));
    const key = (gx, gy) => `${gx},${gy}`;
    const goal = key(Math.round(x1 - x0), Math.round(y1 - y0));
    const from = new Map([[key(0, 0), null]]);
    const queue = [[0, 0]];
    for (let q = 0; q < queue.length; q++) {
      const [gx, gy] = queue[q];
      if (key(gx, gy) === goal) {
        const path = [];
        for (let k = goal; k; k = from.get(k)) path.unshift(k.split(",").map(Number));
        return path.map(([px, py]) => [x0 + px, y0 + py]);
      }
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const [nx, ny] = [gx + dx, gy + dy];
          const k = key(nx, ny);
          if (from.has(k) || x0 + nx < 0 || y0 + ny < 0 || x0 + nx > level.width * 2 || y0 + ny > level.height * 2) continue;
          // The start and goal hover over pads, closer to the floor than the margin.
          const near = Math.hypot(nx, ny) < 3 || Math.hypot(x0 + nx - x1, y0 + ny - y1) < 3;
          if (!(near ? fits(x0 + nx, y0 + ny) || margin === 0 : fits(x0 + nx, y0 + ny))) continue;
          from.set(k, key(gx, gy));
          queue.push([nx, ny]);
        }
      }
    }
  }
  return null;
}

const hoverOver = (pad) => [(pad.x0 + pad.x1) / 2, pad.y + CENTRE_Y + HOVER];

// Flies world's rocket along `path` and lets it down on `pad`. Returns the ticks
// taken, or a reason it failed.
function flyLeg(world, path, pad) {
  let at = 0;
  let duty = 0;
  const [padX] = hoverOver(pad);
  for (let t = 0; t < LEG_LIMIT; t++) {
    const r = world.rocket;
    if (r.state === "crashed") return { failed: `crashed at ${r.x.toFixed(0)}, ${r.y.toFixed(0)}` };
    if (world.stranded) return { failed: `ran out of fuel at ${r.x.toFixed(0)}, ${r.y.toFixed(0)}` };
    if (padUnder(world.level, r) === pad) return { ticks: t };

    // Where along the path the rocket is, and where to head.
    for (let k = at; k < Math.min(path.length, at + 20); k++) {
      if (Math.hypot(path[k][0] - r.x, path[k][1] - r.y) < Math.hypot(path[at][0] - r.x, path[at][1] - r.y)) at = k;
    }
    const left = path.length - 1 - at;
    let vx, vy;
    if (left < 2 && Math.abs(r.x - padX) < 1) {
      // Over the pad: let down gently.
      [vx, vy] = [(padX - r.x) * 1.5, -2];
    } else {
      const [tx, ty] = path[Math.min(path.length - 1, at + LOOK)];
      const d = Math.hypot(tx - r.x, ty - r.y) || 1;
      const speed = Math.min(MAX_SPEED, Math.sqrt(2 * BRAKE * (left + 1)), d * 2);
      [vx, vy] = [((tx - r.x) / d) * speed, ((ty - r.y) / d) * speed];
    }
    // The push it needs: towards that velocity, plus holding up against gravity and drag.
    const ax = 2.5 * (vx - r.vx) + DRAG * r.vx;
    const ay = 2.5 * (vy - r.vy) + DRAG * r.vy + GRAVITY;
    const lean = Math.max(-MAX_LEAN, Math.min(MAX_LEAN, Math.atan2(ax, Math.max(ay, 0.1))));
    const along = ax * Math.sin(r.angle) + ay * Math.cos(r.angle);
    duty += Math.max(0, Math.min(1, along / THRUST));
    const thrust = duty >= 1;
    if (thrust) duty -= 1;
    step(world, { steer: lean / MAX_LEAN, thrust });
  }
  return { failed: "took too long" };
}

// Flies level `def` (a level module's export). Returns { legs, failed }: each leg
// is { name, seconds, fuel, metres }, and `failed` says why it stopped short, if it did.
export function flyLevel(def) {
  const level = parseLevel(def);
  const outline = buildOutline(level);
  const world = createWorld(level, outline);
  // The pads in the order the route meets them: by path length from the start.
  const start = hoverOver(level.start);
  const stops = level.pads
    .filter((p) => p.kind !== "start")
    .map((pad) => ({ pad, path: findPath(outline, level, start, hoverOver(pad)) }))
    .sort((a, b) => (a.path?.length ?? Infinity) - (b.path?.length ?? Infinity))
    .map((s) => s.pad);
  const exitAt = stops.indexOf(level.exit);
  const legs = [];
  let from = level.start;
  for (const pad of stops.slice(0, exitAt + 1)) {
    const path = findPath(outline, level, [world.rocket.x, world.rocket.y + HOVER], hoverOver(pad));
    if (!path) return { legs, failed: `no path to the ${pad.kind} pad at column ${pad.c0 + 1}` };
    const fuel = world.rocket.fuel;
    const leg = flyLeg(world, path, pad);
    const name = `${from.kind} → ${pad.kind}`;
    if (leg.failed) return { legs, failed: `${name}: ${leg.failed}` };
    legs.push({ name, seconds: leg.ticks / TICK_RATE, fuel: fuel - world.rocket.fuel, metres: path.length });
    // Fill up before going on.
    while (world.refuelling || (pad.kind === "fuel" && world.rocket.fuel < world.rocket.tank)) step(world, {});
    from = pad;
  }
  return { legs };
}
