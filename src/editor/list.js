import { html, esc, go } from "../ui/dom.js";
import { WORLDS, TEST_CAVE, BIG_CAVE, levelById } from "../levels/index.js";
import { loadProgress, isUnlocked, allUnlocked } from "../progress.js";
import { listLevels, loadLevel, createLevel, duplicateLevel, deleteLevel, newLevel, copyOfLevel } from "../mylevels.js";
import { finishOf } from "../runs.js";
import { formatTime } from "../ui/dom.js";
import { validateLevel } from "../sim/validate.js";
import { levelFromText } from "./text.js";

const FULL = "Couldn't save: the phone's storage for the game is full.";

// The editor's front page, /editor: my levels (and which are finished), a new one,
// a copy of a built-in level (one that's open), or one pasted in.
export function editorList(el) {
  const progress = loadProgress();
  const open = WORLDS.map((w) => ({ ...w, levels: w.levels.filter((l) => allUnlocked() || isUnlocked(progress, l.id)) })).filter((w) => w.levels.length);
  const $ = html(
    el,
    `<h1>Level editor</h1>
    <p>Build your own caves: paint the rock, place pads, keys and hazards, and fly them straight away.</p>
    <div class="cards">
      <button class="card primary" id="new"><b>New level</b><span>A plain cave with a start and an exit, to build on</span></button>
    </div>
    <p class="ed-error" id="error" role="alert" hidden></p>
    <h2>My levels</h2>
    <div class="ed-list" id="mine"></div>
    <h2>Start from a built-in level</h2>
    <div class="ed-copy">
      <select id="copy-from" aria-label="Level to copy">
        ${open
          .map((w) => `<optgroup label="${w.number} · ${w.name}">${w.levels.map((l) => `<option value="${l.id}">${l.id} ${esc(l.name)}</option>`).join("")}</optgroup>`)
          .join("")}
        <option value="${TEST_CAVE.id}">The test cave</option>
        <option value="${BIG_CAVE.id}">The big cave (200 × 150)</option>
      </select>
      <button id="copy">Copy</button>
    </div>
    <p class="hint">Any level you've opened, to change as you like.</p>
    <h2>Import</h2>
    <p class="hint">Paste a level exported from the editor, as JSON or as a level module, or open a file.</p>
    <textarea class="ed-text" id="import-text" rows="4" spellcheck="false" placeholder="{ &quot;name&quot;: …, &quot;map&quot;: … }"></textarea>
    <div class="buttons">
      <button id="import">Import</button>
      <label class="button">Open a file<input type="file" id="import-file" accept=".json,.js,.txt,application/json,text/javascript,text/plain" hidden></label>
    </div>
    <p class="ed-error" id="import-error" role="alert" hidden></p>`,
  );

  const fail = (where, text) => {
    $(where).textContent = text;
    $(where).hidden = false;
  };
  const opened = (id) => (id ? go(`/editor/${id}`) : fail("#error", FULL));

  function renderList() {
    const levels = listLevels();
    $("#mine").innerHTML = levels.length
      ? levels
          .map((l) => ({ ...l, finish: finishOf(`my:${l.id}`, loadLevel(l.id)?.level ?? { map: "" }) }))
          .map(
            (l) => `<div class="ed-item">
              <a class="ed-item-main" href="/editor/${l.id}" data-link><b>${esc(l.name || "No name")}</b><small>${l.width} × ${l.height} · ${ago(l.updated)}${l.finish ? ` · Finished in ${formatTime(l.finish.time)}` : ""}</small></a>
              <a class="button" href="/play/my/${l.id}" data-link>Fly</a>
              <button data-copy="${l.id}">Copy</button>
              <button data-delete="${l.id}" aria-label="Delete ${esc(l.name)}">Delete</button>
            </div>`,
          )
          .join("")
      : `<p class="hint">None yet: start a new one, or copy one of the game's.</p>`;
  }
  $("#mine").addEventListener("click", (e) => {
    const copy = e.target.closest("[data-copy]")?.dataset.copy;
    const del = e.target.closest("[data-delete]")?.dataset.delete;
    if (copy) {
      if (!duplicateLevel(copy)) fail("#error", FULL);
      renderList();
    } else if (del) {
      const name = listLevels().find((l) => l.id === del)?.name || "this level";
      if (!confirm(`Delete “${name}”? It can't be brought back.`)) return;
      deleteLevel(del);
      renderList();
    }
  });

  $("#new").addEventListener("click", () => opened(createLevel(newLevel(`My level ${listLevels().length + 1}`))));
  $("#copy").addEventListener("click", () => opened(createLevel(copyOfLevel(levelById($("#copy-from").value)))));

  const importText = (text) => {
    $("#import-error").hidden = true;
    let level;
    try {
      level = validateLevel(levelFromText(text.trim()));
    } catch (e) {
      fail("#import-error", `That isn't a level the game can take: ${e.message}.`);
      return;
    }
    const id = createLevel({ name: "Imported level", ...level });
    if (id) go(`/editor/${id}`);
    else fail("#import-error", FULL);
  };
  $("#import").addEventListener("click", () => importText($("#import-text").value));
  $("#import-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) importText(await file.text());
  });

  renderList();
}

// How long ago a time was, roughly.
function ago(time) {
  const minutes = Math.round((Date.now() - time) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : days < 30 ? `${days} days ago` : new Date(time).toLocaleDateString();
}
