// Flies every level (or the ones named: npm run fly -- 1-3 1-6) with the autopilot
// and reports how long each leg took and how much fuel it burned.
import { LEVELS } from "../src/levels/index.js";
import { flyLevel } from "./autopilot.js";

const only = process.argv.slice(2);
for (const def of LEVELS.filter((l) => !only.length || only.includes(l.id))) {
  const { legs, failed, suggested } = flyLevel(def);
  const total = legs.reduce((s, l) => s + l.seconds, 0);
  console.log(`${def.id} ${def.name} (tank ${def.fuel} s, par ${def.par} s)${failed ? `: FAILED, ${failed}` : `: ${total.toFixed(1)} s`}`);
  if (suggested) console.log(`  Suggested tank ${suggested.fuel} s, par ${suggested.par} s`);
  for (const l of legs) {
    console.log(
      `  ${l.name.padEnd(16)} ${String(l.metres).padStart(4)} m  ${l.seconds.toFixed(1).padStart(5)} s  ${l.fuel.toFixed(1).padStart(5)} s of fuel${l.hull < 100 ? `, hull ${Math.round(l.hull)}` : ""}`,
    );
  }
}
