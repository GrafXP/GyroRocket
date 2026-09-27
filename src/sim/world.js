import { buildOutline } from "./outline.js";
import { deepestContact } from "./collide.js";
import { TILE } from "./level.js";
import { createRocket, step as stepRocket, circlesAt, TICK_RATE, CENTRE_Y, HULL, TANK } from "./rocket.js";

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
// comes near. Landing on a switch opens its gate, for good or for the switch's
// time from when the rocket lifts off again; a timed gate shuts when its time is up,
// but not on the rocket.
//
// Landing on a fuel pad fills the tank, mends the hull and saves a checkpoint: the
// pad, and the level as it is (crystals, keys, doors and gates open for good).
// After a crash, or when the rocket is stranded (out of fuel away from a fuel pad),
// `restart` puts a fresh rocket on the checkpoint's pad and the level back as it
// was, with timed gates shut. Until the first fuel pad, the checkpoint is the start.
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
    seen: new Uint8Array(level.width * level.height), // tiles the rocket has been near
    seenFrom: -1,
    checkpoint: null,
    restarts: 0,
    stranded: false,
    downTick: -1, // when it crashed or got stranded, until the restart
    refuelling: false, // on a fuel pad, and not full yet
    stillTicks: 0,
    cheats: { god: false, fuel: false }, // for the dev overlay
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
  stepRocket(r, input, world.outline, shut(world));
  if (world.startTick < 0 && r.state === "flying") world.startTick = world.tick;
  if (r.state !== "crashed") {
    collect(world);
    openDoors(world);
    see(world);
  }

  const pad = padUnder(world.level, r);
  world.refuelling = false;
  if (pad?.kind === "exit" && world.startTick >= 0) {
    world.done = true;
    world.endTick = world.tick;
    return world;
  }
  if (pad?.kind === "switch") {
    // Open the gate; a timed one's time starts over while the rocket sits here.
    const i = world.level.doors.findIndex((d) => d.gate === pad.opens);
    const door = world.doors[i];
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

// Shuts timed gates whose time is up, unless the rocket is in the way.
function shutGates(world) {
  const r = world.rocket;
  world.level.doors.forEach((d, i) => {
    const state = world.doors[i];
    if (state.until < 0 || world.tick < state.until) return;
    if (r.state !== "crashed" && deepestContact(world.outline, circlesAt(r.x, r.y, r.angle), [d])) return;
    Object.assign(state, { open: false, changed: world.tick, until: -1 });
  });
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

// Seconds until each timed gate shuts, for those open on a timer.
export const gateTimers = (world) =>
  world.level.doors
    .map((d, i) => ({ gate: d, seconds: (world.doors[i].until - world.tick) / TICK_RATE }))
    .filter((t, i) => world.doors[i].until >= 0);

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
