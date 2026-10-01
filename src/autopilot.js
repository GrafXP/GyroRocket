import { KEY_COLORS, TILE } from "./sim/level.js";
import { deepestContact, polyContact } from "./sim/collide.js";
import { buildOutline, setTile, solidAt } from "./sim/outline.js";
import { circlesAt, CENTRE_Y, GRAVITY, THRUST, DRAG, MAX_LEAN, TICK_RATE } from "./sim/rocket.js";
import { padUnder, switched, RETRY_AFTER } from "./sim/world.js";
import { flamePhase, inFlame } from "./sim/hazards/flame.js";
import { blobAt, inBlob, BLOB_RADIUS } from "./sim/hazards/blob.js";
import { fieldAt, moverBox } from "./sim/machines.js";
import { laserPhase, inLaser } from "./sim/hazards/laser.js";
import { hangingShapes, below, stalactiteShape } from "./sim/hazards/stalactite.js";
import { lavaHeight } from "./sim/hazards/rise.js";
import { SHOT_RADIUS } from "./sim/hazards/turret.js";

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
// It steers round flames and laser beams that are always on and hanging
// stalactites, allows for the push of fans and magnets, sidesteps turrets' shots
// coming its way (not into a flame or rock, and deciding again whether to cross
// what's ahead), and keeps above rising lava. Where its path crosses any other
// flame or beam, a lava blob's column, or the ground a crusher or moving block
// covers, it slows as it comes up to it and waits, hovering, until the hazard's
// schedule shows a gap long enough to get across; then it goes, and doesn't change
// its mind. Hazards too close together to wait between, it crosses as one, when
// all of them have a gap. If there's a way round the ground a block covers, it
// takes that instead, or else it keeps clear of where crushers rest. A flame that
// fires as it comes near, it edges up to until it fires, and crosses while it
// rests. Under stalactites, it works out when each will be set off and fall, and
// flies on through at crossing speed if none would hit it; otherwise it edges
// forward until the first shakes, backs off, and goes once it has fallen. If
// crumbling rock is in the way, and there's no way round, it edges up to it until
// it cracks, backs off, and goes through once it has fallen away.

const MAX_SPEED = 9; // m/s it flies at, at most
const BRAKE = 3; // m/s² it plans to slow down at
const LOOK = 5; // m ahead along the path it steers for
const HOVER = 2; // m above a pad it flies to before letting down
const LEG_LIMIT = 90 * TICK_RATE;
const HAZARD_MARGIN = 0.8; // m it keeps from flames and blobs
const PASSING = 1.2; // m from a flame or beam that it counts as crossing it: a lean swings the feet out
const MARGINS = [2, 1.5, 1, 0.5, 0]; // m it tries to keep from rock, widest first, when finding a path
const APPROACH = 3; // m before a hazard it decides whether to cross or wait
const CROSS_SPEED = 6; // m/s it crosses a hazard at, and slows to as it comes up to one
const LINK = 4; // m between two hazards it needs to wait between them
const SPARE = 0.25; // s either side of a hazard's burning that it counts as burning too
const CREEP = 1.2; // m/s it edges forward at to set off a stalactite, or crack crumbling rock
const FALL_MARGIN = 0.5; // m it keeps from a falling stalactite, as it works out where they'll fall
const LAVA_MARGIN = 1.5; // m its feet keep above rising lava, where it plans its path…
const PLAN_SPEED = 4; // …by the time it gets there, going at about this, m/s, waits and all
const LAVA_WARNING = 3; // s before rising lava would reach it that it leaves a pad
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
      // Round the ground moving blocks cover, if there's a way; else through it,
      // waiting, and clear of where crushers rest if it can be.
      const boxes = blocking(world);
      const resting = level.movers.filter((m) => m.kind === "crusher");
      // Through crumbling rock only if there's no way round it, and there's none
      // at all if air doesn't join here and there.
      const [a, b] = [here(r), stop.target];
      const open = airJoins(world.outline, a, b);
      const path =
        (open && findPath(world, a, b, [...boxes, ...level.movers.map(sweep)], world.outline, true)) ||
        (open && resting.length && findPath(world, a, b, [...boxes, ...resting], world.outline, true)) ||
        (open && level.movers.length && findPath(world, a, b, boxes, world.outline, true)) ||
        breakThrough(world, a, b, boxes);
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
  const zone = zones.find((z) => z.to >= at && !fallen(z));
  const ahead = zone ? zone.from - at : Infinity;
  // It goes only if it can cross the hazards after this one that it couldn't
  // stop short of, too, and no stalactite would come down on it on the way.
  const run = zone ? linked(zones, zone, at) : [];
  const clear = () => run.every((z) => safeToCross(world, z, Math.max(0, z.from - at))) && fallsClear(world, path, at, run);
  // Under stalactites, it decides further back, so as not to slow down for them
  // if it can fly on through.
  const decide = zone?.stalactite ? APPROACH + 8 : APPROACH;
  if (zone && !zone.go && (zone.from === 0 || (ahead <= decide && clear()))) for (const z of run) z.go = true;
  const wait = zone && !zone.go && ahead <= APPROACH;
  // Across at crossing speed, but through a hole in crumbling rock with care.
  const crossing = zone && zone.go && !zone.crumble && ahead <= APPROACH && zone.to < path.length - 3;
  // Slowing for a hazard it can't cross yet: no faster than it can stop at by the
  // time it has to decide.
  const halt = zone && !zone.go && ahead > APPROACH && ahead <= APPROACH + 8 && !clear() ? Math.sqrt(2 * BRAKE * (ahead - APPROACH)) + 1 : Infinity;
  const cap = Math.min(halt, zone && ahead <= APPROACH + 8 ? CROSS_SPEED : MAX_SPEED);
  let vx, vy;
  // Slowing, to creep up to a stalactite or crumbling rock: as fast as it can
  // still brake to CREEP a little short of it (gently: leaning back to brake
  // swings the feet forward).
  const creep = zone && !zone.go && untouched(zone, world.tick) ? CREEP + Math.sqrt(2 * (BRAKE / 2) * Math.max(0, ahead - 3.5)) : Infinity;
  if (wait && untouched(zone, world.tick)) {
    // A stalactite or "near" flame that hasn't been set off, or crumbling rock
    // not cracked yet: edge on until it shakes, fires or cracks (keeping close to
    // the path, to come down where the hole will be).
    const [tx, ty] = path[Math.min(path.length - 1, at + (zone.crumble ? 2 : LOOK))];
    const d = Math.hypot(tx - r.x, ty - r.y) || 1;
    [vx, vy] = [((tx - r.x) / d) * Math.min(creep, CROSS_SPEED), ((ty - r.y) / d) * Math.min(creep, CROSS_SPEED)];
  } else if (wait && zone.crumble) {
    // Crumbling rock that's cracked: hold still until it's gone.
    [vx, vy] = [0, 0];
  } else if (wait) {
    // Hover; back off if it's drifted up to the hazard.
    const [bx, by] = path[Math.max(0, zone.from - APPROACH)];
    const d = Math.hypot(bx - r.x, by - r.y) || 1;
    [vx, vy] = ahead < 1.5 ? [((bx - r.x) / d) * 2, ((by - r.y) / d) * 2] : [0, 0];
  } else if (crossing) {
    // On along the path at crossing speed, not slowing.
    const [tx, ty] = path[Math.min(path.length - 1, at + LOOK, zone.to + 2)];
    const d = Math.hypot(tx - r.x, ty - r.y) || 1;
    [vx, vy] = [((tx - r.x) / d) * CROSS_SPEED, ((ty - r.y) / d) * CROSS_SPEED];
  } else if (stop.pad && left < 2 && Math.abs(r.x - padX) < 1) {
    // Over the pad: let down gently.
    [vx, vy] = [(padX - r.x) * 1.5, -2];
  } else {
    // Through a hole in crumbling rock it keeps close to the path, not cutting corners.
    const look = zone?.crumble && ahead <= APPROACH ? 2 : LOOK;
    const [tx, ty] = path[Math.min(path.length - 1, at + look)];
    const d = Math.hypot(tx - r.x, ty - r.y) || 1;
    const speed = Math.min(cap, creep, Math.sqrt(2 * BRAKE * (left + 1)), d * 2);
    [vx, vy] = [((tx - r.x) / d) * speed, ((ty - r.y) / d) * speed];
  }
  // Out of the way of any shot coming at it.
  const shot = incoming(world, 1.5);
  if (shot) {
    const [dx, dy] = dodge(world, shot, vx, vy);
    // That throws its timing out: what it hasn't started across yet, it decides again.
    if ((dx !== vx || dy !== vy) && zone?.go && ahead > 0) for (const z of run) z.go = false;
    [vx, vy] = [dx, dy];
  }

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

// Zone `first` and the ones after it that it can't stop between, once it's going
// (it's at `at` along the path): each starting less than LINK metres after the
// ones before end. Crumbling rock it deals with one piece at a time.
function linked(zones, first, at) {
  const run = [first];
  if (first.crumble) return run;
  let end = first.to;
  for (const z of zones) {
    if (z === first || z.to < at || z.from < first.from || fallen(z)) continue;
    if (z.crumble || z.from - end >= LINK) break;
    run.push(z);
    end = Math.max(end, z.to);
  }
  return run;
}

// Whether a zone's stalactite has come down: there's nothing there any more.
const fallen = (z) => z.stalactite && z.state.gone >= 0;

// Whether a zone's stalactite hasn't been set off, its "near" flame is waiting
// to be, or its crumbling rock is still standing and none of it has cracked.
function untouched({ stalactite, flame, state, crumble, states }, tick) {
  if (stalactite) return state.shook < 0;
  if (flame?.mode === "near") return idle(flame, state, tick);
  if (!crumble) return false;
  const standing = crumble.filter((i) => states[i].fell < 0);
  return standing.length > 0 && standing.every((i) => states[i].cracked < 0);
}

// A path through crumbling rock, when there's no way round: the shortest through
// any one piece of it (level.crumbles joined side by side) that's still there, or
// else through all of it.
function breakThrough(world, from, to, boxes) {
  const { level } = world;
  if (!level.crumbles.length) return null;
  let best = null;
  crumbleMasses(level).forEach((mass, m) => {
    if (mass.every((i) => world.crumbles[i].fell >= 0) || !airJoins(openOutline(level, m), from, to)) return;
    const path = findPath(world, from, to, boxes, openOutline(level, m), true);
    if (path && (!best || path.length < best.length)) best = path;
  });
  return best ?? findPath(world, from, to, boxes, openOutline(level), true);
}

const masses = new WeakMap();

// The level's crumbling rock in pieces, each a list of the tiles (indices into
// level.crumbles) joined side by side.
function crumbleMasses(level) {
  if (!masses.has(level)) {
    const at = new Map(level.crumbles.map((t, i) => [t.j * level.width + t.c, i]));
    const seen = new Set();
    const list = [];
    level.crumbles.forEach((t, i) => {
      if (seen.has(i)) return;
      const mass = [];
      const todo = [i];
      seen.add(i);
      while (todo.length) {
        const k = todo.pop();
        mass.push(k);
        const { c, j } = level.crumbles[k];
        for (const n of [at.get(j * level.width + c - 1), at.get(j * level.width + c + 1), at.get((j - 1) * level.width + c), at.get((j + 1) * level.width + c)]) {
          if (n !== undefined && !seen.has(n) && Math.abs(level.crumbles[n].c - c) <= 1) {
            seen.add(n);
            todo.push(n);
          }
        }
      }
      list.push(mass);
    });
    masses.set(level, list);
  }
  return masses.get(level);
}

const opened = new WeakMap();

// The level's rock with a piece of its crumbling rock gone (mass `m`, as numbered
// by crumbleMasses), or all of it, for paths through it.
function openOutline(level, m = -1) {
  if (!opened.has(level)) opened.set(level, new Map());
  const cache = opened.get(level);
  if (!cache.has(m)) {
    const outline = buildOutline(level);
    const tiles = m < 0 ? level.crumbles.map((t, i) => i) : crumbleMasses(level)[m];
    for (const i of tiles) setTile(outline, level.crumbles[i].c, level.crumbles[i].j, false);
    cache.set(m, outline);
  }
  return cache.get(m);
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
                .map((p) => ({ p, length: findPath(world, at, hoverOver(p), blocked(), openOutline(level))?.length ?? Infinity }))
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
    .map((pad) => ({ pad, length: findPath(world, start, hoverOver(pad), level.doors, openOutline(level))?.length ?? Infinity }))
    .sort((a, b) => a.length - b.length)
    .map((s) => s.pad);
  return pads.slice(0, pads.indexOf(level.exit) + 1).map((p) => (p.kind === "exit" ? "E" : `F@${p.c0 + 1}`));
}

const hoverOver = (pad) => [(pad.x0 + pad.x1) / 2, pad.y + CENTRE_Y + HOVER];

// Where the rocket starts a leg from: over its pad if it's landed.
const here = (r) => [r.x, r.y + (r.state === "landed" ? HOVER : 0)];

// What blocks the autopilot now: shut gates, shut doors it has no key for, and
// hanging stalactites.
const blocking = (world) => [...world.level.doors.filter((d, i) => !world.doors[i].open && !(d.key && world.keys.includes(d.key))), ...hangingShapes(world)];

// A path from (x0, y0) to (x1, y1) for the upright rocket, in 1 m steps (eight
// ways), keeping `margin` metres clear of rock, `boxes` and flames that never go
// out where it can, except near its ends (which are over pads, or at keys), and
// its feet out of reach of rising lava, as high as it will be by the time it gets
// there. It goes by the world's rock unless given another `outline`. With `avoid`,
// of the shortest paths it takes the one that spends least time in reach of
// hazards it would have to wait for (a straight line along a band rather than a
// dip through every lava blob's column), and of those the straightest (the grid's
// shortest paths can weave). Returns a list of [x, y], or null.
export function findPath(world, [x0, y0], [x1, y1], boxes, outline = world.outline, avoid = false) {
  const { level } = world;
  // The lowest the rocket's centre can be, `steps` metres along the path.
  const { rise } = level;
  const soon = rise && world.rise.from >= 0 ? Math.max(0, (world.rise.from - world.tick) / TICK_RATE) : Infinity;
  const lava = (steps) => (rise ? Math.min(rise.to, lavaHeight(world) + rise.speed * Math.max(0, steps / PLAN_SPEED - soon)) : lavaHeight(world)) + LAVA_MARGIN + CENTRE_Y;
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
      // (A foot can be wholly inside a thin wedge of rock, touching none of its edges.)
      !circles.some((c) => solidAt(outline, c.x, c.y)) &&
      !deepestContact(outline, circles, boxes) &&
      !walls.some((f) => inFlame(f, circles, HAZARD_MARGIN)) &&
      !beams.some((l) => inLaser(l, circles, HAZARD_MARGIN)) &&
      !gales.some((f) => x > f.x0 && x < f.x1 && y > f.y0 && y < f.y1)
    );
  };
  const tight = new Int8Array(cols * rows); // 0 not checked, 1 fits, 2 doesn't
  // Whether a point fits at each margin, as far as known: it fits at every margin
  // from pass fitsFrom on, and not at any up to pass failsTo. (A point that fits
  // with a wide margin fits with a narrower one, so a failed pass costs little more
  // than the search itself.)
  const fitsFrom = new Int8Array(cols * rows).fill(MARGINS.length);
  const failsTo = new Int8Array(cols * rows).fill(-1);
  const from = new Int32Array(cols * rows);
  const steps = new Int32Array(cols * rows); // from the start
  const queue = new Int32Array(cols * rows);
  const hazard = avoid ? hazardGrid(world, x0, y0, gx0, gy0, cols, rows) : null;
  const exposed = new Int32Array(avoid ? cols * rows : 0); // steps in reach of hazards, from the start
  const length = new Float32Array(avoid ? cols * rows : 0); // metres from the start, diagonal steps and all
  const start = index(0, 0);
  // Breadth first from the start, keeping MARGINS[pass] clear of rock.
  const search = (pass) => {
    from.fill(-1);
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
          if (from[n] >= 0) {
            // Found again as far from the start: keep the way with less exposure,
            // and of those the straightest. (Breadth first, so i's are settled, and
            // n's aren't used yet.)
            if (hazard && steps[n] === steps[i] + 1 && n !== start) {
              const [e, l] = [exposed[i] + hazard[n], length[i] + (dx && dy ? Math.SQRT2 : 1)];
              if (e < exposed[n] || (e === exposed[n] && l < length[n] - 1e-3)) [from[n], exposed[n], length[n]] = [i, e, l];
            }
            continue;
          }
          const [x, y] = [x0 + nx, y0 + ny];
          const near = Math.hypot(nx, ny) < 3 || Math.hypot(x - x1, y - y1) < 3;
          if (Math.hypot(nx, ny) >= 3 && y < lava(steps[i] + 1)) continue;
          if (near) {
            if (!tight[n]) tight[n] = fits(x, y, 0) ? 1 : 2;
            if (tight[n] === 2) continue;
          } else if (pass < fitsFrom[n]) {
            if (pass <= failsTo[n]) continue;
            if (!fits(x, y, MARGINS[pass])) {
              failsTo[n] = pass;
              continue;
            }
            fitsFrom[n] = pass;
          }
          from[n] = i;
          steps[n] = steps[i] + 1;
          if (hazard) [exposed[n], length[n]] = [exposed[i] + hazard[n], length[i] + (dx && dy ? Math.SQRT2 : 1)];
          queue[tail++] = n;
        }
      }
    }
    return null;
  };
  // The roomiest way there. If there's none with no margin at all, there's none,
  // so that's tried second, to save searching the whole cave at every margin.
  const roomy = search(0);
  if (roomy) return roomy;
  const any = search(MARGINS.length - 1);
  if (!any) return null;
  for (let pass = 1; pass < MARGINS.length - 1; pass++) {
    const path = search(pass);
    if (path) return path;
  }
  return any;
}

// Whether air joins the tiles at points a and b in `outline`, corners and all,
// with doors, gates, blocks and stalactites left out. If it doesn't, the rocket
// can't get from one to the other, whichever way it goes.
function airJoins(outline, a, b) {
  const { level, solid } = outline;
  const { width, height } = level;
  const tile = ([x, y]) => {
    const [c, j] = [Math.floor(x / TILE), Math.floor(y / TILE)];
    return c < 0 || j < 0 || c >= width || j >= height ? -1 : j * width + c;
  };
  const [from, to] = [tile(a), tile(b)];
  if (from < 0 || to < 0 || solid[from] || solid[to]) return true; // can't tell: let the search find out
  const seen = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let [head, tail] = [0, 0];
  seen[from] = 1;
  queue[tail++] = from;
  while (head < tail) {
    const i = queue[head++];
    if (i === to) return true;
    const [c, j] = [i % width, Math.floor(i / width)];
    for (let dj = -1; dj <= 1; dj++) {
      for (let dc = -1; dc <= 1; dc++) {
        const [nc, nj] = [c + dc, j + dj];
        const n = nj * width + nc;
        if (nc < 0 || nj < 0 || nc >= width || nj >= height || seen[n] || solid[n]) continue;
        seen[n] = 1;
        queue[tail++] = n;
      }
    }
  }
  return false;
}

// Whether a fan that's always on blows harder than the rocket can fly against:
// down harder than its burn beats gravity, or sideways harder than it can push
// at full lean while holding itself up.
const tooStrong = (f) => f.mode === "always" && (f.dir[1] < 0 ? f.strength > 8 : f.dir[0] !== 0 && f.strength > 15);

// The stretches of `path` (as index ranges, 1 m apiece) where the rocket would be
// in reach of a flame that isn't always on, of a lava blob's column, of the ground
// a mover or crusher covers, or under a stalactite; and where it goes through
// crumbling rock.
function hazardZones(world, path) {
  const zones = crumbleZones(world, path);
  for (const h of passingHazards(world)) {
    let from = -1;
    path.forEach(([x, y], i) => {
      const inside = touches(h, circlesAt(x, y, 0));
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

// The hazards a path can cross by waiting for them: stalactites still hanging,
// flames and lasers that go off, blobs, and moving blocks.
function passingHazards(world) {
  const { flames, blobs, movers, stalactites, lasers } = world.level;
  return [
    ...stalactites
      .map((stalactite, i) => ({ stalactite, state: world.stalactites[i], floor: dropFloor(world, stalactite) }))
      .filter((h) => h.state.gone < 0),
    ...flames.map((flame, i) => ({ flame, state: world.flames[i] })).filter((h) => h.flame.mode !== "always"),
    ...blobs.map((blob) => ({ blob })),
    ...movers.map((mover) => ({ mover, swept: sweep(mover) })),
    ...lasers.map((laser, i) => ({ laser, state: world.lasers[i] })).filter((h) => h.laser.mode === "cycle"),
  ];
}

// Whether the rocket's `circles` are in reach of hazard `h` (from passingHazards).
const touches = (h, circles) =>
  h.stalactite
    ? underStalactite(h.stalactite, h.floor, circles)
    : h.flame
      ? inFlame(h.flame, circles, PASSING)
      : h.laser
        ? inLaser(h.laser, circles, PASSING)
        : h.blob
          ? inColumn(h.blob, circles)
          : inBox(h.swept, circles);

// A box round everything hazard `h` can reach, give or take a metre.
function reachBox(h) {
  if (h.stalactite) return { x0: h.stalactite.x0, x1: h.stalactite.x1, y0: h.floor, y1: h.stalactite.top };
  if (h.blob) return { x0: h.blob.x - 0.8, x1: h.blob.x + 0.8, y0: h.blob.y - 1, y1: h.blob.y + h.blob.height * TILE + 1.8 };
  if (h.swept) return h.swept;
  const { x0, y0, x1, y1 } = h.flame ?? h.laser;
  return { x0: Math.min(x0, x1) - 1, x1: Math.max(x0, x1) + 1, y0: Math.min(y0, y1) - 1, y1: Math.max(y0, y1) + 1 };
}

// How far the rocket reaches from its centre, upright, and a little more.
const ROCKET_REACH = Math.max(...circlesAt(0, 0, 0).map((c) => Math.hypot(c.x, c.y) + c.r)) + PASSING + 1;

// For findPath: at each point of its grid, how bad it is to be there: 0 out of
// reach of any hazard it would have to wait for, 1 in reach of one, and more in
// reach of a moving block that's there for more than half its cycle (up to
// 1 + BLOCKED, for all of it), so that it passes a block where it's clear for
// long enough, as at the side of a shaft a slab slides across.
// Points are (x0 + gx, y0 + gy) for gx from gx0, cols of them, and gy from gy0,
// rows of them.
const BLOCKED = 4;
const SAMPLES = 16; // times through a block's cycle it looks at
function hazardGrid(world, x0, y0, gx0, gy0, cols, rows) {
  const grid = new Uint8Array(cols * rows);
  for (const h of passingHazards(world)) {
    const b = reachBox(h);
    const [ga, gb] = [Math.max(gx0, Math.ceil(b.x0 - ROCKET_REACH - x0)), Math.min(gx0 + cols - 1, Math.floor(b.x1 + ROCKET_REACH - x0))];
    const [ha, hb] = [Math.max(gy0, Math.ceil(b.y0 - ROCKET_REACH - y0)), Math.min(gy0 + rows - 1, Math.floor(b.y1 + ROCKET_REACH - y0))];
    const m = h.mover;
    const cycle = m && (m.kind === "mover" ? m.period : m.rest + m.warn + m.slam + m.hold + m.back) * TICK_RATE;
    const boxes = m ? Array.from({ length: SAMPLES }, (_, i) => moverBox(m, (i * cycle) / SAMPLES)) : null;
    for (let gy = ha; gy <= hb; gy++) {
      for (let gx = ga; gx <= gb; gx++) {
        const k = (gy - gy0) * cols + (gx - gx0);
        if (grid[k] > BLOCKED) continue;
        const circles = circlesAt(x0 + gx, y0 + gy, 0);
        if (!touches(h, circles)) continue;
        const share = boxes ? boxes.filter((box) => inBox(box, circles)).length / SAMPLES : 0;
        grid[k] = Math.max(grid[k], share > 0.5 ? 1 + Math.floor(BLOCKED * share) : 1);
      }
    }
  }
  return grid;
}

// The stretches of `path` through crumbling rock that's standing, each with the
// tiles in its way (indices into level.crumbles) as `crumble`.
function crumbleZones(world, path) {
  const { level } = world;
  if (!level.crumbles.length) return [];
  const zones = [];
  let zone = null;
  path.forEach(([x, y], i) => {
    const circles = circlesAt(x, y, 0);
    const tiles = [];
    for (let j = Math.floor((y - 4) / TILE); j <= Math.floor((y + 4) / TILE); j++) {
      for (let c = Math.floor((x - 3) / TILE); c <= Math.floor((x + 3) / TILE); c++) {
        const k = c >= 0 && j >= 0 && c < level.width && j < level.height ? world.crumbleAt[j * level.width + c] : -1;
        if (k >= 0 && world.crumbles[k].fell < 0 && inBox(level.crumbles[k], circles, 0.3)) tiles.push(k);
      }
    }
    if (tiles.length && !zone) zone = { crumble: [], states: world.crumbles, from: i, to: i, points: [] };
    if (zone && tiles.length) {
      zone.to = i;
      for (const k of tiles) if (!zone.crumble.includes(k)) zone.crumble.push(k);
    }
    if (zone && (!tiles.length || i === path.length - 1)) {
      zones.push({ ...zone, points: path.slice(zone.from, zone.to + 1) });
      zone = null;
    }
  });
  return zones;
}

// The whole of the ground a mover or crusher covers on its travel.
function sweep(m) {
  const [dx, dy] = m.to;
  return { x0: m.x0 + Math.min(0, dx), y0: m.y0 + Math.min(0, dy), x1: m.x1 + Math.max(0, dx), y1: m.y1 + Math.max(0, dy) };
}

// Whether any circle comes within `margin` of the box.
const inBox = (b, circles, margin = HAZARD_MARGIN) =>
  circles.some((c) => {
    const [px, py] = [Math.max(b.x0, Math.min(b.x1, c.x)), Math.max(b.y0, Math.min(b.y1, c.y))];
    return Math.hypot(c.x - px, c.y - py) < c.r + margin;
  });

// Whether any circle is in the space a stalactite falls through, down from where
// it hangs to `floor`, the rock below it (dropFloor).
const underStalactite = (s, floor, circles) =>
  circles.some((c) => c.x > s.x0 - c.r - HAZARD_MARGIN && c.x < s.x1 + c.r + HAZARD_MARGIN && c.y < s.top && c.y > floor - c.r);

// How low a stalactite can fall: the height of the rock under its tip.
function dropFloor(world, s) {
  let floor = s.tip;
  while (floor > 0 && !solidAt(world.outline, s.x, floor)) floor -= 0.5;
  return floor;
}

// Whether any circle is in the space a blob flies through.
const inColumn = (blob, circles) =>
  circles.some((c) => Math.abs(c.x - blob.x) < c.r + 0.8 + HAZARD_MARGIN && c.y > blob.y - 1 && c.y < blob.y + blob.height * TILE + 1.8);

// Whether the rocket, `ahead` metres short of `zone`, can fly through it before
// its hazard burns: it's clear from arrival until the far side, with SPARE. (The
// zone already allows for the rocket's size.)
function safeToCross(world, zone, ahead) {
  const r = world.rocket;
  if (zone.stalactite) return true; // fallsClear works it out
  // A "near" flame that isn't firing or resting: set it off first (untouched).
  if (zone.flame?.mode === "near" && idle(zone.flame, zone.state, world.tick)) return false;
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

// Whether the rocket can fly on along `path` from point `at` through the zones of
// `run` at crossing speed without one of their stalactites coming down on it: as
// the sim has it, those not set off yet shake once it's below them and in reach,
// then drop, and those that have, fall on. It allows for going a little slower
// than it means to.
function fallsClear(world, path, at, run) {
  const near = run.filter((z) => z.stalactite && !fallen(z)).map((z) => ({ s: z.stalactite, state: z.state, floor: z.floor }));
  if (!near.length) return true;
  const end = run.at(-1).to;
  const r = world.rocket;
  const v0 = Math.hypot(r.vx, r.vy);
  const now = world.tick;
  // (Steps along the path are a metre, or √2 on a diagonal.)
  const step = (i) => Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
  return [1, 0.8].every((pace) => {
    const falls = near.map(({ s, state, floor }) => ({ s, floor, shook: state.shook, drop: state.drop, vy: state.vy }));
    let [d, k, v] = [0, at, v0];
    for (let t = 1; k < end && t <= 6 * TICK_RATE; t++) {
      // Towards crossing speed as steer() drives it, and on along the path.
      v += (CROSS_SPEED * pace - v) * (2.5 / TICK_RATE);
      d += v / TICK_RATE;
      while (k < end && d >= step(k)) [d, k] = [d - step(k), k + 1];
      const [[xa, ya], [xb, yb]] = [path[k], path[Math.min(end, k + 1)]];
      const part = k < end ? d / step(k) : 0;
      const [x, y] = [xa + (xb - xa) * part, ya + (yb - ya) * part];
      const tick = now + t;
      const circles = circlesAt(x, y, 0).map((c) => ({ ...c, r: c.r + FALL_MARGIN }));
      for (const f of falls) {
        if (f.gone) continue;
        if (f.shook < 0) {
          if (below(world.outline, f.s, x, y)) f.shook = tick;
          continue;
        }
        if (tick - f.shook < f.s.warn * TICK_RATE) continue;
        f.vy += GRAVITY / TICK_RATE;
        f.drop += f.vy / TICK_RATE;
        if (f.s.tip - f.drop <= f.floor) {
          f.gone = true;
          continue;
        }
        const { poly } = stalactiteShape(f.s, f.drop);
        if (circles.some((c) => polyContact(poly, c))) return false;
      }
    }
    return true;
  });
}

// Whether a "near" flame is neither firing nor resting, so the rocket coming
// within its reach sets it off.
const idle = (flame, state, tick) => state.fired < 0 || (tick - state.fired) / TICK_RATE >= flame.warn + flame.on + flame.off;

// Whether a flame, blob, moving block, beam, shot or stalactite could reach the
// rocket where it is within a second, or rising lava within a few.
function dangerSoon(world) {
  const r = world.rocket;
  const circles = circlesAt(r.x, r.y, r.angle);
  const soon = (hurts) => {
    for (let t = world.tick; t <= world.tick + TICK_RATE; t += 3) if (hurts(t)) return true;
    return false;
  };
  const feet = r.y - CENTRE_Y;
  const rise = world.level.rise;
  return (
    (rise && world.rise.from >= 0 && lavaHeight(world) + rise.speed * LAVA_WARNING > feet - 0.5) ||
    world.level.stalactites.some((s, i) => world.stalactites[i].shook >= 0 && world.stalactites[i].gone < 0 && underStalactite(s, dropFloor(world, s), circles)) ||
    world.level.flames.some((flame, i) => {
      if (!inFlame(flame, circles, HAZARD_MARGIN)) return false;
      const state = world.flames[i];
      if (flame.mode === "near" && idle(flame, state, world.tick)) return true;
      return soon((t) => burningAt({ flame, state }, t));
    }) ||
    world.level.blobs.some((blob) => inColumn(blob, circles) && soon((t) => blobAt(blob, t).up)) ||
    world.level.movers.some((m) => soon((t) => inBox(moverBox(m, t), circles))) ||
    world.level.lasers.some((l, i) => inLaser(l, circles, HAZARD_MARGIN) && soon((t) => laserPhase(l, world.lasers[i], t) !== "off")) ||
    incoming(world, 1) !== null
  );
}

// A turret's shot that'll pass within 3 m of the rocket in the next `seconds`,
// as { shot, away }, with `away` the way to move to get out of its way (a unit
// [x, y]), or null if none will.
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
    return { shot: s, away: d > 0.3 ? [-cx / d, -cy / d] : [-vy / Math.hypot(vx, vy), vx / Math.hypot(vx, vy)] };
  }
  return null;
}

const DODGE = 6; // m/s it adds to get out of a shot's way
const DODGE_ROOM = 0.5; // m it wants between the shot and its shape

// The velocity to fly at instead of (vx, vy) with `shot` (from incoming) coming:
// away from where it'll pass, if that clears it; if not (going away would only
// stop it, say, when it's crossing a flame and the shot passes in front), of
// that, the other way, (vx, vy) as it was, and straight away or the other way,
// the one that keeps furthest from it.
function dodge(world, { shot, away: [ux, uy] }, vx, vy) {
  const options = [
    [vx + ux * DODGE, vy + uy * DODGE],
    [vx - ux * DODGE, vy - uy * DODGE],
    [vx, vy],
    [ux * DODGE, uy * DODGE],
    [-ux * DODGE, -uy * DODGE],
  ];
  const room = options.map(([tx, ty]) => clearance(world, shot, tx, ty));
  if (room[0] >= DODGE_ROOM) return options[0];
  return options[room.indexOf(Math.max(...room))];
}

// How close `shot` comes to the rocket's shape in the next 1.5 s, in metres, if
// the rocket heads for velocity (tx, ty) as steer() drives it, until the shot hits
// rock or has gone by; or -HARMED if that takes it into rock, a flame, a beam or
// a blob instead, before it has had time to turn back once the shot's by.
const HARMED = 10;
const TURN_BACK = 0.8; // s after a shot's gone by
function clearance(world, shot, tx, ty) {
  const r = world.rocket;
  let least = Infinity;
  let gone = Infinity; // when the shot hit rock or went by
  for (let t = 1 / 30; t <= Math.min(1.5, gone + TURN_BACK); t += 1 / 30) {
    const [sx, sy] = [shot.x + shot.vx * t, shot.y + shot.vy * t];
    // Towards (tx, ty) at 2.5 /s, as steer() asks for.
    const k = (1 - Math.exp(-2.5 * t)) / 2.5;
    const [x, y] = [r.x + tx * t + (r.vx - tx) * k, r.y + ty * t + (r.vy - ty) * k];
    const circles = circlesAt(x, y, 0);
    if (harms(world, circles, world.tick + Math.round(t * TICK_RATE))) return -HARMED;
    if (gone < Infinity) continue;
    for (const c of circles) least = Math.min(least, Math.hypot(c.x - sx, c.y - sy) - c.r - SHOT_RADIUS);
    const by = (sx - x) * shot.vx + (sy - y) * shot.vy > 0 && Math.hypot(sx - x, sy - y) > 3;
    if (by || solidAt(world.outline, sx, sy)) gone = t;
  }
  return least;
}

// Whether the rocket's `circles` would be in rock, or in a flame, beam or blob
// that could be burning at `tick` (a "near" flame unless it's resting: it would
// fire).
function harms(world, circles, tick) {
  const { level } = world;
  return (
    circles.some((c) => solidAt(world.outline, c.x, c.y)) ||
    level.flames.some((f, i) => {
      if (!inFlame(f, circles, 0.3)) return false;
      if (f.mode !== "near") return flamePhase(f, world.flames[i], tick) !== "off";
      const s = (tick - world.flames[i].fired) / TICK_RATE;
      return world.flames[i].fired < 0 || s < f.warn + f.on || s >= f.warn + f.on + f.off;
    }) ||
    level.lasers.some((l, i) => inLaser(l, circles, 0.3) && laserPhase(l, world.lasers[i], tick) !== "off") ||
    level.blobs.some((b) => inBlob(b, circles, tick, 0.3))
  );
}

// Whether a zone's hazard could hurt at `tick`, as far as can be told now.
function burningAt({ flame, laser, state, blob, mover, stalactite, crumble, states, points }, tick) {
  if (stalactite) return state.gone < 0; // until it's down
  if (crumble) return crumble.some((i) => states[i].fell < 0); // until it's all gone
  if (blob) {
    // The blob where it'll be then, against the rocket anywhere along the stretch.
    const { y, up } = blobAt(blob, tick);
    return up && points.some(([x, py]) => Math.abs(py - y) < ROCKET_REACH + 1 && circlesAt(x, py, 0).some((c) => Math.hypot(c.x - blob.x, c.y - y) < c.r + BLOB_RADIUS + HAZARD_MARGIN));
  }
  if (laser) return laserPhase(laser, state, tick) === "on";
  if (mover) {
    // The block where it'll be then, against the rocket anywhere along the stretch.
    const box = moverBox(mover, tick);
    return points.some(([x, y]) => inBox(box, circlesAt(x, y, 0)));
  }
  if (flame.mode === "near") {
    // Burning, or burning again once it's rested, if the rocket's still in reach
    // then and sets it off.
    const s = (tick - state.fired) / TICK_RATE;
    return s < flame.warn + flame.on || s >= flame.warn + flame.on + flame.off + flame.warn;
  }
  return flamePhase(flame, state, tick) === "on";
}
