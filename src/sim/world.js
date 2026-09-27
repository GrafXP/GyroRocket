import { buildOutline } from "./outline.js";
import { createRocket, step as stepRocket, circlesAt, TICK_RATE, CENTRE_Y, HULL, TANK } from "./rocket.js";

export const REFUEL_TIME = 1.5; // seconds on a fuel pad to fill an empty tank, or mend a wrecked hull
export const RETRY_AFTER = TICK_RATE; // ticks after a crash, getting stranded or the finish before a tap goes on
const STUCK_TICKS = TICK_RATE; // sitting still this long with an empty tank, off the floor, is stranded too
const STILL_SPEED = 0.2; // m/s
export const CRYSTAL_REACH = 1; // m from a crystal's centre to the rocket's shape that picks it up

// A level in play: the rocket in the level's cave, the checkpoint, and the level
// clock, which starts at lift-off, keeps running through restarts, and stops at
// the finish.
//
// Landing on a fuel pad fills the tank, mends the hull and saves a checkpoint: the
// pad, and the level as it is (the crystals collected; later, keys and doors).
// After a crash, or when the rocket is stranded (out of fuel away from a fuel pad),
// `restart` puts a fresh rocket on the checkpoint's pad and the level back as it
// was. Until the first fuel pad, the checkpoint is the start.
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
  world.checkpoint = { pad, got: [...world.got] };
}

function place(world) {
  const { x0, x1, y } = world.checkpoint.pad;
  world.rocket = createRocket((x0 + x1) / 2, y, world.level.fuel ?? TANK);
}

// Starts again from the checkpoint, full of fuel and mended. The clock runs on.
export function restart(world) {
  place(world);
  world.got = [...world.checkpoint.got];
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
  stepRocket(r, input, world.outline);
  if (world.startTick < 0 && r.state === "flying") world.startTick = world.tick;
  if (r.state !== "crashed") collect(world);

  const pad = padUnder(world.level, r);
  world.refuelling = false;
  if (pad?.kind === "exit" && world.startTick >= 0) {
    world.done = true;
    world.endTick = world.tick;
    return world;
  }
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

// Picks up any crystal the rocket touches.
function collect(world) {
  const { crystals } = world.level;
  for (let i = 0; i < crystals.length; i++) {
    if (world.got[i] < 0 && touches(world.rocket, crystals[i])) world.got[i] = world.tick;
  }
}

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
