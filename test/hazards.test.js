import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLevel, isSolid, TILE, FLAME } from "../src/sim/level.js";
import { createWorld, step } from "../src/sim/world.js";
import { TICK_RATE, CENTRE_Y, HULL } from "../src/sim/rocket.js";
import { flamePhase, FLAME_DAMAGE } from "../src/sim/hazards/flame.js";
import { blobAt, flightTime } from "../src/sim/hazards/blob.js";

const run = (w, input, ticks) => {
  for (let i = 0; i < ticks; i++) step(w, input);
  return w;
};

// A room with a flamethrower in the roof pointing down (its flame clipped by the
// floor), one in the left wall with its own settings, and a lava pool with a blob.
const MAP = `
  ##########v#########################
  #..................................#
  #..................................#
  #..................................#
  1..................................#
  #..................................#
  #.SSS...............~~2~~.....EEE..#
  ####################################
`;
const THINGS = {
  1: { kind: "flame", facing: "right", length: 8, on: 1, off: 3, warn: 0.5, offset: 1 },
  2: { kind: "blob", height: 4, period: 4 },
};
const room = () => parseLevel({ name: "hazards", map: MAP, things: THINGS });

// A world with the rocket flying still at (x, y).
const at = (level, x, y) => {
  const w = run(createWorld(level), { thrust: true }, 5);
  Object.assign(w.rocket, { x, y, vx: 0, vy: 0, angle: 0, state: "flying" });
  return w;
};

test("flamethrowers and lava parse; nozzles and lava are rock", () => {
  const l = room();
  const [down, side] = l.flames;
  assert.equal(isSolid(l, 10, 7), true);
  // The roof one: the defaults, so 5 tiles down from the nozzle's face.
  assert.deepEqual(
    [down.facing, down.mode, down.on, down.x0, down.y0, down.x1, down.y1],
    ["down", "cycle", FLAME.on, 10.5 * TILE, 7 * TILE, 10.5 * TILE, 2 * TILE],
  );
  // Longer, it stops at the floor.
  const clipped = parseLevel({ name: "x", map: MAP.replace("#v#", "#9#"), things: { ...THINGS, 9: { kind: "flame", facing: "down", length: 20 } } });
  assert.equal(clipped.flames[0].y1, 1 * TILE);
  // The wall one: its own settings, and 8 tiles long.
  assert.deepEqual([side.facing, side.on, side.off, side.offset, side.x0, side.x1], ["right", 1, 3, 1, TILE, 9 * TILE]);
  assert.equal(l.lava[1 * l.width + 20], 1);
  assert.equal(isSolid(l, 20, 1), true);
  assert.deepEqual([l.blobs[0].x, l.blobs[0].y, l.blobs[0].height], [22.5 * TILE, 2 * TILE, 4]);
  const bad = (map, things, message) => assert.throws(() => parseLevel({ name: "x", map, things }), message);
  const room3 = (row) => `#...............#\n#...............#\n${row}\n#################`;
  bad(room3("#.SSS.EEE..>#...#"), {}, /points into rock/);
  bad(room3("#.SSS.EEE.....1.#"), { 1: { kind: "flame", facing: "sideways" } }, /faces left, right, up or down/);
});

test("a cycling flame is off, flickers, fires, and keeps time with its offset", () => {
  const [down, side] = room().flames;
  const phase = (f, s) => flamePhase(f, { fired: -1 }, Math.round(s * TICK_RATE));
  // Default: off 2 s (the last 0.5 flickering), on 1.5 s.
  assert.deepEqual([0, 1.4, 1.6, 2.1, 3.4, 3.6].map((s) => phase(down, s)), ["off", "off", "warn", "on", "on", "off"]);
  // Offset 1 s: everything a second later.
  assert.deepEqual([1, 3.6, 4.1, 5.1].map((s) => phase(side, s)), ["off", "warn", "on", "off"]);
});

test("a flame burns the hull fast: a quick pass hurts, staying in it kills", () => {
  const l = room();
  const [down] = l.flames;
  // At 2.1 s the roof flame is on; hold the rocket in it for a fifth of a second.
  const w = at(l, 40, 7);
  const hold = (x, ticks) => {
    for (let i = 0; i < ticks; i++) {
      Object.assign(w.rocket, { x, y: 7, vx: 0, vy: 0 });
      step(w, {});
    }
  };
  w.rocket.hull = HULL; // the wall flame is over the start pad
  hold(40, Math.round(2.1 * TICK_RATE) - w.tick);
  assert.equal(w.rocket.hull, HULL);
  const inFlame = (ticks) => hold(down.x0, ticks);
  inFlame(TICK_RATE / 5);
  assert.ok(Math.abs(w.rocket.hull - (HULL - FLAME_DAMAGE / 5)) < 1e-6, `${w.rocket.hull}`);
  inFlame(TICK_RATE);
  assert.equal(w.rocket.state, "crashed");
  assert.equal(w.rocket.cause, "flame");
});

test('a "near" flame fires as the rocket comes close, then rests', () => {
  const l = parseLevel({ name: "near", map: MAP, things: { ...THINGS, 1: { kind: "flame", facing: "right", mode: "near", on: 1, off: 2 } } });
  const side = l.flames.find((f) => f.mode === "near");
  const w = at(l, 40, 12);
  w.flames[1].fired = -1; // the start pad is within its reach
  run(w, {}, 5);
  assert.equal(flamePhase(side, w.flames[1], w.tick), "off", "fired with the rocket far away");
  Object.assign(w.rocket, { x: side.x1 + 1, y: side.y0 + 3, vx: 0, vy: 0 }); // 3.2 m from its tip
  w.cheats.god = true;
  step(w, {});
  const fired = w.flames[1].fired;
  assert.equal(fired, w.tick);
  const phaseAt = (s) => flamePhase(side, w.flames[1], fired + Math.round(s * TICK_RATE));
  assert.deepEqual([0.2, 0.6, 1.6, 3.4].map(phaseAt), ["warn", "on", "off", "off"]);
});

test("touching lava destroys the rocket, even landing gently; the god cheat doesn't", () => {
  const l = room();
  const w = at(l, 21 * TILE, 2 * TILE + CENTRE_Y + 0.5);
  run(w, {}, TICK_RATE);
  assert.equal(w.rocket.state, "crashed");
  assert.equal(w.rocket.cause, "lava");
  const god = at(l, 21 * TILE, 2 * TILE + CENTRE_Y + 0.5);
  god.cheats.god = true;
  run(god, {}, TICK_RATE / 2);
  assert.notEqual(god.rocket.state, "crashed");
});

test("a blob goes up and comes down on its period, and destroys what it hits", () => {
  const [blob] = room().blobs;
  const up = flightTime(blob);
  const top = blobAt(blob, Math.round((up / 2) * TICK_RATE));
  assert.ok(top.up && Math.abs(top.y - (blob.y + blob.height * TILE)) < 0.1, `${top.y}`);
  assert.equal(blobAt(blob, Math.round((up + 0.1) * TICK_RATE)).up, false);
  assert.equal(blobAt(blob, Math.round((blob.period - 0.3) * TICK_RATE)).warn, true);
  // A rocket hovering over the pool gets hit on the next throw.
  const l = room();
  const w = at(l, blob.x, blob.y + 7);
  for (let i = 0; i < blob.period * TICK_RATE && w.rocket.state !== "crashed"; i++) {
    Object.assign(w.rocket, { x: blob.x, y: blob.y + 7, vx: 0, vy: 0 });
    step(w, {});
  }
  assert.equal(w.rocket.cause, "lava");
});
