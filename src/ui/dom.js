import { getThemePref, setThemePref, onThemeChange } from "../theme.js";
import { icon } from "./kit.js";
import { fullscreenSupported, isFullscreen, toggleFullscreen, onFullscreenChange } from "../fullscreen.js";

// Fills `el` with `markup` and returns a querySelector for it.
export function html(el, markup) {
  el.innerHTML = markup;
  return (sel) => el.querySelector(sel);
}

// Text made safe to put in markup: a level's or a player's name.
export const esc = (text) =>
  String(text).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

// Goes to another page, as a link does whose data-link is `how` (main.js listens,
// and says what each means).
export function go(path, how = "") {
  window.dispatchEvent(new CustomEvent("go", { detail: { path, how } }));
}

// Hands the viewer `text` as a file called `name`, to save.
export function saveFile(name, text, type = "application/json") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Seconds → "m:ss.s".
export function formatTime(s) {
  const tenths = Math.floor(s * 10);
  return `${Math.floor(tenths / 600)}:${((tenths % 600) / 10).toFixed(1).padStart(4, "0")}`;
}

// Keeps a fullscreen button's label (or icon, on an .icon-btn) in sync.
export function bindFullscreenButton(btn) {
  if (!fullscreenSupported) {
    btn.hidden = true;
    return () => {};
  }
  const sync = () => {
    const on = isFullscreen();
    btn.setAttribute("aria-label", on ? "Exit fullscreen" : "Go fullscreen");
    if (btn.classList.contains("icon-btn")) btn.innerHTML = icon(on ? "shrink" : "expand");
    else btn.textContent = on ? "Exit fullscreen" : "Go fullscreen";
  };
  btn.addEventListener("click", toggleFullscreen);
  sync();
  return onFullscreenChange(sync);
}

export const THEME_PICKER = `<div class="segmented theme" role="group" aria-label="Theme">
  <button data-pref="auto">Auto</button><button data-pref="light">${icon("sun")} Light</button><button data-pref="dark">${icon("moon")} Dark</button>
</div>`;

// Auto / Light / Dark picker; the choice is saved and shared by every page.
export function bindThemePicker(group) {
  const sync = () => {
    const pref = getThemePref();
    for (const b of group.querySelectorAll("[data-pref]")) b.setAttribute("aria-pressed", b.dataset.pref === pref);
  };
  group.addEventListener("click", (e) => {
    const pref = e.target.closest("[data-pref]")?.dataset.pref;
    if (pref) setThemePref(pref);
  });
  sync();
  return onThemeChange(sync);
}
