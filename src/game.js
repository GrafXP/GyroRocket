import { createWorld, step, restart, RETRY_AFTER } from "./sim/world.js";
import { buildOutline } from "./sim/outline.js";
import { TICK_RATE } from "./sim/rocket.js";
import { createView } from "./render/view.js";
import { createControls } from "./controls.js";
import { createPilot } from "./autopilot.js";

const TICK_MS = 1000 / TICK_RATE;
const MAX_TICKS_PER_FRAME = 10; // after a long stall, drop time instead of freezing to catch up

// Plays a parsed level: owns the world, the view and the controls, and runs the
// sim at a fixed tick rate whatever the display's frame rate. onFrame(world,
// controls) runs after every frame, for the HUD. After a crash or getting stranded,
// the next press restarts from the checkpoint. After the finish, the rocket sits on
// the exit until the page moves on (restartLevel, or another page). With the
// autopilot on (setAutopilot), it flies instead of the controls, and the run is
// marked assisted. `stats` times the frames, for the frame rate display.
export function createGame(container, { level, onFrame, fullTilt } = {}) {
  const outline = buildOutline(level);
  const view = createView(container, level, outline);
  const controls = createControls(view.canvas, { fullTilt });
  const cheats = { god: false, fuel: false }; // the dev overlay's, kept across restarts
  const fresh = () => Object.assign(createWorld(level, outline), { cheats });
  let world = fresh();
  let pilot = null;
  let wasThrust = false;

  let running = true;
  let last = performance.now();
  let acc = 0;
  let raf = 0;
  const meter = createMeter();

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const began = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    if (running) {
      acc += now - last;
      let n = 0;
      while (acc >= TICK_MS && n < MAX_TICKS_PER_FRAME) {
        const flying = pilot && !pilot.failed;
        const input = flying ? pilot.input() : controls.input();
        const pressed = input.thrust && !wasThrust;
        wasThrust = input.thrust;
        if (world.downTick >= 0 || world.done) {
          if (world.downTick >= 0 && pressed && world.tick - world.downTick >= RETRY_AFTER) restart(world);
          input.thrust = false;
        }
        step(world, input);
        acc -= TICK_MS;
        n++;
      }
      if (acc >= TICK_MS) acc = 0;
    }
    last = now;
    view.render(world, running ? dt : 0);
    onFrame?.(world, controls);
    meter.frame(now, performance.now() - began, view.info);
  };
  raf = requestAnimationFrame(frame);

  return {
    get world() {
      return world;
    },
    get running() {
      return running;
    },
    pause() {
      running = false;
    },
    resume() {
      running = true;
    },
    cheats,
    stats: meter.stats,
    // Back to the last fuel pad, with the clock running on.
    restartFromPad() {
      if (!world.done) restart(world);
    },
    // The level from the top, clock and all.
    restartLevel() {
      world = fresh();
      if (pilot) this.setAutopilot(true);
    },
    // The autopilot, while it's flying (it gives up if it gets lost), or null.
    get pilot() {
      return pilot && !pilot.failed ? pilot : null;
    },
    // The last autopilot, flying or not: its `failed` says if it got lost.
    get lastPilot() {
      return pilot;
    },
    setAutopilot(on) {
      pilot = on ? createPilot(world) : null;
      if (on) world.assisted = true;
    },
    setFullTilt: controls.setFullTilt,
    screenToWorld: view.screenToWorld,
    dispose() {
      cancelAnimationFrame(raf);
      controls.dispose();
      view.dispose();
    },
  };
}

// Frame timings over the last second: frames a second, the longest gap between
// two frames, and the time the code took per frame on average (the sim, the HUD
// and handing the scene to WebGL; the GPU's drawing isn't in it, so a low frame
// rate with little code time means the GPU is the slow part). `calls` and
// `triangles` are the last frame's draw calls and triangles.
function createMeter() {
  const stats = { fps: 0, slowest: 0, work: 0, calls: 0, triangles: 0 };
  let since = 0; // when this second's frames started
  let prev = 0;
  let frames = 0;
  let slowest = 0;
  let work = 0;
  return {
    stats,
    frame(now, took, info) {
      // A long gap (the page was hidden) starts the count again.
      if (!since || now - prev > 1000) {
        [since, prev, frames, slowest, work] = [now, now, 0, 0, 0];
        return;
      }
      slowest = Math.max(slowest, now - prev);
      prev = now;
      frames++;
      work += took;
      if (now - since < 1000) return;
      Object.assign(stats, {
        fps: (frames * 1000) / (now - since),
        slowest,
        work: work / frames,
        calls: info.calls,
        triangles: info.triangles,
      });
      [since, frames, slowest, work] = [now, 0, 0, 0];
    },
  };
}
