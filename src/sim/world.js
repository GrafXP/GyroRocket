import { buildOutline } from "./outline.js";
import { createRocket, step as stepRocket, TICK_RATE, CENTRE_Y } from "./rocket.js";

// A level in play: the rocket in the level's cave, and the level clock, which
// starts at lift-off and stops at a crash or at the finish.
export function createWorld(level, outline = buildOutline(level)) {
  const { x0, x1, y } = level.start;
  return {
    level,
    outline,
    rocket: createRocket((x0 + x1) / 2, y),
    tick: 0,
    startTick: -1,
    endTick: -1,
    done: false, // landed on the exit pad
  };
}

export function step(world, input) {
  world.tick++;
  const r = world.rocket;
  if (world.done) {
    r.burning = false;
    return world;
  }
  stepRocket(r, input, world.outline);
  if (world.startTick < 0 && r.state === "flying") world.startTick = world.tick;
  if (r.state === "crashed" && world.endTick < 0) world.endTick = world.tick;
  if (r.state === "landed" && world.startTick >= 0 && onPad(world.level.exit, r)) {
    world.done = true;
    world.endTick = world.tick;
  }
  return world;
}

// Seconds on the level clock.
export function clock(world) {
  if (world.startTick < 0) return 0;
  return ((world.endTick < 0 ? world.tick : world.endTick) - world.startTick) / TICK_RATE;
}

const onPad = (pad, r) => r.x >= pad.x0 && r.x <= pad.x1 && Math.abs(r.y - CENTRE_Y - pad.y) < 0.01;
