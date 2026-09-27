import { deepestContact } from "./collide.js";
import { floorAt } from "./outline.js";
import { lavaAt } from "./level.js";

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
export const TANK = 15; // seconds of full burn in a full tank, unless the level says
export const SCRAPE_SPEED = 1.5; // m/s into rock that does no damage
export const DAMAGE = 7; // hull lost per m/s into rock over SCRAPE_SPEED
export const CRASH_SPEED = 13; // m/s into rock that destroys the rocket outright
const BOUNCE = 0.3; // how much of the speed into rock comes back out
const FRICTION = 0.4; // along the rock, against the push into it
const MAX_MOVE = 0.15; // m per substep: less than the smallest circle's radius
const MAX_SUBSTEPS = 12;
const CRUSH_DEPTH = 0.3; // m still in rock after pushing out: squeezed, crushed
const NONE = [];
const NO_FIELD = { ax: 0, ay: 0 };

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

// A rocket standing on the floor at height `floorY`, centred on x, with a full
// tank of `tank` seconds' burn.
// "landed": standing on flat floor; "flying"; "crashed": nothing moves until reset.
export function createRocket(x, floorY, tank = TANK) {
  return {
    x,
    y: floorY + CENTRE_Y,
    vx: 0,
    vy: 0,
    angle: 0,
    state: "landed",
    burning: false,
    sputtering: false, // trying to burn with an empty tank
    tank,
    fuel: tank,
    hull: HULL,
    tick: 0,
    hitTick: -1, // when it last hit rock, and how much hull that cost
    hitDamage: 0,
    crashTick: -1,
    cause: null, // what destroyed it: "impact", "lava", "flame" or "crush"
    god: false, // a dev cheat: hits cost nothing
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
// the rocket turns towards, or null to hold the lean it has, and `turnRate` how
// fast it turns (rad/s); `thrust` burns the engine along the rocket's axis, while
// there's fuel. It flies in `outline`'s rock, and `env` has the rest: `boxes`, the
// rectangles that block it (shut doors and gates, and moving blocks with their
// velocity), as a list or as a function of how far through the tick it is (0 to 1);
// `boxSpeed`, the fastest any of them moves (m/s); and `field`, the push of fans
// and magnets, { ax, ay } in m/s².
export function step(r, { steer = 0, turnRate = TURN_RATE, thrust = false } = {}, outline, env = {}) {
  const { field = NO_FIELD, boxSpeed = 0 } = env;
  const boxesAt = typeof env.boxes === "function" ? env.boxes : () => env.boxes ?? NONE;
  r.tick++;
  const wants = thrust && r.state !== "crashed";
  r.burning = wants && r.fuel > 0;
  r.sputtering = wants && !r.burning;
  if (r.state === "crashed") return r;
  if (r.burning) r.fuel = Math.max(0, r.fuel - DT);
  if (r.state === "landed") {
    // It stays put while its floor's still under it and nothing's in the way (a
    // moving block can take the floor away, or run into it), until it burns: the
    // thrust beats gravity, so any burn lifts off.
    if (canStand(outline, r.x, r.y - CENTRE_Y, boxesAt(1)) && !r.burning) return r;
    r.state = "flying";
  } else if (steer != null) {
    const target = Math.max(-1, Math.min(1, steer)) * MAX_LEAN;
    const turn = turnRate * DT;
    r.angle += Math.max(-turn, Math.min(turn, target - r.angle));
  }

  const push = r.burning ? THRUST : 0;
  const ax = Math.sin(r.angle) * push + field.ax;
  const ay = Math.cos(r.angle) * push - GRAVITY + field.ay;
  // Small enough steps that nothing moves further than its radius into rock, and
  // no block moves further than that into the rocket.
  const n = Math.min(MAX_SUBSTEPS, Math.ceil((Math.max(Math.hypot(r.vx, r.vy), boxSpeed) * DT) / MAX_MOVE) || 1);
  const dt = DT / n;
  const worst = { impact: 0, box: null };
  for (let i = 0; i < n && r.state === "flying"; i++) {
    const boxes = boxesAt((i + 1) / n);
    r.vx += (ax - r.vx * DRAG) * dt;
    r.vy += (ay - r.vy * DRAG) * dt;
    r.x += r.vx * dt;
    r.y += r.vy * dt;
    collide(r, outline, boxes, worst);
    if (r.state !== "flying") break;
    // Still deep in something after pushing out: squeezed between a block and rock.
    const c = deepestContact(outline, circlesAt(r.x, r.y, r.angle), boxes);
    if (c && c.depth > CRUSH_DEPTH && !r.god) crash(r, "crush");
  }
  if (worst.impact > SCRAPE_SPEED) hit(r, worst.impact, worst.box?.mover ? "crush" : "impact");
  return r;
}

// Pushes the rocket out of rock and boxes and bounces it off, going by its speed
// relative to what it hit (a moving block carries it along), or lands it. Keeps
// the hardest hit in `worst`: { impact (m/s), box }.
function collide(r, outline, boxes, worst) {
  for (let k = 0; k < 4; k++) {
    const c = deepestContact(outline, circlesAt(r.x, r.y, r.angle), boxes);
    if (!c) break;
    r.x += c.nx * c.depth;
    r.y += c.ny * c.depth;
    if (!r.god && !c.box && lavaAt(outline.level, c.px - c.nx * 0.1, c.py - c.ny * 0.1)) {
      crash(r, "lava");
      return;
    }
    const [bx, by] = [c.box?.vx ?? 0, c.box?.vy ?? 0];
    const [rx, ry] = [r.vx - bx, r.vy - by];
    const vn = rx * c.nx + ry * c.ny; // negative: moving into it
    if (c.foot && c.ny > 0.99 && vn <= 0 && tryLand(r, outline, boxes, c.py, rx, ry)) return;
    if (vn >= 0) continue;
    if (-vn > worst.impact) Object.assign(worst, { impact: -vn, box: c.box });
    const [tx, ty] = [-c.ny, c.nx];
    const vt = rx * tx + ry * ty;
    const along = Math.sign(vt) * Math.max(0, Math.abs(vt) + FRICTION * (1 + BOUNCE) * vn);
    const out = -vn > 0.5 ? -BOUNCE * vn : 0; // don't jiggle while resting on rock
    r.vx = bx + c.nx * out + tx * along;
    r.vy = by + c.ny * out + ty * along;
  }
}

// Lands the rocket if it's slow enough (relative to what it's landing on) and
// upright enough, and there's room to stand.
function tryLand(r, outline, boxes, floorY, rx, ry) {
  if (Math.hypot(rx, ry) > SAFE_SPEED || Math.abs(r.angle) > SAFE_LEAN) return false;
  if (!canStand(outline, r.x, floorY, boxes)) return false;
  Object.assign(r, { state: "landed", angle: 0, vx: 0, vy: 0, y: floorY + CENTRE_Y });
  return true;
}

// Whether the rocket could stand upright at x on the floor at height floorY: flat
// floor under both feet, and room for the rest of it.
export function canStand(outline, x, floorY, boxes = []) {
  if (!floorAt(outline, x - FOOT_X, floorY, 0.05, boxes) || !floorAt(outline, x + FOOT_X, floorY, 0.05, boxes)) return false;
  const c = deepestContact(outline, circlesAt(x, floorY + CENTRE_Y + 0.01, 0), boxes);
  return !c || c.depth < 0.02;
}

function hit(r, impact, cause) {
  hurt(r, impact >= CRASH_SPEED ? r.hull : (impact - SCRAPE_SPEED) * DAMAGE, cause);
}

// Takes `damage` off the hull (none with the god cheat); at none left, the rocket
// is destroyed by `cause`.
export function hurt(r, damage, cause) {
  if (r.state === "crashed") return;
  if (r.god) damage = 0;
  r.hull = Math.max(0, r.hull - damage);
  r.hitTick = r.tick;
  r.hitDamage = damage;
  if (r.hull === 0) crash(r, cause);
}

function crash(r, cause) {
  Object.assign(r, { state: "crashed", crashTick: r.tick, cause, vx: 0, vy: 0, burning: false, sputtering: false });
}
