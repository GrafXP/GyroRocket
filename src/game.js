import { createRocket, step, TICK_RATE } from "./sim/rocket.js";
import { createView } from "./render/view.js";
import { createControls } from "./controls.js";

const TICK_MS = 1000 / TICK_RATE;
const MAX_TICKS_PER_FRAME = 10; // after a long stall, drop time instead of freezing to catch up
const RETRY_AFTER = TICK_RATE; // ticks after a crash before a press starts over

// Owns the rocket, the view and the controls, and runs the sim at a fixed tick rate
// independent of the display's frame rate. onFrame(rocket, controls) runs after
// every frame, for the HUD. After a crash, the next press starts a new flight.
export function createGame(container, { onFrame } = {}) {
  const view = createView(container);
  const controls = createControls(view.canvas);
  let rocket = createRocket();
  let wasThrust = false;

  let running = true;
  let last = performance.now();
  let acc = 0;
  let raf = 0;

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (running) {
      acc += now - last;
      let n = 0;
      while (acc >= TICK_MS && n < MAX_TICKS_PER_FRAME) {
        const input = controls.input();
        const pressed = input.thrust && !wasThrust;
        wasThrust = input.thrust;
        if (rocket.state === "crashed") {
          if (pressed && rocket.tick - rocket.crashTick >= RETRY_AFTER) rocket = createRocket({ best: rocket.best });
          else input.thrust = false;
        }
        step(rocket, input);
        acc -= TICK_MS;
        n++;
      }
      if (acc >= TICK_MS) acc = 0;
    }
    last = now;
    view.render(rocket);
    onFrame?.(rocket, controls);
  };
  raf = requestAnimationFrame(frame);

  return {
    get rocket() {
      return rocket;
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
