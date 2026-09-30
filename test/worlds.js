import { test } from "node:test";
import assert from "node:assert/strict";
import { WORLDS } from "../src/levels/index.js";
import { parseLevel } from "../src/sim/level.js";
import { checkLevel } from "../src/sim/check.js";
import { validateLevel, MAX_WIDTH, MAX_HEIGHT } from "../src/sim/validate.js";
import { copyOfLevel } from "../src/mylevels.js";
import { levelToJson } from "../src/editor/text.js";
import { flyLevel } from "../scripts/autopilot.js";
import { belowFloors } from "../scripts/levels/reaction.js";

// The checks every level of world `number` must pass, a test apiece: it parses,
// Check finds nothing wrong, and the autopilot flies it within its tank. The big
// levels of part two (PLAN-CONTENT.md) must keep to their rules too. Each world has
// a file of its own that calls this, so node --test flies the worlds side by side.
export function testWorld(number) {
  const world = WORLDS[number - 1];
  for (const def of world.levels) {
    test(`${def.id} ${def.name}: can be flown from start to finish`, () => {
      const level = parseLevel(def);
      assert.ok(def.par > 0, "no par time");
      assert.ok(def.fuel > 0, "no tank size");
      assert.ok(level.crystals.length >= 1 && level.crystals.length <= 3, `${level.crystals.length} crystals`);
      assert.deepEqual(checkLevel(def), []);
      const { failed, legs } = flyLevel(def);
      assert.equal(failed, undefined, failed);
      if (world.part > 1) {
        keepsToBigRules(def, legs);
        keepsToFloors(def);
      }
    });
  }
}

// Part two's floors (PLAN-CONTENT.md, *Harder by reaction*): nothing warns for too
// short a time to react to, or is clear for too short a time to get past.
export function keepsToFloors(def) {
  assert.deepEqual(belowFloors(parseLevel(def)), []);
}

const MAX_BYTES = 48 * 1024; // a shared level's limit (PLAN-EDITOR.md), as JSON
const MAX_STRETCH = 45; // s of the autopilot's flying between pads, at most

// A big level's rules: it opens in the editor as a copy (so it's within the map's
// limits, and valid), it's small enough to share, it has three crystals, and the
// autopilot never flies more than MAX_STRETCH seconds from one pad to the next.
export function keepsToBigRules(def, legs) {
  const copy = copyOfLevel(def);
  validateLevel(copy);
  const level = parseLevel(def);
  assert.ok(level.width <= MAX_WIDTH && level.height <= MAX_HEIGHT, `${level.width} × ${level.height} tiles`);
  const bytes = levelToJson(copy).length;
  assert.ok(bytes <= MAX_BYTES, `${Math.ceil(bytes / 1024)} KB as JSON`);
  assert.equal(level.crystals.length, 3, "crystals");
  let stretch = 0;
  for (const leg of legs) {
    stretch += leg.seconds;
    if (!/→ (fuel pad|exit)$/.test(leg.name)) continue;
    assert.ok(stretch <= MAX_STRETCH, `${leg.name} after ${stretch.toFixed(1)} s since the last pad`);
    stretch = 0;
  }
}
