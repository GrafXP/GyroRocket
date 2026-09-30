// node scripts/levels/check.js 7-1 [ratio]: parses the level, runs Check, flies
// it with the autopilot and prints its legs, the stretches between pads, the
// big-level rules, a suggested tank (`ratio`, 1.3 unless given, times the
// longest burn from one refill to the next) and par, and how dense and quick it
// is along the autopilot's route (reaction.js).
import { levelById } from "../../src/levels/index.js";
import { parseLevel } from "../../src/sim/level.js";
import { checkLevel } from "../../src/sim/check.js";
import { flyLevel } from "../../src/autofly.js";
import { keepsToBigRules, keepsToFloors } from "../../test/worlds.js";
import { watchReaction, summary, describe } from "./reaction.js";

const id = process.argv[2];
const ratio = Number(process.argv[3] ?? 1.3);
const def = levelById(id);
if (!def) throw new Error(`no level ${id}`);
const level = parseLevel(def);
console.log(
  `${id} ${def.name}: ${level.width} × ${level.height}, ${Object.keys(def.things ?? {}).length} things, ${level.crystals.length} crystals, ${level.pads.filter((p) => p.kind === "fuel").length} fuel pads`,
);
const problems = checkLevel(def);
if (problems.length) console.log("Check:", problems.map((p) => `${p.text} (row ${p.at?.r + 1}, column ${p.at?.c + 1})`).join("; "));
const t0 = performance.now();
const watch = watchReaction(level);
const { legs, failed, seconds, at } = flyLevel(def, { each: watch.tick });
console.log(`flown in ${seconds.toFixed(1)} s (${((performance.now() - t0) / 1000).toFixed(1)} s to work out)${failed ? `: FAILED ${failed} (row ${at.r + 1}, column ${at.c + 1})` : ""}`);
let stretch = 0;
let fuel = 0;
let worst = 0;
for (const l of legs) {
  stretch += l.seconds;
  fuel += l.fuel;
  const pad = /→ (fuel pad|exit)$/.test(l.name);
  console.log(
    `  ${l.name.padEnd(24)} ${String(l.metres).padStart(4)} m ${l.seconds.toFixed(1).padStart(5)} s ${l.fuel.toFixed(1).padStart(5)} fuel${l.hull < 100 ? ` hull ${Math.round(l.hull)}` : ""}${pad ? `   | stretch ${stretch.toFixed(1)} s, ${fuel.toFixed(1)} fuel` : ""}`,
  );
  if (pad) {
    worst = Math.max(worst, fuel);
    stretch = 0;
    fuel = 0;
  }
}
if (!failed) {
  console.log(`suggested tank ${Math.ceil(worst * ratio)} (longest ${worst.toFixed(1)}), par ${Math.ceil(seconds / 5) * 5}; the level has tank ${def.fuel}, par ${def.par}`);
  try {
    keepsToBigRules(def, legs);
    keepsToFloors(def);
    console.log("big-level rules: ok");
  } catch (e) {
    console.log("big-level rules:", e.message);
  }
}
console.log(describe(summary([watch.report()])));
