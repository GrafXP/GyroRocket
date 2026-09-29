import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { sin, cos, hypot } from "../src/sim/fmath.js";
import { random } from "./helpers.js";

// The gap between x and the next double up, from zero.
function ulp(x) {
  const bits = new BigInt64Array(new Float64Array([Math.abs(x)]).buffer);
  bits[0]++;
  return new Float64Array(bits.buffer)[0] - Math.abs(x);
}

test("sin and cos are within a unit in the last place of Math's", () => {
  const rand = random(7);
  for (let i = 0; i < 100000; i++) {
    const x = (rand() * 2 - 1) * [1.2, 10, 2000][i % 3];
    assert.ok(Math.abs(sin(x) - Math.sin(x)) <= ulp(Math.sin(x)), `sin(${x})`);
    assert.ok(Math.abs(cos(x) - Math.cos(x)) <= ulp(Math.cos(x)), `cos(${x})`);
  }
  assert.equal(sin(0), 0);
  assert.equal(cos(0), 1);
  assert.equal(sin(Math.PI / 2), 1);
  assert.ok(Number.isNaN(sin(Infinity)) && Number.isNaN(cos(NaN)));
});

test("hypot is the length", () => {
  assert.equal(hypot(3, 4), 5);
  assert.equal(hypot(0, 0), 0);
  assert.equal(hypot(-5, 12), 13);
});

// Math functions every engine does exactly the same way (the rest, like
// Math.sin, are left to each engine, and replays would drift).
const EXACT = new Set(["abs", "ceil", "floor", "round", "trunc", "sign", "min", "max", "sqrt", "fround", "imul", "clz32", "PI"]);

test("the sim only uses maths that's the same everywhere", () => {
  const dir = new URL("../src/sim/", import.meta.url);
  const files = readdirSync(dir, { recursive: true }).filter((f) => f.endsWith(".js"));
  assert.ok(files.length > 10);
  for (const file of files) {
    const code = readFileSync(new URL(file, dir), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    for (const [, name] of code.matchAll(/Math\.(\w+)/g)) assert.ok(EXACT.has(name), `Math.${name} in src/sim/${file}: use fmath.js`);
    assert.ok(!code.includes("**"), `** in src/sim/${file}: multiply`);
  }
});
