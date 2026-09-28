import { test } from "node:test";
import assert from "node:assert/strict";
import { newLevel } from "../src/mylevels.js";
import { gridFromLevel } from "../src/editor/grid.js";
import { createEditorCanvas, drawEditor } from "../src/editor/canvas.js";
import { lookColors } from "../src/editor/tiles.js";

const context = () =>
  new Proxy(
    {},
    {
      get: (o, k) => o[k] ?? (() => {}),
      set: (o, k, v) => {
        o[k] = v;
        return true;
      },
    },
  );
const scene = () => ({ grid: gridFromLevel(newLevel()), colors: lookColors(1) });

test("canvas draws reach and all problem markers together", () => {
  let boxes = 0;
  const ctx = context();
  ctx.strokeRect = () => boxes++;
  drawEditor(ctx, {
    ...scene(),
    view: { cx: 24, cy: 12, zoom: 10 },
    width: 480,
    height: 300,
    marker: { c: 2, r: 3 },
    markers: [{ c: 10, r: 12 }],
    reach: [{ type: "capsule", x: 3, y: 4, x1: 8, y1: 4, radius: 2, color: "#fff" }],
  });
  assert.equal(boxes, 3); // border and both markers
});

function setup(t, options = {}) {
  class Canvas extends EventTarget {
    getContext() {
      return context();
    }
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 480, height: 300 };
    }
    setPointerCapture() {}
    remove() {}
  }
  const canvas = new Canvas();
  const globals = {
    document: { createElement: () => canvas },
    window: { devicePixelRatio: 1 },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    ResizeObserver: class {
      constructor(fn) {
        this.fn = fn;
      }
      observe() {
        this.fn();
      }
      disconnect() {}
    },
  };
  const previous = Object.fromEntries(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const calls = [];
  const editor = createEditorCanvas(
    { append() {} },
    {
      scene,
      canInspect: () => true,
      onInspect: () => calls.push("inspect"),
      ...options,
      paint: { ...Object.fromEntries(["down", "move", "up", "cancel"].map((name) => [name, () => calls.push(name)])), ...options.paint },
    },
  );
  t.after(() => {
    editor.dispose();
    for (const [key, old] of Object.entries(previous)) {
      if (old) Object.defineProperty(globalThis, key, old);
      else delete globalThis[key];
    }
  });
  const pointer = (type, id = 1, x = 150, y = 100) => {
    const event = new Event(`pointer${type}`);
    Object.assign(event, { pointerId: id, clientX: x, clientY: y, pointerType: "touch", button: 0 });
    canvas.dispatchEvent(event);
  };
  return { calls, pointer, editor };
}

test("long press reverts the stroke before inspecting, and release adds no paint", (t) => {
  const { calls, pointer } = setup(t);
  pointer("down");
  t.mock.timers.tick(550);
  pointer("up");
  assert.deepEqual(calls, ["down", "cancel", "inspect"]);
});

test("a second finger cancels a quick stroke and its pending inspection", (t) => {
  const { calls, pointer } = setup(t);
  pointer("down");
  pointer("down", 2, 200);
  t.mock.timers.tick(600);
  pointer("up");
  pointer("up", 2);
  assert.deepEqual(calls, ["down", "cancel"]);
});

test("moving, cancelling and disposing clear the pending long press", (t) => {
  const { calls, pointer, editor } = setup(t);
  pointer("down");
  pointer("move", 1, 170);
  t.mock.timers.tick(600);
  pointer("up");
  assert.deepEqual(calls, ["down", "move", "up"]);
  pointer("down");
  pointer("cancel");
  t.mock.timers.tick(600);
  assert.equal(calls.at(-1), "cancel");
  pointer("down");
  editor.dispose();
  t.mock.timers.tick(600);
  assert.ok(!calls.includes("inspect"));
});

test("Move chooses object dragging or background panning from the touched tile", (t) => {
  const touched = [];
  const { calls, pointer, editor } = setup(t, {
    canInspect: () => false,
    pans: (c, r) => {
      touched.push([c, r]);
      return c > 15;
    },
  });
  pointer("down", 1, 150);
  pointer("move", 1, 170);
  pointer("up");
  assert.deepEqual(calls, ["down", "move", "up"]);
  const before = editor.view;
  pointer("down", 1, 300);
  pointer("move", 1, 320);
  pointer("up");
  assert.notEqual(editor.view.cx, before.cx);
  assert.deepEqual(calls, ["down", "move", "up"]);
  assert.ok(touched[0][0] < touched[1][0]);
});

test("adding a second finger cancels an object drag even after the paint grace period", (t) => {
  let now = 0;
  t.mock.method(performance, "now", () => now);
  const { calls, pointer } = setup(t, { canInspect: () => false, paint: { cancelOnPinch: () => true } });
  pointer("down");
  pointer("move", 1, 170);
  now = 1000;
  pointer("down", 2, 250);
  pointer("up");
  pointer("up", 2);
  assert.deepEqual(calls, ["down", "move", "cancel"]);
});
