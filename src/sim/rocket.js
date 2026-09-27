import { deepestContact } from "./collide.js";
import { floorAt } from "./outline.js";

// The rocket's flight, stepped at a fixed TICK_RATE against a level's rock outline
// (outline.js). Pure state, no DOM or three.js, so the tests run it in node. Units
// are metres, seconds and radians. (x, y) is the rocket's centre of mass, which it
// turns about; `angle` is the lean from upright, positive to the right (clockwise,
// as seen on screen).

export const TICK_RATE = 60;
const DT = 1 / TICK_RATE;

export const GRAVITY = 9.8; // m/s²
export const THRUST = 20; // m/s² at full burn: at full lean, just about a hover
export const DRAG = 0.4; // per second, which caps a fall at about 25 m/s
export const MAX_LEAN = Math.PI / 3; // how far the rocket leans at full steer
export const TURN_RATE = 3.5; // how fast the lean follows the steer, rad/s
export const SAFE_SPEED = 5; // m/s: a landing has to be slower than this…
export const SAFE_LEAN = 0.35; // rad: …and more upright than this
export const HULL = 100;
export const SCRAPE_SPEED = 1.5; // m/s into rock that does no damage
export const DAMAGE = 7; // hull lost per m/s into rock over SCRAPE_SPEED
export const CRASH_SPEED = 13; // m/s into rock that destroys the rocket outright
const BOUNCE = 0.3; // how much of the speed into rock comes back out
const FRICTION = 0.4; // along the rock, against the push into it
const MAX_MOVE = 0.15; // m per substep: less than the smallest circle's radius
const MAX_SUBSTEPS = 12;

// The rocket's shape, as circles [x, y, radius] with the rocket upright and its
// feet on y = 0: two feet, the fins that end in them, the engine, the body and the
// nose. The centre of mass is CENTRE_Y above the feet.
export const CENTRE_Y = 2.2;
export const FOOT_X = 1.5;
export const SHAPE = [
  [-FOOT_X, 0.2, 0.2, true],
  [FOOT_X, 0.2, 0.2, true],
  [-1.05, 0.85, 0.32],
  [1.05, 0.85, 0.32],
  [-0.8, 1.55, 0.25],
  [0.8, 1.55, 0.25],
  [0, 0.95, 0.5],
  [0, 1.75, 0.62],
  [0, 2.55, 0.62],
  [0, 3.35, 0.62],
  [0, 4.1, 0.6],
  [0, 4.8, 0.4],
].map(([x, y, r, foot = false]) => ({ x, y: y - CENTRE_Y, r, foot }));

// A rocket standing on the floor at height `floorY`, centred on x.
// "landed": standing on flat floor; "flying"; "crashed": nothing moves until reset.
export function createRocket(x, floorY) {
  return {
    x,
    y: floorY + CENTRE_Y,
    vx: 0,
    vy: 0,
    angle: 0,
    state: "landed",
    burning: false,
    hull: HULL,
    tick: 0,
    hitTick: -1, // when it last hit rock, and how much hull that cost
    hitDamage: 0,
    crashTick: -1,
  };
}

const scratch = SHAPE.map((s) => ({ ...s }));

// The rocket's circles at (x, y) leaning `angle`, in world coordinates. Reuses one
// array unless given `out`.
export function circlesAt(x, y, angle, out = scratch) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  SHAPE.forEach((s, i) => {
    out[i].x = x + s.x * cos + s.y * sin;
    out[i].y = y - s.x * sin + s.y * cos;
  });
  return out;
}

// Advances one tick. `steer` is -1 (full left) to 1 (full right) and sets the lean
// the rocket turns towards; `thrust` burns the engine along the rocket's axis.
export function step(r, { steer = 0, thrust = false } = {}, outline) {
  r.tick++;
  r.burning = thrust && r.state !== "crashed";
  if (r.state === "crashed") return r;
  if (r.state === "landed") {
    if (!r.burning) return r;
    r.state = "flying"; // the thrust beats gravity, so any burn lifts off
  } else {
    const target = Math.max(-1, Math.min(1, steer)) * MAX_LEAN;
    const turn = TURN_RATE * DT;
    r.angle += Math.max(-turn, Math.min(turn, target - r.angle));
  }

  const push = r.burning ? THRUST : 0;
  const ax = Math.sin(r.angle) * push;
  const ay = Math.cos(r.angle) * push - GRAVITY;
  // Small enough steps that nothing moves further than its radius into rock.
  const n = Math.min(MAX_SUBSTEPS, Math.ceil((Math.hypot(r.vx, r.vy) * DT) / MAX_MOVE) || 1);
  const dt = DT / n;
  let impact = 0;
  for (let i = 0; i < n && r.state === "flying"; i++) {
    r.vx += (ax - r.vx * DRAG) * dt;
    r.vy += (ay - r.vy * DRAG) * dt;
    r.x += r.vx * dt;
    r.y += r.vy * dt;
    impact = Math.max(impact, collide(r, outline));
  }
  if (impact > SCRAPE_SPEED) hit(r, impact);
  return r;
}

// Pushes the rocket out of rock and bounces it off, or lands it. Returns the
// fastest speed it hit rock at.
function collide(r, outline) {
  let impact = 0;
  for (let k = 0; k < 4; k++) {
    const c = deepestContact(outline, circlesAt(r.x, r.y, r.angle));
    if (!c) break;
    r.x += c.nx * c.depth;
    r.y += c.ny * c.depth;
    const vn = r.vx * c.nx + r.vy * c.ny; // negative: moving into the rock
    if (c.foot && c.ny > 0.99 && vn <= 0 && tryLand(r, outline, c.py)) return impact;
    if (vn >= 0) continue;
    impact = Math.max(impact, -vn);
    const [tx, ty] = [-c.ny, c.nx];
    const vt = r.vx * tx + r.vy * ty;
    const along = Math.sign(vt) * Math.max(0, Math.abs(vt) + FRICTION * (1 + BOUNCE) * vn);
    const out = -vn > 0.5 ? -BOUNCE * vn : 0; // don't jiggle while resting on rock
    r.vx = c.nx * out + tx * along;
    r.vy = c.ny * out + ty * along;
  }
  return impact;
}

function tryLand(r, outline, floorY) {
  if (Math.hypot(r.vx, r.vy) > SAFE_SPEED || Math.abs(r.angle) > SAFE_LEAN) return false;
  if (!canStand(outline, r.x, floorY)) return false;
  Object.assign(r, { state: "landed", angle: 0, vx: 0, vy: 0, y: floorY + CENTRE_Y });
  return true;
}

// Whether the rocket could stand upright at x on the floor at height floorY: flat
// floor under both feet, and room for the rest of it.
export function canStand(outline, x, floorY) {
  if (!floorAt(outline, x - FOOT_X, floorY) || !floorAt(outline, x + FOOT_X, floorY)) return false;
  const c = deepestContact(outline, circlesAt(x, floorY + CENTRE_Y + 0.01, 0));
  return !c || c.depth < 0.02;
}

function hit(r, impact) {
  const damage = impact >= CRASH_SPEED ? r.hull : (impact - SCRAPE_SPEED) * DAMAGE;
  r.hull = Math.max(0, r.hull - damage);
  r.hitTick = r.tick;
  r.hitDamage = damage;
  if (r.hull === 0) Object.assign(r, { state: "crashed", crashTick: r.tick, vx: 0, vy: 0, burning: false });
}
