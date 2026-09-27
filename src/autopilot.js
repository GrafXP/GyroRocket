import { KEY_COLORS, TILE } from "./sim/level.js";
import { deepestContact } from "./sim/collide.js";
import { circlesAt, CENTRE_Y, GRAVITY, THRUST, DRAG, MAX_LEAN, TICK_RATE } from "./sim/rocket.js";
import { padUnder, switched, RETRY_AFTER } from "./sim/world.js";
import { flamePhase, inFlame, distanceToFlame } from "./sim/hazards/flame.js";
import { blobAt } from "./sim/hazards/blob.js";
import { fieldAt, moverBox } from "./sim/machines.js";
import { laserPhase, inLaser } from "./sim/hazards/laser.js";

// A cautious autopilot: given a level in play (sim/world.js), it gives the input
// for each tick to fly the level's route. The game can hand it the controls, and
// scripts/autopilot.js flies every level with it, for setting par times and tank
// sizes and for checking each level can be finished within its tank. A good player
// is faster than this, and should use less fuel.
//
// A level's `route` lists its stops in order, like "r F 1 E": fly through the red
// key (r y g b), land on the nearest fuel pad but the one it's on (F), or the one
// at a column of the map as written (F@45), on switch 1 (a digit), and on the exit
// (E). Doors open on the way once their key is held. Without a route, it lands on
// the fuel pads in order of distance from the start, then the exit.
//
// It steers round flames and laser beams that are always on, allows for the push
// of fans and magnets, and sidesteps turrets' shots coming its way. Where its path
// crosses any other flame or beam, a lava blob's column, or the ground a crusher or
// moving block covers, it slows as it comes up to it and waits,
// hovering, until the hazard's schedule shows a gap long enough to get across;
// then it goes, and doesn't change its mind. If there's a way round the ground a
// block covers, it takes that instead.

const MAX_SPEED = 9; // m/s it flies at, at most
const BRAKE = 3; // m/s² it plans to slow down at
const LOOK = 5; // m ahead along the path it steers for
const HOVER = 2; // m above a pad it flies to before letting down
const LEG_LIMIT = 90 * TICK_RATE;
const HAZARD_MARGIN = 0.8; // m it keeps from flames and blobs
const APPROACH = 3; // m before a hazard it decides whether to cross or wait
const CROSS_SPEED = 6; // m/s it crosses a hazard at, and slows to as it comes up to one
const SPARE = 0.25; // s either side of a hazard's burning that it counts as burning too
const IDLE = { steer: 0, thrust: false };

// A pilot for `world`, picking up the route from wherever the level is (keys held,
// switches pressed, the checkpoint). With `restart`, it taps to go again after a
// crash or getting stranded; without, it gives up (see `failed`).
export function createPilot(world, { restart = true } = {}) {
  const { level } = world;
  const route = resolveRoute(world);
  const pilot = {
    legs: [], // { name, seconds, fuel, metres, hull } for each stop reached
    failed: null, // why it gave up, if it did
    status: "", // what it's doing, for the HUD
    next: 0, // the route stop it's heading for
  };
  let leg = null; // the stop, its path and hazards, and how it's going
  let refuelling = false;
  let rocket = null; // to notice restarts: each one makes a new rocket
  let from = "start";

  // Where to pick the route up: after the stop that's the checkpoint, skipping
  // keys already held and switches whose gate is open for good.
  const resume = () => {
    const cp = route.findLastIndex((s) => s.pad && s.pad === world.checkpoint.pad);
    pilot.next = cp + 1;
    from = cp < 0 ? "start" : route[cp].name;
    while (pilot.next < route.length && done(route[pilot.next])) pilot.next++;
    leg = null;
    refuelling = false;
  };
  const done = (s) => (s.key && world.keys.includes(s.key.color)) || (s.pad?.kind === "switch" && switched(world, s.pad.opens).open && !s.pad.time);
  const fail = (why) => {
    pilot.failed = why;
    pilot.status = "The autopilot's lost: you have it";
    return IDLE;
  };

  pilot.input = () => {
    const r = world.rocket;
    if (leg && reached(leg.stop)) arrive();
    if (world.done || pilot.failed) return IDLE;
    if (world.downTick >= 0) {
      if (!restart) {
        const at = `at ${r.x.toFixed(0)}, ${r.y.toFixed(0)}`;
        const name = `${from} → ${leg?.stop.name ?? "?"}`;
        return fail(`${name}: ${world.stranded ? `ran out of fuel ${at}` : `crashed ${at}${r.fuel <= 0 ? ", after running out of fuel" : ""}`}`);
      }
      pilot.status = "Autopilot: going again";
      // A tap once the game will take one.
      return { steer: 0, thrust: world.tick - world.downTick >= RETRY_AFTER && (world.tick - world.downTick) % 10 === 0 };
    }
    if (r !== rocket) {
      rocket = r;
      resume();
    }
    if (refuelling) {
      if ((world.refuelling || r.fuel < r.tank) && !dangerSoon(world)) return IDLE;
      refuelling = false;
    }
    if (!leg) {
      if (pilot.next >= route.length) return fail("the route doesn't end on the exit");
      const stop = route[pilot.next];
      if (stop.missing) return fail(`nothing on the map for ${stop.name} in the route`);
      // Round the ground moving blocks cover, if there's a way; else through it, waiting.
      const boxes = blocking(world);
      const path = findPath(world, here(r), stop.target, [...boxes, ...level.movers.map(sweep)]) ?? findPath(world, here(r), stop.target, boxes);
      if (!path) return fail(`${from} → ${stop.name}: no way through`);
      leg = { stop, path, zones: hazardZones(world, path), at: 0, duty: 0, tick: world.tick, fuel: r.fuel };
      pilot.status = `Autopilot: to the ${stop.name}`;
    }
    if (world.tick - leg.tick > LEG_LIMIT) return fail(`${from} → ${leg.stop.name}: took too long`);
    return steer(world, leg);
  };

  const reached = (stop) => (stop.pad ? padUnder(level, world.rocket) === stop.pad : world.keys.includes(stop.key.color));
  // Notes the leg just flown and moves on to the next stop.
  const arrive = () => {
    const r = world.rocket;
    const { stop, path } = leg;
    pilot.legs.push({
      name: `${from} → ${stop.name}`,
      seconds: (world.tick - leg.tick) / TICK_RATE,
      fuel: leg.fuel - r.fuel,
      metres: path.length,
      hull: r.hull,
    });
    from = stop.name;
    pilot.next++;
    refuelling = stop.pad?.kind === "fuel";
    leg = null;
  };
  return pilot;
}

// The input that flies the rocket along its leg's path: towards a point LOOK
// metres ahead, waiting short of hazards until it can cross, and letting down
// gently at the end if the stop's a pad.
function steer(world, leg) {
  const r = world.rocket;
  const { path, zones, stop } = leg;
  for (let k = leg.at; k < Math.min(path.length, leg.at + 20); k++) {
    if (Math.hypot(path[k][0] - r.x, path[k][1] - r.y) < Math.hypot(path[leg.at][0] - r.x, path[leg.at][1] - r.y)) leg.at = k;
  }
  const at = leg.at;
  const left = path.length - 1 - at;
  const padX = stop.pad && (stop.pad.x0 + stop.pad.x1) / 2;

  // The next hazard on the path: wait short of it until it's safe to cross, then go.
  const zone = zones.find((z) => z.to >= at);
  const ahead = zone ? zone.from - at : Infinity;
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
  // Out of the way of any shot coming at it.
  const dodge = incoming(world, 1.5);
  if (dodge) [vx, vy] = [vx + dodge[0] * 6, vy + dodge[1] * 6];

  // The push it needs: towards that velocity, plus holding up against gravity,
  // drag, fans and magnets; the engine's on/off, so it burns for that share of the
  // ticks.
  const field = fieldAt(world.level, world.tick, r.x, r.y);
  const ax = 2.5 * (vx - r.vx) + DRAG * r.vx - field.ax;
  const ay = 2.5 * (vy - r.vy) + DRAG * r.vy + GRAVITY - field.ay;
  const lean = Math.max(-MAX_LEAN, Math.min(MAX_LEAN, Math.atan2(ax, Math.max(ay, 0.1))));
  const along = ax * Math.sin(r.angle) + ay * Math.cos(r.angle);
  leg.duty += Math.max(0, Math.min(1, along / THRUST));
  const thrust = leg.duty >= 1;
  if (thrust) leg.duty -= 1;
  return { steer: lean / MAX_LEAN, thrust };
}

// The route as stops with a place to go: { name, target: [x, y], pad | key }. An F
// becomes the fuel pad it would pick: the nearest but the one it's at, as the
// doors and gates will be by then.
function resolveRoute(world) {
  const { level } = world;
  const letters = level.route?.split(/\s+/) ?? defaultRoute(world);
  const keys = [];
  const switched = [];
  let at = hoverOver(level.start);
  let pad = level.start;
  const blocked = () => level.doors.filter((d) => !(d.key && keys.includes(d.key)) && !(d.gate && switched.includes(d.gate)));
  return letters.map((letter) => {
    if (KEY_COLORS[letter]) {
      const key = level.keys.find((k) => k.color === KEY_COLORS[letter]);
      if (!key) return { name: `"${letter}"`, target: at, missing: true };
      keys.push(key.color);
      [at, pad] = [[key.x, key.y], null];
      return { name: `${key.color} key`, target: at, key };
    }
    const column = Number(letter.match(/^F@(\d+)$/)?.[1]);
    const others = level.pads.filter((p) => p !== pad);
    const found =
      letter === "E"
        ? level.exit
        : column
          ? others.find((p) => p.kind === "fuel" && p.c0 + 1 <= column && column <= p.c1 + 1)
          : letter === "F"
            ? others
                .filter((p) => p.kind === "fuel")
                .map((p) => ({ p, length: findPath(world, at, hoverOver(p), blocked())?.length ?? Infinity }))
                .sort((a, b) => a.length - b.length)[0]?.p
            : others.find((p) => p.kind === "switch" && p.label === letter);
    if (!found) return { name: `"${letter}"`, target: at, missing: true };
    if (found.kind === "switch") switched.push(found.opens);
    [at, pad] = [hoverOver(found), found];
    return { name: found.kind === "switch" ? `switch ${found.label}` : found.kind === "fuel" ? "fuel pad" : "exit", target: at, pad: found };
  });
}

// The fuel pads in order of distance from the start, up to the exit.
function defaultRoute(world) {
  const { level } = world;
  const start = hoverOver(level.start);
  const pads = level.pads
    .filter((p) => p.kind === "fuel" || p.kind === "exit")
    .map((pad) => ({ pad, length: findPath(world, start, hoverOver(pad), level.doors)?.length ?? Infinity }))
    .sort((a, b) => a.length - b.length)
    .map((s) => s.pad);
  return pads.slice(0, pads.indexOf(level.exit) + 1).map((p) => (p.kind === "exit" ? "E" : `F@${p.c0 + 1}`));
}

const hoverOver = (pad) => [(pad.x0 + pad.x1) / 2, pad.y + CENTRE_Y + HOVER];

// Where the rocket starts a leg from: over its pad if it's landed.
const here = (r) => [r.x, r.y + (r.state === "landed" ? HOVER : 0)];

// What blocks the autopilot now: shut gates, and shut doors it has no key for.
const blocking = (world) => world.level.doors.filter((d, i) => !world.doors[i].open && !(d.key && world.keys.includes(d.key)));

// A path from (x0, y0) to (x1, y1) for the upright rocket, in 1 m steps (eight
// ways), keeping `margin` metres clear of rock, `boxes` and flames that never go
// out where it can, except near its ends (which are over pads, or at keys).
// Returns a list of [x, y], or null.
export function findPath(world, [x0, y0], [x1, y1], boxes) {
  const { level, outline } = world;
  const walls = level.flames.filter((f) => f.mode === "always");
  const beams = level.lasers.filter((l, i) => l.mode === "always" && !world.lasers[i].open);
  const gales = level.fans.filter(tooStrong);
  const [gx0, gy0] = [-Math.floor(x0), -Math.floor(y0)];
  const cols = Math.floor(level.width * TILE - x0) - gx0 + 1;
  const rows = Math.floor(level.height * TILE - y0) - gy0 + 1;
  const index = (gx, gy) => (gy - gy0) * cols + (gx - gx0);
  const [goalX, goalY] = [Math.round(x1 - x0), Math.round(y1 - y0)];
  if (goalX < gx0 || goalY < gy0 || goalX - gx0 >= cols || goalY - gy0 >= rows) return null;
  const goal = index(goalX, goalY);
  const fits = (x, y, margin) => {
    const circles = circlesAt(x, y, 0).map((c) => ({ ...c, r: c.r + margin }));
    return (
      !deepestContact(outline, circles, boxes) &&
      !walls.some((f) => inFlame(f, circles, HAZARD_MARGIN)) &&
      !beams.some((l) => inLaser(l, circles, HAZARD_MARGIN)) &&
      !gales.some((f) => x > f.x0 && x < f.x1 && y > f.y0 && y < f.y1)
    );
  };
  const tight = new Int8Array(cols * rows); // 0 not checked, 1 fits, 2 doesn't
  const from = new Int32Array(cols * rows);
  const queue = new Int32Array(cols * rows);
  for (const margin of [2, 1.5, 1, 0.5, 0]) {
    const loose = new Int8Array(cols * rows);
    from.fill(-1);
    const start = index(0, 0);
    from[start] = start;
    let [head, tail] = [0, 0];
    queue[tail++] = start;
    while (head < tail) {
      const i = queue[head++];
      if (i === goal) {
        const path = [];
        for (let k = i; ; k = from[k]) {
          path.unshift([x0 + ((k % cols) + gx0), y0 + (Math.floor(k / cols) + gy0)]);
          if (k === start) return path;
        }
      }
      const [gx, gy] = [(i % cols) + gx0, Math.floor(i / cols) + gy0];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const [nx, ny] = [gx + dx, gy + dy];
          if (nx < gx0 || ny < gy0 || nx - gx0 >= cols || ny - gy0 >= rows) continue;
          const n = index(nx, ny);
          if (from[n] >= 0) continue;
          const [x, y] = [x0 + nx, y0 + ny];
          const near = Math.hypot(nx, ny) < 3 || Math.hypot(x - x1, y - y1) < 3;
          const cache = near ? tight : loose;
          if (!cache[n]) cache[n] = fits(x, y, near ? 0 : margin) ? 1 : 2;
          if (cache[n] === 2) continue;
          from[n] = i;
          queue[tail++] = n;
        }
      }
    }
  }
  return null;
}

// Whether a fan that's always on blows harder than the rocket can fly against:
// down harder than its burn beats gravity, or sideways harder than it can push
// at full lean while holding itself up.
const tooStrong = (f) => f.mode === "always" && (f.dir[1] < 0 ? f.strength > 8 : f.dir[0] !== 0 && f.strength > 15);

// The stretches of `path` (as index ranges, 1 m apiece) where the rocket would be
// in reach of a flame that isn't always on, of a lava blob's column, or of the
// ground a mover or crusher covers.
function hazardZones(world, path) {
  const { flames, blobs, movers } = world.level;
  const hazards = [
    ...flames.map((flame, i) => ({ flame, state: world.flames[i] })).filter((h) => h.flame.mode !== "always"),
    ...blobs.map((blob) => ({ blob })),
    ...movers.map((mover) => ({ mover, swept: sweep(mover) })),
    ...world.level.lasers.map((laser, i) => ({ laser, state: world.lasers[i] })).filter((h) => h.laser.mode === "cycle"),
  ];
  const zones = [];
  for (const h of hazards) {
    let from = -1;
    path.forEach(([x, y], i) => {
      const circles = circlesAt(x, y, 0);
      const inside = h.flame
        ? inFlame(h.flame, circles, HAZARD_MARGIN)
        : h.laser
          ? inLaser(h.laser, circles, HAZARD_MARGIN)
          : h.blob
            ? inColumn(h.blob, circles)
            : inBox(h.swept, circles);
      if (inside && from < 0) from = i;
      if ((!inside || i === path.length - 1) && from >= 0) {
        const to = inside ? i : i - 1;
        zones.push({ ...h, from, to, points: path.slice(from, to + 1) });
        from = -1;
      }
    });
  }
  return zones.sort((a, b) => a.from - b.from);
}

// The whole of the ground a mover or crusher covers on its travel.
function sweep(m) {
  const [dx, dy] = m.to;
  return { x0: m.x0 + Math.min(0, dx), y0: m.y0 + Math.min(0, dy), x1: m.x1 + Math.max(0, dx), y1: m.y1 + Math.max(0, dy) };
}

// Whether any circle comes within HAZARD_MARGIN of the box.
const inBox = (b, circles) =>
  circles.some((c) => {
    const [px, py] = [Math.max(b.x0, Math.min(b.x1, c.x)), Math.max(b.y0, Math.min(b.y1, c.y))];
    return Math.hypot(c.x - px, c.y - py) < c.r + HAZARD_MARGIN;
  });

// Whether any circle is in the space a blob flies through.
const inColumn = (blob, circles) =>
  circles.some((c) => Math.abs(c.x - blob.x) < c.r + 0.8 + HAZARD_MARGIN && c.y > blob.y - 1 && c.y < blob.y + blob.height * TILE + 1.8);

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
    }) ||
    world.level.blobs.some((blob) => inColumn(blob, circles) && soon((t) => blobAt(blob, t).up)) ||
    world.level.movers.some((m) => soon((t) => inBox(moverBox(m, t), circles))) ||
    world.level.lasers.some((l, i) => inLaser(l, circles, HAZARD_MARGIN) && soon((t) => laserPhase(l, world.lasers[i], t) !== "off")) ||
    incoming(world, 1) !== null
  );
}

// Which way to move to get out of the way of a turret's shot that'll pass within
// 3 m of the rocket in the next `seconds`, as a unit [x, y], or null if none will.
function incoming(world, seconds) {
  const r = world.rocket;
  for (const s of world.shots) {
    const [px, py, vx, vy] = [s.x - r.x, s.y - r.y, s.vx - r.vx, s.vy - r.vy];
    const t = -(px * vx + py * vy) / (vx * vx + vy * vy || 1);
    if (t <= 0 || t > seconds) continue;
    const [cx, cy] = [px + vx * t, py + vy * t]; // where it'll be, from the rocket, closest
    const d = Math.hypot(cx, cy);
    if (d > 3) continue;
    // Away from where it passes; straight across its path if it's coming dead on.
    return d > 0.3 ? [-cx / d, -cy / d] : [-vy / Math.hypot(vx, vy), vx / Math.hypot(vx, vy)];
  }
  return null;
}

// Whether a zone's hazard could hurt at `tick`, as far as can be told now.
function burningAt({ flame, laser, state, blob, mover, points }, tick) {
  if (blob) return blobAt(blob, tick).up;
  if (laser) return laserPhase(laser, state, tick) === "on";
  if (mover) {
    // The block where it'll be then, against the rocket anywhere along the stretch.
    const box = moverBox(mover, tick);
    return points.some(([x, y]) => inBox(box, circlesAt(x, y, 0)));
  }
  if (flame.mode === "near") {
    const s = (tick - state.fired) / TICK_RATE;
    return s < flame.warn + flame.on || s > flame.warn + flame.on + flame.off - flame.warn; // near its next firing
  }
  return flamePhase(flame, state, tick) === "on";
}
