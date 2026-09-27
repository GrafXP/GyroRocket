// The rocket's flight, stepped at a fixed TICK_RATE. Pure state, no DOM or three.js,
// so the tests run it in node. Units are metres, seconds and radians; x is sideways,
// y is height above the flat ground at y = 0. `angle` is the lean from upright,
// positive to the right (clockwise, as seen on screen).

export const TICK_RATE = 60;
const DT = 1 / TICK_RATE;

export const GRAVITY = 9.8; // m/s²
export const THRUST = 20; // m/s² at full burn, about twice gravity
export const DRAG = 0.05; // per second, so the rocket doesn't drift forever
export const MAX_LEAN = Math.PI / 3; // how far the rocket leans at full steer
export const TURN_RATE = 3; // how fast the lean follows the steer, rad/s
export const SAFE_SPEED = 5; // m/s: touching down faster than this is a crash
export const SAFE_LEAN = 0.35; // rad: touching down leaning further than this is a crash

// "landed": standing on the ground; "flying"; "crashed": nothing moves until reset.
export function createRocket({ best = 0 } = {}) {
  return { x: 0, y: 0, vx: 0, vy: 0, angle: 0, state: "landed", burning: false, tick: 0, crashTick: 0, best };
}

// Advances one tick. `steer` is -1 (full left) to 1 (full right) and sets the lean
// the rocket turns towards; `thrust` burns the engine along the rocket's axis.
export function step(r, { steer = 0, thrust = false } = {}) {
  r.tick++;
  r.burning = thrust && r.state !== "crashed";
  if (r.state === "crashed") return r;

  if (r.state === "flying") {
    const target = Math.max(-1, Math.min(1, steer)) * MAX_LEAN;
    const turn = TURN_RATE * DT;
    r.angle += Math.max(-turn, Math.min(turn, target - r.angle));
  }

  const push = r.burning ? THRUST : 0;
  r.vx += (Math.sin(r.angle) * push - r.vx * DRAG) * DT;
  r.vy += (Math.cos(r.angle) * push - GRAVITY - r.vy * DRAG) * DT;

  if (r.state === "landed" && r.vy <= 0) {
    // Resting on the ground: the thrust isn't enough to lift off.
    r.vx = r.vy = 0;
    return r;
  }
  r.state = "flying";
  r.x += r.vx * DT;
  r.y += r.vy * DT;
  r.best = Math.max(r.best, r.y);

  if (r.y <= 0) touchDown(r);
  return r;
}

function touchDown(r) {
  const speed = Math.hypot(r.vx, r.vy);
  r.y = 0;
  if (speed <= SAFE_SPEED && Math.abs(r.angle) <= SAFE_LEAN) {
    r.state = "landed";
    r.angle = 0;
  } else {
    r.state = "crashed";
    r.crashTick = r.tick;
  }
  r.vx = r.vy = 0;
}
