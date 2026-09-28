import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LEVELS } from "../src/levels/index.js";
import { levelFromText, levelToJson, levelToModule } from "../src/editor/text.js";
import { mapRows } from "../src/sim/level.js";

const builtIn = ({ id, world, colors, ...level }) => level;
const source = (id) => readFileSync(new URL(`../src/levels/${id}.js`, import.meta.url), "utf8");
const sameLevel = (a, b, what) => assert.deepEqual({ ...a, map: mapRows(a.map) }, { ...b, map: mapRows(b.map) }, what);

test("every level module in src/levels reads as the level it exports", () => {
  for (const def of LEVELS) sameLevel(levelFromText(source(def.id)), builtIn(def), def.id);
});

test("levels go out as JSON and as a module, and come back the same", () => {
  for (const def of LEVELS.filter((l) => ["1-1", "2-5", "4-3", "5-7", "6-8"].includes(l.id))) {
    const level = { ...builtIn(def), look: 3 };
    const json = levelToJson(level);
    assert.deepEqual(levelFromText(json), { format: 1, ...level, map: mapRows(level.map).join("\n") }, def.id);
    assert.deepEqual(JSON.parse(json).map, mapRows(level.map));
    const { look, ...rest } = level;
    sameLevel(levelFromText(levelToModule(level)), rest, def.id);
  }
});

test("a level module is laid out like the ones in src/levels", () => {
  const text = levelToModule({ name: "Two gates", fuel: 12, things: { 1: { kind: "switch", opens: 2 }, a: { kind: "mover", to: [0, -3] } }, map: "####\n#..#\n####" });
  assert.equal(
    text,
    [
      "// Two gates, made in the level editor.",
      "export default {",
      '  name: "Two gates",',
      "  fuel: 12,",
      "  things: {",
      '    1: { kind: "switch", opens: 2 },',
      '    a: { kind: "mover", to: [0, -3] },',
      "  },",
      "  map: `",
      "    ####",
      "    #..#",
      "    ####",
      "  `,",
      "};",
      "",
    ].join("\n"),
  );
});

test("pasted text is read, never run", () => {
  assert.throws(() => levelFromText("export default { map: `${alert(1)}` }"), /can't have \$\{…\} in it/);
  assert.throws(() => levelFromText("export default { map: foo() }"), /"foo\(\) }" isn't a value/);
  assert.throws(() => levelFromText("{ a: 1 } alert(1)"), /there's more after the level/);
  assert.throws(() => levelFromText("{ a: 1"), /expected "," or "}"/);
  assert.throws(() => levelFromText('{ "a": "line\nbreak" }'), /a string doesn't end/);
  assert.throws(() => levelFromText("[".repeat(20)), /nested too deeply/);
  const tricky = levelFromText('{ "__proto__": { "polluted": true }, name: "x", }');
  assert.equal({}.polluted, undefined);
  assert.deepEqual(Object.keys(tricky), ["__proto__", "name"]);
  assert.deepEqual(levelFromText("/* hi */ export default { a: 'it\\'s', b: [1, -2.5e1,], c: null, }; // bye"), { a: "it's", b: [1, -25], c: null });
});
