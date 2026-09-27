import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLevel, TILE, isSolid } from "../src/sim/level.js";
import { createWorld, step, restart, gateTimers } from "../src/sim/world.js";
import { TICK_RATE, CENTRE_Y } from "../src/sim/rocket.js";
import { laserPhase } from "../src/sim/hazards/laser.js";
import { canSee } from "../src/sim/hazards/turret.js";

const lvl = (map, things) => parseLevel({ name: "defences", map, things });
const run = (w, input, ticks) => {
  for (let i = 0; i < ticks; i++) step(w, input);
  return w;
};
// Keeps the rocket still at (x, y) for `ticks`, or until it's gone.
const hold = (w, x, y, ticks) => {
  for (let i = 0; i < ticks && w.rocket.state !== "crashed"; i++) {
    Object.assign(w.rocket, { x, y, vx: 0, vy: 0, angle: 0, state: "flying" });
    step(w, {});
  }
  return w;
};

// A room with a laser across it from the roof (l), a switch (1) that turns it off,
// and a turret in the right wall (t), with a pillar to hide behind.
const ROOM = `
  ##########l###############
  #........................#
  #........................#
  #...................##...t
  #...................##...#
  #...................##...#
  #.SSS...111.........##EEE#
  ##########################
`;
const room = (time = 0) =>
  lvl(ROOM, { l: { kind: "laser", facing: "down" }, 1: { kind: "switch", opens: "l", time }, t: { kind: "turret", windup: 1, reload: 2 } });

test("lasers and turrets parse; a switch can name a laser", () => {
  const l = room(4);
  const [laser] = l.lasers;
  assert.deepEqual([laser.x0, laser.y0, laser.x1, laser.y1, laser.mode], [10.5 * TILE, 7 * TILE, 10.5 * TILE, 1 * TILE, "always"]);
  assert.equal(isSolid(l, 10, 7), true);
  assert.deepEqual([laser.switch, laser.time], ["1", 4]);
  const [turret] = l.turrets;
  assert.deepEqual([turret.x, turret.y, turret.range, turret.damage], [25.5 * TILE, 4.5 * TILE, 40, 30]);
});

test("a laser beam destroys what touches it; a cycling one flickers before it comes on", () => {
  const l = room();
  const w = createWorld(l);
  w.turrets[0].ready = 1e9; // keep the turret out of it
  hold(w, l.lasers[0].x0 + 0.5, 6, 5);
  assert.equal(w.rocket.cause, "laser");
  const cycling = { ...l.lasers[0], mode: "cycle", on: 1, off: 2, warn: 0.5, offset: 0 };
  assert.deepEqual([0.5, 1.7, 2.5].map((s) => laserPhase(cycling, { open: false }, s * TICK_RATE)), ["off", "warn", "on"]);
});

test("a switch turns a laser off; a timed one comes back on, but not through the rocket", () => {
  const l = room(2);
  const w = createWorld(l);
  w.turrets[0].ready = 1e9;
  const sw = l.pads.find((p) => p.kind === "switch");
  run(w, { thrust: true }, 3);
  Object.assign(w.rocket, { x: (sw.x0 + sw.x1) / 2, y: sw.y + CENTRE_Y + 0.4, vx: 0, vy: 0, state: "flying" });
  run(w, {}, 20);
  assert.equal(w.lasers[0].open, true);
  assert.deepEqual(gateTimers(w).map((t) => [t.laser, t.seconds]), [[true, 2]]);
  // Sit in the beam's path past its time: it stays off; move away and it's back on.
  hold(w, l.lasers[0].x0, 6, 3 * TICK_RATE);
  assert.equal(w.rocket.state, "flying");
  assert.equal(w.lasers[0].open, true);
  hold(w, 30, 8, 2);
  assert.equal(w.lasers[0].open, false);
});

test("a turret that can see the rocket winds up and shoots it; rock is cover", () => {
  const l = room();
  const [turret] = l.turrets;
  const w = createWorld(l);
  // Up where it can see over the pillar: a shot arrives within a few seconds.
  hold(w, 36, 13, 5 * TICK_RATE);
  assert.ok(w.rocket.hull <= 70, `hull ${w.rocket.hull}`);
  // Low behind the pillar it can't be seen, so it isn't shot at.
  assert.equal(canSee(w.outline, turret, 30, 6), false);
  assert.equal(canSee(w.outline, turret, 36, 13), true);
  const hidden = createWorld(l);
  hold(hidden, 30, 6, 5 * TICK_RATE);
  assert.equal(hidden.rocket.hull, 100);
  assert.equal(hidden.shots.length, 0);
});

test("ducking out of sight while it winds up means no shot; a restart clears the air", () => {
  const l = room();
  const w = createWorld(l);
  hold(w, 36, 13, TICK_RATE / 2); // it sees the rocket and starts winding up…
  assert.ok(w.turrets[0].charge >= 0);
  hold(w, 30, 6, TICK_RATE); // …which hides before it fires
  assert.equal(w.shots.length, 0);
  hold(w, 36, 13, 2.6 * TICK_RATE);
  assert.ok(w.shots.length > 0 || w.rocket.hull < 100, "no shot at all");
  restart(w);
  assert.equal(w.shots.length, 0);
});
