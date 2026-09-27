import { buildOutline } from "./outline.js";
import { createRocket, step as stepRocket, TICK_RATE, CENTRE_Y, HULL, TANK } from "./rocket.js";

export const REFUEL_TIME = 1.5; // seconds on a fuel pad to fill an empty tank, or mend a wrecked hull
export const RETRY_AFTER = TICK_RATE; // ticks after a crash, getting stranded or the finish before a tap goes on
const STUCK_TICKS = TICK_RATE; // sitting still this long with an empty tank, off the floor, is stranded too
const STILL_SPEED = 0.2; // m/s

// A level in play: the rocket in the level's cave, the checkpoint, and the level
// clock, which starts at lift-off, keeps running through restarts, and stops at
// the finish.
//
// Landing on a fuel pad fills the tank, mends the hull and makes that pad the
// checkpoint. After a crash, or when the rocket is stranded (out of fuel away from
// a fuel pad), `restart` puts a fresh rocket on the checkpoint. It's the start pad
// until the first fuel pad; later phases add the level's own state (keys, doors) to it.
export function createWorld(level, outline = buildOutline(level)) {
  const world = {
    level,
    outline,
    rocket: null,
    tick: 0,
    startTick: -1,
    endTick: -1,
    done: false, // landed on the exit pad
    checkpoint: level.start,
    restarts: 0,
    stranded: false,
    downTick: -1, // when it crashed or got stranded, until the restart
    refuelling: false, // on a fuel pad, and not full yet
    stillTicks: 0,
  };
  place(world);
  return world;
}

function place(world) {
  const { x0, x1, y } = world.checkpoint;
  world.rocket = createRocket((x0 + x1) / 2, y, world.level.fuel ?? TANK);
}

// Starts again from the checkpoint, full of fuel and mended. The clock runs on.
export function restart(world) {
  place(world);
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
  stepRocket(r, input, world.outline);
  if (world.startTick < 0 && r.state === "flying") world.startTick = world.tick;

  const pad = padUnder(world.level, r);
  world.refuelling = false;
  if (pad?.kind === "exit" && world.startTick >= 0) {
    world.done = true;
    world.endTick = world.tick;
    return world;
  }
  if (pad?.kind === "fuel") {
    world.checkpoint = pad;
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
