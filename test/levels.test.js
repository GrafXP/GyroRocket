import { test } from "node:test";
import assert from "node:assert/strict";
import { LEVELS, WORLDS, levelById, nextLevel } from "../src/levels/index.js";
import { parseLevel } from "../src/sim/level.js";
import { buildOutline } from "../src/sim/outline.js";
import { deepestContact } from "../src/sim/collide.js";
import { circlesAt, canStand, CENTRE_Y } from "../src/sim/rocket.js";
import { touches } from "../src/sim/world.js";
import { flyLevel } from "../scripts/autopilot.js";

// Everywhere an upright rocket can get to from the start pad, moving in 1 m steps
// without touching rock. Returns a list of reachable [x, y] centres.
function reachable(level, outline) {
  const { start } = level;
  const [sx, sy] = [(start.x0 + start.x1) / 2, start.y + CENTRE_Y + 0.05];
  const [gx0, gy0] = [Math.floor(-sx), Math.floor(-sy)];
  const cols = Math.ceil(level.width * 2 - sx) - gx0 + 1;
  const rows = Math.ceil(level.height * 2 - sy) - gy0 + 1;
  const seen = new Uint8Array(cols * rows); // 1 seen and fits, 2 seen and doesn't
  const fits = (x, y) => !deepestContact(outline, circlesAt(x, y, 0));
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
    const spots = reachable(level, outline);
    for (const pad of level.pads) {
      const [x, y] = [(pad.x0 + pad.x1) / 2, pad.y + CENTRE_Y];
      assert.ok(
        spots.some(([sx, sy]) => Math.abs(sx - x) <= 0.5 && sy - y >= 0 && sy - y <= 1.5),
        `can't get to the ${pad.kind} pad at column ${pad.c0 + 1}`,
      );
    }
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
