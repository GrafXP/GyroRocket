import "./style/base.css";
import "./style/kit.css";
import "./style/title.css";
import "./style/settings.css";
import "./style/pages.css";
import "./style/levels.css";
import "./style/play.css";
import "./style/editor.css";
import { WORLDS } from "./levels/index.js";
import { loadProgress, nextToPlay, setAllUnlocked } from "./progress.js";
import { css } from "./looks.js";
import { rockCanvas } from "./render/rock.js";
import { CAVE_COLORS } from "./render/cave.js";
import { sheetBack, dropSheets } from "./ui/sheet.js";
import { frame } from "./ui/frame.js";
import { title } from "./ui/title.js";
import { levels } from "./ui/levels.js";
import { help } from "./ui/help.js";
import { play } from "./ui/play.js";
import { profile } from "./ui/profile.js";
import { editorList } from "./editor/list.js";
import { editor } from "./editor/editor.js";

const view = document.getElementById("view");
let cleanup = null;
let shown = null; // the path and query of the page that's showing

// The ?unlock debug flag (progress.js), remembered on this device.
const unlock = new URLSearchParams(location.search).get("unlock");
if (unlock !== null) setAllUnlocked(unlock !== "off");

const routes = {
  "/": title,
  "/levels": levels,
  "/editor": editorList,
  "/profile": profile,
  "/help": help,
};

// The page for the current URL. /play/1-3 plays a level; /play alone plays the
// next one to do.
function pageFor(path) {
  if (path === "/play") {
    history.replaceState(history.state, "", `/play/${nextToPlay(loadProgress()).id}${location.search}`);
    return pageFor(location.pathname);
  }
  const level = path.match(/^\/play\/([\w-]+)$/)?.[1];
  if (level) return (el) => play(el, level);
  const mine = path.match(/^\/play\/my\/(\w+)$/)?.[1];
  if (mine) return (el) => play(el, `my:${mine}`);
  const editing = path.match(/^\/editor\/(\w+)$/)?.[1];
  if (editing) return (el) => editor(el, editing);
  if (path === "/ui" && new URLSearchParams(location.search).has("dev")) return kit;
  return routes[path] || notFound;
}

// The kit's page, /ui?dev: every component in every state. It's only fetched here.
function kit(el) {
  let gone = false;
  let stop = null;
  import("./ui/kitpage.js").then((m) => {
    if (!gone) stop = m.kitPage(el);
  });
  return () => {
    gone = true;
    stop?.();
  };
}

function notFound(el) {
  frame(el, "Not found", `<p>There's no such page.</p>`);
}

// The menus take the colour of the world the player has reached: its rock's rim.
function tint() {
  const rim = WORLDS[nextToPlay(loadProgress()).world - 1].colors?.rim ?? CAVE_COLORS.rim;
  document.documentElement.style.setProperty("--world", css(rim));
}

// The rock behind the menus (style/base.css): its texture, see-through where the
// cave's is dark, made once.
function rock() {
  const canvas = rockCanvas(256, (v) => [255, 255, 255, Math.max(0, Math.min(255, (v - 0.35) * 600))]);
  document.documentElement.style.setProperty("--rock", `url(${canvas.toDataURL()})`);
  document.documentElement.classList.add("rocky");
}
(window.requestIdleCallback ?? setTimeout)(rock);

function render() {
  dropSheets();
  cleanup?.();
  cleanup = null;
  document.body.classList.remove("playing"); // the play page puts it back
  view.innerHTML = "";
  tint();
  cleanup = pageFor(location.pathname)(view) || null;
  shown = location.pathname + location.search;
}

// Goes to the page at `path`, as a link with data-link does, or go() (ui/dom.js).
// What the link's data-link says, or go()'s `how`, is what becomes of the history,
// so that Back, the phone's or the browser's, always leads out the way you came in:
// - nothing: the page is added to it, and Back comes back here;
// - "replace": the page takes this one's place, as the next level does;
// - "up", for the way out of a page: a step back, if that's where this page was
//   come to from, and otherwise in this page's place.
// Each entry remembers the page before it (`prev`), to tell. A page gone to from a
// sheet takes the sheet's place.
function navigate(path, how = "") {
  const url = new URL(path, location.href);
  const to = url.pathname + url.search;
  const sheet = dropSheets();
  if (how === "up" && !sheet && history.state?.prev === to) return history.back(); // which shows it
  if (to !== shown || url.hash !== location.hash) {
    if (sheet) history.replaceState({ prev: shown }, "", url);
    else if (how) history.replaceState({ prev: history.state?.prev }, "", url);
    else history.pushState({ prev: shown }, "", url);
  }
  render();
  const target = url.hash && document.getElementById(url.hash.slice(1));
  if (target) target.scrollIntoView();
  else window.scrollTo(0, 0);
}

document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-link]");
  if (!link) return;
  e.preventDefault();
  navigate(link.getAttribute("href"), link.dataset.link);
});
window.addEventListener("go", (e) => navigate(e.detail.path, e.detail.how));

// Back and Forward. A sheet's entry in the history has the page's own address, so
// the page that's showing stays as it is.
window.addEventListener("popstate", () => {
  if (sheetBack()) return;
  if (history.state?.sheet) return history.back(); // a sheet's entry, with its sheet long gone: on past it
  if (location.pathname + location.search !== shown) render();
});

render();
if (history.state?.sheet) history.back(); // loaded again with a sheet open
if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
