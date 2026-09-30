import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

// Hash the BUILT script text; Vite may change whitespace. A hash generated from
// source would prevent the early theme script from running in production.
const html = readFileSync("dist/index.html", "utf8");
const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
  .filter((match) => !/\bsrc\s*=/.test(match[1])).map((match) => match[2]);
if (inline.length !== 1) throw new Error("Expected exactly one inline theme script.");
const hash = createHash("sha256").update(inline[0]).digest("base64");
writeFileSync("dist/.htaccess", readFileSync("server/public/.htaccess", "utf8").replace("__THEME_HASH__", `'sha256-${hash}'`));
