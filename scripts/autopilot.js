// Flies a level with the autopilot (src/autopilot.js), headless, for scripts/fly.js
// and test/levels.test.js.
import { parseLevel } from "../src/sim/level.js";
import { buildOutline } from "../src/sim/outline.js";
import { createWorld, step } from "../src/sim/world.js";
import { createPilot } from "../src/autopilot.js";

// Flies level `def` (a level module's export). Returns { legs, failed }: each leg
// is { name, seconds, fuel, metres, hull } (the hull left at its end), and `failed`
// says why it stopped short, if it did.
export function flyLevel(def) {
  const level = parseLevel(def);
  const world = createWorld(level, buildOutline(level));
  const pilot = createPilot(world, { restart: false });
  for (;;) {
    const input = pilot.input();
    if (world.done || pilot.failed) break;
    step(world, input);
  }
  return { legs: pilot.legs, failed: pilot.failed ?? undefined };
}
