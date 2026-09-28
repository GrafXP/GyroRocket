import { getThemePref, setThemePref, onThemeChange } from "../theme.js";
import { fullscreenSupported, isFullscreen, toggleFullscreen, onFullscreenChange } from "../fullscreen.js";

// Fills `el` with `markup` and returns a querySelector for it.
export function html(el, markup) {
  el.innerHTML = markup;
  return (sel) => el.querySelector(sel);
}

const PATHS = {
  back: "M15 5l-7 7 7 7",
  expand: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5",
  shrink: "M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5",
  pause: "M8 5v14M16 5v14",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3",
  map: "M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15",
  auto: "M12 3l7 18-7-4-7 4z",
  pan: "M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3",
  undo: "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  redo: "M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3",
  menu: "M4 7h16M4 12h16M4 17h16",
  brush: "M4 20l1-4L16 5l3 3L8 19zM13 8l3 3",
  rect: "M5 6h14v12H5z",
  fill: "M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z",
  erase: "M9 20h11M4 15l9-9 6 6-8 8H9z",
  pick: "M14 4l6 6-2.5 2.5-6-6zM12.5 7.5L5 15v4h4l7.5-7.5",
};
export const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${PATHS[name]}"/></svg>`;

// Text made safe to put in markup: a level's or a player's name.
export const esc = (text) =>
  String(text).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

// Goes to another page, as a link with data-link does (main.js listens).
export function go(path) {
  history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

// Seconds → "m:ss.s".
export function formatTime(s) {
  const tenths = Math.floor(s * 10);
  return `${Math.floor(tenths / 600)}:${((tenths % 600) / 10).toFixed(1).padStart(4, "0")}`;
}

// Three stars, lit for each true in `earned`.
export const starsHtml = (earned) =>
  `<span class="stars" aria-label="${earned.filter(Boolean).length} of 3 stars">${earned
    .map((on) => `<span class="${on ? "on" : ""}">★</span>`)
    .join("")}</span>`;

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
  <button data-pref="auto">Auto</button><button data-pref="light">☀ Light</button><button data-pref="dark">☾ Dark</button>
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
