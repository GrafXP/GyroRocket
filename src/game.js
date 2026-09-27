import { createWorld, step, restart, RETRY_AFTER } from "./sim/world.js";
import { buildOutline } from "./sim/outline.js";
import { TICK_RATE } from "./sim/rocket.js";
import { createView } from "./render/view.js";
import { createControls } from "./controls.js";

const TICK_MS = 1000 / TICK_RATE;
const MAX_TICKS_PER_FRAME = 10; // after a long stall, drop time instead of freezing to catch up

// Plays a parsed level: owns the world, the view and the controls, and runs the
// sim at a fixed tick rate whatever the display's frame rate. onFrame(world,
// controls) runs after every frame, for the HUD. After a crash or getting stranded,
// the next press restarts from the checkpoint; after the finish, it plays the level
// again from the top.
export function createGame(container, { level, onFrame } = {}) {
  const outline = buildOutline(level);
  const view = createView(container, level, outline);
  const controls = createControls(view.canvas);
  let world = createWorld(level, outline);
  let wasThrust = false;

  let running = true;
  let last = performance.now();
  let acc = 0;
  let raf = 0;

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    if (running) {
      acc += now - last;
      let n = 0;
      while (acc >= TICK_MS && n < MAX_TICKS_PER_FRAME) {
        const input = controls.input();
        const pressed = input.thrust && !wasThrust;
        wasThrust = input.thrust;
        if (world.done || world.downTick >= 0) {
          if (pressed && world.tick - (world.done ? world.endTick : world.downTick) >= RETRY_AFTER) {
            if (world.done) world = createWorld(level, outline);
            else restart(world);
          }
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
    dispose() {
      cancelAnimationFrame(raf);
      controls.dispose();
      view.dispose();
    },
  };
}
