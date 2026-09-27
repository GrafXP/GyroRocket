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
//
// It steers round flames that are always on. Where its path crosses any other
// flame or a lava blob's column, it slows as it comes up to it and waits, hovering,
// until the hazard's schedule shows a gap long enough to get across; then it goes,
// and doesn't change its mind.
import { parseLevel, KEY_COLORS } from "../src/sim/level.js";
import { buildOutline } from "../src/sim/outline.js";
import { deepestContact } from "../src/sim/collide.js";
import { circlesAt, CENTRE_Y, GRAVITY, THRUST, DRAG, MAX_LEAN, TICK_RATE } from "../src/sim/rocket.js";
import { createWorld, step, padUnder } from "../src/sim/world.js";
import { flamePhase, inFlame, distanceToFlame } from "../src/sim/hazards/flame.js";
import { blobAt } from "../src/sim/hazards/blob.js";

const MAX_SPEED = 9; // m/s the autopilot flies at, at most
const BRAKE = 3; // m/s² it plans to slow down at
const LOOK = 5; // m ahead along the path it steers for
const HOVER = 2; // m above a pad it flies to before letting down
const LEG_LIMIT = 90 * TICK_RATE;
const HAZARD_MARGIN = 0.8; // m it keeps from flames and blobs
const APPROACH = 3; // m before a hazard it decides whether to cross or wait
const CROSS_SPEED = 6; // m/s it crosses a hazard at, and slows to as it comes up to one
const SPARE = 0.25; // s either side of a hazard's burning that it counts as burning too

// A path from (x0, y0) to (x1, y1) for the upright rocket, in 1 m steps, keeping
// `margin` metres clear of rock and `boxes` where it can, except near its ends
// (which are over pads, or at keys). Returns a list of [x, y], or null.
function findPath(outline, level, [x0, y0], [x1, y1], boxes) {
  const walls = level.flames.filter((f) => f.mode === "always");
  const fitsWith = (margin) => (x, y) => {
    const circles = circlesAt(x, y, 0).map((c) => ({ ...c, r: c.r + margin }));
    return !deepestContact(outline, circles, boxes) && !walls.some((f) => inFlame(f, circles, HAZARD_MARGIN));
  };
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
  const zones = hazardZones(world, path);
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
    // The next hazard on the path: wait short of it until it's safe to cross, then go.
    const zone = zones.find((z) => z.to >= at);
    const ahead = zone ? zone.from - at : Infinity;
    // Starting the leg in one, or safe to go: go.
    if (zone && !zone.go && (zone.from === 0 || (ahead <= APPROACH && safeToCross(world, zone, Math.max(0, ahead))))) zone.go = true;
    const wait = zone && !zone.go && ahead <= APPROACH;
    const crossing = zone && zone.go && ahead <= APPROACH && zone.to < path.length - 3;
    const cap = zone && ahead <= APPROACH + 8 ? CROSS_SPEED : MAX_SPEED;
    let vx, vy;
    if (wait) {
      // Hover; back off if it's drifted up to the hazard.
      const [bx, by] = path[Math.max(0, zone.from - APPROACH)];
      const d = Math.hypot(bx - r.x, by - r.y) || 1;
      [vx, vy] = ahead < 1.5 ? [((bx - r.x) / d) * 2, ((by - r.y) / d) * 2] : [0, 0];
    } else if (crossing) {
      // Straight on at crossing speed, towards the far side.
      const [tx, ty] = path[Math.min(path.length - 1, zone.to + 2)];
      const d = Math.hypot(tx - r.x, ty - r.y) || 1;
      [vx, vy] = [((tx - r.x) / d) * CROSS_SPEED, ((ty - r.y) / d) * CROSS_SPEED];
    } else if (stop.pad && left < 2 && Math.abs(r.x - padX) < 1) {
      // Over the pad: let down gently.
      [vx, vy] = [(padX - r.x) * 1.5, -2];
    } else {
      const [tx, ty] = path[Math.min(path.length - 1, at + LOOK)];
      const d = Math.hypot(tx - r.x, ty - r.y) || 1;
      const speed = Math.min(cap, Math.sqrt(2 * BRAKE * (left + 1)), d * 2);
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

// The stretches of `path` (as index ranges, 1 m apiece) where the rocket would be
// in reach of a flame that isn't always on, or of a lava blob's column.
function hazardZones(world, path) {
  const { flames, blobs } = world.level;
  const hazards = [
    ...flames.map((flame, i) => ({ flame, state: world.flames[i] })).filter((h) => h.flame.mode !== "always"),
    ...blobs.map((blob) => ({ blob })),
  ];
  const zones = [];
  for (const h of hazards) {
    let from = -1;
    path.forEach(([x, y], i) => {
      const circles = circlesAt(x, y, 0);
      const inside = h.flame ? inFlame(h.flame, circles, HAZARD_MARGIN) : inColumn(h.blob, circles);
      if (inside && from < 0) from = i;
      if ((!inside || i === path.length - 1) && from >= 0) {
        zones.push({ ...h, from, to: inside ? i : i - 1 });
        from = -1;
      }
    });
  }
  return zones.sort((a, b) => a.from - b.from);
}

// Whether any circle is in the space a blob flies through.
const inColumn = (blob, circles) =>
  circles.some((c) => Math.abs(c.x - blob.x) < c.r + 0.8 + HAZARD_MARGIN && c.y > blob.y - 1 && c.y < blob.y + blob.height * 2 + 1.8);

// Whether the rocket, `ahead` metres short of `zone`, can fly through it before
// its hazard burns: it's clear from arrival until the far side, with SPARE. (The
// zone already allows for the rocket's size.)
function safeToCross(world, zone, ahead) {
  const r = world.rocket;
  if (zone.flame?.mode === "near" && zone.state.fired < 0) {
    // Not set off yet: go on until it's in reach, which sets it off; then wait.
    return distanceToFlame(zone.flame, r.x, r.y) > zone.flame.reach;
  }
  // From a hover it takes about half a second to get up to speed; allow for it
  // crossing 15% slower than it means to.
  const speed = Math.min(CROSS_SPEED, Math.hypot(r.vx, r.vy));
  const arrive = ahead / CROSS_SPEED + 0.5 * (1 - speed / CROSS_SPEED);
  const t0 = world.tick + Math.round((arrive - SPARE) * TICK_RATE);
  const t1 = world.tick + Math.round((arrive + (zone.to - zone.from + 1) / CROSS_SPEED / 0.85 + SPARE) * TICK_RATE);
  for (let t = Math.max(world.tick, t0); t <= t1; t += 3) {
    if (burningAt(zone, t)) return false;
  }
  return true;
}

// Whether a flame or blob could reach the rocket where it is within a second.
function dangerSoon(world) {
  const r = world.rocket;
  const circles = circlesAt(r.x, r.y, r.angle);
  const soon = (hurts) => {
    for (let t = world.tick; t <= world.tick + TICK_RATE; t += 3) if (hurts(t)) return true;
    return false;
  };
  return (
    world.level.flames.some((flame, i) => {
      if (!inFlame(flame, circles, HAZARD_MARGIN)) return false;
      const state = world.flames[i];
      if (flame.mode === "near" && (state.fired < 0 || (world.tick - state.fired) / TICK_RATE > flame.warn + flame.on + flame.off)) return true;
      return soon((t) => burningAt({ flame, state }, t));
    }) || world.level.blobs.some((blob) => inColumn(blob, circles) && soon((t) => blobAt(blob, t).up))
  );
}

// Whether a zone's hazard could hurt at `tick`, as far as can be told now.
function burningAt({ flame, state, blob }, tick) {
  if (blob) return blobAt(blob, tick).up;
  if (flame.mode === "near") {
    const s = (tick - state.fired) / TICK_RATE;
    return s < flame.warn + flame.on || s > flame.warn + flame.on + flame.off - flame.warn; // near its next firing
  }
  return flamePhase(flame, state, tick) === "on";
}

// What blocks the autopilot now: shut gates, and shut doors it has no key for.
const blocking = (world) =>
  world.level.doors.filter((d, i) => !world.doors[i].open && !(d.key && world.keys.includes(d.key)));

// Where the rocket starts a leg from: over its pad if it's landed.
const here = (r) => [r.x, r.y + (r.state === "landed" ? HOVER : 0)];

// Flies level `def` (a level module's export). Returns { legs, failed }: each leg
// is { name, seconds, fuel, metres, hull } (the hull left at its end), and `failed`
// says why it stopped short, if it did.
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
    legs.push({ name, seconds: leg.ticks / TICK_RATE, fuel: fuel - world.rocket.fuel, metres: path.length, hull: world.rocket.hull });
    // Fill up before going on, unless a hazard's about to reach it here.
    while ((world.refuelling || (stop.pad?.kind === "fuel" && world.rocket.fuel < world.rocket.tank)) && !dangerSoon(world)) step(world, {});
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
