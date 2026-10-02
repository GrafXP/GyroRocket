import { test } from "node:test";
import assert from "node:assert/strict";
import { layout, COLUMN } from "../src/ui/way.js";

// The corners of a path of M, H, V and L commands, as [x, y].
function corners(d) {
  const points = [];
  let [x, y] = [0, 0];
  for (const [, cmd, args] of d.matchAll(/([MHVL])([-\d. ]+)/g)) {
    const n = args.trim().split(/\s+/).map(Number);
    if (cmd === "H") x = n[0];
    else if (cmd === "V") y = n[0];
    else [x, y] = n;
    points.push([x, y]);
  }
  return points;
}

for (const [name, perRow, flip] of [
  ["sideways", 8, false],
  ["sideways, from the right", 8, true],
  ["upright", 4, false],
]) {
  test(`${name}: eight stops, a column each, and inside the picture`, () => {
    const l = layout(8, perRow, flip);
    assert.equal(l.width, perRow * COLUMN);
    assert.equal(l.stops.length, 8);
    assert.equal(new Set(l.stops.map(String)).size, 8);
    for (const [x, y] of l.stops) {
      assert.equal((x - COLUMN / 2) % COLUMN, 0);
      assert.ok(y >= 50 && y <= l.height - 50, `a stop at ${y} of ${l.height}`);
    }
  });

  test(`${name}: the tunnel goes through every stop in order, level, straight down or at 45°`, () => {
    const l = layout(8, perRow, flip);
    const points = corners(l.path(true));
    let at = -1;
    for (const stop of l.stops) {
      at = points.findIndex((p, i) => i > at && String(p) === String(stop));
      assert.ok(at >= 0, `the tunnel misses the stop at ${stop}`);
    }
    for (let i = 1; i < points.length; i++) {
      const [dx, dy] = [points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]];
      assert.ok(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy), `a stretch of ${dx} by ${dy}`);
      assert.ok(dy >= 0 || Math.abs(dx) === Math.abs(dy), "the tunnel never climbs straight up");
    }
  });

  test(`${name}: in at the top over the first stop, out at the bottom under the last`, () => {
    const l = layout(8, perRow, flip);
    const way = corners(l.path(true));
    assert.deepEqual(way[0], [l.in, 0]);
    assert.deepEqual(way.at(-1), [l.out, l.height]);
    assert.equal(l.in, l.stops[0][0]);
    assert.equal(l.out, l.stops[7][0]);
    // With no way out, it ends at the last stop.
    assert.deepEqual(corners(l.path()).at(-1), l.stops[7]);
  });
}

test("sideways, one world's way out is over the next one's way in", () => {
  const [a, b] = [layout(8, 8, false), layout(8, 8, true)];
  assert.equal(a.in, 50);
  assert.equal(a.out, 750);
  assert.equal(b.in, a.out);
  assert.equal(b.out, a.in);
});

test("upright, the two rows snake, and every world starts and ends on the left", () => {
  const l = layout(8, 4);
  assert.deepEqual(l.stops.map(([x]) => x), [50, 150, 250, 350, 350, 250, 150, 50]);
  assert.equal(l.in, l.out);
  assert.ok(l.stops[4][1] > l.stops[3][1]);
});
