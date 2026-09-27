import "./style.css";
import { createGame } from "./game.js";
import { requestTiltPermission } from "./controls.js";
import { SAFE_SPEED, HULL } from "./sim/rocket.js";
import { parseLevel } from "./sim/level.js";
import { clock } from "./sim/world.js";
import testCave from "./levels/testcave.js";
import { getThemePref, setThemePref, onThemeChange } from "./theme.js";
import { fullscreenSupported, isFullscreen, toggleFullscreen, onFullscreenChange } from "./fullscreen.js";

const view = document.getElementById("view");
let cleanup = null;

const routes = {
  "/": home,
  "/play": play,
  "/help": help,
};

function navigate(path) {
  if (path !== location.pathname) history.pushState(null, "", path);
  render();
}

function render() {
  cleanup?.();
  cleanup = null;
  const page = routes[location.pathname] || notFound;
  document.body.classList.toggle("playing", page === play);
  view.innerHTML = "";
  cleanup = page(view) || null;
  for (const a of document.querySelectorAll("#nav a")) {
    a.classList.toggle("active", a.getAttribute("href") === location.pathname);
  }
}

document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-link]");
  if (!link) return;
  e.preventDefault();
  navigate(link.getAttribute("href"));
});
window.addEventListener("popstate", render);

function html(el, markup) {
  el.innerHTML = markup;
  return (sel) => el.querySelector(sel);
}

const PATHS = {
  back: "M15 5l-7 7 7 7",
  expand: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5",
  shrink: "M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5",
};
const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${PATHS[name]}"/></svg>`;

// Keeps a fullscreen button's label (or icon, on an .icon-btn) in sync.
function bindFullscreenButton(btn) {
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

const THEME_PICKER = `<div class="segmented" id="theme" role="group" aria-label="Theme">
  <button data-pref="auto">Auto</button><button data-pref="light">☀ Light</button><button data-pref="dark">☾ Dark</button>
</div>`;

// Auto / Light / Dark picker; the choice is saved and shared by every page.
function bindThemePicker(group) {
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

function home(el) {
  const $ = html(
    el,
    `<h1>Gyro Rocket</h1>
    <p>Tilt your phone to steer a little rocket through a cave, and land it on the exit pad in one piece.</p>
    <div class="cards">
      <a class="card" href="/play" data-link><b>Fly</b><span>The test cave: tilt to steer, hold the screen to burn</span></a>
      <a class="card" href="/help" data-link><b>Help</b><span>Controls and tips</span></a>
    </div>
    <h2>Theme</h2>
    ${THEME_PICKER}
    <button id="fs" class="wide"></button>
    <p class="hint">Tip: <i>Add to Home screen</i> launches the game fullscreen every time.</p>`,
  );
  const unbindTheme = bindThemePicker($("#theme"));
  const unbindFs = bindFullscreenButton($("#fs"));
  return () => {
    unbindTheme();
    unbindFs();
  };
}

function play(el) {
  const $ = html(
    el,
    `<div class="game" id="game">
      <div class="hud">
        <a href="/" data-link class="icon-btn" aria-label="Back">${icon("back")}</a>
        <div class="score"><b id="time">0:00.0</b><span class="hull" role="meter" aria-label="Hull" aria-valuemin="0" aria-valuemax="${HULL}"><i id="hull"></i></span></div>
        <button class="icon-btn" id="fs"></button>
      </div>
      <div class="banner" id="banner" hidden><b>Level complete</b><span id="banner-time"></span></div>
      <div class="message" id="message"></div>
      <div class="overlay" id="tilt-ask" hidden>
        <p>Gyro Rocket steers by tilting your phone, and needs your OK to read its motion sensors.</p>
        <button class="big" id="tilt-ok">Enable tilt steering</button>
      </div>
    </div>`,
  );
  const unbindFs = bindFullscreenButton($("#fs"));
  const time = $("#time");
  const hull = $("#hull");
  const banner = $("#banner");
  const message = $("#message");
  const gameEl = $("#game");

  // iOS asks before it sends orientation events, and only from a tap.
  if (typeof globalThis.DeviceOrientationEvent?.requestPermission === "function") {
    const ask = $("#tilt-ask");
    ask.hidden = false;
    $("#tilt-ok").addEventListener("click", async () => {
      await requestTiltPermission();
      ask.hidden = true;
    });
  }

  const started = performance.now();
  const show = (el, text) => el.textContent !== text && (el.textContent = text);
  let lastHit = -1;
  const game = createGame(gameEl, {
    level: parseLevel(testCave),
    onFrame(w, controls) {
      const r = w.rocket;
      show(time, formatTime(clock(w)));
      hull.style.width = `${(r.hull / HULL) * 100}%`;
      hull.parentElement.setAttribute("aria-valuenow", Math.round(r.hull));
      hull.dataset.level = r.hull > 60 ? "ok" : r.hull > 30 ? "low" : "bad";
      // A red flash round the edges when the rocket hits rock.
      if (r.hitTick !== lastHit) {
        lastHit = r.hitTick;
        if (r.hitTick >= 0) {
          gameEl.classList.remove("hit");
          void gameEl.offsetWidth; // restart the animation
          gameEl.classList.add("hit");
        }
      }
      banner.hidden = !w.done;
      if (w.done) show($("#banner-time"), formatTime(clock(w)));
      let text = "";
      if (r.state === "crashed") text = "Crashed! Tap to try again";
      else if (w.done) text = "Tap to fly again";
      else if (w.startTick < 0) {
        const steer = controls.hasTilt || performance.now() - started < 1500 ? "tilt to steer" : "← → to steer (no tilt sensor found)";
        text = `Hold the screen (or ↑) to burn, ${steer}. Land on the green pad.`;
      }
      show(message, text);
      message.hidden = !text;
    },
  });

  const onHidden = () => (document.hidden ? game.pause() : game.resume());
  document.addEventListener("visibilitychange", onHidden);

  return () => {
    document.removeEventListener("visibilitychange", onHidden);
    unbindFs();
    game.dispose();
  };
}

function help(el) {
  const $ = html(
    el,
    `<h1>Help</h1>
    <h2>Controls</h2>
    <dl>
      <dt>Steer</dt><dd>Tilt the phone left or right, held flat or upright. Or ← → / A D.</dd>
      <dt>Burn</dt><dd>Hold a finger anywhere on the screen. Or ↑ / W / Space, or hold the mouse.</dd>
    </dl>
    <h2>Landing</h2>
    <p>Land on any flat floor: touch down slower than ${SAFE_SPEED} m/s, nearly upright, with both feet on the flat. Land on the green exit pad to finish.</p>
    <h2>Hitting rock</h2>
    <p>The rocket bounces off rock and loses hull, more the harder it hits. A slam, or losing all its hull, breaks it up. Tap to try again.</p>
    <h2>Tilt not working?</h2>
    <p class="hint">Browsers only share the motion sensors over HTTPS (or on localhost). On iPhone, allow motion access when asked.</p>
    <button id="fs" class="wide"></button>`,
  );
  const unbindFs = bindFullscreenButton($("#fs"));
  return () => unbindFs();
}

// Seconds → "m:ss.s".
function formatTime(s) {
  const tenths = Math.floor(s * 10);
  return `${Math.floor(tenths / 600)}:${((tenths % 600) / 10).toFixed(1).padStart(4, "0")}`;
}

function notFound(el) {
  html(el, `<h1>Not found</h1><p><a href="/" data-link>Go home</a></p>`);
}

render();
