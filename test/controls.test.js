import { test } from "node:test";
import assert from "node:assert/strict";
import { createControls, tiltAngle, steerOf, FULL_TILT } from "../src/controls.js";

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

function setup(t) {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: new EventTarget() });
  const canvas = new EventTarget();
  canvas.setPointerCapture = () => {};
  const controls = createControls(canvas);
  t.after(() => {
    controls.dispose();
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else delete globalThis.window;
  });
  const pointer = (type, id = 1) => {
    const event = new Event(`pointer${type}`, { cancelable: true });
    Object.assign(event, { pointerId: id, pointerType: "touch" });
    canvas.dispatchEvent(event);
    return event;
  };
  return { canvas, controls, pointer };
}

test("rapid taps suppress native gestures while each press still drives thrust", (t) => {
  const { canvas, controls, pointer } = setup(t);
  for (let i = 0; i < 10; i++) {
    assert.equal(pointer("down").defaultPrevented, true);
    const touch = new Event("touchstart", { cancelable: true });
    canvas.dispatchEvent(touch);
    assert.equal(touch.defaultPrevented, true);
    assert.equal(controls.input().thrust, true);
    pointer("up");
    assert.equal(controls.input().thrust, false);
  }
});

test("native menus are blocked and multi-touch releases thrust after the last finger", (t) => {
  const { canvas, controls, pointer } = setup(t);
  pointer("down", 1);
  pointer("down", 2);
  const menu = new Event("contextmenu", { cancelable: true });
  canvas.dispatchEvent(menu);
  assert.equal(menu.defaultPrevented, true);
  pointer("up", 1);
  assert.equal(controls.input().thrust, true);
  pointer("cancel", 2);
  assert.equal(controls.input().thrust, false);
});

test("disposing controls removes native gesture suppression and press handlers", (t) => {
  const { canvas, controls, pointer } = setup(t);
  controls.dispose();
  for (const type of ["touchstart", "contextmenu"]) {
    const event = new Event(type, { cancelable: true });
    canvas.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false);
  }
  assert.equal(pointer("down").defaultPrevented, false);
  assert.equal(controls.input().thrust, false);
});
