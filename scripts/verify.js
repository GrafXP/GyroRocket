// Plays recorded runs back in node and checks each lands on the exit on the tick
// it did, with its time, crystals and restarts: npm run verify -- run.json …, or
// with no files, every run in runs/ (where the dev server puts the runs saved on
// the phone with ?dev). "-" reads a run from stdin. A run is a replay (replay.js)
// with the level's `id`, and for my levels the level itself as `def`; a built-in
// level is found by its id or its hash.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { LEVELS, EXTRAS, levelById } from "../src/levels/index.js";
import { levelHash } from "../src/hash.js";
import { checkReplay } from "../src/replay.js";

const ALL = [...LEVELS, ...EXTRAS];
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const byHash = (hash) => ALL.find((l) => levelHash(l) === hash) ?? null;

let files = process.argv.slice(2);
if (!files.length) {
  files = existsSync("runs") ? readdirSync("runs").filter((f) => f.endsWith(".json")).sort().map((f) => `runs/${f}`) : [];
  if (!files.length) console.log("No runs to check: name some, or save them on the phone with ?dev (they land in runs/).");
}

let failed = 0;
for (const file of files) {
  let run;
  try {
    run = JSON.parse(readFileSync(file === "-" ? 0 : file, "utf8"));
  } catch (e) {
    console.log(`${file}: can't read it (${e.message})`);
    failed++;
    continue;
  }
  const def = run.def ?? (levelById(run.id ?? "") && levelHash(levelById(run.id)) === run.level ? levelById(run.id) : byHash(run.level));
  const name = def ? `${def.id?.startsWith("my:") ? "" : `${def.id} `}${def.name ?? "level"}` : `level ${run.id ?? "?"}`;
  if (!def) {
    console.log(`${file}: ${name}: FAILED, no level here has its hash (${run.level})`);
    failed++;
    continue;
  }
  const result = await checkReplay(def, run);
  const how = result.finished
    ? `lands on the exit on tick ${result.tick}, in ${result.time.toFixed(2)} s, with ${plural(result.crystals, "crystal")} and ${plural(result.restarts, "restart")}`
    : "doesn't finish";
  const flags = [run.assisted && "autopilot", run.cheated && "cheats"].filter(Boolean).join(", ");
  console.log(`${file}: ${name}${flags ? ` (${flags})` : ""}: ${result.ok ? `ok, ${how}` : `FAILED, ${result.why}`}`);
  if (!result.ok) failed++;
}
process.exitCode = failed ? 1 : 0;
