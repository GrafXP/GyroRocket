import { test } from "node:test";
import assert from "node:assert/strict";
import { LEVELS, WORLDS, levelById, nextLevel } from "../src/levels/index.js";
import { parseLevel } from "../src/sim/level.js";
import { buildOutline, setTile } from "../src/sim/outline.js";
import { deepestContact } from "../src/sim/collide.js";
import { circlesAt, canStand, CENTRE_Y } from "../src/sim/rocket.js";
import { touches } from "../src/sim/world.js";
import { flyLevel } from "../scripts/autopilot.js";
import { inFlame } from "../src/sim/hazards/flame.js";
import { inLaser } from "../src/sim/hazards/laser.js";
import { stalactiteShape } from "../src/sim/hazards/stalactite.js";

// Everywhere an upright rocket can get to from the start pad, moving in 1 m steps
// without touching rock, the shut doors and gates in `boxes`, a flame that's always
// on, or a laser beam in `beams`. Returns a list of reachable [x, y] centres.
function flood(level, outline, boxes, beams) {
  const walls = level.flames.filter((f) => f.mode === "always");
  const { start } = level;
  const [sx, sy] = [(start.x0 + start.x1) / 2, start.y + CENTRE_Y + 0.05];
  const [gx0, gy0] = [Math.floor(-sx), Math.floor(-sy)];
  const cols = Math.ceil(level.width * 2 - sx) - gx0 + 1;
  const rows = Math.ceil(level.height * 2 - sy) - gy0 + 1;
  const seen = new Uint8Array(cols * rows); // 1 seen and fits, 2 seen and doesn't
  const fits = (x, y) => {
    const circles = circlesAt(x, y, 0);
    return !deepestContact(outline, circles, boxes) && !walls.some((f) => inFlame(f, circles)) && !beams.some((l) => inLaser(l, circles));
  };
  const found = [];
  const queue = [[0, 0]];
  seen[(0 - gy0) * cols + (0 - gx0)] = 1;
  while (queue.length) {
    const [gx, gy] = queue.pop();
    found.push([sx + gx, sy + gy]);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const [nx, ny] = [gx + dx, gy + dy];
      if (nx < gx0 || ny < gy0 || nx - gx0 >= cols || ny - gy0 >= rows) continue;
      const i = (ny - gy0) * cols + (nx - gx0);
      if (seen[i]) continue;
      seen[i] = fits(sx + nx, sy + ny) ? 1 : 2;
      if (seen[i] === 1) queue.push([nx, ny]);
    }
  }
  return found;
}

// Whether any of `spots` is where the rocket stands over a pad's middle.
const onPad = (spots, pad) => {
  const [x, y] = [(pad.x0 + pad.x1) / 2, pad.y + CENTRE_Y];
  return spots.some(([sx, sy]) => Math.abs(sx - x) <= 0.5 && sy - y >= 0 && sy - y <= 1.5);
};

// Everywhere the rocket can get to, opening each door once its key has been
// reached, and each gate (or laser that's always on) once its switch has.
// Cycling lasers are no bar: they go off; nor is crumbling rock, which falls away
// once it's touched. Stalactites are: some might never fall.
function reachable(level) {
  const outline = buildOutline(level);
  for (const t of level.crumbles) setTile(outline, t.c, t.j, false);
  const stalactites = level.stalactites.map((s) => stalactiteShape(s));
  const open = new Set();
  const off = new Set();
  for (;;) {
    const spots = flood(
      level,
      outline,
      [...level.doors.filter((d, i) => !open.has(i)), ...stalactites],
      level.lasers.filter((l, i) => l.mode === "always" && !off.has(i)),
    );
    const keys = level.keys.filter((k) => spots.some(([x, y]) => touches({ x, y, angle: 0 }, k))).map((k) => k.color);
    const switches = level.pads.filter((p) => p.kind === "switch" && onPad(spots, p)).map((p) => p.opens);
    const doors = level.doors.filter((d, i) => !open.has(i) && (keys.includes(d.key) || switches.includes(d.gate)));
    const lasers = level.lasers.filter((l, i) => !off.has(i) && switches.includes(l.label));
    if (!doors.length && !lasers.length) return spots;
    for (const d of doors) open.add(level.doors.indexOf(d));
    for (const l of lasers) off.add(level.lasers.indexOf(l));
  }
}

test("levels have ids in order, and know what comes next", () => {
  assert.deepEqual(
    WORLDS[0].levels.map((l) => l.id),
    ["1-1", "1-2", "1-3", "1-4", "1-5", "1-6", "1-7", "1-8"],
  );
  assert.equal(levelById("1-3").name, LEVELS[2].name);
  assert.equal(levelById("test").id, "test");
  assert.equal(levelById("9-9"), null);
  assert.equal(nextLevel("1-1").id, "1-2");
  assert.equal(nextLevel(LEVELS.at(-1).id), null);
});

for (const def of LEVELS) {
  test(`${def.id} ${def.name}: can be flown from start to finish`, () => {
    const level = parseLevel(def);
    const outline = buildOutline(level);
    assert.ok(def.par > 0, "no par time");
    assert.ok(def.fuel > 0, "no tank size");
    assert.ok(level.crystals.length >= 1 && level.crystals.length <= 3, `${level.crystals.length} crystals`);

    for (const pad of level.pads) {
      assert.ok(canStand(outline, (pad.x0 + pad.x1) / 2, pad.y), `can't stand on the ${pad.kind} pad at column ${pad.c0 + 1}`);
    }
    const spots = reachable(level);
    for (const pad of level.pads) {
      assert.ok(onPad(spots, pad), `can't get to the ${pad.kind} pad at column ${pad.c0 + 1}`);
    }
    level.keys.forEach((k) => {
      assert.ok(
        spots.some(([x, y]) => touches({ x, y, angle: 0 }, k)),
        `can't get to the ${k.color} key`,
      );
    });
    level.crystals.forEach((c, i) => {
      assert.ok(
        spots.some(([x, y]) => touches({ x, y, angle: 0 }, c)),
        `can't get to crystal ${i + 1} (column ${Math.floor(c.x / 2) + 1})`,
      );
    });
  });
}

test("the autopilot can fly every level within its tank", () => {
  for (const def of LEVELS) {
    const { failed } = flyLevel(def);
    assert.equal(failed, undefined, `${def.id} ${def.name}: ${failed}`);
  }
});
