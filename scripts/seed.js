import { mkdirSync, writeFileSync } from "node:fs";
import { LEVELS } from "../src/levels/index.js";
import { levelHash } from "../src/hash.js";
import { SIM_VERSION } from "../src/sim/world.js";

// Generated locally; PHP never needs the JS sim or a node installation.
mkdirSync("server/data", { recursive: true });
writeFileSync("server/data/version.json", `${JSON.stringify({ api: 1, sim: SIM_VERSION }, null, 2)}\n`);
writeFileSync("server/data/builtin.json", `${JSON.stringify(
  LEVELS.map((level) => ({ id: level.id, hash: levelHash(level) })), null, 2,
)}\n`);
