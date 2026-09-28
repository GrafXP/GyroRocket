import { test } from "node:test";
import assert from "node:assert/strict";
import { newLevel } from "../src/mylevels.js";
import { parseLevel, TILE } from "../src/sim/level.js";
import { THING_SETTINGS, validateLevel } from "../src/sim/validate.js";
import { createWorld, step } from "../src/sim/world.js";
import { gridFromLevel, levelFromGrid, charAt, cloneGrid } from "../src/editor/grid.js";
import { addThing, customizeTile, thingDefaults, validateThingEdit, validateSettingsEdit, thingShapes } from "../src/editor/things.js";
import { createStroke, paintAt, paintRect } from "../src/editor/tools.js";
import { reachOf } from "../src/editor/reach.js";
import { LEVELS } from "../src/levels/index.js";

const paint = (g, c, r, ch) => paintAt(createStroke(g), c, r, ch);
function withThing(kind) {
  const g = gridFromLevel(newLevel());
  const label = addThing(g, kind);
  paint(g, 14, kind === "switch" ? 22 : kind === "stalactite" ? 1 : 10, label);
  if (kind === "gate" || kind === "switch") {
    const partner = addThing(g, kind === "gate" ? "switch" : "gate");
    paint(g, 20, kind === "gate" ? 22 : 10, partner);
    g.things[kind === "gate" ? partner : label].opens = kind === "gate" ? label : partner;
  }
  return { g, label };
}

for (const kind of Object.keys(THING_SETTINGS)) {
  test(`${kind}: editor defaults place, parse and simulate, with schema bounds enforced`, () => {
    const { g, label } = withThing(kind);
    const thing = g.things[label];
    assert.doesNotThrow(() => validateThingEdit(g, label, thing));
    const def = levelFromGrid(g);
    validateLevel(def);
    const w = createWorld(parseLevel(def));
    for (let n = 0; n < 120; n++) step(w, { thrust: n < 60, steer: 0 });
    assert.ok([w.rocket.x, w.rocket.y, w.rocket.fuel, w.rocket.hull].every(Number.isFinite));
    assert.throws(() => validateThingEdit(g, label, { ...thing, c: 4 }), /no setting/);
    for (const [key, spec] of Object.entries(THING_SETTINGS[kind])) {
      if (spec.type === "number" || spec.type === "whole") {
        for (const v of [spec.min, spec.max]) assert.doesNotThrow(() => validateThingEdit(g, label, { ...thing, [key]: v }), `${kind}.${key} = ${v}`);
        for (const v of [NaN, Infinity, spec.min - 1, spec.max + 1, "2"]) assert.throws(() => validateThingEdit(g, label, { ...thing, [key]: v }), `${kind}.${key} = ${v}`);
      }
      if (spec.type === "oneOf") {
        for (const v of spec.values) assert.doesNotThrow(() => validateThingEdit(g, label, { ...thing, [key]: v }));
        assert.throws(() => validateThingEdit(g, label, { ...thing, [key]: "sideways" }));
      }
    }
  });
}

test("new things reserve labels, and copying defaults cannot change another instance", () => {
  const g = gridFromLevel(newLevel());
  paint(g, 14, 10, "1"); // undefined map label must not get silently redefined
  assert.equal(addThing(g, "mover"), "2");
  assert.equal(addThing(g, "crusher"), "3");
  g.things[2].to[0] = 9;
  assert.deepEqual(thingDefaults("mover").to, [3, 0]);
  const before = cloneGrid(g);
  addThing(g, "switch");
  assert.equal(Object.keys(before.things).length, 2);
});

test("plain hazards can gain settings without changing their facing or splitting a stalactite", () => {
  const g = gridFromLevel(newLevel());
  paint(g, 10, 10, ">");
  const flame = customizeTile(g, 10, 10);
  assert.equal(g.things[flame].facing, "right");
  assert.equal(customizeTile(g, 10, 10), flame);
  for (const r of [1, 2, 3]) paint(g, 18, r, "!");
  const stalactite = customizeTile(g, 18, 2);
  for (const r of [1, 2, 3]) assert.equal(charAt(g, 18, r), stalactite);
  assert.equal(customizeTile(g, 0, 0), null);
  assert.doesNotThrow(() => parseLevel(levelFromGrid(g)));
});

test("sheets refuse stationary movers, unknown targets and impossible level settings", () => {
  const { g, label } = withThing("mover");
  assert.throws(() => validateThingEdit(g, label, { ...g.things[label], to: [0, 0] }), /at least one tile/);
  const sw = addThing(g, "switch");
  assert.throws(() => validateThingEdit(g, sw, { kind: "switch", opens: label }), /Choose a gate/);
  assert.throws(() => validateSettingsEdit(g, { ...g.settings, sky: g.height }), /Sky must/);
  assert.throws(() => validateSettingsEdit(g, { ...g.settings, rise: { speed: 1, from: 5, to: 4 } }), /finish above/);
  assert.throws(() => validateSettingsEdit(g, { ...g.settings, rise: { speed: 1, after: "r" } }), /Choose a key/);
  assert.doesNotThrow(() => validateSettingsEdit(g, { ...g.settings, sky: 3, rise: { speed: 1, from: 0, to: 24 }, route: "F@12 E" }));
});

test("a switch links every instance of its gate, and movers have independent handles per rectangle", () => {
  const g = gridFromLevel(newLevel());
  const gate = addThing(g, "gate"),
    sw = addThing(g, "switch"),
    mover = addThing(g, "mover");
  g.things[sw].opens = gate;
  paint(g, 14, 8, gate);
  paint(g, 14, 12, gate);
  paint(g, 10, 22, sw);
  paintRect(createStroke(g), 20, 5, 22, 6, mover);
  paint(g, 20, 12, mover);
  assert.equal(thingShapes(g, mover).length, 2);
  assert.equal(reachOf(g).filter((p) => p.ch === sw && p.type === "link").length, 2);
  const arrows = reachOf(g).filter((p) => p.ch === mover && p.type === "arrow");
  assert.equal(arrows.length, 2);
  for (const p of arrows) assert.equal(p.x1 - p.x, 3);
});

test("flame, laser and fan reach matches the parser, including rock clipping, on every built-in level", () => {
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  for (const def of LEVELS) {
    const g = gridFromLevel(def),
      l = parseLevel(def),
      reach = reachOf(g);
    for (const beam of [...l.flames, ...l.lasers]) {
      assert.ok(
        reach.some(
          (p) => p.type === "line" && near(p.x * TILE, beam.x0) && near((g.height - p.y) * TILE, beam.y0) && near(p.x1 * TILE, beam.x1) && near((g.height - p.y1) * TILE, beam.y1),
        ),
        `${def.id}: missing beam`,
      );
    }
    for (const fan of l.fans) {
      assert.ok(
        reach.some(
          (p) =>
            p.type === "rect" && near(p.x * TILE, fan.x0) && near((g.height - p.y - p.h) * TILE, fan.y0) && near(p.w * TILE, fan.x1 - fan.x0) && near(p.h * TILE, fan.y1 - fan.y0),
        ),
        `${def.id}: missing fan`,
      );
    }
  }
});

test("near-flame triggers cover the whole beam; magnet range is in metres", () => {
  const { g, label } = withThing("flame");
  g.things[label].mode = "near";
  g.things[label].facing = "right";
  const magnet = addThing(g, "magnet");
  paint(g, 30, 10, magnet);
  const shapes = reachOf(g);
  const trigger = shapes.find((p) => p.ch === label && p.type === "capsule");
  const flame = shapes.find((p) => p.ch === label && p.type === "line");
  assert.deepEqual([trigger.x, trigger.y, trigger.x1, trigger.y1], [flame.x, flame.y, flame.x1, flame.y1]);
  assert.equal(trigger.radius, g.things[label].reach / TILE);
  assert.equal(shapes.find((p) => p.ch === magnet).radius, g.things[magnet].range / TILE);
});
