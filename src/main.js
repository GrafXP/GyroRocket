import "./style.css";
import { SAFE_SPEED } from "./sim/rocket.js";
import { WORLDS, LEVELS } from "./levels/index.js";
import { loadProgress, nextToPlay, isUnlocked, allUnlocked, setAllUnlocked, starsOf, starCount } from "./progress.js";
import { html, icon, formatTime, starsHtml, bindFullscreenButton, THEME_PICKER, bindThemePicker } from "./ui/dom.js";
import { play } from "./ui/play.js";
import { editorList } from "./editor/list.js";
import { editor } from "./editor/editor.js";

const view = document.getElementById("view");
let cleanup = null;

// The ?unlock debug flag (progress.js), remembered on this device.
const unlock = new URLSearchParams(location.search).get("unlock");
if (unlock !== null) setAllUnlocked(unlock !== "off");

const routes = {
  "/": home,
  "/levels": levels,
  "/editor": editorList,
  "/help": help,
};

function navigate(path) {
  if (path !== location.pathname + location.search) history.pushState(null, "", path);
  render();
}

// The page for the current URL. /play/1-3 plays a level; /play alone plays the
// next one to do.
function pageFor(path) {
  if (path === "/play") {
    history.replaceState(null, "", `/play/${nextToPlay(loadProgress()).id}${location.search}`);
    return pageFor(location.pathname);
  }
  const level = path.match(/^\/play\/([\w-]+)$/)?.[1];
  if (level) return (el) => play(el, level);
  const mine = path.match(/^\/play\/my\/(\w+)$/)?.[1];
  if (mine) return (el) => play(el, `my:${mine}`);
  const editing = path.match(/^\/editor\/(\w+)$/)?.[1];
  if (editing) return (el) => editor(el, editing);
  return routes[path] || notFound;
}

function render() {
  cleanup?.();
  cleanup = null;
  document.body.classList.remove("playing"); // the play page puts it back
  view.innerHTML = "";
  cleanup = pageFor(location.pathname)(view) || null;
  const path = location.pathname;
  const section = path.startsWith("/play/my/") || path.startsWith("/editor") ? "/editor" : path.startsWith("/play") ? "/levels" : path;
  for (const a of document.querySelectorAll("#nav a")) {
    a.classList.toggle("active", a.getAttribute("href") === section);
  }
}

document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-link]");
  if (!link) return;
  e.preventDefault();
  navigate(link.getAttribute("href"));
});
window.addEventListener("popstate", render);

function home(el) {
  const progress = loadProgress();
  const next = nextToPlay(progress);
  const started = Object.keys(progress.levels).length > 0;
  const stars = LEVELS.reduce((n, l) => n + starCount(l, progress.levels[l.id]), 0);
  const $ = html(
    el,
    `<h1>Gyro Rocket</h1>
    <p>Tilt your phone to steer a little rocket through caves. Refuel on the way, and land it on the exit pad in one piece.</p>
    <div class="cards">
      <a class="card primary" href="/play/${next.id}" data-link>
        <b>${started ? "Continue" : "Start"}: ${next.id} ${next.name}</b>
        <span>${progress.levels[next.id] ? "Play it again" : "Tilt to steer, hold the screen to burn"}</span>
      </a>
      <a class="card" href="/levels" data-link><b>Levels</b><span>${stars} of ${LEVELS.length * 3} stars</span></a>
      <a class="card" href="/help" data-link><b>Help</b><span>Controls, fuel and stars</span></a>
    </div>
    <h2>Theme</h2>
    ${THEME_PICKER}
    <button id="fs" class="wide"></button>
    <p class="hint">Tip: <i>Add to Home screen</i> launches the game fullscreen every time.</p>`,
  );
  const unbindTheme = bindThemePicker($(".theme"));
  const unbindFs = bindFullscreenButton($("#fs"));
  return () => {
    unbindTheme();
    unbindFs();
  };
}

// Every world's levels, with the stars earned and best times; locked levels greyed out.
function levels(el) {
  const progress = loadProgress();
  const all = allUnlocked();
  html(
    el,
    `<h1>Levels</h1>
    ${WORLDS.map((world) => {
      const stars = world.levels.reduce((n, l) => n + starCount(l, progress.levels[l.id]), 0);
      return `<section class="world">
        <h2>${world.number} · ${world.name} <small>★ ${stars}/${world.levels.length * 3}</small></h2>
        <p class="hint">${world.about}</p>
        <div class="level-grid">
          ${world.levels
            .map((l) => {
              const record = progress.levels[l.id];
              if (!all && !isUnlocked(progress, l.id)) {
                return `<div class="level locked" aria-label="${l.id} ${l.name}, locked"><b>${l.id}</b>${icon("lock")}<small>${l.name}</small></div>`;
              }
              return `<a class="level${record ? " done" : ""}" href="/play/${l.id}" data-link>
                <b>${l.id}</b>${starsHtml(starsOf(l, record))}<small>${l.name}</small>
                <small class="best">${record ? formatTime(record.best) : "&nbsp;"}</small>
              </a>`;
            })
            .join("")}
        </div>
      </section>`;
    }).join("")}
    <p class="hint">More worlds are on the way. There's also the <a href="/play/test" data-link>test cave</a>.</p>
    ${all ? `<p class="hint">Every level is open (the ?unlock debug flag). <a href="/levels?unlock=off">Lock them again</a></p>` : ""}`,
  );
}

function help(el) {
  const $ = html(
    el,
    `<h1>Help</h1>
    <h2>Controls</h2>
    <dl>
      <dt>Steer</dt><dd>Tilt the phone left or right, held flat or upright. Or ← → / A D.</dd>
      <dt>Burn</dt><dd>Hold a finger anywhere on the screen. Or ↑ / W / Space, or hold the mouse.</dd>
      <dt>Pause</dt><dd>The ❚❚ button, or P / Esc. The pause menu has restarts and tilt sensitivity.</dd>
      <dt>Autopilot</dt><dd>The arrow button, or O: sit back and watch it fly the level, from wherever you are. It's careful rather than quick, and a run it flies any of doesn't earn stars.</dd>
    </dl>
    <h2>Landing</h2>
    <p>Land on any flat floor: touch down slower than ${SAFE_SPEED} m/s (the speed turns green), nearly upright, with both feet on the flat. Land on the green exit pad to finish.</p>
    <h2>Fuel</h2>
    <p>The engine only burns while there's fuel. Land on a blue fuel pad to fill up and mend the hull. After a crash, or when you're stuck without fuel, you start again from the last fuel pad you landed on. The clock keeps running.</p>
    <h2>Hitting rock</h2>
    <p>The rocket bounces off rock and loses hull, more the harder it hits. A slam, or losing all its hull, breaks it up. Tap to try again.</p>
    <h2>Keys, doors and switches</h2>
    <p>Fly through a key to pick it up; the doors of its colour and shape open as you come near. Land on an orange switch to open the gate with its number. Some gates shut again: the countdown starts as you lift off. The map (▦ or M) shows where you've been.</p>
    <h2>Flames and lava</h2>
    <p>Flamethrowers flicker before they fire, and burn the hull fast: a quick pass hurts, lingering kills. Some fire on a beat, some when you come near, and some never stop. Lava, and the blobs it throws up, destroy the rocket at a touch.</p>
    <h2>Machinery and magnets</h2>
    <p>Fans blow you along their column of dust: burn hard to fight them. Magnets pull you in (their rings close in) or push you away (their rings spread out), hardest close up. Moving blocks shove you and carry you if you land on them. Crushers shake before they slam: don't be in the way, or squeezed against the rock.</p>
    <h2>Dark, lasers and turrets</h2>
    <p>Some caves are dark: your headlight shows the way ahead, and pads, keys and crystals glow. A laser beam destroys you at a touch; some flicker before they come on, and a switch can turn one off. Turrets glow as they wind up, then fire a slow shot at where you are: keep moving, or put rock between you.</p>
    <h2>Falling rock, crumbling rock and rising lava</h2>
    <p>Stalactites shake and shed dust when you pass beneath them, then drop: hang back until they've fallen, or be quick. A hit costs hull. Crumbling rock is paler, with glowing cracks: touch it or land on it and it gives way a moment later, with all the crumbling rock joined to it, so take off fast. In some caves the lava rises, from the start or once you've taken something: the HUD shows how far below you it is. Climb!</p>
    <h2>Stars</h2>
    <p>Each level has three: one for finishing, one for beating its par time, and one for collecting all its crystals ◆ in one run. Finishing a level opens the next.</p>
    <h2>Level editor</h2>
    <p>Build your own caves under Editor, from a plain cave or a copy of one you've played. Paint rock, air, pads, keys, doors and hazards with one finger. With Move (the arrows), drag a placed thing to reposition it or drag the background to pan; use two fingers to move and zoom. If something's wrong with the level, it says what at the top, and Show finds it. Fly tries it straight away. The palette also adds switches, gates, fans, magnets and other things. Inspect (O), or hold a thing, to change its settings; moving blocks have a path you can drag. The menu has level settings, a reach overlay, Check for unreachable places, and Autopilot for a test flight with tank and par suggestions.</p>
    <h2>Tilt not working?</h2>
    <p class="hint">Browsers only share the motion sensors over HTTPS (or on localhost). On iPhone, allow motion access when asked.</p>
    <button id="fs" class="wide"></button>`,
  );
  const unbindFs = bindFullscreenButton($("#fs"));
  return () => unbindFs();
}

function notFound(el) {
  html(el, `<h1>Not found</h1><p><a href="/" data-link>Go home</a></p>`);
}

render();
