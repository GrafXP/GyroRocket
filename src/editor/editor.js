import { html, esc, go, saveFile, formatTime } from "../ui/dom.js";
import { icon } from "../ui/kit.js";
import { loadLevel, saveLevel, deleteLevel } from "../mylevels.js";
import { finishOf } from "../runs.js";
import { buildOutline, setTile as setOutlineTile } from "../sim/outline.js";
import { MIN_WIDTH, MAX_WIDTH, MIN_HEIGHT, MAX_HEIGHT } from "../sim/validate.js";
import { gridFromLevel, levelFromGrid, cloneGrid, resizeGrid, solidOf, charAt, inside, problemOf } from "./grid.js";
import { createStroke, paintAt, paintLine, paintRect, floodFill, strokeChanges, revertStroke } from "./tools.js";
import { createEditorCanvas } from "./canvas.js";
import { PALETTE, KIND_NAMES, tileName, lookColors, drawTile } from "./tiles.js";
import { levelToJson, levelToModule } from "./text.js";

import { addThing, customizeTile, thingDefaults, thingShapes } from "./things.js";
import { openThingSheet, openSettingsSheet } from "./sheets.js";
import { reachOf } from "./reach.js";
import { movableAt, moveObject } from "./move.js";

const UNDO_LIMIT = 200;
const SAVE_AFTER = 400; // ms after the last change
const CHECK_AFTER = 150;
const SIZES = [1, 2, 3, 5]; // the brush, in tiles across
const TOOLS = [
  ["pan", "Move things or the view", "h"],
  ["brush", "Brush", "b"],
  ["rect", "Rectangle", "r"],
  ["fill", "Fill", "f"],
  ["erase", "Eraser", "e"],
  ["pick", "Pick a tile", "i"],
  ["inspect", "Inspect a thing", "o"],
];
const MARGINS = [64, 12, 76, 12]; // pixels the toolbars cover: top, right, bottom, left
const SIDES = ["top", "bottom", "left", "right"];

// Each level's editing, kept while the app runs, so that flying the level and
// coming back finds it as it was: undo, the view, the tool and tile.
const sessions = new Map();

function sessionFor(id, record) {
  const saved = JSON.stringify(record.level);
  const old = sessions.get(id);
  if (old?.saved === saved) return old;
  const session = { grid: gridFromLevel(record.level), undo: [], redo: [], view: null, tool: "pan", tile: "#", size: 1, outline: false, reach: true, pendingKind: null, saved };
  sessions.set(id, session);
  return session;
}

// The editor page for my level `id`: the level on a canvas you paint on, the
// tools and the tile palette, undo and redo, the level's first problem, and Fly.
// Every change is saved as you go.
export function editor(el, id) {
  const record = loadLevel(id);
  if (!record) {
    html(el, `<h1>No such level</h1><p>It may have been deleted.</p><p><a href="/editor" data-link>My levels</a></p>`);
    return null;
  }
  document.body.classList.add("playing");
  const session = sessionFor(id, record);
  const $ = html(
    el,
    `<div class="editor" id="editor">
      <div class="ed-view" id="view"></div>
      <div class="ed-bar ed-top">
        <a class="icon-btn" href="/editor" data-link aria-label="My levels">${icon("back")}</a>
        <input class="ed-name" id="name" maxlength="40" aria-label="Level name" spellcheck="false" autocomplete="off">
        <button class="icon-btn" id="undo" aria-label="Undo">${icon("undo")}</button>
        <button class="icon-btn" id="redo" aria-label="Redo">${icon("redo")}</button>
        <button class="icon-btn" id="menu-btn" aria-label="Menu">${icon("menu")}</button>
        <a class="button ed-fly" id="fly" href="/play/my/${id}" data-link>Fly</a>
      </div>
      <div class="ed-problem" id="problem" role="status" hidden>
        <span id="problem-text"></span><button id="problem-show">Show</button>
      </div>
      <div class="ed-note" id="where"></div>
      <div class="ed-toast" id="toast" role="status" hidden></div>
      <div class="ed-bar ed-tools" role="toolbar" aria-label="Tools">
        <button class="ed-swatch" id="swatch"><canvas></canvas></button>
        ${TOOLS.map(([tool, label]) => `<button class="icon-btn" data-tool="${tool}" aria-label="${label}" aria-pressed="false">${icon(tool)}</button>`).join("")}
        <button class="icon-btn ed-size" id="size"></button>
      </div>

      <div class="overlay ed-palette" id="palette" hidden><div class="ed-sheet" id="palette-list"></div></div>

      <div class="ed-panel" id="resize" hidden>
        <b id="resize-size"></b>
        <div class="ed-resize">
          ${SIDES.map(
            (side) =>
              `<span>${side[0].toUpperCase() + side.slice(1)}</span>${[-5, -1, 1, 5]
                .map((n) => `<button data-side="${side}" data-n="${n}">${n > 0 ? "+" : "−"}${Math.abs(n)}</button>`)
                .join("")}`,
          ).join("")}
        </div>
        <button class="big" id="resize-done">Done</button>
      </div>

      <div class="overlay menu" id="menu" hidden>
        <section>
          <h2>Level</h2>
          <p class="hint" id="m-finish"></p>
          <button id="m-settings">Settings…</button>
          <button id="m-check">Check</button>
          <button id="m-auto">Autopilot</button>
          <button id="m-reach" aria-pressed="true"></button>
          <button id="m-resize">Resize…</button>
          <button id="m-outline" aria-pressed="false"></button>
          <button id="m-fit">Show the whole level</button>
          <button id="m-export">Export…</button>
          <button id="m-delete">Delete this level</button>
        </section>
        <section>
          <p class="hint">With Move (the arrows), drag a thing to reposition it or drag the background to move the view. Tap the tool that's on to return to Move. Other tools paint with one finger. Two fingers always move the view and pinch to zoom. With a mouse, drag with the right button and zoom with the wheel; Ctrl+Z undoes. Inspect (O) or hold a thing to change its settings.</p>
          <button class="big" id="m-close">Back to the level</button>
        </section>
      </div>

      <div class="overlay ed-palette" id="settings-sheet" hidden></div>
      <div class="overlay ed-palette" id="report" hidden><div class="ed-sheet ed-report">
        <h2 id="report-title"></h2><div id="report-body" role="status"></div>
        <div class="buttons"><button id="report-close">Cancel</button><button id="report-apply" hidden>Use suggested tank and par</button></div>
      </div></div>
      <div class="ed-panel ed-path" id="path-panel" hidden><span>Drag the arrow tip to set the travel. Two fingers move the view.</span><div class="buttons"><button id="path-cancel">Cancel</button><button id="path-done">Done</button></div></div>

      <div class="overlay menu" id="export" hidden>
        <section>
          <h2>Export</h2>
          <div class="segmented" id="export-kind" role="group" aria-label="Format">
            <button data-kind="json" aria-pressed="true">JSON</button><button data-kind="module" aria-pressed="false">Level module</button>
          </div>
          <textarea class="ed-text" id="export-text" readonly rows="8" spellcheck="false"></textarea>
          <div class="buttons"><button id="export-copy">Copy</button><button id="export-save">Save as a file</button></div>
          <button class="big" id="export-close">Done</button>
        </section>
      </div>
    </div>`,
  );

  let outline = null;
  let outlineDirty = true;
  let problem = null;
  let preview = null; // the rectangle being dragged out
  let stroke = null;
  let last = null; // the tile the stroke last painted
  let saveTimer = 0;
  let checkTimer = 0;
  let toastTimer = 0;
  let deleted = false;
  let strokeBefore = null;
  let strokeKind = null;
  let oldTile = null;
  let reach = [];
  let reachDirty = true;
  let markers = [];
  let path = null;
  let pathDrag = false;
  let dragging = null;
  let worker = null;
  let workerTimer = 0;
  let reportResult = null;

  const canvas = createEditorCanvas($("#view"), {
    view: session.view,
    margins: MARGINS,
    scene() {
      const { grid } = session;
      if (session.outline && outlineDirty) {
        // Only the tiles that changed, unless the level's size did.
        const solid = solidOf(grid);
        const same = outline && outline.level.width === grid.width && outline.level.height === grid.height && outline.level.sky === grid.settings.sky;
        if (!same) outline = buildOutline({ width: grid.width, height: grid.height, solid, sky: grid.settings.sky });
        else for (let i = 0; i < solid.length; i++) if (solid[i] !== outline.solid[i]) setOutlineTile(outline, i % grid.width, Math.floor(i / grid.width), solid[i] === 1);
        outlineDirty = false;
      }
      if (session.reach && reachDirty) {
        reach = reachOf(grid);
        reachDirty = false;
      }
      const overlays = session.reach ? [...reach] : [];
      if (path) overlays.push({ type: "arrow", x: path.c, y: path.r, x1: path.c + path.to[0], y1: path.r - path.to[1], color: "#ffffff", handle: true });
      const movingPreview = dragging
        ? {
            c0: dragging.object.c0 + dragging.dc,
            c1: dragging.object.c1 + dragging.dc,
            r0: dragging.object.r0 + dragging.dr,
            r1: dragging.object.r1 + dragging.dr,
            color: dragging.problem ? "#ff4d4f" : "#ffb347",
          }
        : preview;
      return {
        reach: overlays,
        markers,
        grid,
        colors: lookColors(grid.settings.look),
        outline: session.outline ? outline : null,
        marker: problem?.at ?? null,
        preview: movingPreview,
      };
    },
    paint: { down, move, up, cancel, cancelOnPinch: () => !!dragging },
    pans: (c, r) => !path && session.tool === "pan" && !movableAt(session.grid, c, r),
    canInspect: (c, r) =>
      session.tool !== "inspect" &&
      !path &&
      !session.pendingKind &&
      inside(session.grid, c, r) &&
      !!(session.grid.things[charAt(session.grid, c, r)] || "><^v!".includes(charAt(session.grid, c, r))),
    onInspect: inspect,
    onHover: showWhere,
  });

  // Painting, a stroke at a time.
  const ink = () => (session.tool === "erase" ? "." : session.tile);
  const clampTile = ({ c, r }) => ({ c: Math.max(0, Math.min(session.grid.width - 1, c)), r: Math.max(0, Math.min(session.grid.height - 1, r)) });
  function down(c, r) {
    const { grid, tool } = session;
    if (path) {
      const distance = Math.hypot(c + 0.5 - path.c - path.to[0], r + 0.5 - path.r + path.to[1]);
      pathDrag = distance <= Math.max(1, 24 / (canvas.view?.zoom ?? 16));
      if (pathDrag) path.from = [...path.to];
      return;
    }
    if (tool === "pan") {
      const object = movableAt(grid, c, r);
      if (object) {
        dragging = { object, before: cloneGrid(grid), c, r, dc: 0, dr: 0, problem: null };
        canvas.redraw();
      }
      return;
    }
    if (tool === "inspect") {
      inspect(c, r);
      return;
    }
    if (tool === "pick") {
      if (inside(grid, c, r)) setTile(charAt(grid, c, r), "brush");
      return;
    }
    if (!inside(grid, c, r)) return;
    if (session.pendingKind && tool !== "erase") {
      strokeBefore = cloneGrid(grid);
      strokeKind = session.pendingKind;
      oldTile = session.tile;
      try {
        session.tile = addThing(grid, session.pendingKind);
      } catch (e) {
        strokeBefore = null;
        toast(e.message);
        return;
      }
      session.pendingKind = null;
      drawSwatch();
    }
    stroke = createStroke(grid);
    last = { c, r };
    if (tool === "rect") {
      const at = clampTile(last);
      preview = { c0: at.c, r0: at.r, c1: at.c, r1: at.r };
    } else if (tool === "fill") floodFill(stroke, c, r, ink());
    else paintAt(stroke, c, r, ink(), session.size);
    tilesChanged();
  }
  function move(c, r) {
    if (dragging) {
      const result = moveObject(dragging.before, dragging.object, c - dragging.c, r - dragging.r);
      if (result.dc === dragging.dc && result.dr === dragging.dr) return;
      Object.assign(dragging, { dc: result.dc, dr: result.dr, problem: result.problem });
      session.grid = result.grid;
      tilesChanged();
      return;
    }
    if (path) {
      if (pathDrag) {
        path.to = [Math.max(-200, Math.min(200, Math.round(c + 0.5 - path.c))), Math.max(-200, Math.min(200, Math.round(path.r - r - 0.5)))];
        canvas.redraw();
      }
      return;
    }
    if (!stroke || (c === last.c && r === last.r)) return;
    if (session.tool === "rect") {
      const at = clampTile({ c, r });
      preview = { ...preview, c1: at.c, r1: at.r };
    } else if (session.tool !== "fill") paintLine(stroke, last.c, last.r, c, r, ink(), session.size);
    last = { c, r };
    tilesChanged();
  }
  function up() {
    if (dragging) {
      const { before, dc, dr, problem } = dragging;
      dragging = null;
      if (!problem && (dc || dr)) commit({ before, after: cloneGrid(session.grid) });
      else {
        session.grid = before;
        tilesChanged();
        check();
        if (problem) toast(problem);
      }
      return;
    }
    if (path) {
      pathDrag = false;
      return;
    }
    if (!stroke) return;
    if (preview) paintRect(stroke, preview.c0, preview.r0, preview.c1, preview.r1, ink());
    preview = null;
    const tiles = strokeChanges(stroke);
    stroke = null;
    if (strokeBefore) {
      const before = strokeBefore;
      strokeBefore = null;
      commit({ before, after: cloneGrid(session.grid) });
      toast("Placed. Move drags it; Inspect or hold changes its settings");
    } else if (tiles.length) commit({ tiles });
    else canvas.redraw();
  }
  function cancel() {
    if (dragging) {
      session.grid = dragging.before;
      dragging = null;
      tilesChanged();
      check();
      return;
    }
    if (path) {
      if (pathDrag) path.to = path.from;
      pathDrag = false;
      canvas.redraw();
      return;
    }
    if (!stroke) return;
    revertStroke(stroke);
    if (strokeBefore) {
      session.grid = strokeBefore;
      session.pendingKind = strokeKind;
      session.tile = oldTile;
      strokeBefore = null;
      drawSwatch();
    }
    stroke = null;
    preview = null;
    tilesChanged();
  }
  function tilesChanged() {
    outlineDirty = true;
    reachDirty = true;
    canvas.redraw();
  }

  // Whole-grid edits keep independent snapshots, including thing definitions.
  function mutate(edit, name = false) {
    const before = cloneGrid(session.grid);
    const after = cloneGrid(session.grid);
    edit(after);
    session.grid = after;
    commit({ before, after: cloneGrid(after), name });
  }

  // Undo and redo: a stroke's tiles, or the whole grid before and after a resize.
  function commit(entry) {
    session.undo.push(entry);
    if (session.undo.length > UNDO_LIMIT) session.undo.shift();
    session.redo = [];
    changed();
  }
  function undoRedo(back) {
    const [from, to] = back ? [session.undo, session.redo] : [session.redo, session.undo];
    if (stroke || dragging || path || !from.length) return;
    const entry = from.pop();
    if (entry.tiles) {
      for (const [i, was, now] of entry.tiles) session.grid.cells[i] = back ? was : now;
    } else {
      const { name } = session.grid.settings; // the name isn't undone
      session.grid = cloneGrid(back ? entry.before : entry.after);
      if (!entry.name) session.grid.settings.name = name;
    }
    to.push(entry);
    changed();
  }
  function changed() {
    stopWorker();
    markers = [];
    reportResult = null;
    $("#report-apply").hidden = true;
    tilesChanged();
    $("#name").value = session.grid.settings.name ?? "";
    if (!session.pendingKind && !"#.*~SEF<>^vrygbRYGB!%".includes(session.tile) && !session.grid.things[session.tile]) session.tile = "#";
    drawSwatch();
    $("#undo").disabled = !session.undo.length;
    $("#redo").disabled = !session.redo.length;
    $("#resize-size").textContent = `${session.grid.width} × ${session.grid.height} tiles`;
    for (const b of el.querySelectorAll("[data-side]")) {
      const n = Number(b.dataset.n);
      const [w, h] = b.dataset.side === "left" || b.dataset.side === "right" ? [session.grid.width + n, session.grid.height] : [session.grid.width, session.grid.height + n];
      b.disabled = w < MIN_WIDTH || w > MAX_WIDTH || h < MIN_HEIGHT || h > MAX_HEIGHT;
    }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, SAVE_AFTER);
    clearTimeout(checkTimer);
    checkTimer = setTimeout(check, CHECK_AFTER);
  }

  function save() {
    clearTimeout(saveTimer);
    if (deleted) return;
    const level = levelFromGrid(dragging?.before ?? session.grid);
    const text = JSON.stringify(level);
    if (text === session.saved) return;
    if (saveLevel(id, level)) session.saved = text;
    else toast("Couldn't save: the phone's storage for the game is full");
  }

  // The level's first problem, and whether it can be flown.
  function check() {
    clearTimeout(checkTimer);
    problem = problemOf(session.grid);
    $("#problem").hidden = !problem;
    $("#problem-text").textContent = problem?.text ?? "";
    $("#problem-show").hidden = !problem?.at;
    $("#fly").setAttribute("aria-disabled", !!problem);
    canvas.redraw();
  }
  $("#problem-show").addEventListener("click", () => problem?.at && canvas.show(problem.at.c, problem.at.r));
  $("#fly").addEventListener("click", (e) => {
    check();
    if (!problem) return; // main.js follows the link; leaving the page saves
    e.preventDefault();
    e.stopPropagation();
    const bar = $("#problem");
    bar.classList.remove("shake");
    void bar.offsetWidth;
    bar.classList.add("shake");
    if (problem.at) canvas.show(problem.at.c, problem.at.r);
  });

  // The name, saved as it's typed (it isn't undone).
  const name = $("#name");
  name.value = session.grid.settings.name ?? "";
  name.addEventListener("input", () => {
    session.grid.settings.name = name.value;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, SAVE_AFTER);
    clearTimeout(checkTimer);
    checkTimer = setTimeout(check, CHECK_AFTER);
  });
  name.addEventListener("keydown", (e) => e.key === "Enter" && name.blur());

  $("#undo").addEventListener("click", () => undoRedo(true));
  $("#redo").addEventListener("click", () => undoRedo(false));

  // Tools, the brush size and the tile.
  function setTool(tool) {
    session.tool = tool;
    $("#editor").dataset.mode = tool;
    for (const b of el.querySelectorAll("[data-tool]")) b.setAttribute("aria-pressed", b.dataset.tool === tool);
    $("#size").disabled = tool !== "brush" && tool !== "erase";
  }
  function setTile(ch, tool = null) {
    session.pendingKind = null;
    session.tile = ch;
    if (tool || session.tool === "erase" || session.tool === "pick") setTool(tool ?? "brush");
    drawSwatch();
  }
  function setSize(size) {
    session.size = size;
    $("#size").textContent = size;
    $("#size").setAttribute("aria-label", `Brush size: ${size} tiles`);
  }
  function drawSwatch() {
    const c = $("#swatch canvas");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    [c.width, c.height] = [Math.round(28 * dpr), Math.round(28 * dpr)];
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ch = session.pendingKind ? "0" : session.tile;
    const things = session.pendingKind ? { 0: thingDefaults(session.pendingKind) } : session.grid.things;
    drawTile(ctx, ch, 0, 0, 28, things, lookColors(session.grid.settings.look));
    $("#swatch").setAttribute("aria-label", `Tile: ${session.pendingKind ? `New ${KIND_NAMES[session.pendingKind]}` : tileName(session.tile, session.grid.things)}. Change it`);
  }
  // Tapping the tool that's on turns it off: one finger moves the view again.
  for (const b of el.querySelectorAll("[data-tool]")) {
    b.addEventListener("click", () => setTool(b.dataset.tool === session.tool ? "pan" : b.dataset.tool));
  }
  $("#size").addEventListener("click", () => setSize(SIZES[(SIZES.indexOf(session.size) + 1) % SIZES.length]));

  // Where the finger or mouse is, as the parser counts rows and columns.
  function showWhere(tile) {
    const { grid } = session;
    $("#where").textContent = tile && inside(grid, tile.c, tile.r) ? `Column ${tile.c + 1}, row ${tile.r + 1} · ${tileName(charAt(grid, tile.c, tile.r), grid.things)}` : "";
  }

  // The palette: every tile that's just a letter, and the things in the level.
  const palette = $("#palette");
  function openPalette() {
    const { grid } = session;
    const groups = [...PALETTE];
    const things = Object.keys(grid.things).sort();
    if (things.length) groups.push({ name: "In this level", tiles: things.join("") });
    $("#palette-list").innerHTML = groups
      .map(
        (g) =>
          `<h3>${g.name}</h3><div class="ed-tiles">${[...g.tiles]
            .map(
              (ch) =>
                `<button class="ed-tile" data-ch="${esc(ch)}" aria-pressed="${ch === session.tile}"><canvas></canvas><small>${esc(tileName(ch, grid.things))}</small></button>`,
            )
            .join("")}</div>`,
      )
      .join("");
    $("#palette-list").insertAdjacentHTML(
      "beforeend",
      `<h3>Add a thing</h3><div class="ed-tiles">${Object.entries(KIND_NAMES)
        .map(([kind, label]) => `<button class="ed-tile" data-new="${kind}"><canvas></canvas><small>${label}</small></button>`)
        .join(
          "",
        )}</div><p class="hint">Choose a new thing, then place it on the map. Choose an existing label to paint more of it. Inspect or hold a thing to change its settings.</p><button class="big" data-palette-close>Done</button>`,
    );
    palette.hidden = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const colors = lookColors(grid.settings.look);
    for (const b of palette.querySelectorAll("[data-ch], [data-new]")) {
      const c = b.querySelector("canvas");
      [c.width, c.height] = [Math.round(36 * dpr), Math.round(36 * dpr)];
      const ctx = c.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawTile(ctx, b.dataset.ch ?? "0", 0, 0, 36, b.dataset.new ? { 0: thingDefaults(b.dataset.new) } : grid.things, colors);
    }
    palette.querySelector('[aria-pressed="true"]')?.focus();
  }
  $("#swatch").addEventListener("click", openPalette);
  palette.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ch]");
    if (b) setTile(b.dataset.ch, session.tool === "rect" || session.tool === "fill" ? session.tool : "brush");
    const add = e.target.closest("[data-new]");
    if (add) {
      session.pendingKind = add.dataset.new;
      setTool("brush");
      drawSwatch();
    }
    if (b || add || e.target.closest("[data-palette-close]") || e.target === palette) palette.hidden = true;
  });

  // The menu.
  const menu = $("#menu");
  const syncOutline = () => {
    $("#m-reach").setAttribute("aria-pressed", session.reach);
    $("#m-reach").textContent = `Thing reach: ${session.reach ? "on" : "off"}`;
    $("#m-outline").setAttribute("aria-pressed", session.outline);
    $("#m-outline").textContent = `Rock outline: ${session.outline ? "on" : "off"}`;
  };
  $("#menu-btn").addEventListener("click", () => {
    // Finished, while it's the level that was finished: any change but its name clears it.
    const finish = finishOf(`my:${id}`, levelFromGrid(session.grid));
    $("#m-finish").textContent = finish ? `Finished in ${formatTime(finish.time)}.` : "Not finished yet: fly it from the start to the exit, without the autopilot.";
    menu.hidden = false;
    $("#m-close").focus();
  });
  $("#m-close").addEventListener("click", () => (menu.hidden = true));
  $("#m-outline").addEventListener("click", () => {
    session.outline = !session.outline;
    outlineDirty = true;
    syncOutline();
    canvas.redraw();
  });
  $("#m-reach").addEventListener("click", () => {
    session.reach = !session.reach;
    syncOutline();
    canvas.redraw();
  });
  $("#m-fit").addEventListener("click", () => {
    menu.hidden = true;
    canvas.fit();
  });
  $("#m-resize").addEventListener("click", () => {
    menu.hidden = true;
    $("#resize").hidden = false;
  });
  $("#m-delete").addEventListener("click", () => {
    if (!confirm(`Delete “${session.grid.settings.name || "this level"}”? It can't be brought back.`)) return;
    deleted = true;
    deleteLevel(id);
    sessions.delete(id);
    go("/editor");
  });

  // Resizing: each press adds or takes away rows or columns, as a step to undo.
  el.querySelector(".ed-resize").addEventListener("click", (e) => {
    const b = e.target.closest("[data-side]");
    if (!b || b.disabled || stroke) return;
    const before = session.grid;
    const after = resizeGrid(before, { [b.dataset.side]: Number(b.dataset.n) });
    session.grid = after;
    commit({ before: cloneGrid(before), after: cloneGrid(after) });
  });
  $("#resize-done").addEventListener("click", () => ($("#resize").hidden = true));

  // Inspecting changes only the chosen instance of a plain hazard. Configured
  // things keep their label, and every occurrence shares its settings.
  function inspect(c, r) {
    if (path || !inside(session.grid, c, r)) return;
    let ch = charAt(session.grid, c, r);
    if (!session.grid.things[ch]) {
      if (!"><^v!".includes(ch)) {
        toast("Inspect a thing, a flame or a stalactite");
        return;
      }
      try {
        mutate((g) => {
          ch = customizeTile(g, c, r);
        });
      } catch (e) {
        toast(e.message);
        return;
      }
    }
    openThingSheet($("#settings-sheet"), {
      grid: session.grid,
      ch,
      onApply: (thing) =>
        mutate((g) => {
          g.things[ch] = thing;
        }),
      onPath: () => {
        const shape = thingShapes(session.grid, ch).find((s) => c >= s.c0 && c <= s.c1 && r >= s.r0 && r <= s.r1);
        if (!shape) return;
        path = { ...shape, to: [...session.grid.things[ch].to] };
        $("#path-panel").hidden = false;
        $("#editor").classList.add("ed-path-active");
        canvas.redraw();
      },
    });
  }
  function endPath(apply) {
    if (!path) return;
    if (apply && !path.to.some(Boolean)) {
      toast("Move at least one tile from the start");
      return;
    }
    const { ch, to } = path;
    path = null;
    pathDrag = false;
    $("#path-panel").hidden = true;
    $("#editor").classList.remove("ed-path-active");
    if (apply)
      mutate((g) => {
        g.things[ch].to = to;
      });
    canvas.redraw();
  }
  $("#path-done").onclick = () => endPath(true);
  $("#path-cancel").onclick = () => endPath(false);
  $("#m-settings").onclick = () => {
    menu.hidden = true;
    openSettingsSheet($("#settings-sheet"), {
      grid: session.grid,
      onApply: (settings) =>
        mutate((g) => {
          g.settings = settings;
        }, true),
    });
  };

  // Both checks run in a worker, which is discarded on cancellation, changes or
  // leaving the editor. A late message can never apply to a newer map.
  function stopWorker() {
    worker?.terminate();
    worker = null;
    clearTimeout(workerTimer);
  }
  const legsTable = (legs) =>
    legs.length
      ? `<div class="ed-table-scroll"><table><thead><tr><th>Leg</th><th>Time</th><th>Fuel</th><th>Hull</th></tr></thead><tbody>${legs.map((leg) => `<tr><td>${esc(leg.name)}</td><td>${leg.seconds.toFixed(1)} s</td><td>${Math.max(0, leg.fuel).toFixed(1)} s</td><td>${Math.round(leg.hull)}</td></tr>`).join("")}</tbody></table></div>`
      : "";
  function runCheck(action) {
    check();
    menu.hidden = true;
    stopWorker();
    reportResult = null;
    markers = [];
    $("#report").hidden = false;
    $("#report-title").textContent = action === "check" ? "Check level" : "Autopilot";
    $("#report-body").textContent = action === "check" ? "Checking pads, pick-ups and door order…" : "Flying the route…";
    $("#report-close").textContent = "Cancel";
    $("#report-apply").hidden = true;
    if (problem) {
      showReportError(problem.text, problem.at);
      return;
    }
    try {
      const running = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
      worker = running;
      running.onmessage = ({ data }) => {
        if (worker !== running) return;
        if (data.progress) {
          $("#report-body").innerHTML = `<p>${esc(data.progress.status)} · ${data.progress.seconds.toFixed(1)} s</p>${legsTable(data.progress.legs)}`;
          return;
        }
        stopWorker();
        $("#report-close").textContent = "Done";
        if (data.error) {
          showReportError(data.error);
          return;
        }
        if (action === "check") {
          markers = data.result.filter((p) => p.at).map((p) => p.at);
          $("#report-body").innerHTML = data.result.length
            ? data.result.map((p) => `<p>${esc(p.text)}${p.at ? ` <button data-show-c="${p.at.c}" data-show-r="${p.at.r}">Show</button>` : ""}</p>`).join("")
            : "<p>All pads, keys and crystals are reachable. Doors can open in a working order.</p>";
          $("#report-body").insertAdjacentHTML("beforeend", "<p class=hint>This checks space and lock order. Use Autopilot or Fly to check timing, moving hazards and fuel.</p>");
        } else {
          const result = data.result;
          reportResult = result;
          if (result.failed) markers = [result.at];
          $("#report-body").innerHTML =
            `<p>${result.failed ? `${esc(result.failed)} <button data-show-c="${result.at.c}" data-show-r="${result.at.r}">Show</button>` : `Finished in ${result.seconds.toFixed(1)} s`}</p>${legsTable(result.legs)}${result.suggested ? `<p>Suggested tank: ${result.suggested.fuel} s · par: ${result.suggested.par} s.</p><p class="hint">Tank includes 40% spare fuel between refills; par rounds the full run up to 5 seconds.</p>` : '<p class="hint">The autopilot may need a route in Settings → Advanced, a larger tank, or a clearer path. A failed flight does not always mean a person cannot finish.</p>'}`;
          $("#report-apply").hidden = !result.suggested || result.suggested.fuel > 300 || result.suggested.par > 3600;
        }
        canvas.redraw();
      };
      running.onerror = () => {
        stopWorker();
        showReportError("The check couldn't run. Try again or reload the game.");
      };
      workerTimer = setTimeout(() => {
        stopWorker();
        showReportError("The check took too long. Try a smaller level or a shorter route.");
      }, 30000);
      running.postMessage({ action, level: levelFromGrid(session.grid) });
    } catch (e) {
      stopWorker();
      showReportError(`Couldn't start the check: ${e.message}`);
    }
  }
  function showReportError(text, at = null) {
    markers = at ? [at] : [];
    $("#report-body").innerHTML = `<p>${esc(text)}${at ? ` <button data-show-c="${at.c}" data-show-r="${at.r}">Show</button>` : ""}</p>`;
    $("#report-close").textContent = "Done";
    canvas.redraw();
  }
  $("#m-check").onclick = () => runCheck("check");
  $("#m-auto").onclick = () => runCheck("autopilot");
  $("#report-close").onclick = () => {
    stopWorker();
    $("#report").hidden = true;
  };
  $("#report-body").onclick = (e) => {
    const b = e.target.closest("[data-show-c]");
    if (b) {
      $("#report").hidden = true;
      canvas.show(Number(b.dataset.showC), Number(b.dataset.showR));
    }
  };
  $("#report-apply").onclick = () => {
    const suggestion = reportResult?.suggested;
    if (!suggestion) return;
    mutate((g) => Object.assign(g.settings, suggestion));
    $("#report").hidden = true;
    toast("Tank and par updated");
  };

  // Export: the level as JSON or as a level module, to copy or save.
  const exportEl = $("#export");
  let exportKind = "json";
  const exportText = () => {
    const level = levelFromGrid(session.grid);
    return exportKind === "json" ? levelToJson(level) : levelToModule(level);
  };
  const syncExport = () => {
    for (const b of exportEl.querySelectorAll("[data-kind]")) b.setAttribute("aria-pressed", b.dataset.kind === exportKind);
    $("#export-text").value = exportText();
  };
  $("#m-export").addEventListener("click", () => {
    menu.hidden = true;
    exportEl.hidden = false;
    syncExport();
  });
  $("#export-kind").addEventListener("click", (e) => {
    const kind = e.target.closest("[data-kind]")?.dataset.kind;
    if (kind) {
      exportKind = kind;
      syncExport();
    }
  });
  $("#export-copy").addEventListener("click", async () => {
    const text = $("#export-text");
    try {
      await navigator.clipboard.writeText(text.value);
    } catch {
      text.select();
      document.execCommand?.("copy");
    }
    toast("Copied");
  });
  $("#export-save").addEventListener("click", () => {
    const json = exportKind === "json";
    const file =
      (session.grid.settings.name || "level")
        .replace(/[^\w-]+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase() || "level";
    saveFile(`${file}.${json ? "json" : "js"}`, exportText(), json ? "application/json" : "text/javascript");
  });
  $("#export-close").addEventListener("click", () => (exportEl.hidden = true));

  function toast(text) {
    const t = $("#toast");
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 3000);
  }

  // Keys: Ctrl+Z and Ctrl+Y (or Ctrl+Shift+Z), a letter per tool, [ and ] for the
  // brush size, Esc closes what's open.
  const onKey = (e) => {
    if (e.key === "Escape") {
      cancel();
      stopWorker();
      endPath(false);
      for (const o of [palette, menu, exportEl, $("#resize"), $("#settings-sheet"), $("#report")]) o.hidden = true;
      return;
    }
    if (e.target.closest?.("input, textarea, select")) return;
    if (!$("#settings-sheet").hidden || !$("#report").hidden) return;
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && (key === "z" || key === "y")) {
      e.preventDefault();
      undoRedo(key === "z" && !e.shiftKey);
    } else if (e.ctrlKey || e.metaKey || e.altKey) return;
    else if (key === "[" || key === "]") {
      const i = SIZES.indexOf(session.size) + (key === "]" ? 1 : -1);
      setSize(SIZES[Math.max(0, Math.min(SIZES.length - 1, i))]);
    } else {
      const tool = TOOLS.find(([, , k]) => k === key);
      if (tool) setTool(tool[0]);
    }
  };
  window.addEventListener("keydown", onKey);
  const onHidden = () => document.hidden && save();
  document.addEventListener("visibilitychange", onHidden);

  setTool(session.tool);
  setSize(session.size);
  drawSwatch();
  syncOutline();
  changed();
  check();

  return () => {
    cancel();
    stopWorker();
    save();
    clearTimeout(checkTimer);
    clearTimeout(toastTimer);
    session.view = canvas.view;
    window.removeEventListener("keydown", onKey);
    document.removeEventListener("visibilitychange", onHidden);
    canvas.dispose();
  };
}
