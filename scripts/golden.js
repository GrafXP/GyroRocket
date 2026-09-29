// Records the golden replays test/replay.test.js plays back: the autopilot flying a
// level from each world, and one run with restarts in it. Run it after a change to
// the sim on purpose, once SIM_VERSION is bumped: npm run golden.
import { writeFileSync, mkdirSync } from "node:fs";
import { levelById } from "../src/levels/index.js";
import { parseLevel } from "../src/sim/level.js";
import { createWorld, advance } from "../src/sim/world.js";
import { inputCode } from "../src/sim/input.js";
import { createPilot } from "../src/autopilot.js";
import { createRecorder, makeReplay, checkReplay } from "../src/replay.js";
import { TICK_RATE } from "../src/sim/rocket.js";

export const GOLDEN = ["1-8", "2-6", "3-8", "4-8", "5-8", "6-8", "7-4"];
export const WITH_RESTARTS = "1-6";
const dir = new URL("../test/replays/", import.meta.url);

// Flies level `id` with the autopilot, recording it. `script(world, tick)` can
// give the input instead, for as long as it gives one.
async function record(id, script = () => null) {
  const def = levelById(id);
  const world = createWorld(parseLevel(def));
  const pilot = createPilot(world);
  const recorder = createRecorder();
  while (!world.done && world.tick < 600 * TICK_RATE) {
    const code = inputCode(script(world, world.tick) ?? pilot.input());
    recorder.push(code);
    advance(world, code);
  }
  if (!world.done) throw new Error(`${id}: the autopilot didn't finish`);
  world.assisted = false; // the point is the inputs, not who gave them
  const replay = { id, ...(await makeReplay(def, world, recorder.codes())) };
  const check = await checkReplay(def, replay);
  if (!check.ok) throw new Error(`${id}: ${check.why}`);
  return replay;
}

// Into the roof at full burn until it breaks up, a tap to go again, then later a
// Restart from pad from the menu once it's past the fuel pad.
function crashAndRestart() {
  let crashed = -1;
  let refuelled = -1;
  return (world, tick) => {
    if (world.restarts === 0) {
      if (world.downTick < 0) return { steer: 0.2, thrust: true };
      crashed = world.downTick;
      return { thrust: tick - crashed === 2 * TICK_RATE };
    }
    if (world.checkpoint.pad !== world.level.start && refuelled < 0) refuelled = tick;
    if (refuelled >= 0 && tick === refuelled + 3 * TICK_RATE) return { restart: true };
    return null;
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(dir, { recursive: true });
  for (const id of GOLDEN) {
    const replay = await record(id);
    writeFileSync(new URL(`${id}.json`, dir), `${JSON.stringify(replay)}\n`);
    console.log(`${id}: ${replay.ticks} ticks, ${replay.time.toFixed(2)} s`);
  }
  const replay = await record(WITH_RESTARTS, crashAndRestart());
  if (replay.restarts < 2) throw new Error(`${WITH_RESTARTS}: only ${replay.restarts} restarts`);
  writeFileSync(new URL(`${WITH_RESTARTS}-restarts.json`, dir), `${JSON.stringify(replay)}\n`);
  console.log(`${WITH_RESTARTS} with restarts: ${replay.ticks} ticks, ${replay.time.toFixed(2)} s, ${replay.restarts} restarts`);
}
