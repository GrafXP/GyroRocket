import { buildOutline } from "./outline.js";
import { deepestContact } from "./collide.js";
import { TILE } from "./level.js";
import { createRocket, step as stepRocket, circlesAt, hurt, TICK_RATE, CENTRE_Y, FOOT_X, HULL, TANK } from "./rocket.js";
import { flamePhase, armFlame, inFlame, FLAME_DAMAGE } from "./hazards/flame.js";
import { inBlob } from "./hazards/blob.js";
import { fieldAt, moverBox } from "./machines.js";
import { laserPhase, inLaser } from "./hazards/laser.js";
import { stepTurrets } from "./hazards/turret.js";

export const REFUEL_TIME = 1.5; // seconds on a fuel pad to fill an empty tank, or mend a wrecked hull
export const RETRY_AFTER = TICK_RATE; // ticks after a crash, getting stranded or the finish before a tap goes on
const STUCK_TICKS = TICK_RATE; // sitting still this long with an empty tank, off the floor, is stranded too
const STILL_SPEED = 0.2; // m/s
export const CRYSTAL_REACH = 1; // m from a crystal's or key's centre to the rocket's shape that picks it up
export const OPEN_REACH = 10; // m from a door to the rocket's centre that opens it, with its key
const SEEN_RADIUS = 12; // tiles round the rocket that count as seen, for the map

// A level in play: the rocket in the level's cave, the checkpoint, and the level
// clock, which starts at lift-off, keeps running through restarts, and stops at
// the finish.
//
// Flying through a key picks it up, for good, and its doors open as the rocket
// comes near. Landing on a switch opens its gate (or turns its laser off), for good
// or for the switch's time from when the rocket lifts off again; a timed gate shuts
// when its time is up, but not on the rocket.
//
// Flamethrowers burn the hull while the rocket is in their flame; lava, the blobs
// it throws up, and laser beams destroy it; turrets' shots cost hull. Fans and magnets push it about, and moving blocks
// shove it, carry it when it's landed on them, and crush it against rock. They all
// keep to the level clock (world.tick).
//
// Landing on a fuel pad fills the tank, mends the hull and saves a checkpoint: the
// pad, and the level as it is (crystals, keys, doors, gates open and lasers off for
// good). After a crash, or when the rocket is stranded (out of fuel away from a
// fuel pad), `restart` puts a fresh rocket on the checkpoint's pad and the level
// back as it was, with timed gates shut, timed lasers on, and no shots in the air.
// Until the first fuel pad, the checkpoint is the start.
export function createWorld(level, outline = buildOutline(level)) {
  const world = {
    level,
    outline,
    rocket: null,
    tick: 0,
    startTick: -1,
    endTick: -1,
    done: false, // landed on the exit pad
    got: level.crystals.map(() => -1), // the tick each crystal was collected, or -1
    keys: [], // the colours of the keys held
    keyTicks: level.keys.map(() => -1), // the tick each key was picked up, or -1
    // Per door and gate: whether it's open, since when (or when it shut), and for a
    // timed gate, the tick it shuts (else -1).
    doors: level.doors.map(() => ({ open: false, changed: -1, until: -1 })),
    lasers: level.lasers.map(() => ({ open: false, changed: -1, until: -1 })), // `open`: switched off
    turrets: level.turrets.map((t) => ({ charge: -1, ready: Math.round(t.offset * TICK_RATE) })),
    shots: [], // { x, y, vx, vy, damage, born }
    flames: level.flames.map(() => ({ fired: -1 })), // when each "near" flamethrower was set off
    seen: new Uint8Array(level.width * level.height), // tiles the rocket has been near
    seenFrom: -1,
    checkpoint: null,
    restarts: 0,
    stranded: false,
    downTick: -1, // when it crashed or got stranded, until the restart
    refuelling: false, // on a fuel pad, and not full yet
    stillTicks: 0,
    cheats: { god: false, fuel: false }, // for the dev overlay
    assisted: false, // the autopilot flew some of it, so it doesn't count
  };
  save(world, level.start);
  place(world);
  return world;
}

function save(world, pad) {
  world.checkpoint = {
    pad,
    got: [...world.got],
    keys: [...world.keys],
    keyTicks: [...world.keyTicks],
    open: world.doors.map((d) => d.open && d.until < 0),
    off: world.lasers.map((l) => l.open && l.until < 0),
  };
}

function place(world) {
  const { x0, x1, y } = world.checkpoint.pad;
  world.rocket = createRocket((x0 + x1) / 2, y, world.level.fuel ?? TANK);
}

// Starts again from the checkpoint, full of fuel and mended. The clock runs on.
export function restart(world) {
  place(world);
  const saved = world.checkpoint;
  world.got = [...saved.got];
  world.keys = [...saved.keys];
  world.keyTicks = [...saved.keyTicks];
  world.doors = saved.open.map((open) => ({ open, changed: open ? -Infinity : -1, until: -1 }));
  world.lasers = saved.off.map((open) => ({ open, changed: open ? -Infinity : -1, until: -1 }));
  world.turrets = world.level.turrets.map(() => ({ charge: -1, ready: world.tick + TICK_RATE }));
  world.shots = [];
  world.restarts++;
  world.stranded = false;
  world.downTick = -1;
  world.stillTicks = 0;
}

export function step(world, input) {
  world.tick++;
  const r = world.rocket;
  if (world.done) {
    r.burning = r.sputtering = false;
    return world;
  }
  r.god = world.cheats.god;
  if (world.cheats.fuel) r.fuel = r.tank;
  const { level, tick } = world;
  // Blocks at any point through this tick (0 to 1), with doors and gates.
  const doors = shut(world);
  const boxesAt = (f) => (level.movers.length ? [...doors, ...level.movers.map((m) => moverBox(m, tick - 1 + f))] : doors);
  const now = level.movers.map((m) => moverBox(m, tick));
  if (r.state === "landed") carry(world, r, now);
  stepRocket(r, input, world.outline, {
    boxes: boxesAt,
    boxSpeed: Math.max(0, ...now.map((b) => Math.hypot(b.vx, b.vy))),
    field: fieldAt(level, tick, r.x, r.y),
  });
  if (world.startTick < 0 && r.state === "flying") world.startTick = world.tick;
  if (r.state !== "crashed") {
    collect(world);
    openDoors(world);
    see(world);
    hazards(world);
  }

  const pad = padUnder(world.level, r);
  world.refuelling = false;
  if (pad?.kind === "exit" && world.startTick >= 0) {
    world.done = true;
    world.endTick = world.tick;
    return world;
  }
  if (pad?.kind === "switch") {
    // Open the gate (or switch off the laser); a timed one's time starts over while
    // the rocket sits here.
    const door = switched(world, pad.opens);
    if (!door.open) Object.assign(door, { open: true, changed: world.tick });
    door.until = pad.time ? world.tick + pad.time * TICK_RATE : -1;
  }
  shutGates(world);
  if (pad?.kind === "fuel") {
    save(world, pad);
    world.refuelling = r.fuel < r.tank || r.hull < HULL;
    const share = 1 / (REFUEL_TIME * TICK_RATE);
    r.fuel = Math.min(r.tank, r.fuel + r.tank * share);
    r.hull = Math.min(HULL, r.hull + HULL * share);
  }

  if (world.downTick < 0) {
    if (r.state === "crashed") world.downTick = world.tick;
    else if (r.fuel <= 0 && pad?.kind !== "fuel") {
      const still = r.state === "landed" || Math.hypot(r.vx, r.vy) < STILL_SPEED;
      world.stillTicks = still ? world.stillTicks + 1 : 0;
      if (r.state === "landed" || world.stillTicks >= STUCK_TICKS) {
        world.stranded = true;
        world.downTick = world.tick;
      }
    }
  }
  return world;
}

// Picks up any crystal or key the rocket touches.
function collect(world) {
  const { crystals, keys } = world.level;
  for (let i = 0; i < crystals.length; i++) {
    if (world.got[i] < 0 && touches(world.rocket, crystals[i])) world.got[i] = world.tick;
  }
  for (let i = 0; i < keys.length; i++) {
    if (world.keyTicks[i] < 0 && touches(world.rocket, keys[i])) {
      world.keyTicks[i] = world.tick;
      world.keys.push(keys[i].color);
    }
  }
}

// Burns the rocket in any flame that's on, destroys it in a lava blob or a laser
// beam, and steps the turrets and their shots.
function hazards(world) {
  const r = world.rocket;
  const circles = circlesAt(r.x, r.y, r.angle);
  world.level.flames.forEach((f, i) => {
    armFlame(f, world.flames[i], world.tick, r);
    if (flamePhase(f, world.flames[i], world.tick) === "on" && inFlame(f, circles)) hurt(r, FLAME_DAMAGE / TICK_RATE, "flame");
  });
  if (world.level.blobs.some((b) => inBlob(b, circles, world.tick))) hurt(r, r.hull, "lava");
  if (world.level.lasers.some((l, i) => laserPhase(l, world.lasers[i], world.tick) === "on" && inLaser(l, circles))) hurt(r, r.hull, "laser");
  const shot = stepTurrets(world, circles);
  if (shot) hurt(r, shot, "shot");
}

// The state of the gate, or laser, that switch `label` works: { open, changed, until }.
export function switched(world, label) {
  const i = world.level.doors.findIndex((d) => d.gate === label);
  return i >= 0 ? world.doors[i] : world.lasers[world.level.lasers.findIndex((l) => l.label === label)];
}

// Moves a landed rocket along with the block it's standing on, if it is.
function carry(world, r, now) {
  const feet = r.y - CENTRE_Y;
  world.level.movers.forEach((m, i) => {
    const was = moverBox(m, world.tick - 1);
    const on = Math.abs(was.y1 - feet) < 0.05 && r.x + FOOT_X >= was.x0 && r.x - FOOT_X <= was.x1;
    if (!on) return;
    r.x += now[i].x0 - was.x0;
    r.y += now[i].y0 - was.y0;
  });
}

// Opens any shut door whose key the rocket holds, once it's near.
function openDoors(world) {
  const { x, y } = world.rocket;
  world.level.doors.forEach((d, i) => {
    const state = world.doors[i];
    if (state.open || !d.key || !world.keys.includes(d.key)) return;
    const dx = Math.max(d.x0 - x, 0, x - d.x1);
    const dy = Math.max(d.y0 - y, 0, y - d.y1);
    if (Math.hypot(dx, dy) < OPEN_REACH) Object.assign(state, { open: true, changed: world.tick });
  });
}

// Shuts timed gates, and turns timed lasers back on, when their time is up,
// unless the rocket is in the way.
function shutGates(world) {
  const r = world.rocket;
  const circles = () => circlesAt(r.x, r.y, r.angle);
  const back = (state, inTheWay) => {
    if (state.until < 0 || world.tick < state.until) return;
    if (r.state !== "crashed" && inTheWay()) return;
    Object.assign(state, { open: false, changed: world.tick, until: -1 });
  };
  world.level.doors.forEach((d, i) => back(world.doors[i], () => deepestContact(world.outline, circles(), [d])));
  world.level.lasers.forEach((l, i) => back(world.lasers[i], () => inLaser(l, circles(), 0.5)));
}

// The doors and gates that are shut, as rectangles that block the rocket.
export const shut = (world) => world.level.doors.filter((d, i) => !world.doors[i].open);

// Marks the tiles round the rocket as seen, each time it moves into a new tile.
function see(world) {
  const { width, height } = world.level;
  const c = Math.floor(world.rocket.x / TILE);
  const j = Math.floor(world.rocket.y / TILE);
  if (c + j * width === world.seenFrom) return;
  world.seenFrom = c + j * width;
  for (let jj = Math.max(0, j - SEEN_RADIUS); jj <= Math.min(height - 1, j + SEEN_RADIUS); jj++) {
    for (let cc = Math.max(0, c - SEEN_RADIUS); cc <= Math.min(width - 1, c + SEEN_RADIUS); cc++) {
      if ((cc - c) ** 2 + (jj - j) ** 2 <= SEEN_RADIUS ** 2) world.seen[jj * width + cc] = 1;
    }
  }
}

// Seconds until each timed gate shuts, or timed laser comes back on, for those on
// a timer: { gate, laser (true for one), seconds }.
export const gateTimers = (world) =>
  [
    ...world.level.doors.map((d, i) => ({ gate: d, laser: false, until: world.doors[i].until })),
    ...world.level.lasers.map((l, i) => ({ gate: l, laser: true, until: world.lasers[i].until })),
  ]
    .filter((t) => t.until >= 0)
    .map(({ gate, laser, until }) => ({ gate, laser, seconds: (until - world.tick) / TICK_RATE }));

// Whether the rocket's shape comes within CRYSTAL_REACH of point p.
export function touches(r, p) {
  if (Math.hypot(r.x - p.x, r.y - p.y) > 6) return false; // too far for any part of it
  return circlesAt(r.x, r.y, r.angle).some((c) => Math.hypot(c.x - p.x, c.y - p.y) < c.r + CRYSTAL_REACH);
}

export const crystalCount = (world) => world.got.filter((t) => t >= 0).length;

// Seconds on the level clock.
export function clock(world) {
  if (world.startTick < 0) return 0;
  return ((world.endTick < 0 ? world.tick : world.endTick) - world.startTick) / TICK_RATE;
}

// The pad the rocket has landed on, if any.
export function padUnder(level, r) {
  if (r.state !== "landed") return null;
  return level.pads.find((p) => r.x >= p.x0 && r.x <= p.x1 && Math.abs(r.y - CENTRE_Y - p.y) < 0.01) ?? null;
}
