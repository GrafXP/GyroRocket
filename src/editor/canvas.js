import { POINTS, SOLID } from "../sim/outline.js";
import { tileLook, AIR_COLOR, OUTSIDE_COLOR } from "./tiles.js";

// The editor's view of the level: tiles seen straight on, `zoom` pixels across,
// with tile (cx, cy) (in tiles, from the top left) in the middle of the canvas.
// One finger paints, or moves the view when there's no tool to paint with; two
// move it and pinch to zoom. With a mouse, the left button does what a finger
// does, the others drag, and the wheel zooms.

const MAX_ZOOM = 64; // pixels per tile
const GLYPHS_FROM = 6; // pixels per tile, below which tiles are just colours
const GRID_FROM = 14;
const PINCH_GRACE = 250; // ms: a stroke a second finger joins this soon is a pinch, not paint

// Draws the level on `ctx` (already scaled to CSS pixels, `width` × `height`).
// `outline`, if given, is the rock outline (sim/outline.js) to draw the rock by,
// smooth corners and all; `marker` is a tile to ring, `preview` a rectangle.
export function drawEditor(ctx, { grid, view, width, height, colors, outline = null, marker = null, preview = null, hover = null }) {
  const { cx, cy, zoom: s } = view;
  const X = (c) => width / 2 + (c - cx) * s;
  const Y = (r) => height / 2 + (r - cy) * s;
  const [W, H] = [grid.width, grid.height];

  // Outside the map is rock; inside, air to start with.
  ctx.fillStyle = OUTSIDE_COLOR;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = colors.rock;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 1;
  ctx.fillStyle = AIR_COLOR;
  ctx.fillRect(X(0), Y(0), W * s, H * s);

  const c0 = Math.max(0, Math.floor(cx - width / 2 / s));
  const c1 = Math.min(W - 1, Math.floor(cx + width / 2 / s));
  const r0 = Math.max(0, Math.floor(cy - height / 2 / s));
  const r1 = Math.min(H - 1, Math.floor(cy + height / 2 / s));
  const looks = new Map();
  const lookOf = (code) => {
    let look = looks.get(code);
    if (!look) looks.set(code, (look = tileLook(String.fromCharCode(code), grid.things, colors)));
    return look;
  };
  const small = s < GLYPHS_FROM;

  // The rock by its outline: a polygon per cell, over the tile centres.
  if (outline) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(X(0), Y(0), W * s, H * s);
    ctx.clip();
    ctx.fillStyle = colors.rock;
    ctx.beginPath();
    const ccMax = Math.min(outline.cols - 1, c1 + 1);
    for (let jj = Math.max(0, H - 1 - r1); jj <= Math.min(outline.rows - 1, H - r0); jj++) {
      let full = -1; // where a run of cells that are all rock started
      for (let cc = c0; cc <= ccMax + 1; cc++) {
        const k = cc <= ccMax ? outline.cases[jj * outline.cols + cc] : 0;
        if (k === 15) {
          if (full < 0) full = cc;
          continue;
        }
        if (full >= 0) {
          ctx.rect(X(full - 0.5), Y(H - jj - 0.5), (cc - full) * s, s);
          full = -1;
        }
        const poly = SOLID[k] ?? [];
        poly.forEach((p, i) => {
          const px = X(cc - 0.5 + POINTS[p][0]);
          const py = Y(H - (jj - 0.5 + POINTS[p][1]));
          if (i) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
        });
        if (poly.length) ctx.closePath();
      }
    }
    ctx.fill();
    ctx.restore();
  }

  // Each row's runs of tiles with the same base colour, as one rectangle each.
  for (let r = r0; r <= r1; r++) {
    let run = null;
    let from = c0;
    for (let c = c0; c <= c1 + 1; c++) {
      let color = null;
      if (c <= c1) {
        const look = lookOf(grid.cells[r * W + c]);
        color = look.base ?? (small ? (look.dot ?? null) : null);
        if (outline && color === colors.rock) color = null; // drawn by the outline
      }
      if (color === run) continue;
      if (run) {
        ctx.fillStyle = run;
        ctx.fillRect(X(from), Y(r), (c - from) * s + 0.5, s + 0.5);
      }
      [run, from] = [color, c];
    }
  }

  if (!small) {
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) lookOf(grid.cells[r * W + c]).glyph?.(ctx, X(c), Y(r), s);
    }
  }

  if (s >= GRID_FROM) {
    ctx.strokeStyle = "rgb(255 255 255 / 0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = c0; c <= c1 + 1; c++) {
      ctx.moveTo(Math.round(X(c)) + 0.5, Y(r0));
      ctx.lineTo(Math.round(X(c)) + 0.5, Y(r1 + 1));
    }
    for (let r = r0; r <= r1 + 1; r++) {
      ctx.moveTo(X(c0), Math.round(Y(r)) + 0.5);
      ctx.lineTo(X(c1 + 1), Math.round(Y(r)) + 0.5);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = "rgb(255 255 255 / 0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(X(0) - 0.5, Y(0) - 0.5, W * s + 1, H * s + 1);

  if (preview) {
    const [pc0, pc1] = [Math.min(preview.c0, preview.c1), Math.max(preview.c0, preview.c1)];
    const [pr0, pr1] = [Math.min(preview.r0, preview.r1), Math.max(preview.r0, preview.r1)];
    ctx.fillStyle = "rgb(255 179 71 / 0.3)";
    ctx.fillRect(X(pc0), Y(pr0), (pc1 - pc0 + 1) * s, (pr1 - pr0 + 1) * s);
    ctx.strokeStyle = "#ffb347";
    ctx.lineWidth = 2;
    ctx.strokeRect(X(pc0), Y(pr0), (pc1 - pc0 + 1) * s, (pr1 - pr0 + 1) * s);
  }
  if (hover) {
    ctx.strokeStyle = "rgb(255 255 255 / 0.8)";
    ctx.lineWidth = 1;
    ctx.strokeRect(X(hover.c) + 0.5, Y(hover.r) + 0.5, s - 1, s - 1);
  }
  if (marker) {
    ctx.strokeStyle = "#ff4d4f";
    ctx.lineWidth = 3;
    ctx.strokeRect(X(marker.c) - 1.5, Y(marker.r) - 1.5, s + 3, s + 3);
    ctx.beginPath();
    ctx.arc(X(marker.c + 0.5), Y(marker.r + 0.5), Math.max(18, s * 1.6), 0, Math.PI * 2);
    ctx.stroke();
  }
}

// Puts the canvas in `container` and runs it. `scene()` gives what to draw (see
// drawEditor, less the view and size); `paint` gets { down, move, up, cancel } of
// a finger or the mouse painting, in tiles, unless `pans()` says one finger moves
// the view; `onHover` gets the tile under the mouse or finger. `margins` are the
// pixels the toolbars cover, top, right, bottom, left.
export function createEditorCanvas(container, { scene, paint, pans = () => false, onHover, margins = [0, 0, 0, 0], view: saved = null }) {
  const canvas = document.createElement("canvas");
  canvas.className = "ed-canvas";
  container.append(canvas);
  const ctx = canvas.getContext("2d");
  let [width, height] = [0, 0];
  let view = saved;
  let raf = 0;
  let hover = null;

  const draw = () => {
    raf = 0;
    if (!width || !view) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawEditor(ctx, { ...scene(), view, width, height, hover });
  };
  const redraw = () => {
    if (!raf) raf = requestAnimationFrame(draw);
  };

  const size = () => {
    const { grid } = scene();
    return [grid.width, grid.height];
  };
  // The zoom that shows the whole level between the toolbars.
  const fitZoom = () => {
    const [W, H] = size();
    const [top, right, bottom, left] = margins;
    return Math.max(1, Math.min((width - left - right) / W, (height - top - bottom) / H) * 0.95);
  };
  const clamp = (v) => {
    const [W, H] = size();
    const zoom = Math.max(Math.min(fitZoom() * 0.6, 4), Math.min(MAX_ZOOM, v.zoom));
    return { zoom, cx: Math.max(0, Math.min(W, v.cx)), cy: Math.max(0, Math.min(H, v.cy)) };
  };
  const fit = () => {
    const [W, H] = size();
    const [top, right, bottom, left] = margins;
    const zoom = fitZoom();
    view = clamp({ zoom, cx: W / 2 - (left - right) / 2 / zoom, cy: H / 2 - (top - bottom) / 2 / zoom });
    redraw();
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    [width, height] = [rect.width, rect.height];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    if (view) view = clamp(view);
    else fit();
    draw();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  const local = (e) => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const tileAt = ({ x, y }) => ({
    c: Math.floor(view.cx + (x - width / 2) / view.zoom),
    r: Math.floor(view.cy + (y - height / 2) / view.zoom),
  });
  // Zooms to `zoom`, keeping the level's point under screen point `at` where it is.
  const zoomAt = (zoom, at, to = at) => {
    const wx = view.cx + (at.x - width / 2) / view.zoom;
    const wy = view.cy + (at.y - height / 2) / view.zoom;
    const z = clamp({ ...view, zoom }).zoom;
    view = clamp({ zoom: z, cx: wx - (to.x - width / 2) / z, cy: wy - (to.y - height / 2) / z });
    redraw();
  };
  const setHover = (tile) => {
    if (tile?.c === hover?.c && tile?.r === hover?.r) return;
    hover = tile;
    onHover?.(tile);
    redraw();
  };

  // What the pointers are doing: painting (one finger or the left button),
  // dragging the view (another button), pinching (two fingers), or done (a pinch
  // lost a finger: nothing until they're all up).
  const pointers = new Map();
  let mode = null;
  let paintStart = 0;
  let pinch = null;

  const startPinch = () => {
    const [a, b] = [...pointers.values()];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: view.zoom, mid, cx: view.cx, cy: view.cy };
  };

  const onDown = (e) => {
    if (!view) return;
    canvas.setPointerCapture(e.pointerId);
    const at = local(e);
    pointers.set(e.pointerId, at);
    if (pointers.size === 1 && ((e.pointerType === "mouse" && e.button !== 0) || pans())) {
      mode = "drag";
      return;
    }
    if (pointers.size === 1) {
      mode = "paint";
      paintStart = performance.now();
      const tile = tileAt(at);
      setHover(tile);
      paint.down(tile.c, tile.r);
    } else if (pointers.size === 2 && (mode === "paint" || mode === "drag")) {
      if (mode === "paint") {
        if (performance.now() - paintStart < PINCH_GRACE) paint.cancel();
        else paint.up();
      }
      mode = "pinch";
      startPinch();
    }
  };
  const onMove = (e) => {
    if (!view) return;
    const at = local(e);
    if (!pointers.has(e.pointerId)) {
      if (e.pointerType === "mouse") setHover(tileAt(at));
      return;
    }
    const last = pointers.get(e.pointerId);
    pointers.set(e.pointerId, at);
    if (mode === "paint") {
      const tile = tileAt(at);
      setHover(tile);
      paint.move(tile.c, tile.r);
    } else if (mode === "drag") {
      view = clamp({ ...view, cx: view.cx - (at.x - last.x) / view.zoom, cy: view.cy - (at.y - last.y) / view.zoom });
      redraw();
    } else if (mode === "pinch" && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      view = { ...view, zoom: pinch.zoom, cx: pinch.cx, cy: pinch.cy };
      zoomAt((pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.dist, pinch.mid, mid);
    }
  };
  const onUp = (e) => {
    if (!pointers.delete(e.pointerId)) return;
    if (mode === "paint") {
      paint.up();
      mode = null;
    } else if (mode === "drag") mode = null;
    else if (mode === "pinch") mode = pointers.size ? "done" : null;
    else if (mode === "done" && !pointers.size) mode = null;
    if (e.pointerType !== "mouse") setHover(null);
  };
  const onCancel = (e) => {
    if (mode === "paint") paint.cancel();
    pointers.delete(e.pointerId);
    mode = pointers.size ? "done" : null;
  };
  const onWheel = (e) => {
    e.preventDefault();
    if (view) zoomAt(view.zoom * Math.exp(-e.deltaY * 0.0015), local(e));
  };
  const onLeave = (e) => e.pointerType === "mouse" && !pointers.size && setHover(null);
  const noMenu = (e) => e.preventDefault();

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onCancel);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("contextmenu", noMenu);

  return {
    redraw,
    fit,
    get view() {
      return view;
    },
    // Centres the view on tile (c, r), zooming in if it's too far out to see it.
    show(c, r) {
      const zoom = Math.max(view.zoom, 16);
      view = clamp({ zoom, cx: c + 0.5, cy: r + 0.5 });
      redraw();
    },
    dispose() {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.remove();
    },
  };
}
