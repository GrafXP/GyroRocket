import { test } from "node:test";
import assert from "node:assert/strict";
import { WORLDS, levelById, endingOf } from "../src/levels/index.js";
import { parseLevel } from "../src/sim/level.js";
import { createWorld } from "../src/sim/world.js";
import { CENTRE_Y, TICK_RATE } from "../src/sim/rocket.js";
import { introduceWorld, completionTitle, guidePosition, flightPrompt } from "../src/ui/flight.js";

const fresh = (id = "1-1") => createWorld(parseLevel(levelById(id)));

test("a world is introduced once, and completed worlds aren't introduced again", () => {
  const seen = new Set();
  const progress = { levels: {} };
  assert.equal(introduceWorld(levelById("1-1"), progress, seen), WORLDS[0]);
  assert.equal(introduceWorld(levelById("1-1"), progress, seen), null, "retry");
  assert.equal(introduceWorld(levelById("1-2"), progress, seen), null, "next level");
  assert.equal(introduceWorld(levelById("2-1"), progress, seen), WORLDS[1]);
  progress.levels["3-1"] = { best: 30 };
  assert.equal(introduceWorld(levelById("3-2"), progress, seen), null);
  assert.equal(introduceWorld({ id: "my:example" }, progress, seen), null);
});

test("world finales acknowledge their world, with both part endings preserved", () => {
  assert.equal(completionTitle(levelById("2-7")), "Level complete");
  assert.equal(completionTitle(levelById("2-8")), "Old mine complete");
  for (const id of ["6-8", "10-8"]) assert.equal(completionTitle(levelById(id)), endingOf(id).title);
  assert.equal(completionTitle({ id: "my:example" }), "Level complete");
});

test("the control card chooses a clear corner inside the HUD and safe margins", () => {
  const margins = { top: 108, left: 32, right: 32, bottom: 30 };
  for (const size of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
    const panel = { width: 300, height: 130 };
    for (const point of [{ x: 40, y: size.height - 60 }, { x: size.width - 40, y: size.height - 60 }, { x: size.width / 2, y: size.height / 2 }]) {
      const pos = guidePosition(point, size, panel, margins);
      assert.ok(pos.x >= margins.left && pos.x + panel.width <= size.width - margins.right);
      assert.ok(pos.y >= margins.top && pos.y + panel.height <= size.height - margins.bottom);
      const gap = Math.hypot(Math.max(pos.x - point.x, 0, point.x - pos.x - panel.width), Math.max(pos.y - point.y, 0, point.y - pos.y - panel.height));
      assert.ok(gap > 20, `rocket clear by ${gap}px at ${JSON.stringify(size)}`);
    }
  }
});

test("failure prompts show their cause and the actual retry checkpoint for each device", () => {
  const w = fresh("1-8");
  assert.equal(flightPrompt(w), null, "the start is taught by pictures");
  w.rocket.state = "crashed";
  w.rocket.cause = "laser";
  assert.deepEqual(flightPrompt(w, { phone: true }), { icon: "retry", title: "Zapped", detail: "Tap to retry from the start" });
  w.checkpoint.pad = w.level.pads.find((p) => p.kind === "fuel");
  assert.match(flightPrompt(w).detail, /Press ↑.*last fuel pad/);
  w.rocket.state = "landed";
  w.stranded = true;
  assert.equal(flightPrompt(w).title, "Out of fuel");
  w.done = true;
  assert.equal(flightPrompt(w, { watching: "this run" }), null);
});

test("switch prompts distinguish gates from lasers and countdowns start after takeoff", () => {
  for (const id of ["2-6", "5-3"]) {
    const w = fresh(id);
    const pad = w.level.pads.find((p) => p.kind === "switch");
    assert.ok(pad, `${id} has a switch`);
    Object.assign(w.rocket, { state: "landed", x: (pad.x0 + pad.x1) / 2, y: pad.y + CENTRE_Y });
    const laser = w.level.lasers.some((l) => l.label === pad.opens);
    assert.equal(flightPrompt(w).icon, laser ? "laser" : "gate");
    w.rocket.state = "flying";
    const things = laser ? w.lasers : w.doors;
    const defs = laser ? w.level.lasers : w.level.doors;
    const i = defs.findIndex((d) => (laser ? d.label : d.gate) === pad.opens);
    assert.ok(i >= 0);
    things[i].until = w.tick + 1.2 * TICK_RATE;
    assert.equal(flightPrompt(w).detail, laser ? "Returns in 2 s" : "Closes in 2 s");
  }
});

test("replay and autopilot status have priority, and rising lava warns briefly", () => {
  const w = fresh("6-8");
  assert.equal(flightPrompt(w, { watching: "your best run" }).title, "Replay");
  assert.deepEqual(flightPrompt(w, { pilot: { status: "Heading for the exit" } }), { icon: "auto", title: "Autopilot", detail: "Heading for the exit" });
  w.rise.from = 0;
  assert.equal(flightPrompt(w).title, "The lava is rising");
  w.tick = 3 * TICK_RATE;
  assert.equal(flightPrompt(w), null);
});
