// node scripts/levels/flight.js 8-5: flies the level like flyLevel and says what
// the hazards did on the way: every hit of 20 or more to the hull, and where; the
// turrets' shots fired; the time left on a timed gate each time the rocket
// went through it, which should leave the autopilot a few seconds to spare; and
// in a level with rising lava, how far below the rocket the lava was on each pad
// it landed on.
import { levelById } from "../../src/levels/index.js";
import { parseLevel, TILE } from "../../src/sim/level.js";
import { buildOutline } from "../../src/sim/outline.js";
import { createWorld, advance } from "../../src/sim/world.js";
import { inputCode } from "../../src/sim/input.js";
import { TICK_RATE } from "../../src/sim/rocket.js";
import { createPilot } from "../../src/autopilot.js";
import { padUnder } from "../../src/sim/world.js";
import { lavaHeight } from "../../src/sim/hazards/rise.js";

const def = levelById(process.argv[2]);
if (!def) throw new Error(`no level ${process.argv[2]}`);
const level = parseLevel(def);
const world = createWorld(level, buildOutline(level));
const pilot = createPilot(world, { restart: false });
const where = (r) => `row ${level.height - Math.floor(r.y / TILE)}, column ${Math.floor(r.x / TILE) + 1}`;
const seconds = () => `${(world.tick / TICK_RATE).toFixed(1)} s`;
const shots = new Set();
const side = level.doors.map(() => 0); // which side of each gate the rocket was last on: across it, for one wider than it's high
let hull = world.rocket.hull;
let rocket = world.rocket;
let pad = null;
for (let t = 0; t < 1800 * TICK_RATE; t++) {
  const input = pilot.input();
  if (world.done || pilot.failed) break;
  advance(world, inputCode(input));
  const r = world.rocket;
  if (r !== rocket) [rocket, hull] = [r, r.hull];
  for (const s of world.shots) shots.add(s);
  if (hull - r.hull >= 20) console.log(`${seconds()}: hit, hull ${Math.round(hull)} → ${Math.round(r.hull)}${r.cause ? `, ${r.cause}` : ""}, at ${where(r)} (${pilot.status})`);
  hull = r.hull;
  const on = padUnder(level, r);
  if (on && on !== pad && level.rise && world.rise.from >= 0) console.log(`${seconds()}: on the ${on.kind} pad at column ${on.c0 + 1}, the lava ${(r.y - lavaHeight(world)).toFixed(0)} m below`);
  pad = on;
  level.doors.forEach((d, i) => {
    if (!d.gate) return;
    const flat = d.x1 - d.x0 > d.y1 - d.y0;
    const s = flat ? (r.y < d.y0 ? -1 : r.y > d.y1 ? 1 : 0) : r.x < d.x0 ? -1 : r.x > d.x1 ? 1 : 0;
    const beside = flat ? r.x > d.x0 - 3 && r.x < d.x1 + 3 : r.y > d.y0 - 3 && r.y < d.y1 + 3;
    if (s && side[i] && s !== side[i] && beside) {
      const { until } = world.doors[i];
      console.log(`${seconds()}: through gate ${d.gate}${until >= 0 ? ` with ${((until - world.tick) / TICK_RATE).toFixed(1)} s left` : ", open for good"}`);
    }
    if (s) side[i] = s;
  });
}
console.log(`${world.done ? `finished in ${seconds()}` : (pilot.failed ?? "stopped")}; the turrets fired ${shots.size} shots`);
