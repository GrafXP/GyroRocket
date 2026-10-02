// The kit: the markup every screen is made of (style/kit.css has its look, and
// /ui?dev shows all of it).

// Icons, each one path on a 24 × 24 grid: drawn as lines, or filled (SOLID).
const PATHS = {
  back: "M15 5l-7 7 7 7",
  expand: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5",
  shrink: "M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5",
  pause: "M8 5v14M16 5v14",
  play: "M7 4l13 8-13 8z",
  retry: "M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5",
  home: "M4 11l8-7 8 7M6 10v10h12V10",
  gear: "M8 3h8l5 5v8l-5 5H8l-5-5V8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3",
  map: "M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15",
  auto: "M12 3l7 18-7-4-7 4z",
  star: "M12 2.5l2.9 6.2 6.6.8-4.9 4.6 1.3 6.7L12 17.5l-5.9 3.3 1.3-6.7-4.9-4.6 6.6-.8z",
  crystal: "M12 2l7 10-7 10-7-10z",
  sound: "M4 9v6h4l5 4V5L8 9zM16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11",
  tilt: "M9.5 3.5l8 2.2-3 13.8-8-2.2zM3.5 8a11 11 0 0 0-1 6M20.5 10a11 11 0 0 1 1 6",
  hold: "M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0M5 12a7 7 0 1 0 14 0 7 7 0 1 0-14 0",
  keys: "M9 3h6v6H9zM2 13h6v6H2zM9 13h6v6H9zM16 13h6v6h-6z",
  pilot: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21a8 8 0 0 1 16 0",
  help: "M9 9a3 3 0 1 1 4.6 2.5c-1 .7-1.6 1.2-1.6 2.5M12 18v.5",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1",
  moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6L6 18",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  down: "M12 5v14M6 13l6 6 6-6",
  pan: "M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3",
  undo: "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  redo: "M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3",
  menu: "M4 7h16M4 12h16M4 17h16",
  brush: "M4 20l1-4L16 5l3 3L8 19zM13 8l3 3",
  rect: "M5 6h14v12H5z",
  fill: "M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z",
  erase: "M9 20h11M4 15l9-9 6 6-8 8H9z",
  inspect: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM15 15l6 6M10 7v6M7 10h6",
  pick: "M14 4l6 6-2.5 2.5-6-6zM12.5 7.5L5 15v4h4l7.5-7.5",
  check: "M5 12l5 5 9-10",
};
const SOLID = new Set(["play", "star", "crystal"]);
export const ICONS = Object.keys(PATHS);

// The icon called `name`, with any classes in `cls` as well.
export const icon = (name, cls = "") =>
  `<svg class="icon${SOLID.has(name) ? " solid" : ""}${cls && ` ${cls}`}" viewBox="0 0 24 24" aria-hidden="true"><path d="${PATHS[name]}"/></svg>`;

// Three stars, lit for each true in `earned`.
export const stars = (earned) =>
  `<span class="stars" role="img" aria-label="${earned.filter(Boolean).length} of 3 stars">${earned.map((on) => icon("star", on ? "on" : "")).join("")}</span>`;

// A button: `label` and an `icon`, either or both. `big` is the one to press on
// its screen; with `href` it's a link that looks like a button, and goes there as
// a link with data-link does; `pressed` (true or false) makes it one that's on or
// off. `attrs` is any more markup for its tag.
export function button({ label = "", icon: name, id, big = false, href, pressed, attrs = "" }) {
  const bare = name && !label;
  const cls = [href && "button", big && "big", bare && "icon-btn"].filter(Boolean).join(" ");
  const all = `${id ? ` id="${id}"` : ""}${cls && ` class="${cls}"`}${pressed === undefined ? "" : ` aria-pressed="${pressed}"`}${attrs && ` ${attrs}`}`;
  const inside = `${name ? icon(name) : ""}${label}`;
  return href ? `<a href="${href}" data-link${all}>${inside}</a>` : `<button${all}>${inside}</button>`;
}

// A switch: `label`, and whether it's on.
export const toggle = ({ label, id, on = false }) =>
  `<label class="switch"><span>${label}</span><input type="checkbox" role="switch"${id ? ` id="${id}"` : ""}${on ? " checked" : ""}><i></i></label>`;

// A slider under its `label`, with a line of `note` below it, or with `ends`, a
// word for each end of it.
export const slider = ({ label, id, min, max, step = 1, value, note = "", ends }) =>
  `<label class="setting"><span>${label}</span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}"${value === undefined ? "" : ` value="${value}"`}>${
    ends ? `<span class="ends"><small>${ends[0]}</small><small>${ends[1]}</small></span>` : `<small class="hint" id="${id}-note">${note}</small>`
  }</label>`;

// Shows `text` in `el` with each digit in a box of one width, for numbers that
// change as you watch: the display font's digits differ (its 1 is narrow), and a
// clock set in them would jiggle. Only the characters that changed are touched.
export function setDigits(el, text) {
  if (el.dataset.shown === text) return;
  el.dataset.shown = text;
  while (el.children.length > text.length) el.lastChild.remove();
  while (el.children.length < text.length) el.append(document.createElement("i"));
  [...text].forEach((ch, i) => {
    const box = el.children[i];
    if (box.textContent === ch) return;
    box.textContent = ch;
    box.className = ch >= "0" && ch <= "9" ? "d" : "";
  });
}

// Every press of a button, or of a link that looks like one, comes through here,
// so that a click's sound and buzz have one place to hang on (PLAN.md's phase 9).
// onPress(fn) has fn(element) called for each; it returns a function that stops it.
const PRESSED = "button, a.button, label.button, a.card, a.level, a.icon-btn";
const listeners = new Set();
export function onPress(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
globalThis.document?.addEventListener("click", (e) => {
  const el = e.target.closest?.(PRESSED);
  if (el && !el.disabled) for (const fn of listeners) fn(el);
});
