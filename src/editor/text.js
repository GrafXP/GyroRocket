import { mapRows } from "../sim/level.js";

// Levels as text, to copy out of the editor and paste into it: JSON, or a level
// module like the ones in src/levels (to add a level to the game). Pasted text is
// read with a small parser for plain values, never run as code; validateLevel
// then checks what it says.

const MAX_TEXT = 200_000; // characters
const MAX_DEPTH = 8;
const ORDER = ["format", "name", "look", "fuel", "par", "dark", "sky", "route", "rise", "crumble", "things", "map"];

// A level from pasted text: JSON, or a level module (`export default { … }`).
// Throws if it can't be read.
export function levelFromText(text) {
  if (text.length > MAX_TEXT) throw new Error("that's far too long for a level");
  const lead = text.match(/^(?:\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*(?:export\s+default\s+)?/)[0];
  const reader = createReader(text, lead.length);
  const level = reader.value(0);
  reader.skip();
  if (text[reader.at] === ";") reader.at++;
  reader.skip();
  if (reader.at < text.length) reader.fail("there's more after the level");
  if (Array.isArray(level?.map)) level.map = level.map.join("\n"); // JSON from the editor has its rows in a list
  return level;
}

// The level as JSON, with the map as a list of rows so it reads like a map.
export function levelToJson(def) {
  const { map, ...rest } = ordered(def);
  const json = JSON.stringify({ format: 1, ...rest, map: mapRows(map) }, null, 2);
  // One line per thing, as in a level module.
  return json.replace(/\{\n\s+"kind"[^}]*\}/g, (thing) => thing.replace(/\s*\n\s*/g, " ").replace(/\[ /g, "[").replace(/ \]/g, "]"));
}

// The level as a module for src/levels, laid out like the ones there.
export function levelToModule(def) {
  const { format, look, map, things, ...settings } = ordered(def);
  const lines = [`// ${def.name || "A level"}, made in the level editor.`, "export default {"];
  for (const [key, v] of Object.entries(settings)) lines.push(`  ${key}: ${literal(v)},`);
  if (things && Object.keys(things).length) {
    lines.push("  things: {");
    for (const [label, thing] of Object.entries(things)) lines.push(`    ${key(label)}: ${literal(thing)},`);
    lines.push("  },");
  }
  lines.push("  map: `", ...mapRows(map).map((row) => `    ${row}`), "  `,", "};", "");
  return lines.join("\n");
}

const ordered = (def) => Object.fromEntries(Object.entries(def).sort(([a], [b]) => rank(a) - rank(b)));
const rank = (k) => (ORDER.includes(k) ? ORDER.indexOf(k) : ORDER.length);
const key = (k) => (/^(?:[A-Za-z_$][\w$]*|\d+)$/.test(k) ? k : JSON.stringify(k));

// A value written as JS: objects with bare keys and spaces inside the braces.
function literal(v) {
  if (Array.isArray(v)) return `[${v.map(literal).join(", ")}]`;
  if (v && typeof v === "object") {
    const inner = Object.entries(v).map(([k, x]) => `${key(k)}: ${literal(x)}`);
    return inner.length ? `{ ${inner.join(", ")} }` : "{}";
  }
  return JSON.stringify(v);
}

// Reads plain JS values: objects, arrays, strings (quoted or `template`, without
// ${…}), numbers, true, false and null, with comments and trailing commas.
function createReader(text, at) {
  const r = {
    at,
    fail(what) {
      const line = text.slice(0, r.at).split("\n").length;
      throw new Error(`${what} (line ${line})`);
    },
    skip() {
      for (;;) {
        const m = text.slice(r.at).match(/^(?:\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/)/);
        if (!m || !m[0]) return;
        r.at += m[0].length;
      }
    },
    value(depth) {
      if (depth > MAX_DEPTH) r.fail("that's nested too deeply for a level");
      r.skip();
      const ch = text[r.at];
      if (ch === "{") return r.object(depth);
      if (ch === "[") return r.array(depth);
      if (ch === '"' || ch === "'" || ch === "`") return r.string(ch);
      const m = text.slice(r.at).match(/^(?:-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|true|false|null)(?![\w$])/);
      if (!m) r.fail(ch === undefined ? "the text ends too soon" : `"${text.slice(r.at, r.at + 12)}" isn't a value a level can have`);
      r.at += m[0].length;
      return m[0] === "true" ? true : m[0] === "false" ? false : m[0] === "null" ? null : Number(m[0]);
    },
    object(depth) {
      const obj = {};
      r.at++;
      for (;;) {
        r.skip();
        if (text[r.at] === "}") {
          r.at++;
          return obj;
        }
        let name;
        const q = text[r.at];
        if (q === '"' || q === "'") name = r.string(q);
        else {
          const m = text.slice(r.at).match(/^(?:[A-Za-z_$][\w$]*|\d+)/);
          if (!m) r.fail("expected a name");
          name = m[0];
          r.at += name.length;
        }
        r.skip();
        if (text[r.at] !== ":") r.fail(`expected ":" after ${name}`);
        r.at++;
        // Defined, not assigned, so "__proto__" is just a name (that validateLevel refuses).
        Object.defineProperty(obj, name, { value: r.value(depth + 1), enumerable: true, writable: true, configurable: true });
        if (!r.next("}")) return obj;
      }
    },
    array(depth) {
      const list = [];
      r.at++;
      for (;;) {
        r.skip();
        if (text[r.at] === "]") {
          r.at++;
          return list;
        }
        list.push(r.value(depth + 1));
        if (!r.next("]")) return list;
      }
    },
    // After an item: a comma (true, more may follow), or the closing bracket (false).
    next(close) {
      r.skip();
      if (text[r.at] === ",") {
        r.at++;
        return true;
      }
      if (text[r.at] === close) {
        r.at++;
        return false;
      }
      r.fail(`expected "," or "${close}"`);
    },
    string(quote) {
      let s = "";
      for (r.at++; ; r.at++) {
        const ch = text[r.at];
        if (ch === undefined || (ch === "\n" && quote !== "`")) r.fail("a string doesn't end");
        if (ch === quote) {
          r.at++;
          return s;
        }
        if (quote === "`" && ch === "$" && text[r.at + 1] === "{") r.fail("a level's text can't have ${…} in it");
        if (ch !== "\\") {
          s += ch;
          continue;
        }
        const e = text[++r.at];
        if (e === "u") {
          const hex = text.slice(r.at + 1, r.at + 5);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) r.fail("a bad \\u in a string");
          s += String.fromCharCode(parseInt(hex, 16));
          r.at += 4;
        } else s += { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", 0: "\0" }[e] ?? e;
      }
    },
  };
  return r;
}
