// A cautious autopilot that flies a level along its route, for setting par times
// and tank sizes (scripts/fly.js) and for checking every level can be finished
// within its tank (test/levels.test.js). A good player is faster than this, and
// should use less fuel.
//
// A level's `route` lists its stops in order, like "r F 1 E": fly through the red
// key (r y g b), land on the nearest fuel pad but the one it's on (F), or the one
// at a column of the map as written (F@45), on switch 1 (a digit), and on the exit
// (E). Doors open on the way once their key is held.
// Without a route, it lands on the fuel pads in order of distance from the start,
// then the exit.
import { parseLevel, KEY_COLORS } from "../src/sim/level.js";
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
// `margin` metres clear of rock and `boxes` where it can, except near its ends
// (which are over pads, or at keys). Returns a list of [x, y], or null.
function findPath(outline, level, [x0, y0], [x1, y1], boxes) {
  const fitsWith = (margin) => (x, y) =>
    !deepestContact(
      outline,
      circlesAt(x, y, 0).map((c) => ({ ...c, r: c.r + margin })),
      boxes,
    );
  const tight = fitsWith(0);
  for (const margin of [2, 1.5, 1, 0.5, 0]) {
    const loose = fitsWith(margin);
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
          const [x, y] = [x0 + nx, y0 + ny];
          const k = key(nx, ny);
          if (from.has(k) || x < 0 || y < 0 || x > level.width * 2 || y > level.height * 2) continue;
          const near = Math.hypot(nx, ny) < 3 || Math.hypot(x - x1, y - y1) < 3;
          if (!(near ? tight(x, y) : loose(x, y))) continue;
          from.set(k, key(gx, gy));
          queue.push([nx, ny]);
        }
      }
    }
  }
  return null;
}

const hoverOver = (pad) => [(pad.x0 + pad.x1) / 2, pad.y + CENTRE_Y + HOVER];

// Flies world's rocket along `path` to `stop`: letting down on its pad, or until
// it's `done` (a key picked up). Returns the ticks taken, or a reason it failed.
function flyLeg(world, path, stop) {
  let at = 0;
  let duty = 0;
  const padX = stop.pad && hoverOver(stop.pad)[0];
  for (let t = 0; t < LEG_LIMIT; t++) {
    const r = world.rocket;
    if (r.state === "crashed") {
      return { failed: `crashed at ${r.x.toFixed(0)}, ${r.y.toFixed(0)}${r.fuel <= 0 ? ", after running out of fuel" : ""}` };
    }
    if (world.stranded) return { failed: `ran out of fuel at ${r.x.toFixed(0)}, ${r.y.toFixed(0)}` };
    if (stop.pad ? padUnder(world.level, r) === stop.pad : stop.done(world)) return { ticks: t };

    // Where along the path the rocket is, and where to head.
    for (let k = at; k < Math.min(path.length, at + 20); k++) {
      if (Math.hypot(path[k][0] - r.x, path[k][1] - r.y) < Math.hypot(path[at][0] - r.x, path[at][1] - r.y)) at = k;
    }
    const left = path.length - 1 - at;
    let vx, vy;
    if (stop.pad && left < 2 && Math.abs(r.x - padX) < 1) {
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

// What blocks the autopilot now: shut gates, and shut doors it has no key for.
const blocking = (world) =>
  world.level.doors.filter((d, i) => !world.doors[i].open && !(d.key && world.keys.includes(d.key)));

// Where the rocket starts a leg from: over its pad if it's landed.
const here = (r) => [r.x, r.y + (r.state === "landed" ? HOVER : 0)];

// Flies level `def` (a level module's export). Returns { legs, failed }: each leg
// is { name, seconds, fuel, metres }, and `failed` says why it stopped short, if it did.
export function flyLevel(def) {
  const level = parseLevel(def);
  const outline = buildOutline(level);
  const world = createWorld(level, outline);
  const pathTo = (target) => findPath(outline, level, here(world.rocket), target, blocking(world));

  // The stop a route letter means, from where the rocket is now.
  const stopFor = (letter) => {
    if (KEY_COLORS[letter]) {
      const key = level.keys.find((k) => k.color === KEY_COLORS[letter]);
      return key && { name: `${key.color} key`, target: [key.x, key.y], done: (w) => w.keys.includes(key.color) };
    }
    const pads = level.pads.filter((p) => p !== padUnder(level, world.rocket));
    const column = Number(letter.match(/^F@(\d+)$/)?.[1]);
    const pad =
      letter === "E"
        ? level.exit
        : column
          ? pads.find((p) => p.kind === "fuel" && p.c0 + 1 <= column && column <= p.c1 + 1)
          : letter === "F"
            ? pads
                .filter((p) => p.kind === "fuel")
                .map((p) => ({ p, length: pathTo(hoverOver(p))?.length ?? Infinity }))
                .sort((a, b) => a.length - b.length)[0]?.p
            : pads.find((p) => p.kind === "switch" && p.label === letter);
    return pad && { name: pad.kind === "switch" ? `switch ${pad.label}` : pad.kind, target: hoverOver(pad), pad };
  };
  const route = def.route?.split(/\s+/) ?? defaultRoute(level, outline);

  const legs = [];
  let from = "start";
  for (const letter of route) {
    const stop = stopFor(letter);
    if (!stop) return { legs, failed: `nothing on the map for "${letter}" in the route` };
    const path = pathTo(stop.target);
    const name = `${from} → ${stop.name}`;
    if (!path) return { legs, failed: `${name}: no way through` };
    const fuel = world.rocket.fuel;
    const leg = flyLeg(world, path, stop);
    if (leg.failed) return { legs, failed: `${name}: ${leg.failed}` };
    legs.push({ name, seconds: leg.ticks / TICK_RATE, fuel: fuel - world.rocket.fuel, metres: path.length });
    // Fill up before going on.
    while (world.refuelling || (stop.pad?.kind === "fuel" && world.rocket.fuel < world.rocket.tank)) step(world, {});
    from = stop.name;
  }
  if (!world.done) return { legs, failed: "the route doesn't end on the exit" };
  return { legs };
}

// The fuel pads in order of distance from the start, up to the exit.
function defaultRoute(level, outline) {
  const start = hoverOver(level.start);
  const pads = level.pads
    .filter((p) => p.kind === "fuel" || p.kind === "exit")
    .map((pad) => ({ pad, length: findPath(outline, level, start, hoverOver(pad), level.doors)?.length ?? Infinity }))
    .sort((a, b) => a.length - b.length)
    .map((s) => s.pad);
  return pads.slice(0, pads.indexOf(level.exit) + 1).map((p) => (p.kind === "exit" ? "E" : `F@${p.c0 + 1}`));
}
