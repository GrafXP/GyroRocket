import { test } from "node:test";
import assert from "node:assert/strict";
import { newLevel } from "../src/mylevels.js";
import { gridFromLevel, charAt, levelFromGrid } from "../src/editor/grid.js";
import { movableAt, moveObject } from "../src/editor/move.js";
import { addThing } from "../src/editor/things.js";
import { createStroke, paintAt, paintRect } from "../src/editor/tools.js";

const grid = () => gridFromLevel(newLevel());
const paint = (g, c, r, ch) => paintAt(createStroke(g), c, r, ch);

test("Move selects objects while rock, air, lava and crumbling rock pan the view", () => {
  const g = grid();
  for (const ch of "*rygb<>^v!") {
    paint(g, 15, 10, ch);
    assert.equal(movableAt(g, 15, 10).cells.size, 1, ch);
  }
  for (const ch of "#.~%") {
    paint(g, 15, 10, ch);
    assert.equal(movableAt(g, 15, 10), null, ch);
  }
  assert.equal(movableAt(g, -1, 10), null);
});

test("moving a block preserves its full shape, settings and other instances of the same label", () => {
  const g = grid();
  const ch = addThing(g, "mover");
  g.things[ch].to = [7, -2];
  paintRect(createStroke(g), 12, 5, 14, 6, ch);
  paint(g, 25, 10, ch);
  const object = movableAt(g, 13, 6);
  assert.equal(object.cells.size, 6);
  const result = moveObject(g, object, 4, 3);
  assert.equal(result.problem, null);
  for (const c of [12, 13, 14])
    for (const r of [5, 6]) {
      assert.equal(charAt(result.grid, c, r), ".");
      assert.equal(charAt(result.grid, c + 4, r + 3), ch);
      assert.equal(charAt(g, c, r), ch); // original snapshot is immutable
    }
  assert.equal(charAt(result.grid, 25, 10), ch);
  assert.deepEqual(result.grid.things[ch], g.things[ch]);
});

test("pads, switches, gates and stalactites move as their complete instances", () => {
  const g = grid();
  const sw = addThing(g, "switch"),
    gate = addThing(g, "gate"),
    stalactite = addThing(g, "stalactite");
  g.things[sw].opens = gate;
  paint(g, 12, 22, sw);
  paintRect(createStroke(g), 20, 4, 21, 8, gate);
  for (const r of [1, 2, 3]) paint(g, 30, r, stalactite);
  assert.equal(movableAt(g, 5, 22).cells.size, 3); // start pad, grabbed at its middle
  assert.equal(movableAt(g, 12, 22).cells.size, 3);
  assert.equal(movableAt(g, 20, 7).cells.size, 10);
  assert.equal(movableAt(g, 30, 2).cells.size, 3);
  const moved = moveObject(g, movableAt(g, 20, 7), 3, 2).grid;
  assert.equal(moved.things[sw].opens, gate);
  assert.deepEqual(levelFromGrid(moved).things, g.things);
});

test("overlapping moves preserve the object and previews leave crossed tiles untouched", () => {
  const g = grid();
  const ch = addThing(g, "gate");
  paintRect(createStroke(g), 10, 5, 13, 6, ch);
  const object = movableAt(g, 10, 5);
  const overlap = moveObject(g, object, 1, 0);
  assert.equal(overlap.problem, null);
  for (const r of [5, 6]) {
    assert.equal(charAt(overlap.grid, 10, r), ".");
    for (const c of [11, 12, 13, 14]) assert.equal(charAt(overlap.grid, c, r), ch);
  }
  paint(g, 20, 5, "#");
  const preview = moveObject(g, object, 10, 0);
  assert.equal(charAt(preview.grid, 20, 5), ch);
  const final = moveObject(g, object, 15, 0);
  assert.equal(charAt(final.grid, 20, 5), "#");
  assert.equal(charAt(g, 20, 5), "#");
});

test("occupied drops are rejected and a whole object stays inside the map", () => {
  const g = grid();
  const ch = addThing(g, "crusher");
  paintRect(createStroke(g), 10, 5, 12, 7, ch);
  paint(g, 20, 10, "*");
  const object = movableAt(g, 11, 6);
  const rejected = moveObject(g, object, 10, 5);
  assert.match(rejected.problem, /occupied/);
  assert.equal(rejected.grid, g);
  assert.equal(charAt(g, 20, 10), "*");
  const atEdge = moveObject(g, object, -100, -100);
  assert.equal(atEdge.dc, -10);
  assert.equal(atEdge.dr, -5);
  assert.equal(movableAt(atEdge.grid, 0, 0).cells.size, 9);
  const farEdge = moveObject(g, object, 100, 100);
  assert.equal(farEdge.dc, 35);
  assert.equal(farEdge.dr, 16);
  assert.equal(movableAt(farEdge.grid, 47, 23).cells.size, 9);
});

test("moving a fuel pad updates only route stops that name its columns", () => {
  const g = grid();
  paint(g, 14, 22, "F");
  g.settings.route = "r F@14 F@15 F@16 F@30 E";
  const result = moveObject(g, movableAt(g, 14, 22), 5, -3);
  assert.equal(result.problem, null);
  assert.equal(result.grid.settings.route, "r F@19 F@20 F@21 F@30 E");
  assert.equal(g.settings.route, "r F@14 F@15 F@16 F@30 E");
  assert.equal(movableAt(result.grid, 19, 19).cells.size, 3);
});
