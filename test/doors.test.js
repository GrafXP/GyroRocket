import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLevel, TILE } from "../src/sim/level.js";
import { createWorld, step, restart, shut, gateTimers, OPEN_REACH } from "../src/sim/world.js";
import { TICK_RATE, CENTRE_Y } from "../src/sim/rocket.js";

const run = (w, input, ticks) => {
  for (let i = 0; i < ticks; i++) step(w, input);
  return w;
};

// A room with a red key, a red door floor to ceiling, a switch (1) that opens a
// gate (2) for `time` seconds, and a fuel pad.
const MAP = `
  ##########################################
  #.......................2................#
  #.......................2................#
  #.......r..........R....2................#
  #..................R....2................#
  #..................R....2................#
  #..................R....2................#
  #.SSS.....111..FFF.R....2...........EEE..#
  ##########################################
`;
const room = (time = 0) => parseLevel({ name: "doors", map: MAP, things: { 1: { kind: "switch", opens: 2, time }, 2: { kind: "gate" } } });

// A flying world with the rocket at (x, y), still.
const flyingAt = (level, x, y) => {
  const w = run(createWorld(level), { thrust: true }, 5);
  Object.assign(w.rocket, { x, y, vx: 0, vy: 0, angle: 0 });
  return w;
};

test("keys, doors, switches and gates parse", () => {
  const l = room(8);
  assert.deepEqual(l.keys, [{ color: "red", x: 8.5 * TILE, y: 5.5 * TILE }]);
  const [door, gate] = l.doors;
  assert.deepEqual(
    { key: door.key, gate: door.gate, x0: door.x0, y0: door.y0, x1: door.x1, y1: door.y1 },
    { key: "red", gate: null, x0: 19 * TILE, y0: TILE, x1: 20 * TILE, y1: 6 * TILE },
  );
  assert.deepEqual({ key: gate.key, gate: gate.gate, switch: gate.switch, time: gate.time }, { key: null, gate: "2", switch: "1", time: 8 });
  const sw = l.pads.find((p) => p.kind === "switch");
  assert.deepEqual({ label: sw.label, opens: sw.opens, time: sw.time, c0: sw.c0 }, { label: "1", opens: "2", time: 8, c0: 10 });
  // Door and gate tiles are air to the rock.
  assert.equal(l.solid[1 * l.width + 19], 0);
});

test("bad keys, doors and things are refused", () => {
  const bad = (map, things, message) => assert.throws(() => parseLevel({ name: "x", map, things }), message);
  const pads = "#...............#\n#...............#\n#.SSS.EEE.......#\n#################";
  bad(`#..R......r.....#\n#..RR............#\n${pads}`, {}, /must be a rectangle/);
  bad(`#..Y.............#\n${pads}`, {}, /no yellow key for this door/);
  bad(`#..r.....r......#\n${pads}`, {}, /a second red key/);
  bad(`#..5............#\n${pads}`, {}, /"5" isn't set up in things/);
  bad(`#...............#\n#...............#\n#.SSS.EEE.111...#\n#################`, { 1: { kind: "switch", opens: 2 } }, /opens "2", which isn't a gate/);
  bad(`#..2............#\n${pads}`, { 2: { kind: "gate" } }, /no switch opens gate 2/);
});

test("a shut door blocks the rocket; its key opens it from nearby, for good", () => {
  const l = room();
  const [door] = l.doors;
  // No key: flying into the door bounces off it.
  const w = flyingAt(l, door.x0 - 4, 7);
  Object.assign(w.rocket, { vx: 6 });
  run(w, {}, TICK_RATE);
  assert.ok(w.rocket.x < door.x0, "went through the door");
  assert.equal(shut(w).length, 2);
  // With the key, coming near opens it.
  const k = flyingAt(l, l.keys[0].x, l.keys[0].y - 1);
  step(k, {});
  assert.deepEqual(k.keys, ["red"]);
  Object.assign(k.rocket, { x: door.x0 - OPEN_REACH - 3 });
  step(k, {});
  assert.equal(k.doors[0].open, false, "opened from too far away");
  Object.assign(k.rocket, { x: door.x0 - OPEN_REACH + 1, y: 9, vx: 10, vy: 0 });
  step(k, {});
  assert.equal(k.doors[0].open, true);
  for (let i = 0; i < 1.5 * TICK_RATE; i++) step(k, { thrust: k.rocket.vy < 0 });
  assert.ok(k.rocket.x > door.x1, "didn't get through the open door");
  assert.equal(k.doors[0].open, true);
});

// Lands the world's rocket on the switch.
const onSwitch = (w) => {
  const sw = w.level.pads.find((p) => p.kind === "switch");
  Object.assign(w.rocket, { x: (sw.x0 + sw.x1) / 2, y: sw.y + CENTRE_Y + 0.5, vx: 0, vy: 0, angle: 0, state: "flying" });
  run(w, {}, 20);
  assert.equal(w.rocket.state, "landed");
};

test("landing on a switch opens its gate for good", () => {
  const w = flyingAt(room(), 10, 10);
  onSwitch(w);
  assert.equal(w.doors[1].open, true);
  run(w, { thrust: true }, 10 * TICK_RATE);
  assert.equal(w.doors[1].open, true);
  assert.deepEqual(gateTimers(w), []);
});

test("a timed gate counts down from lift-off and shuts, but not on the rocket", () => {
  const w = flyingAt(room(3), 10, 10);
  onSwitch(w);
  run(w, {}, 2 * TICK_RATE);
  assert.equal(gateTimers(w)[0].seconds, 3, "the time runs while sitting on the switch");
  Object.assign(w.rocket, { state: "flying", x: 70, y: 10 }); // away from the switch and the gate
  run(w, {}, 3 * TICK_RATE - 1);
  assert.equal(w.doors[1].open, true);
  step(w, {});
  assert.equal(w.doors[1].open, false);
  // Open again, with the rocket in the gateway when the time's up.
  onSwitch(w);
  const [, gate] = w.level.doors;
  Object.assign(w.rocket, { x: (gate.x0 + gate.x1) / 2, y: 9, state: "flying", vx: 0, vy: 0 });
  w.cheats.god = true;
  run(w, { thrust: true }, 4 * TICK_RATE);
  assert.equal(w.doors[1].open, true, "shut on the rocket");
  Object.assign(w.rocket, { x: gate.x1 + 6 });
  step(w, {});
  assert.equal(w.doors[1].open, false);
});

test("a restart puts keys, doors and gates back as they were at the checkpoint", () => {
  const w = flyingAt(room(3), 10, 10);
  onSwitch(w); // a timed gate: shut again after a restart
  Object.assign(w.rocket, { x: w.level.keys[0].x, y: w.level.keys[0].y - 1, state: "flying" });
  step(w, {});
  // Checkpoint on the fuel pad, next to the door: it opens.
  const fuel = w.level.pads.find((p) => p.kind === "fuel");
  Object.assign(w.rocket, { x: (fuel.x0 + fuel.x1) / 2, y: fuel.y + CENTRE_Y + 0.5, vx: 0, vy: 0 });
  run(w, {}, 20);
  assert.deepEqual([w.keys, w.doors[0].open, w.doors[1].open], [["red"], true, true]);
  restart(w);
  assert.deepEqual([w.keys, w.doors[0].open, w.doors[1].open], [["red"], true, false]);
  // Before any checkpoint, a restart takes the key back and shuts the door.
  const fresh = flyingAt(room(), 10, 10);
  Object.assign(fresh.rocket, { x: fresh.level.keys[0].x, y: fresh.level.keys[0].y - 1 });
  step(fresh, {});
  Object.assign(fresh.rocket, { x: fresh.level.doors[0].x0 - 3 });
  step(fresh, {});
  assert.equal(fresh.doors[0].open, true);
  restart(fresh);
  assert.deepEqual([fresh.keys, fresh.doors[0].open], [[], false]);
});

test("the tiles round the rocket count as seen", () => {
  const w = createWorld(room());
  step(w, {});
  const at = (x, y) => w.seen[Math.floor(y / TILE) * w.level.width + Math.floor(x / TILE)];
  assert.equal(at(w.rocket.x, w.rocket.y), 1);
  assert.equal(at(w.rocket.x + 20, w.rocket.y), 1);
  assert.equal(at(w.level.exit.x0, w.level.exit.y), 0);
});
