import { test } from "node:test";
import assert from "node:assert/strict";
import { tiltAngle, steerOf, FULL_TILT, onPhone, tiltNeedsAsking, requestTiltPermission } from "../src/controls.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test("level reads as no tilt, held flat or upright", () => {
  near(tiltAngle(0, 0), 0);
  near(tiltAngle(90, 0), 0);
  near(tiltAngle(45, 0), 0);
});

test("portrait, held flat: rolling right tilts right", () => {
  near(tiltAngle(0, 20), 20);
  near(tiltAngle(0, -30), -30);
});

test("portrait, upright: turning like a steering wheel tilts the same way", () => {
  // Screen vertical and turned 20° clockwise. Near vertical, beta and gamma can give
  // the same pose two ways (here gamma jumps from 90 to -90); both read the same.
  near(tiltAngle(70, 90), 20);
  near(tiltAngle(110, -90), 20);
  near(tiltAngle(70, -90), -20);
});

test("landscape: rolling towards the screen's right tilts right, whichever way it's turned", () => {
  // Screen turned 90° (the phone's top at the left): its right is the phone's bottom,
  // so lowering it raises the top, which is a bigger beta.
  near(tiltAngle(20, 0, 90), 20);
  // Turned 270° (top at the right): lowering the right edge lowers the top.
  near(tiltAngle(-20, 0, 270), 20);
  near(tiltAngle(-20, 0, -90), 20);
  // Upside-down portrait mirrors plain portrait.
  near(tiltAngle(0, 20, 180), -20);
});

test("steer is tilt over FULL_TILT, capped at ±1", () => {
  assert.equal(steerOf(0), 0);
  near(steerOf(FULL_TILT / 2), 0.5);
  assert.equal(steerOf(90), 1);
  assert.equal(steerOf(-90), -1);
});

// A browser as the game sees it: whether its pointer is a finger, and whether it
// has the question about the motion sensors (an iPhone's), with `answer` to it.
function browser({ coarse, answer }, run) {
  const before = [globalThis.matchMedia, globalThis.DeviceOrientationEvent];
  globalThis.matchMedia = (query) => ({ matches: query === "(pointer: coarse)" && coarse });
  globalThis.DeviceOrientationEvent = answer ? { requestPermission: answer } : undefined;
  return Promise.resolve(run()).finally(() => ([globalThis.matchMedia, globalThis.DeviceOrientationEvent] = before));
}

test("the motion sensors are asked for on a phone that asks, once", async () => {
  let asks = 0;
  const answer = async () => (asks++, "granted");
  // With no browser at all (node), nothing's asked.
  assert.equal(onPhone(), false);
  assert.equal(tiltNeedsAsking(), false);
  // An Android phone has nothing to ask; a desktop with the question has nothing to tilt.
  await browser({ coarse: true }, () => assert.equal(tiltNeedsAsking(), false));
  await browser({ coarse: false, answer }, () => assert.equal(tiltNeedsAsking(), false));
  await browser({ coarse: true, answer }, async () => {
    assert.equal(tiltNeedsAsking(), true);
    assert.equal(await requestTiltPermission(), true);
    assert.equal(asks, 1);
    assert.equal(tiltNeedsAsking(), false);
  });
});

test("a refusal, or a browser that won't ask, reads as no", async () => {
  await browser({ coarse: true, answer: async () => "denied" }, async () => assert.equal(await requestTiltPermission(), false));
  await browser({ coarse: true, answer: async () => Promise.reject(new Error("no tap")) }, async () => assert.equal(await requestTiltPermission(), false));
  await browser({ coarse: true }, async () => assert.equal(await requestTiltPermission(), true));
});
