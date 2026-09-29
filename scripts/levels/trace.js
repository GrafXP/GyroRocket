// node scripts/levels/trace.js 7-1 [seconds]: flies the level like flyLevel and
// prints how it ended, with the rocket's track over the last `seconds` (4 unless
// given): time, row and column, velocity, hull, fuel, burn and the autopilot's status.
import { levelById } from "../../src/levels/index.js";
import { parseLevel, TILE } from "../../src/sim/level.js";
import { buildOutline } from "../../src/sim/outline.js";
import { createWorld, advance } from "../../src/sim/world.js";
import { inputCode } from "../../src/sim/input.js";
import { createPilot } from "../../src/autopilot.js";

const def = levelById(process.argv[2]);
if (!def) throw new Error(`no level ${process.argv[2]}`);
const back = Number(process.argv[3] ?? 4);
const level = parseLevel(def);
const world = createWorld(level, buildOutline(level));
const pilot = createPilot(world, { restart: false });
const track = [];
const rc = (x, y) => `r${level.height - Math.floor(y / TILE)} c${Math.floor(x / TILE) + 1}`;
for (let t = 0; t < 1800 * 60; t++) {
  const input = pilot.input();
  if (world.done || pilot.failed) break;
  advance(world, inputCode(input));
  const r = world.rocket;
  track.push(`${(world.tick / 60).toFixed(2)} ${rc(r.x, r.y)} v ${r.vx.toFixed(1)},${r.vy.toFixed(1)} hull ${r.hull.toFixed(0)} fuel ${r.fuel.toFixed(1)} ${input.thrust ? "T" : " "} ${pilot.status}`);
}
const r = world.rocket;
console.log(world.done ? "done" : pilot.failed, "cause:", r.cause, "state:", r.state);
console.log(track.slice(-back * 60).filter((_, i) => i % 6 === 0).join("\n"));
