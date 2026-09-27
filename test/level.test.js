import { test } from "node:test";
import assert from "node:assert/strict";
import { isSolid, parseLevel, TILE } from "../src/sim/level.js";
import { level } from "./helpers.js";

test("a map parses into rock and air, row 0 at the bottom", () => {
  const l = level(`
    ##########
    #........#
    #........#
    #.SSS.EEE#
    ##########
  `);
  assert.equal(l.width, 10);
  assert.equal(l.height, 5);
  assert.equal(isSolid(l, 0, 0), true);
  assert.equal(isSolid(l, 1, 1), false);
  assert.equal(isSolid(l, 5, 4), true);
  // Outside the map is rock.
  assert.equal(isSolid(l, -1, 2), true);
  assert.equal(isSolid(l, 3, 99), true);
});

test("pads know where their flat floor is", () => {
  const l = level(`
    ##########
    #........#
    #........#
    #.SSS.EEE#
    ##########
  `);
  // The floor carries on past the start pad both ways: flat to its ends.
  assert.deepEqual(l.start, { kind: "start", c0: 2, c1: 4, j: 1, x0: 2 * TILE, x1: 5 * TILE, y: TILE });
  // The exit pad ends at a wall, whose corner cuts half a tile off.
  assert.equal(l.exit.x0, 6 * TILE);
  assert.equal(l.exit.x1, 8.5 * TILE);
});

test("any number of fuel pads, and a tank size", () => {
  const l = parseLevel({
    name: "fuel",
    fuel: 9,
    map: `
      #...................#
      #...................#
      #.SSS.FFF.FFF.EEE...#
      #####################
    `,
  });
  assert.equal(l.fuel, 9);
  assert.deepEqual(
    l.pads.filter((p) => p.kind === "fuel").map((p) => p.c0),
    [6, 10],
  );
  assert.throws(() => parseLevel({ name: "x", fuel: 0, map: "#.SSS.EEE#" }), /fuel must be a number of seconds/);
});

test("short rows are filled with rock and indentation is ignored", () => {
  const l = level(`
      #.........
      #.........
      #.SSS.EEE.#
      ###########
  `);
  assert.equal(l.width, 11);
  assert.equal(isSolid(l, 10, 3), true);
  assert.equal(isSolid(l, 9, 3), false);
});

test("bad maps are refused, saying where", () => {
  const bad = (map, message) => assert.throws(() => level(map), message);
  bad(`#.SSS.EEE.?#\n############`, /row 1, column 11: unknown tile "\?"/);
  bad(`#...\n#.SS.EEE#\n#########`, /at least 3 tiles wide/);
  bad(`#...\n#SSS.EEE#\n#...######\n##########`, /must stand on rock/);
  bad(`#...##.....\n#.SSS.EEE.#\n###########`, /3 tiles of air above/);
  bad(`#.......\n#.......\n#.SSS...\n########`, /needs one exit pad, has 0/);
  bad(`#...............\n#...............\n#.SSS.SSS.EEE...\n################`, /needs one start pad, has 2/);
});
