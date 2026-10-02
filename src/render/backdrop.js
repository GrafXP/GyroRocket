import { parseLevel } from "../sim/level.js";
import { buildOutline } from "../sim/outline.js";
import { createWorld, advance } from "../sim/world.js";
import { inputCode } from "../sim/input.js";
import { TICK_RATE } from "../sim/rocket.js";
import { tiltAngle, screenAngle } from "../controls.js";
import { createView } from "./view.js";
import titleCave from "../levels/title.js";

const FRAME_MS = 1000 / 30; // a picture to look at, not to fly in: half the frames, and a cooler phone
const ZOOM = 0.6; // closer than in play, so the rocket's worth looking at
// Where the rocket stands on the screen, across and down: left of the menu on a
// phone held sideways, between the title and the menu on one held upright.
const WIDE = [0.35, 0.7];
const TALL = [0.5, 0.52];
const DRIFT = [1.2, 0.6]; // m the camera wanders, each way
const LEAN = 3; // m the camera moves to the side with the phone tilted all the way
const FULL_TILT = 35; // degrees
const IDLE = inputCode({});

// The cave behind the title (levels/title.js), in a world's `colors`, with the
// rocket standing on its pad: the game's own view, with a camera that drifts, and
// leans as the phone tilts (or keeps still, on a phone set to reduce motion). It
// draws 30 times a second, and not at all while the page is hidden.
export function createBackdrop(container, colors) {
  const level = parseLevel({ ...titleCave, colors });
  const outline = buildOutline(level);
  const world = createWorld(level, outline);
  const view = createView(container, level, outline);
  const at = [world.rocket.x, world.rocket.y];
  const still = !!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  let tilt = 0;
  const onOrientation = (e) => {
    if (e.beta != null && e.gamma != null) tilt = tiltAngle(e.beta, e.gamma, screenAngle());
  };
  window.addEventListener("deviceorientation", onOrientation);

  let raf = 0;
  let last = 0; // when the last frame was drawn, or 0 for none yet
  let seconds = 0;
  let lean = 0;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (last && now - last < FRAME_MS - 4) return; // a display's frames come a little early or late
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    seconds += dt;
    // The level's clock runs, for the crystals to turn and the exit's beam to glow.
    for (let n = Math.round(dt * TICK_RATE); n > 0; n--) advance(world, IDLE);
    if (!still) lean += (Math.max(-1, Math.min(1, tilt / FULL_TILT)) * LEAN - lean) * (1 - Math.exp(-4 * dt));
    const drift = still ? 0 : 1;
    const wide = container.clientWidth >= container.clientHeight;
    view.render(world, dt, {
      at: [at[0] + drift * DRIFT[0] * Math.sin(seconds * 0.21), at[1] + drift * DRIFT[1] * Math.sin(seconds * 0.33 + 1)],
      on: wide ? WIDE : TALL,
      zoom: ZOOM,
      lean,
    });
  };
  const onVisibility = () => {
    cancelAnimationFrame(raf);
    last = 0;
    if (!document.hidden) raf = requestAnimationFrame(frame);
  };
  document.addEventListener("visibilitychange", onVisibility);
  onVisibility();

  return {
    dispose() {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("deviceorientation", onOrientation);
      view.dispose();
    },
  };
}
