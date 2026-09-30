import { parseLevel, TILE } from "./sim/level.js";
import { buildOutline } from "./sim/outline.js";
import { createWorld, advance } from "./sim/world.js";
import { inputCode } from "./sim/input.js";
import { TICK_RATE } from "./sim/rocket.js";
import { createPilot } from "./autopilot.js";

// The same bounded flight in the CLI, tests and editor worker. Fuel is measured
// between refills, including stops at keys and switches that don't refill it.
// `each(world)`, if given, sees the world after every tick.
export function flyLevel(def, { maxSeconds = 1800, progress = () => {}, each = null } = {}) {
  const level = parseLevel(def);
  const world = createWorld(level, buildOutline(level));
  const pilot = createPilot(world, { restart: false });
  let longest = 0;
  let burned = 0;
  let legs = 0;
  const limit = Math.ceil(maxSeconds * TICK_RATE);
  for (;;) {
    const input = pilot.input();
    if (world.done || pilot.failed || world.tick >= limit) break;
    if (world.refuelling) burned = 0;
    const fuel = world.rocket.fuel;
    advance(world, inputCode(input));
    each?.(world);
    if (world.rocket.burning && fuel > 0) burned += Math.min(1 / TICK_RATE, fuel);
    longest = Math.max(longest, burned);
    if (pilot.legs.length !== legs || world.tick % 600 === 0) {
      legs = pilot.legs.length;
      progress({ seconds: world.tick / TICK_RATE, status: pilot.status, legs: pilot.legs });
    }
  }
  const failed = pilot.failed ?? (!world.done ? `Stopped after ${maxSeconds} seconds of simulated flight` : undefined);
  const seconds = world.tick / TICK_RATE;
  const at = {
    c: Math.max(0, Math.min(level.width - 1, Math.floor(world.rocket.x / TILE))),
    r: Math.max(0, Math.min(level.height - 1, level.height - 1 - Math.floor(world.rocket.y / TILE))),
  };
  return {
    legs: pilot.legs,
    failed,
    at,
    seconds,
    suggested: failed ? null : { fuel: Math.max(1, Math.ceil(longest * 1.4)), par: Math.max(5, Math.ceil(seconds / 5) * 5) },
  };
}
