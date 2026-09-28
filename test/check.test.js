import { test } from "node:test";
import assert from "node:assert/strict";
import { newLevel } from "../src/mylevels.js";
import { gridFromLevel, levelFromGrid } from "../src/editor/grid.js";
import { createStroke, paintAt, paintRect } from "../src/editor/tools.js";
import { checkLevel } from "../src/sim/check.js";
import { flyLevel } from "../src/autofly.js";

function divided(ch = "#") {
  const g = gridFromLevel(newLevel());
  paintRect(createStroke(g), 24, 1, 24, 22, ch);
  return g;
}
const paint = (g, c, r, ch) => paintAt(createStroke(g), c, r, ch);

test("check locates an unreachable exit and crystal, and parser problems", () => {
  const g = divided();
  paint(g, 30, 10, "*");
  const problems = checkLevel(levelFromGrid(g));
  assert.ok(problems.some((p) => /exit/.test(p.text) && p.at.c === 41 && p.at.r === 22));
  assert.ok(problems.some((p) => /crystal/.test(p.text) && p.at.c === 30 && p.at.r === 10));
  paint(g, 3, 10, "S");
  assert.ok(checkLevel(levelFromGrid(g))[0].at);
});

test("check opens doors only after reaching their keys", () => {
  const g = divided("R");
  paint(g, 12, 10, "r");
  assert.deepEqual(checkLevel(levelFromGrid(g)), []);
  paint(g, 30, 10, "r");
  const problems = checkLevel(levelFromGrid(g));
  assert.ok(problems.some((p) => /red key/.test(p.text)));
  assert.ok(problems.some((p) => /exit/.test(p.text)));
});

test("check opens gates and disables lasers only after reaching their switches", () => {
  for (const kind of ["gate", "laser"]) {
    const g = kind === "gate" ? divided("1") : gridFromLevel(newLevel());
    g.things = { 1: { kind, ...(kind === "laser" ? { facing: "up" } : {}) }, 2: { kind: "switch", opens: "1" } };
    if (kind === "laser") paint(g, 24, 23, "1");
    paint(g, 12, 22, "2");
    assert.deepEqual(checkLevel(levelFromGrid(g)), [], kind);
    paintRect(createStroke(g), 11, 22, 13, 22, ".");
    paint(g, 30, 22, "2");
    assert.ok(
      checkLevel(levelFromGrid(g)).some((p) => /switch/.test(p.text)),
      kind,
    );
  }
});

test("autopilot reports legs, total time and suggestions, and bounds failed runs", () => {
  const progress = [];
  const report = flyLevel(newLevel(), { progress: (p) => progress.push(p.seconds) });
  assert.equal(report.failed, undefined);
  assert.ok(report.legs.length > 0);
  assert.ok(report.seconds > 0);
  assert.equal(report.suggested.par, Math.ceil(report.seconds / 5) * 5);
  assert.ok(report.suggested.fuel >= Math.ceil(Math.max(...report.legs.map((l) => l.fuel)) * 1.4));
  assert.ok(progress.length > 0);
  const failed = flyLevel(levelFromGrid(divided()));
  assert.match(failed.failed, /no way/);
  assert.equal(failed.suggested, null);
  assert.ok(failed.at.c >= 0 && failed.at.r >= 0);
  assert.match(flyLevel(newLevel(), { maxSeconds: 0.1 }).failed, /Stopped after/);
});

test("tank suggestions include all key legs between refills", () => {
  const g = gridFromLevel({ ...newLevel(), fuel: 30, route: "r y E" });
  paint(g, 12, 18, "r");
  paint(g, 28, 10, "y");
  const result = flyLevel(levelFromGrid(g));
  assert.equal(result.failed, undefined);
  assert.equal(result.legs.length, 3);
  assert.equal(result.suggested.fuel, Math.ceil(result.legs.reduce((sum, leg) => sum + leg.fuel, 0) * 1.4));
  assert.equal(flyLevel({ ...levelFromGrid(g), ...result.suggested }).failed, undefined);
});
