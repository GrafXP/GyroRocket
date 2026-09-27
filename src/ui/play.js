import { createGame } from "../game.js";
import { requestTiltPermission } from "../controls.js";
import { SAFE_SPEED, HULL, TICK_RATE } from "../sim/rocket.js";
import { parseLevel, TILE } from "../sim/level.js";
import { clock, padUnder, crystalCount, gateTimers } from "../sim/world.js";
import { KEY_LOOKS, css, shapePath } from "../looks.js";
import { drawMap } from "./map.js";
import { levelById, nextLevel, TEST_CAVE } from "../levels/index.js";
import { loadProgress, saveProgress, recordRun, isUnlocked, loadSettings, saveSettings } from "../progress.js";
import { html, icon, formatTime, bindFullscreenButton, THEME_PICKER, bindThemePicker } from "./dom.js";

const RESULTS_AFTER = TICK_RATE / 2; // ticks on the exit pad before the results come up
const TILT_MIN = 15; // degrees for full steer, at the sensitivity slider's ends
const TILT_MAX = 60;

// The play page for level `id`: the game with its HUD, the pause menu (button, P
// or Esc, and whenever the app is hidden), the level complete sheet, and with ?dev
// in the URL, a developer overlay (and every level open).
export function play(el, id) {
  const def = levelById(id);
  const dev = new URLSearchParams(location.search).has("dev");
  const progress = loadProgress();
  if (!def || (def !== TEST_CAVE && !dev && !isUnlocked(progress, id))) {
    html(
      el,
      `<h1>${def ? `${id} is locked` : "No such level"}</h1>
      <p>${def ? "Finish the level before it to open it." : ""}</p>
      <p><a href="/levels" data-link>Pick a level</a></p>`,
    );
    return null;
  }
  document.body.classList.add("playing");

  const level = parseLevel(def);
  const title = def === TEST_CAVE ? def.name : `${def.id} ${def.name}`;
  const settings = loadSettings();
  const next = def === TEST_CAVE ? null : nextLevel(id);
  const $ = html(
    el,
    `<div class="game" id="game">
      <div class="hud">
        <button class="icon-btn" id="pause-btn" aria-label="Pause">${icon("pause")}</button>
        <button class="icon-btn" id="map-btn" aria-label="Map">${icon("map")}</button>
        <button class="icon-btn" id="auto-btn" aria-label="Autopilot" aria-pressed="false">${icon("auto")}</button>
        <div class="score">
          <b id="time">0:00.0</b>
          <span class="gauge"><small>Fuel</small><span class="bar" role="meter" aria-label="Fuel" aria-valuemin="0" aria-valuemax="100"><i class="fuel" id="fuel"></i></span></span>
          <span class="gauge"><small>Hull</small><span class="bar" role="meter" aria-label="Hull" aria-valuemin="0" aria-valuemax="100"><i class="hull" id="hull"></i></span></span>
          <span class="readout"><span class="crystals" id="crystals"></span><span class="keys" id="keys"></span><span class="speed" id="speed">0.0 m/s</span></span>
        </div>
        <button class="icon-btn" id="fs"></button>
      </div>
      <div class="message" id="message"></div>
      <pre class="dev" id="dev" hidden></pre>

      <div class="overlay menu" id="pause" hidden>
        <section>
          <h2>Paused</h2>
          <p class="hint">${title}</p>
          <button class="big" id="resume">Resume</button>
          <div class="buttons">
            <button id="restart-pad">Restart from pad</button>
            <button id="restart-level">Restart level</button>
          </div>
          <a class="button" href="/levels" data-link>Levels</a>
        </section>
        <section>
          <button id="auto-menu" aria-pressed="false">Autopilot: off</button>
          <label class="setting">
            <span>Tilt sensitivity</span>
            <input type="range" id="tilt" min="${TILT_MIN}" max="${TILT_MAX}" step="5">
            <small class="hint" id="tilt-note"></small>
          </label>
          ${THEME_PICKER}
          <button id="fs-menu"></button>
        </section>
      </div>

      <div class="overlay map" id="map" hidden>
        <canvas id="map-canvas"></canvas>
        <p class="hint">Tap to close</p>
      </div>

      <div class="overlay menu" id="done" hidden>
        <section>
          <h2>Level complete</h2>
          <p class="hint">${title}</p>
          <div class="awards" id="awards"></div>
          <dl class="results" id="results"></dl>
        </section>
        <section>
          ${
            next
              ? `<a class="button big" href="/play/${next.id}${dev ? "?dev" : ""}" data-link id="next">Next: ${next.id} ${next.name}</a>`
              : `<a class="button big" href="/levels" data-link id="next">Back to the levels</a>`
          }
          <div class="buttons">
            <button id="retry">Retry</button>
            <a class="button" href="/levels" data-link>Levels</a>
          </div>
        </section>
      </div>

      <div class="overlay" id="tilt-ask" hidden>
        <p>Gyro Rocket steers by tilting your phone, and needs your OK to read its motion sensors.</p>
        <button class="big" id="tilt-ok">Enable tilt steering</button>
      </div>
    </div>`,
  );
  const gameEl = $("#game");
  const unbind = [bindFullscreenButton($("#fs")), bindFullscreenButton($("#fs-menu")), bindThemePicker($(".theme"))];

  // iOS asks before it sends orientation events, and only from a tap.
  if (typeof globalThis.DeviceOrientationEvent?.requestPermission === "function") {
    const ask = $("#tilt-ask");
    ask.hidden = false;
    $("#tilt-ok").addEventListener("click", async () => {
      await requestTiltPermission();
      ask.hidden = true;
    });
  }

  const hud = {
    time: $("#time"),
    fuel: $("#fuel"),
    hull: $("#hull"),
    speed: $("#speed"),
    crystals: $("#crystals"),
    keys: $("#keys"),
    message: $("#message"),
  };
  let keysShown = "";
  let autoShown = null;
  let lostUntil = 0; // when to stop saying the autopilot gave up
  const show = (el, text) => el.textContent !== text && (el.textContent = text);
  const started = performance.now();
  const hasFuelPads = level.pads.some((p) => p.kind === "fuel");
  let lastHit = -1;
  let finished = false;
  const devHud = dev ? createDevHud($("#dev")) : null;

  const game = createGame(gameEl, {
    level,
    fullTilt: settings.fullTilt,
    onFrame(w, controls) {
      const r = w.rocket;
      show(hud.time, formatTime(clock(w)));
      // Fuel goes amber below 30% and flashes red below 15%; the hull at 60% and 30%.
      const f = r.fuel / r.tank;
      setBar(hud.fuel, f, f > 0.3 ? "ok" : f > 0.15 ? "low" : "bad");
      const h = r.hull / HULL;
      setBar(hud.hull, h, h > 0.6 ? "ok" : h > 0.3 ? "low" : "bad");
      // Speed, green while slow enough to land.
      const v = Math.hypot(r.vx, r.vy);
      show(hud.speed, `${v.toFixed(1)} m/s`);
      hud.speed.dataset.safe = r.state === "flying" && v <= SAFE_SPEED;
      show(hud.crystals, level.crystals.length ? `◆ ${crystalCount(w)}/${level.crystals.length}` : "");
      if (w.keys.join() !== keysShown) {
        keysShown = w.keys.join();
        hud.keys.innerHTML = w.keys
          .map((k) => `<svg viewBox="0 0 24 24" role="img" aria-label="${k} key"><path d="${shapePath(KEY_LOOKS[k].shape)}" fill="${css(KEY_LOOKS[k].color)}"/></svg>`)
          .join("");
      }

      // A red flash round the edges when the rocket hits rock.
      if (r.hitTick !== lastHit) {
        lastHit = r.hitTick;
        if (r.hitTick >= 0) {
          gameEl.classList.remove("hit");
          void gameEl.offsetWidth; // restart the animation
          gameEl.classList.add("hit");
        }
      }

      // The autopilot button, and a word when it gives up.
      const auto = !!game?.pilot;
      if (auto !== autoShown) {
        autoShown = auto;
        for (const b of [$("#auto-btn"), $("#auto-menu")]) b.setAttribute("aria-pressed", auto);
        show($("#auto-menu"), `Autopilot: ${auto ? "on" : "off"}`);
        if (!auto && game?.lastPilot?.failed) lostUntil = performance.now() + 3000;
      }

      const back = w.checkpoint.pad === level.start ? "the start" : "the last fuel pad";
      const on = padUnder(level, r);
      const timer = gateTimers(w)[0];
      let text = "";
      const how = { flame: "Burned up!", lava: "Into the lava!", crush: "Crushed!" }[r.cause] ?? "Crashed!";
      if (w.done) text = "";
      else if (game?.pilot) text = game.pilot.status;
      else if (performance.now() < lostUntil) text = game.lastPilot.status;
      else if (r.state === "crashed") text = `${how} Tap to go back to ${back}`;
      else if (w.stranded) text = `Out of fuel! Tap to go back to ${back}`;
      else if (on?.kind === "switch") text = `Gate ${on.label} is open${on.time ? `. You have ${on.time} s from lift-off` : ""}`;
      else if (timer) text = `Gate ${timer.gate.switch} shuts in ${Math.ceil(timer.seconds)}`;
      else if (on?.kind === "fuel") text = w.refuelling ? "Refuelling…" : "Full up. After a crash, you'll start again here";
      else if (w.startTick < 0) {
        const steer = controls.hasTilt || performance.now() - started < 1500 ? "tilt to steer" : "← → to steer (no tilt sensor found)";
        text = `${title}. Hold the screen (or ↑) to burn, ${steer}. ${hasFuelPads ? "Refuel on blue pads, finish" : "Finish"} on the green one.`;
      }
      show(hud.message, text);
      hud.message.hidden = !text;

      if (w.done && !finished && w.tick - w.endTick >= RESULTS_AFTER) finish(w);
      devHud?.update(w, game);
    },
  });

  // The results: time against par, crystals, and the stars, new ones popping in.
  function finish(w) {
    finished = true;
    const time = clock(w);
    const got = crystalCount(w);
    const all = got === level.crystals.length;
    let result = null;
    if (def !== TEST_CAVE && !w.assisted) {
      result = recordRun(progress, def, { time, crystals: all });
      saveProgress(progress);
    }
    const best = progress.levels[def.id]?.best;
    $("#awards").innerHTML = w.assisted
      ? `<p class="hint">Flown with the autopilot, so no stars</p>`
      : result
      ? [
          "Finished",
          `Par ${formatTime(def.par)}`,
          level.crystals.length > 1 ? `All ${level.crystals.length} crystals` : "The crystal",
        ]
          .map(
            (label, i) =>
              `<div class="award${result.after[i] ? " on" : ""}${result.after[i] && !result.before[i] ? " new" : ""}" style="--i: ${i}"><span>★</span><small>${label}</small></div>`,
          )
          .join("")
      : "";
    $("#results").innerHTML = `
      <dt>Time</dt><dd>${formatTime(time)}${result?.newBest && result.before[0] ? " <b>New best!</b>" : best !== undefined && !result?.newBest ? ` <small>best ${formatTime(best)}</small>` : ""}</dd>
      ${level.crystals.length ? `<dt>Crystals</dt><dd>${got} of ${level.crystals.length}</dd>` : ""}
      <dt>Restarts</dt><dd>${w.restarts}</dd>`;
    $("#done").hidden = false;
    $("#pause-btn").hidden = $("#map-btn").hidden = $("#auto-btn").hidden = true;
    $("#next").focus();
  }

  const toggleAutopilot = () => {
    if (!finished) game.setAutopilot(!game.pilot);
  };
  $("#auto-btn").addEventListener("click", () => {
    toggleAutopilot();
    document.activeElement?.blur();
  });
  $("#auto-menu").addEventListener("click", toggleAutopilot);

  $("#retry").addEventListener("click", () => {
    game.restartLevel();
    finished = false;
    $("#done").hidden = true;
    $("#pause-btn").hidden = $("#map-btn").hidden = $("#auto-btn").hidden = false;
    document.activeElement?.blur();
  });

  // Pausing.
  const pauseMenu = $("#pause");
  const mapEl = $("#map");
  const openPause = () => {
    if (finished || !pauseMenu.hidden) return;
    closeMap();
    game.pause();
    pauseMenu.hidden = false;
    $("#resume").focus();
  };
  const closePause = () => {
    pauseMenu.hidden = true;
    game.resume();
    document.activeElement?.blur(); // so keys fly the rocket again
  };
  $("#pause-btn").addEventListener("click", openPause);

  // The map: the parts of the cave seen so far. The game waits while it's open.
  const openMap = () => {
    if (finished || !pauseMenu.hidden || !mapEl.hidden) return;
    game.pause();
    mapEl.hidden = false;
    drawMap($("#map-canvas"), game.world);
  };
  function closeMap() {
    if (mapEl.hidden) return;
    mapEl.hidden = true;
    game.resume();
    document.activeElement?.blur();
  }
  $("#map-btn").addEventListener("click", openMap);
  mapEl.addEventListener("click", closeMap);
  $("#resume").addEventListener("click", closePause);
  $("#restart-pad").addEventListener("click", () => {
    game.restartFromPad();
    closePause();
  });
  $("#restart-level").addEventListener("click", () => {
    game.restartLevel();
    closePause();
  });
  const onKey = (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === "KeyO" && pauseMenu.hidden && mapEl.hidden) toggleAutopilot();
    else if (e.code === "KeyM") {
      if (mapEl.hidden) openMap();
      else closeMap();
    } else if (e.code === "Escape" && !mapEl.hidden) closeMap();
    else if (e.code === "KeyP" || e.code === "Escape") {
      e.preventDefault();
      if (pauseMenu.hidden) openPause();
      else closePause();
    } else if (dev && e.code === "KeyG") game.cheats.god = !game.cheats.god;
    else if (dev && e.code === "KeyF") game.cheats.fuel = !game.cheats.fuel;
  };
  window.addEventListener("keydown", onKey);
  const onHidden = () => document.hidden && openPause();
  document.addEventListener("visibilitychange", onHidden);

  // Tilt sensitivity: the slider runs from gentle (full steer at TILT_MAX°) to sharp.
  const tilt = $("#tilt");
  const syncTilt = () => {
    tilt.value = TILT_MIN + TILT_MAX - settings.fullTilt;
    show($("#tilt-note"), `Full steer at ${settings.fullTilt}° of tilt`);
  };
  tilt.addEventListener("input", () => {
    settings.fullTilt = TILT_MIN + TILT_MAX - Number(tilt.value);
    saveSettings(settings);
    game.setFullTilt(settings.fullTilt);
    syncTilt();
  });
  syncTilt();

  if (devHud) {
    gameEl.querySelector("canvas").addEventListener("pointermove", devHud.onPointer(game));
    window.game = game; // to poke at from the console
  }

  return () => {
    if (window.game === game) delete window.game;
    window.removeEventListener("keydown", onKey);
    document.removeEventListener("visibilitychange", onHidden);
    for (const u of unbind) u();
    game.dispose();
  };
}

// Fills a HUD bar to `fraction` and colours it by `level` (ok, low or bad).
function setBar(bar, fraction, level) {
  bar.style.width = `${fraction * 100}%`;
  bar.parentElement.setAttribute("aria-valuenow", Math.round(fraction * 100));
  bar.dataset.level = level;
}

// The ?dev overlay, for building and tuning levels: frame rate, the tile under the
// pointer, time and fuel since the last pad, and the cheats (G: no damage, F:
// endless fuel).
function createDevHud(el) {
  el.hidden = false;
  let pointer = null;
  let lastPad = { tick: 0, fuel: 0 };
  let frames = 0;
  let fps = 0;
  let since = performance.now();
  return {
    onPointer: (game) => (e) => {
      pointer = game.screenToWorld(e.clientX, e.clientY);
    },
    update(w, game) {
      frames++;
      const now = performance.now();
      if (now - since >= 1000) {
        fps = Math.round((frames * 1000) / (now - since));
        [frames, since] = [0, now];
      }
      const r = w.rocket;
      if (padUnder(w.level, r)) lastPad = { tick: w.tick, fuel: r.fuel };
      const tile = pointer
        ? `column ${Math.floor(pointer.x / TILE) + 1}, row ${w.level.height - Math.floor(pointer.y / TILE)}`
        : "point at something";
      el.textContent = [
        `${fps} fps · ${tile}`,
        `since the last pad: ${((w.tick - lastPad.tick) / TICK_RATE).toFixed(1)} s, ${(lastPad.fuel - r.fuel).toFixed(1)} s of fuel`,
        `G no damage: ${game.cheats.god ? "on" : "off"} · F endless fuel: ${game.cheats.fuel ? "on" : "off"}`,
      ].join("\n");
    },
  };
}
