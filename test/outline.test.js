import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOutline, solidAt, floorAt, segmentsNear } from "../src/sim/outline.js";
import { TILE, isSolid, parseLevel } from "../src/sim/level.js";
import { level } from "./helpers.js";
import testCave from "../src/levels/testcave.js";

const box = () =>
  buildOutline(
    level(`
      ##########
      #........#
      #........#
      #........#
      #.SSS.EEE#
      ##########
    `),
  );

const key = (x, y) => `${x.toFixed(6)},${y.toFixed(6)}`;

test("outlines are closed loops with the air on their left", () => {
  for (const o of [box(), buildOutline(parseLevel(testCave))]) {
    const starts = new Map(o.segs.map((s) => [key(s.ax, s.ay), s]));
    assert.equal(starts.size, o.segs.length, "two segments start at one point");
    for (const s of o.segs) {
      assert.ok(starts.has(key(s.bx, s.by)), `nothing carries on from ${key(s.bx, s.by)}`);
      // Just off the middle of every segment: air on the normal's side, rock behind.
      const [mx, my] = [(s.ax + s.bx) / 2, (s.ay + s.by) / 2];
      assert.equal(solidAt(o, mx + s.nx * 0.1, my + s.ny * 0.1), false);
      assert.equal(solidAt(o, mx - s.nx * 0.1, my - s.ny * 0.1), true);
    }
  }
});

test("straight walls lie on tile edges, and corners are cut at 45°", () => {
  const o = box();
  // The floor under the pads: along y = 1 tile, facing up.
  const floor = o.segs.filter((s) => s.ny === 1);
  assert.ok(floor.every((s) => s.ay === TILE && s.by === TILE));
  assert.equal(Math.min(...floor.flatMap((s) => [s.ax, s.bx])), 1.5 * TILE);
  assert.equal(Math.max(...floor.flatMap((s) => [s.ax, s.bx])), 8.5 * TILE);
  // The bottom-left corner of the room: cut from (1.5, 1) to (1, 1.5) tiles.
  const cut = o.segs.find((s) => s.nx > 0 && s.ny > 0);
  assert.ok(cut);
  assert.ok(Math.abs(Math.hypot(cut.nx, cut.ny) - 1) < 1e-12);
  assert.ok(Math.abs(cut.nx - cut.ny) < 1e-12);
});

test("solidAt agrees with the tiles at their centres", () => {
  const l = parseLevel(testCave);
  const o = buildOutline(l);
  for (let j = -1; j <= l.height; j++) {
    for (let c = -1; c <= l.width; c++) {
      assert.equal(solidAt(o, (c + 0.5) * TILE, (j + 0.5) * TILE), isSolid(l, c, j), `tile ${c},${j}`);
    }
  }
  assert.equal(solidAt(o, -100, 5), true);
});

test("floorAt finds flat floor only", () => {
  const o = box();
  assert.equal(floorAt(o, 3 * TILE, TILE), true);
  assert.equal(floorAt(o, 3 * TILE, TILE + 0.5), false);
  assert.equal(floorAt(o, 1.2 * TILE, TILE), false); // on the corner cut
});

test("segmentsNear only returns segments near the box", () => {
  const o = box();
  const near = segmentsNear(o, 4 * TILE, 2 * TILE, 5 * TILE, 3 * TILE);
  assert.equal(near.length, 0); // the middle of the room
  assert.ok(segmentsNear(o, 4 * TILE, 0, 5 * TILE, 1.5 * TILE).length > 0);
});
