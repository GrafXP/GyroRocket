import { html, icon, esc, go } from "../ui/dom.js";
import { loadLevel, saveLevel, deleteLevel } from "../mylevels.js";
import { buildOutline, setTile } from "../sim/outline.js";
import { MIN_WIDTH, MAX_WIDTH, MIN_HEIGHT, MAX_HEIGHT } from "../sim/validate.js";
import { gridFromLevel, levelFromGrid, resizeGrid, solidOf, charAt, inside, problemOf } from "./grid.js";
import { createStroke, paintAt, paintLine, paintRect, floodFill, strokeChanges, revertStroke } from "./tools.js";
import { createEditorCanvas } from "./canvas.js";
import { PALETTE, tileName, lookColors, drawTile } from "./tiles.js";
import { levelToJson, levelToModule } from "./text.js";

const UNDO_LIMIT = 200;
const SAVE_AFTER = 400; // ms after the last change
const CHECK_AFTER = 150;
const SIZES = [1, 2, 3, 5]; // the brush, in tiles across
const TOOLS = [
  ["pan", "Move the view", "h"],
  ["brush", "Brush", "b"],
  ["rect", "Rectangle", "r"],
  ["fill", "Fill", "f"],
  ["erase", "Eraser", "e"],
  ["pick", "Pick a tile", "i"],
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
  const session = { grid: gridFromLevel(record.level), undo: [], redo: [], view: null, tool: "pan", tile: "#", size: 1, outline: false, saved };
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
          <button id="m-resize">Resize…</button>
          <button id="m-outline" aria-pressed="false"></button>
          <button id="m-fit">Show the whole level</button>
          <button id="m-export">Export…</button>
          <button id="m-delete">Delete this level</button>
        </section>
        <section>
          <p class="hint">One finger paints with the tool and tile below, or moves the view with the arrows (tap the tool that's on to go back to them). Two fingers always move the view and pinch to zoom. With a mouse, drag with the right button and zoom with the wheel; Ctrl+Z undoes.</p>
          <button class="big" id="m-close">Back to the level</button>
        </section>
      </div>

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
        else for (let i = 0; i < solid.length; i++) if (solid[i] !== outline.solid[i]) setTile(outline, i % grid.width, Math.floor(i / grid.width), solid[i] === 1);
        outlineDirty = false;
      }
      return { grid, colors: lookColors(grid.settings.look), outline: session.outline ? outline : null, marker: problem?.at ?? null, preview };
    },
    paint: { down, move, up, cancel },
    pans: () => session.tool === "pan",
    onHover: showWhere,
  });

  // Painting, a stroke at a time.
  const ink = () => (session.tool === "erase" ? "." : session.tile);
  const clampTile = ({ c, r }) => ({ c: Math.max(0, Math.min(session.grid.width - 1, c)), r: Math.max(0, Math.min(session.grid.height - 1, r)) });
  function down(c, r) {
    const { grid, tool } = session;
    if (tool === "pick") {
      if (inside(grid, c, r)) setTile(charAt(grid, c, r), "brush");
      return;
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
    if (!stroke || (c === last.c && r === last.r)) return;
    if (session.tool === "rect") {
      const at = clampTile({ c, r });
      preview = { ...preview, c1: at.c, r1: at.r };
    } else if (session.tool !== "fill") paintLine(stroke, last.c, last.r, c, r, ink(), session.size);
    last = { c, r };
    tilesChanged();
  }
  function up() {
    if (!stroke) return;
    if (preview) paintRect(stroke, preview.c0, preview.r0, preview.c1, preview.r1, ink());
    preview = null;
    const tiles = strokeChanges(stroke);
    stroke = null;
    if (tiles.length) commit({ tiles });
    else canvas.redraw();
  }
  function cancel() {
    if (!stroke) return;
    revertStroke(stroke);
    stroke = null;
    preview = null;
    tilesChanged();
  }
  function tilesChanged() {
    outlineDirty = true;
    canvas.redraw();
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
    if (stroke || !from.length) return;
    const entry = from.pop();
    if (entry.tiles) {
      for (const [i, was, now] of entry.tiles) session.grid.cells[i] = back ? was : now;
    } else {
      const { name } = session.grid.settings; // the name isn't undone
      session.grid = back ? entry.before : entry.after;
      session.grid.settings.name = name;
    }
    to.push(entry);
    changed();
  }
  function changed() {
    tilesChanged();
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
    const level = levelFromGrid(session.grid);
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
    drawTile(ctx, session.tile, 0, 0, 28, session.grid.things, lookColors(session.grid.settings.look));
    $("#swatch").setAttribute("aria-label", `Tile: ${tileName(session.tile, session.grid.things)}. Change it`);
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
        (g) => `<h3>${g.name}</h3><div class="ed-tiles">${[...g.tiles]
          .map((ch) => `<button class="ed-tile" data-ch="${esc(ch)}" aria-pressed="${ch === session.tile}"><canvas></canvas><small>${esc(tileName(ch, grid.things))}</small></button>`)
          .join("")}</div>`,
      )
      .join("");
    palette.hidden = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const colors = lookColors(grid.settings.look);
    for (const b of palette.querySelectorAll("[data-ch]")) {
      const c = b.querySelector("canvas");
      [c.width, c.height] = [Math.round(36 * dpr), Math.round(36 * dpr)];
      const ctx = c.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawTile(ctx, b.dataset.ch, 0, 0, 36, grid.things, colors);
    }
    palette.querySelector('[aria-pressed="true"]')?.focus();
  }
  $("#swatch").addEventListener("click", openPalette);
  palette.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ch]");
    if (b) setTile(b.dataset.ch, session.tool === "rect" || session.tool === "fill" ? session.tool : "brush");
    if (b || e.target === palette) palette.hidden = true;
  });

  // The menu.
  const menu = $("#menu");
  const syncOutline = () => {
    $("#m-outline").setAttribute("aria-pressed", session.outline);
    $("#m-outline").textContent = `Rock outline: ${session.outline ? "on" : "off"}`;
  };
  $("#menu-btn").addEventListener("click", () => {
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
    commit({ before, after });
  });
  $("#resize-done").addEventListener("click", () => ($("#resize").hidden = true));

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
    const file = (session.grid.settings.name || "level").replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "level";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([exportText()], { type: json ? "application/json" : "text/javascript" }));
    a.download = `${file}.${json ? "json" : "js"}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
    if (e.target.closest?.("input, textarea")) return;
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && (key === "z" || key === "y")) {
      e.preventDefault();
      undoRedo(key === "z" && !e.shiftKey);
    } else if (e.ctrlKey || e.metaKey || e.altKey) return;
    else if (key === "escape") {
      for (const o of [palette, menu, exportEl, $("#resize")]) o.hidden = true;
    } else if (key === "[" || key === "]") {
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
    save();
    clearTimeout(checkTimer);
    clearTimeout(toastTimer);
    session.view = canvas.view;
    window.removeEventListener("keydown", onKey);
    document.removeEventListener("visibilitychange", onHidden);
    canvas.dispose();
  };
}
