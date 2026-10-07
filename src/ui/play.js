import { createGame } from "../game.js";
import { requestTiltPermission } from "../controls.js";
import { SAFE_SPEED, HULL, TICK_RATE, CENTRE_Y } from "../sim/rocket.js";
import { parseLevel, TILE } from "../sim/level.js";
import { clock, padUnder, crystalCount, gateTimers } from "../sim/world.js";
import { rising } from "../sim/hazards/rise.js";
import { KEY_LOOKS, css, shapePath } from "../looks.js";
import { drawMap } from "./map.js";
import { levelById, nextLevel, endingOf, EXTRAS } from "../levels/index.js";
import { loadProgress, saveProgress, recordRun, starsOf, isUnlocked, allUnlocked, loadSettings, saveSettings } from "../progress.js";
import { playableLevel } from "../mylevels.js";
import { makeReplay, unpackInput, unplayable, counts } from "../replay.js";
import { loadRun, keepRun, finishOf } from "../runs.js";
import { html, icon, esc, formatTime, starsHtml, saveFile, bindFullscreenButton, THEME_PICKER, bindThemePicker } from "./dom.js";

const RESULTS_AFTER = TICK_RATE / 2; // ticks on the exit pad before the results come up
const LAVA_NEWS = 3 * TICK_RATE; // ticks the HUD says the lava's rising, once it starts
const LAVA_NEAR = 10; // m below the rocket that rising lava shows red
const TILT_MIN = 15; // degrees for full steer, at the sensitivity slider's ends
const TILT_MAX = 60;

// The play page for level `id`: the game with its HUD, the pause menu (button, P
// or Esc, and whenever the app is hidden), the level complete sheet, and with ?dev
// in the URL, a developer overlay (and every level open). The frame rate display
// is a debug option in the pause menu, and ?dev shows it too. My levels, from the
// editor, have ids "my:<id>", and lead back to the editor.
//
// Every run is recorded (game.js), and the best one that counts is kept (runs.js):
// the pause menu can watch it, and the results can watch the run just flown. For
// my level, the kept run is its finish, which the editor shows. With ?dev, the
// results can save the run as a file, for scripts/verify.js.
export function play(el, id) {
  const mine = id.startsWith("my:") ? id.slice(3) : null;
  const dev = new URLSearchParams(location.search).has("dev");
  const progress = loadProgress();
  let def = null;
  let level = null;
  let problem = null;
  try {
    def = mine ? playableLevel(mine) : levelById(id);
    level = def && parseLevel(def);
  } catch (e) {
    if (!mine) throw e; // the game's own levels are tested
    problem = e.message;
  }
  if (mine && !level) {
    html(
      el,
      `<h1>${problem ? "This level can't be flown yet" : "No such level"}</h1>
      <p>${problem ? esc(problem) : "It may have been deleted."}</p>
      <p><a href="${problem ? `/editor/${mine}` : "/editor"}" data-link>Back to the editor</a></p>`,
    );
    return null;
  }
  const extra = EXTRAS.includes(def); // the test cave and the big cave: always open, never recorded
  if (!def || (!extra && !mine && !dev && !allUnlocked() && !isUnlocked(progress, id))) {
    html(
      el,
      `<h1>${def ? `${id} is locked` : "No such level"}</h1>
      <p>${def ? "Finish the level before it to open it." : ""}</p>
      <p><a href="/levels" data-link>Pick a level</a></p>`,
    );
    return null;
  }
  document.body.classList.add("playing");

  const title = extra || mine ? def.name || "My level" : `${def.id} ${def.name}`;
  const settings = loadSettings();
  const next = extra || mine ? null : nextLevel(id);
  const ending = extra || mine ? null : endingOf(id); // the way out of the core, the end of part one
  // Where the menus lead: the levels, or for my level, back to the editor.
  const back = mine ? { href: `/editor/${mine}`, label: "Back to editor" } : { href: "/levels", label: "Levels" };
  const runId = mine ? `my:${mine}` : def.id; // where its best run is kept
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
          <span class="readout"><span class="crystals" id="crystals"></span><span class="keys" id="keys"></span><span class="lava" id="lava"></span><span class="speed" id="speed">0.0 m/s</span></span>
        </div>
        <button class="icon-btn" id="fs"></button>
      </div>
      <div class="message" id="message"></div>
      <div class="debug">
        <pre class="fps" id="fps" hidden><b>… fps</b></pre>
        <pre class="dev" id="dev" hidden></pre>
      </div>

      <div class="overlay menu" id="pause" hidden>
        <section>
          <h2>Paused</h2>
          <p class="hint">${esc(title)}</p>
          <button class="big" id="resume">Resume</button>
          <div class="buttons" id="restarts">
            <button id="restart-pad">Restart from pad</button>
            <button id="restart-level">Restart level</button>
          </div>
          <button id="watch-best" hidden></button>
          <button id="stop-watch" hidden>Stop watching</button>
          <a class="button" href="${back.href}" data-link>${back.label}</a>
        </section>
        <section>
          <button id="auto-menu" aria-pressed="false">Autopilot: off</button>
          <label class="setting">
            <span>Tilt sensitivity</span>
            <input type="range" id="tilt" min="${TILT_MIN}" max="${TILT_MAX}" step="5">
            <small class="hint" id="tilt-note"></small>
          </label>
          ${THEME_PICKER}
          <a class="button" href="/profile" data-link>Profile</a>
          <div class="buttons">
            <button id="fs-menu"></button>
            <button id="fps-menu" aria-pressed="false"></button>
          </div>
        </section>
      </div>

      <div class="overlay map" id="map" hidden>
        <canvas id="map-canvas"></canvas>
        <p class="hint">Tap to close</p>
      </div>

      <div class="overlay menu" id="done" hidden>
        <section>
          <h2 id="done-title">${ending ? ending.title : "Level complete"}</h2>
          <p class="hint">${esc(title)}</p>
          ${ending ? `<p id="ending">${ending.text}${next ? "" : " That's every level, for now: go back for the stars you missed."}</p>` : ""}
          <div class="awards" id="awards"></div>
          <p class="best-run" id="best-stars" hidden></p>
          <dl class="results" id="results"></dl>
        </section>
        <section>
          ${
            next
              ? `<a class="button big" href="/play/${next.id}${dev ? "?dev" : ""}" data-link id="next">Next: ${next.id} ${next.name}</a>`
              : mine
                ? `<a class="button big" href="${back.href}" data-link id="next">Back to editor</a>`
                : `<a class="button big" href="/levels" data-link id="next">Back to the levels</a>`
          }
          <div class="buttons">
            <button id="retry">Retry</button>
            <button id="watch">Watch</button>
            <a class="button" href="${mine ? "/editor" : "/levels"}" data-link>${mine ? "My levels" : "Levels"}</a>
          </div>
          ${dev ? `<button id="save-run">Save this run</button>` : ""}
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
    lava: $("#lava"),
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
  const fpsEl = $("#fps");
  let fpsShown = 0;

  let watched = null; // the run being watched: { codes, replay, label }
  let lastRun = null; // the run just finished: { codes, replay (once it's made) }
  let bestRun = null; // the kept run, if it can be watched: { codes, replay }
  const kept = extra ? null : loadRun(runId);
  if (counts(kept) && !unplayable(def, kept)) {
    unpackInput(kept.input)
      .then((codes) => {
        bestRun ??= { codes, replay: kept };
        syncPauseMenu();
      })
      .catch(() => {});
  }

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
      // Rising lava: how far below the rocket's feet it is.
      const below = w.rise && w.rise.from >= 0 ? Math.max(0, r.y - CENTRE_Y - w.rise.y) : null;
      show(hud.lava, below === null ? "" : `Lava ${below.toFixed(0)} m ↓`);
      hud.lava.dataset.near = below !== null && below < LAVA_NEAR;
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
      const how =
        { flame: "Burned up!", lava: "Into the lava!", crush: "Crushed!", laser: "Zapped!", shot: "Shot down!", stalactite: "Hit by falling rock!" }[r.cause] ??
        "Crashed!";
      if (w.done) text = "";
      else if (watched) text = `Watching ${watched.label}`;
      else if (game?.pilot) text = game.pilot.status;
      else if (performance.now() < lostUntil) text = game.lastPilot.status;
      else if (r.state === "crashed") text = `${how} Tap to go back to ${back}`;
      else if (w.stranded) text = `Out of fuel! Tap to go back to ${back}`;
      else if (rising(w) && w.tick - w.rise.from < LAVA_NEWS) text = "The lava's rising!";
      else if (on?.kind === "switch") {
        const laser = level.lasers.some((l) => l.label === on.opens);
        text = `${laser ? `Laser ${on.label} is off` : `Gate ${on.label} is open`}${on.time ? `. You have ${on.time} s from lift-off` : ""}`;
      }
      else if (timer) text = `${timer.laser ? "Laser" : "Gate"} ${timer.gate.switch} ${timer.laser ? "comes back on" : "shuts"} in ${Math.ceil(timer.seconds)}`;
      else if (on?.kind === "fuel") text = w.refuelling ? "Refuelling…" : "Full up. After a crash, you'll start again here";
      else if (w.startTick < 0) {
        const steer = controls.hasTilt || performance.now() - started < 1500 ? "tilt to steer" : "← → to steer (no tilt sensor found)";
        text = `${title}. Hold the screen (or ↑) to burn, ${steer}. ${hasFuelPads ? "Refuel on blue pads, finish" : "Finish"} on the green one.`;
      }
      show(hud.message, text);
      hud.message.hidden = !text;

      if (w.done && !finished && w.tick - w.endTick >= RESULTS_AFTER) finish(w);
      else if (watched && !finished && w.tick >= watched.codes.length + RESULTS_AFTER) finish(w); // it should have landed by now
      devHud?.update(w, game);
      if (!fpsEl.hidden && game && game.stats.fps !== fpsShown) {
        fpsShown = game.stats.fps;
        showFps(fpsEl, game.stats);
      }
    },
  });

  // The results: this run's time, crystals and stars, with saved best stars below.
  // Watching a run, the replay's results instead.
  function finish(w) {
    finished = true;
    $("#done").hidden = false;
    $("#pause-btn").hidden = $("#map-btn").hidden = $("#auto-btn").hidden = true;
    $("#next").focus();
    if (watched) return replayResults(w);
    const time = clock(w);
    const got = crystalCount(w);
    const all = got === level.crystals.length;
    const run = game.recording();
    const made = (lastRun = { codes: run.codes, replay: null });
    $("#watch").hidden = run.cheated; // the cheats aren't in its inputs
    makeReplay(def, w, run.codes, { cheated: run.cheated }).then((replay) => {
      made.replay = replay;
      const isBest = !extra && keepRun(runId, replay);
      if (isBest) bestRun = { codes: made.codes, replay };
      if (mine) $("#awards").innerHTML = `<p class="hint">${finishNote(replay, isBest)}</p>`;
      syncPauseMenu();
    });
    let result = null;
    if (!extra && !mine && !w.assisted) {
      result = recordRun(progress, def, { time, crystals: all });
      saveProgress(progress);
    }
    const record = progress.levels[def.id];
    const best = record?.best;
    const bestStars = $("#best-stars");
    bestStars.hidden = extra || !!mine || !record;
    if (!bestStars.hidden) {
      bestStars.innerHTML = `Best run ${starsHtml(starsOf(def, record))} <small>${formatTime(record.run?.time ?? record.best)}</small>`;
    }
    $("#awards").innerHTML = mine
      ? ""
      : w.assisted
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
  }

  // What a finish of my level means: it's marked finished, with the run kept, if it
  // counts and is its best.
  function finishNote(replay, isBest) {
    if (replay.assisted) return "Flown with the autopilot, so it doesn't count as a finish.";
    if (replay.cheated) return "Flown with a cheat on, so it doesn't count as a finish.";
    if (isBest) return `Your level is finished, in ${formatTime(replay.time)}. This run is kept with it.`;
    const old = finishOf(runId, def);
    return old ? `Your level's finish stays at ${formatTime(old.time)}, a faster run.` : "Couldn't keep this run: the phone's storage for the game is full.";
  }

  // A watched run's results. It lands on the exit on the tick it did, or something's wrong.
  function replayResults(w) {
    $("#done-title").textContent = "Replay";
    $("#best-stars").hidden = true;
    if ($("#ending")) $("#ending").hidden = true;
    const { replay } = watched;
    const ticks = replay?.ticks ?? watched.codes.length;
    const note = !w.done
      ? `This replay went wrong: it should have landed on the exit on tick ${ticks}.`
      : w.endTick !== ticks
        ? `This replay went wrong: it landed on the exit on tick ${w.endTick}, not ${ticks}.`
        : dev
          ? `It landed on the exit on tick ${w.endTick}, as it did.`
          : "";
    $("#awards").innerHTML = note ? `<p class="hint">${note}</p>` : "";
    $("#results").innerHTML = `
      <dt>Time</dt><dd>${formatTime(clock(w))}</dd>
      ${level.crystals.length ? `<dt>Crystals</dt><dd>${crystalCount(w)} of ${level.crystals.length}</dd>` : ""}
      <dt>Restarts</dt><dd>${w.restarts}</dd>`;
    $("#retry").textContent = "Play";
    $("#watch").textContent = "Watch again";
  }

  // Watches a recorded run from the start: { codes, replay, label }.
  function startWatching(run) {
    watched = run;
    game.watch(run.codes);
    finished = false;
    $("#done").hidden = true;
    $("#pause-btn").hidden = $("#map-btn").hidden = false;
    $("#auto-btn").hidden = true;
    syncPauseMenu();
  }

  // Back to playing, from the start.
  function playAgain() {
    watched = null;
    game.restartLevel();
    finished = false;
    $("#done").hidden = true;
    $("#done-title").textContent = ending ? ending.title : "Level complete";
    if ($("#ending")) $("#ending").hidden = false;
    $("#retry").textContent = "Retry";
    $("#watch").textContent = "Watch";
    $("#watch").hidden = false;
    $("#pause-btn").hidden = $("#map-btn").hidden = $("#auto-btn").hidden = false;
    syncPauseMenu();
  }

  const toggleAutopilot = () => {
    if (!finished && !watched) game.setAutopilot(!game.pilot);
  };
  $("#auto-btn").addEventListener("click", () => {
    toggleAutopilot();
    document.activeElement?.blur();
  });
  $("#auto-menu").addEventListener("click", toggleAutopilot);

  $("#retry").addEventListener("click", () => {
    playAgain();
    document.activeElement?.blur();
  });
  $("#watch").addEventListener("click", () => {
    startWatching(watched ?? { ...lastRun, label: "this run" });
    document.activeElement?.blur();
  });
  // With ?dev: the run as a file, for scripts/verify.js. The dev server writes it
  // to runs/ in the project (vite.config.js); elsewhere, it's a download.
  $("#save-run")?.addEventListener("click", async (e) => {
    const replay = watched ? watched.replay : lastRun?.replay;
    if (!replay) return;
    const text = JSON.stringify({ id: def.id, ...(mine && { def }), ...replay });
    if (import.meta.env?.DEV) {
      try {
        const res = await fetch("/__runs", { method: "POST", body: text });
        if (res.ok) return show(e.target, `Saved as ${(await res.json()).file}`);
      } catch {}
    }
    saveFile(`run-${runId.replace(":", "-")}-${replay.ticks}.json`, text);
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
  // Restarts while playing; watching, a way back to playing.
  function syncPauseMenu() {
    $("#restarts").hidden = $("#auto-menu").hidden = !!watched;
    $("#stop-watch").hidden = !watched;
    $("#watch-best").hidden = !!watched || !bestRun;
    if (bestRun) show($("#watch-best"), `Watch your best run, ${formatTime(bestRun.replay.time)}`);
  }
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
  $("#watch-best").addEventListener("click", () => {
    startWatching({ ...bestRun, label: "your best run" });
    closePause();
  });
  $("#stop-watch").addEventListener("click", () => {
    playAgain();
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

  // The frame rate display, a debug option.
  const fpsBtn = $("#fps-menu");
  const syncFps = () => {
    fpsBtn.setAttribute("aria-pressed", settings.fps);
    show(fpsBtn, `Frame rate: ${settings.fps ? "on" : "off"}`);
    fpsEl.hidden = !settings.fps && !dev;
  };
  fpsBtn.addEventListener("click", () => {
    settings.fps = !settings.fps;
    saveSettings(settings);
    syncFps();
  });
  syncFps();

  if (devHud) {
    gameEl.querySelector(":scope > canvas").addEventListener("pointermove", devHud.onPointer(game)); // the game's, not the map's
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

// The frame rate display, from the game's `stats`: frames a second (green from 55,
// amber from 40, red below), the slowest frame, the code's time per frame, and
// the draw calls and triangles.
function showFps(el, s) {
  el.dataset.level = s.fps >= 55 ? "ok" : s.fps >= 40 ? "low" : "bad";
  el.innerHTML = [
    `<b>${Math.round(s.fps)} fps</b>`,
    `slowest ${Math.round(s.slowest)} ms`,
    `code ${s.work.toFixed(1)} ms`,
    `${s.calls} draws · ${Math.round(s.triangles / 1000)}k tris`,
  ].join("\n");
}

// The ?dev overlay, for building and tuning levels: the tile under the pointer,
// time and fuel since the last pad, and the cheats (G: no damage, F: endless fuel).
function createDevHud(el) {
  el.hidden = false;
  let pointer = null;
  let lastPad = { tick: 0, fuel: 0 };
  return {
    onPointer: (game) => (e) => {
      pointer = game.screenToWorld(e.clientX, e.clientY);
    },
    update(w, game) {
      const r = w.rocket;
      if (padUnder(w.level, r)) lastPad = { tick: w.tick, fuel: r.fuel };
      const tile = pointer
        ? `column ${Math.floor(pointer.x / TILE) + 1}, row ${w.level.height - Math.floor(pointer.y / TILE)}`
        : "point at something";
      el.textContent = [
        tile,
        `since the last pad: ${((w.tick - lastPad.tick) / TICK_RATE).toFixed(1)} s, ${(lastPad.fuel - r.fuel).toFixed(1)} s of fuel`,
        `G no damage: ${game.cheats.god ? "on" : "off"} · F endless fuel: ${game.cheats.fuel ? "on" : "off"}`,
      ].join("\n");
    },
  };
}
