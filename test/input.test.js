import { test } from "node:test";
import assert from "node:assert/strict";
import { inputCode, readInput, STEER_STEPS } from "../src/sim/input.js";

test("an input is two bytes, and reads back as it was, steer in 127ths", () => {
  for (const input of [
    { steer: 0, slow: false, thrust: false, restart: false },
    { steer: 1, slow: true, thrust: true, restart: false },
    { steer: -1, slow: false, thrust: true, restart: true },
    { steer: null, slow: false, thrust: true, restart: false },
    { steer: 5 / STEER_STEPS, slow: false, thrust: false, restart: false },
  ]) {
    const code = inputCode(input);
    assert.ok(Number.isInteger(code) && code >= 0 && code < 65536, `${code}`);
    assert.deepEqual(readInput(code), input);
  }
});

test("steer is rounded to the nearest 127th, and capped", () => {
  assert.equal(readInput(inputCode({ steer: 0.5 })).steer, 64 / STEER_STEPS);
  assert.equal(readInput(inputCode({ steer: -0.001 })).steer, 0);
  assert.equal(readInput(inputCode({ steer: 3 })).steer, 1);
  assert.equal(readInput(inputCode({ steer: -3 })).steer, -1);
  assert.equal(readInput(inputCode({ steer: NaN })).steer, 0);
  assert.deepEqual(readInput(inputCode()), { steer: 0, slow: false, thrust: false, restart: false });
});

test("any code reads as some input, steer within ±1", () => {
  for (let code = 0; code < 65536; code += 7) {
    const { steer } = readInput(code);
    assert.ok(steer === null || (steer >= -1 && steer <= 1), `${code}: ${steer}`);
  }
});
