import { test } from "node:test";
import assert from "node:assert/strict";
import { LEVELS } from "../src/levels/index.js";
import { parseLevel, mapRows } from "../src/sim/level.js";
import { gridFromLevel, levelFromGrid, resizeGrid, solidOf, charAt, rowOf, cloneGrid, problemOf } from "../src/editor/grid.js";
import { createStroke, paintAt, paintLine, paintRect, floodFill, strokeChanges, revertStroke, paintStyle } from "../src/editor/tools.js";

const builtIn = ({ id, world, colors, ...level }) => level;
const ROOM = `
  ####################
  #..................#
  #..................#
  #..................#
  #..SSS........EEE..#
  ####################
`;
const grid = (map = ROOM, extra = {}) => gridFromLevel({ name: "room", map, ...extra });
const rows = (g) => Array.from({ length: g.height }, (_, r) => rowOf(g, r));

test("every built-in level goes into the grid and comes out the same", () => {
  for (const def of LEVELS) {
    const level = builtIn(def);
    const back = levelFromGrid(gridFromLevel(level));
    // Short rows come back filled with rock, as the parser reads them.
    const width = Math.max(...mapRows(level.map).map((r) => r.length));
    assert.deepEqual(mapRows(back.map), mapRows(level.map).map((r) => r.padEnd(width, "#")), def.id);
    assert.deepEqual({ ...back, map: null }, { ...level, map: null }, def.id);
    assert.deepEqual(parseLevel(back).solid, parseLevel(level).solid, def.id);
  }
});

test("the grid knows which tiles are rock, as the parser does", () => {
  for (const def of LEVELS.filter((l) => ["2-5", "3-8", "4-8", "5-8", "6-5"].includes(l.id))) {
    const g = gridFromLevel(builtIn(def));
    assert.deepEqual(solidOf(g), parseLevel(builtIn(def)).solid, def.id);
  }
});

test("things no longer on the map are left out", () => {
  const g = grid(ROOM.replace("#..SSS", "#1.SSS"), { things: { 1: { kind: "turret" }, 2: { kind: "gate" } } });
  assert.deepEqual(levelFromGrid(g).things, { 1: { kind: "turret" } });
  g.cells[g.cells.indexOf("1".charCodeAt(0))] = ".".charCodeAt(0);
  assert.equal(levelFromGrid(g).things, undefined);
  assert.deepEqual(g.things[2], { kind: "gate" }); // kept while editing, for undo
});

test("resizing adds rock and takes rows and columns away", () => {
  const g = grid();
  const big = resizeGrid(g, { top: 1, left: 2 });
  assert.equal(big.width, 22);
  assert.equal(big.height, 7);
  assert.equal(rows(big)[0], "#".repeat(22));
  assert.equal(rows(big)[5], "###..SSS........EEE..#");
  const small = resizeGrid(g, { right: -3, bottom: -1 });
  assert.deepEqual(rows(small), ["#################", "#................", "#................", "#................", "#..SSS........EEE"]);
  assert.equal(g.width, 20); // the old grid is untouched, for undo
});

test("resizing keeps rising lava and the route's fuel pads where they were", () => {
  const g = grid(ROOM, { rise: { speed: 1, from: 2, to: 5 }, route: "r F@12 1 F@3 E" });
  const moved = resizeGrid(g, { bottom: 3, left: -2 });
  assert.deepEqual(moved.settings.rise, { speed: 1, from: 5, to: 8 });
  assert.equal(moved.settings.route, "r F@10 1 F@1 E");
  assert.equal(g.settings.rise.from, 2);
});

test("a brush paints a square, pads a row of three, keys and crystals one tile", () => {
  const g = grid();
  const s = createStroke(g);
  paintAt(s, 8, 2, "#", 3);
  assert.deepEqual(rows(g).slice(1, 4), ["#......###.........#", "#......###.........#", "#......###.........#"]);
  paintAt(s, 5, 1, "*", 3);
  assert.equal(charAt(g, 5, 1), "*");
  assert.equal(charAt(g, 4, 1), ".");
  paintAt(s, 11, 3, "F", 3);
  assert.equal(rows(g)[3], "#......###FFF......#");
  assert.equal(paintStyle(g, "R"), "area");
  assert.equal(paintStyle(g, ">"), "single");
});

test("painting a start, an exit or a key moves it", () => {
  const g = grid();
  let s = createStroke(g);
  paintAt(s, 9, 2, "S");
  paintAt(s, 10, 2, "S"); // dragging along makes the pad wider, and doesn't clear itself
  assert.equal(rows(g)[4], "#.............EEE..#");
  assert.equal(rows(g)[2], "#.......SSSS.......#");
  s = createStroke(g);
  paintAt(s, 3, 1, "r");
  paintAt(s, 4, 1, "r");
  assert.equal(rows(g)[1], "#...r..............#");
});

test("a line leaves no gaps, and a rectangle fills its corners", () => {
  const g = grid();
  const s = createStroke(g);
  paintAt(s, 1, 1, "#"); // where the finger went down
  paintLine(s, 1, 1, 7, 3, "#", 1); // and where it moved to
  assert.deepEqual(rows(g).slice(1, 4), ["###................#", "#..###.............#", "#.....##...........#"]);
  paintRect(s, 14, 3, 12, 1, "~");
  assert.deepEqual(rows(g).slice(1, 4).map((r) => r.slice(12, 15)), ["~~~", "~~~", "~~~"]);
});

test("flood fill fills what's joined, not across corners", () => {
  const g = grid(`
    ################
    #.....#........#
    #.....#........#
    ######.#########
    #..............#
    #..SSS....EEE..#
    ################
  `);
  const s = createStroke(g);
  floodFill(s, 1, 1, "~");
  assert.equal(rows(g)[1], "#~~~~~#........#");
  assert.equal(rows(g)[4], "#..............#");
});

test("a stroke can be undone, redone, or dropped", () => {
  const g = grid();
  const before = cloneGrid(g);
  const s = createStroke(g);
  paintAt(s, 5, 2, "#", 2);
  paintAt(s, 5, 2, ".", 1); // back to air: not a change in the end
  const changes = strokeChanges(s);
  assert.equal(changes.length, 3);
  for (const [i, from] of changes) g.cells[i] = from;
  assert.deepEqual(g.cells, before.cells);
  for (const [i, , to] of changes) g.cells[i] = to;
  revertStroke(s);
  assert.deepEqual(g.cells, before.cells);
});

test("a level's first problem says which tile it's about", () => {
  const TALL = ROOM.replace("#\n", "#\n" + "  #..................#\n".repeat(6)); // 12 rows: as small as a level can be
  assert.equal(problemOf(grid(TALL)), null);
  assert.deepEqual(problemOf(grid(TALL.replace("#..SSS", "#..SS."))), { text: "Row 11, column 4: a pad is at least 3 tiles wide", at: { c: 3, r: 10 } });
  assert.deepEqual(problemOf(grid(TALL.replace("EEE", "..."))), { text: "Needs one exit pad, has 0", at: null });
  assert.deepEqual(problemOf(grid(TALL, { name: "", fuel: 0 })), { text: "Fuel must be a number from 1 to 300", at: null });
  assert.deepEqual(problemOf(grid()), { text: "The map must be 12 to 150 tiles high, not 6", at: null });
});
