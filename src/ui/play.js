import { createGame } from "../game.js";
import { requestTiltPermission, tiltNeedsAsking, onPhone } from "../controls.js";
import { SAFE_SPEED, HULL, TICK_RATE, CENTRE_Y } from "../sim/rocket.js";
import { parseLevel, TILE } from "../sim/level.js";
import { clock, padUnder, crystalCount } from "../sim/world.js";
import { KEY_LOOKS, css, shapePath } from "../looks.js";
import { CAVE_COLORS } from "../render/cave.js";
import { drawMap } from "./map.js";
import { levelById, nextLevel, endingOf, WORLDS, EXTRAS } from "../levels/index.js";
import { loadProgress, saveProgress, recordRun, starsOf, isUnlocked, allUnlocked, loadSettings } from "../progress.js";
import { playableLevel } from "../mylevels.js";
import { makeReplay, unpackInput, unplayable, counts } from "../replay.js";
import { loadRun, keepRun, finishOf } from "../runs.js";
import { html, esc, formatTime, saveFile, bindFullscreenButton } from "./dom.js";
import { icon, stars, setDigits } from "./kit.js";
import { introduceWorld, completionTitle, guidePosition, flightPrompt } from "./flight.js";
import { controlPictures } from "./flight-pictures.js";
import { frame } from "./frame.js";
import { openSettings } from "./settings.js";

const RESULTS_AFTER = TICK_RATE / 2; // ticks on the exit pad before the results come up
const COUNT_AFTER = 1100; // ms for the three stars to arrive before the clock counts up
const COUNT_MS = 850;
const LAVA_NEAR = 10; // m below the rocket that rising lava shows red
const introducedWorlds = new Set();

// The play page for level `id`: the game with its HUD, the pause menu (button, P
// or Esc, and whenever the app is hidden), the level complete sheet, and with ?dev
// in the URL, a developer overlay (and every level open). The pause menu leads to
// the settings (ui/settings.js), which the level takes up as they change; the
// frame rate display is one, and ?dev shows it too. My levels, from the editor,
// have ids "my:<id>", and lead back to the editor.
//
// Every run is recorded (game.js), and the best one that counts is kept (runs.js):
// the pause menu can watch it, and the results can watch the run just flown. For
// my level, the kept run is its finish, which the editor shows. With ?watch in
// the URL, as the level card's Watch best run has, the page opens watching the
// kept run. With ?dev, the results can save the run as a file, for
// scripts/verify.js.
export function play(el, id) {
  const mine = id.startsWith("my:") ? id.slice(3) : null;
  const params = new URLSearchParams(location.search);
  const dev = params.has("dev");
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
    frame(
      el,
      problem ? "This level can't be flown yet" : "No such level",
      `<p>${problem ? esc(problem) : "It may have been deleted."}</p>`,
      problem ? `/editor/${mine}` : "/editor",
    );
    return null;
  }
  const extra = EXTRAS.includes(def); // the test cave and the big cave: always open, never recorded
  if (!def || (!extra && !mine && !dev && !allUnlocked() && !isUnlocked(progress, id))) {
    frame(el, def ? `${id} is locked` : "No such level", def ? `<p>Finish the level before it to open it.</p>` : "", "/levels");
    return null;
  }
  document.body.classList.add("playing");

  const title = extra || mine ? def.name || "My level" : `${def.id} ${def.name}`;
  const world = WORLDS.find((w) => w.number === def.world);
  const intro = introduceWorld(def, progress, introducedWorlds);
  const doneTitle = completionTitle(def);
  const settings = loadSettings();
  const next = extra || mine ? null : nextLevel(id);
  const ending = extra || mine ? null : endingOf(id); // the way out of the core, the end of part one
  // Where the menus lead: the levels, or for my level, back to the editor.
  const back = mine ? { href: `/editor/${mine}`, label: "Back to editor" } : { href: "/levels", label: "Levels" };
  const runId = mine ? `my:${mine}` : def.id; // where its best run is kept
  const $ = html(
    el,
    `<div class="game is-loading" id="game">
      <div class="level-loading" id="loading" role="status">
        <p class="level-number">${mine ? "Workshop" : extra ? "Test cave" : `Level ${def.id}`}</p>
        <h1>${esc(def.name || "My level")}</h1>
        ${intro ? `<p class="world-intro">World ${intro.number} · ${esc(intro.name)}</p>` : ""}
        <span class="loading-line" aria-hidden="true"></span>
        <small>Entering the cave</small>
      </div>
      <div class="hud">
        <button class="icon-btn" id="pause-btn" aria-label="Pause">${icon("pause")}</button>
        <button class="icon-btn" id="map-btn" aria-label="Map">${icon("map")}</button>
        <button class="icon-btn" id="auto-btn" aria-label="Autopilot" aria-pressed="false">${icon("auto")}</button>
        <div class="score">
          <b class="digits" id="time"></b>
          <span class="gauge"><small>Fuel</small><span class="bar" role="meter" aria-label="Fuel" aria-valuemin="0" aria-valuemax="100"><i class="fuel" id="fuel"></i></span></span>
          <span class="gauge"><small>Hull</small><span class="bar" role="meter" aria-label="Hull" aria-valuemin="0" aria-valuemax="100"><i class="hull" id="hull"></i></span></span>
          <span class="readout"><span class="crystals" id="crystals"></span><span class="keys" id="keys"></span><span class="lava" id="lava"></span><span class="speed digits" id="speed"></span></span>
        </div>
        <button class="icon-btn" id="fs"></button>
      </div>
      <div class="flight-guide panel" id="flight-guide" hidden>
        <div class="level-intro" id="level-intro">
          <small>${mine ? "Workshop" : extra ? "Test cave" : `Level ${def.id}`}</small>
          <h2>${esc(def.name || "My level")}</h2>
          ${intro ? `<p>World ${intro.number} · ${esc(intro.name)}</p>` : ""}
        </div>
        <div class="control-cues" id="control-cues"></div>
      </div>
      <div class="message" id="message" role="status" hidden><span id="prompt-icon"></span><span><b id="prompt-title"></b><small id="prompt-detail"></small></span></div>
      <div class="debug">
        <pre class="fps" id="fps" hidden><b>… fps</b></pre>
        <pre class="dev" id="dev" hidden></pre>
      </div>

      <div class="overlay menu pause-screen" id="pause" role="dialog" aria-modal="true" aria-labelledby="pause-title" hidden>
        <section class="pause-panel">
          <header><small>${world ? `World ${world.number} · ${esc(world.name)}` : mine ? "Workshop" : "Test cave"}</small><h2 id="pause-title">Paused</h2><p>${esc(title)}</p></header>
          <div class="pause-actions">
            <div class="buttons" id="restarts">
              <button id="restart-pad">${icon("retry")}Restart from pad</button>
              <button id="restart-level">${icon("retry")}Restart level</button>
            </div>
            <button id="watch-best" hidden></button>
            <button id="stop-watch" hidden>${icon("close")}Stop watching</button>
            <a class="button" href="${back.href}" data-link="up">${icon(mine ? "brush" : "map")}${back.label}</a>
            <button class="big" id="resume">${icon("play")}Resume</button>
          </div>
          <div class="pause-tools">
            <button class="icon-btn" id="settings" aria-label="Settings" title="Settings">${icon("gear")}</button>
            <button class="icon-btn" id="auto-menu" aria-label="Autopilot" title="Autopilot" aria-pressed="false">${icon("auto")}</button>
            <button class="icon-btn" id="fs-pause"></button>
          </div>
        </section>
      </div>

      <div class="overlay map" id="map" role="dialog" aria-modal="true" aria-labelledby="map-title" hidden>
        <section class="map-frame panel">
          <header><div>${icon("map")}<h2 id="map-title">${esc(title)}</h2></div><button class="icon-btn" id="map-close" aria-label="Close map">${icon("close")}</button></header>
          <canvas id="map-canvas" aria-label="Explored cave map"></canvas>
          <p class="hint">${onPhone() ? "Tap the map" : "M / Esc"} to close</p>
        </section>
      </div>

      <div class="overlay menu done-screen" id="done" role="dialog" aria-modal="true" aria-labelledby="done-title" hidden>
        <section class="done-summary">
          <h2 id="done-title">${esc(doneTitle)}</h2>
          <p class="hint">${esc(title)}</p>
          ${ending ? `<p id="ending">${ending.text}${next ? "" : " That's every level, for now: go back for the stars you missed."}</p>` : ""}
          <div class="awards" id="awards"></div>
          <p class="best-run" id="best-stars" hidden></p>
          <dl class="results" id="results"></dl>
        </section>
        <section class="done-actions">
          ${
            next
              ? `<a class="button big" href="/play/${next.id}${dev ? "?dev" : ""}" data-link="replace" id="next">${icon("play")}<span>Next · ${next.id}<small>${esc(next.name)}</small></span></a>`
              : mine
                ? `<a class="button big" href="${back.href}" data-link="up" id="next">${icon("brush")}Back to editor</a>`
                : `<a class="button big" href="/levels" data-link="up" id="next">${icon("map")}Back to the levels</a>`
          }
          <div class="buttons">
            <button id="retry">${icon("retry")}<span>Retry</span></button>
            <button id="watch">${icon("play")}<span>Watch</span></button>
            <a class="button" href="${mine ? "/editor" : "/levels"}" data-link="up">${icon(mine ? "brush" : "map")}${mine ? "My levels" : "Levels"}</a>
          </div>
          ${dev ? `<button id="save-run">Save this run</button>` : ""}
        </section>
      </div>

      <div class="overlay" id="tilt-ask" hidden>
        <section class="panel tilt-panel">${icon("tilt")}<h2>Tilt to steer</h2><p>Allow motion sensors to steer with your phone.</p><button class="big" id="tilt-ok">Enable steering</button></section>
      </div>
    </div>`,
  );
  const gameEl = $("#game");
  if (world) document.documentElement.style.setProperty("--world", css(world.colors?.rim ?? CAVE_COLORS.rim));
  const unbindFs = [bindFullscreenButton($("#fs")), bindFullscreenButton($("#fs-pause"))];
  let game = null;
  let disposed = false;
  let loadFrame = 0;
  let countFrame = 0;
  let ready = false;
  let introUntil = 0;
  let guidePlaced = false;
  let guideMode = null;
  let promptShown = "";
  const guide = $("#flight-guide");
  const cues = $("#control-cues");
  const introEl = $("#level-intro");
  const onResize = () => { guidePlaced = false; if (game && !$("#map").hidden) drawMap($("#map-canvas"), game.world); };
  window.addEventListener("resize", onResize);
  document.fonts.ready.then(() => { if (!disposed) guidePlaced = false; });

  // iOS asks before it sends orientation events, and only from a tap: the title's,
  // unless the game was opened at a level.
  if (tiltNeedsAsking()) {
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
  let crystalsShown = "";
  let autoShown = null;
  let lostUntil = 0; // when to stop saying the autopilot gave up
  const show = (el, text) => el.textContent !== text && (el.textContent = text);
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
        if (disposed) return;
        bestRun ??= { codes, replay: kept };
        syncPauseMenu();
        if (params.has("watch") && game && !finished && !watched && game.world.startTick < 0) startWatching({ ...bestRun, label: "your best run" });
      })
      .catch(() => {});
  }

  const gameOptions = {
    level,
    fullTilt: settings.fullTilt,
    onFrame(w, controls) {
      if (!ready) {
        ready = true;
        introUntil = performance.now() + 2000;
        $("#loading").hidden = true;
        gameEl.classList.remove("is-loading");
      }
      const r = w.rocket;
      setDigits(hud.time, formatTime(clock(w)));
      // Fuel goes amber below 30% and flashes red below 15%; the hull at 60% and 30%.
      const f = r.fuel / r.tank;
      setBar(hud.fuel, f, f > 0.3 ? "ok" : f > 0.15 ? "low" : "bad");
      const h = r.hull / HULL;
      setBar(hud.hull, h, h > 0.6 ? "ok" : h > 0.3 ? "low" : "bad");
      // Speed, green while slow enough to land.
      const v = Math.hypot(r.vx, r.vy);
      setDigits(hud.speed, `${v.toFixed(1)} m/s`);
      hud.speed.dataset.safe = r.state === "flying" && v <= SAFE_SPEED;
      const crystals = level.crystals.length ? `${crystalCount(w)}/${level.crystals.length}` : "";
      if (crystals !== crystalsShown) {
        crystalsShown = crystals;
        hud.crystals.innerHTML = crystals && icon("crystal") + crystals;
      }
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
        if (!auto && game?.lastPilot?.failed) lostUntil = performance.now() + 3000;
      }

      const prompt = flightPrompt(w, { phone: onPhone(), watching: watched?.label, pilot: game?.pilot, failure: performance.now() < lostUntil ? game.lastPilot : null });
      const shown = JSON.stringify(prompt);
      if (shown !== promptShown) {
        promptShown = shown;
        hud.message.hidden = !prompt;
        if (prompt) {
          $("#prompt-icon").innerHTML = icon(prompt.icon);
          show($("#prompt-title"), prompt.title);
          show($("#prompt-detail"), prompt.detail);
          $("#prompt-detail").hidden = !prompt.detail;
        }
      }
      updateGuide(w, controls);

      if (w.done && !finished && w.tick - w.endTick >= RESULTS_AFTER) finish(w);
      else if (watched && !finished && w.tick >= watched.codes.length + RESULTS_AFTER) finish(w); // it should have landed by now
      devHud?.update(w, game);
      if (!fpsEl.hidden && game && game.stats.fps !== fpsShown) {
        fpsShown = game.stats.fps;
        showFps(fpsEl, game.stats);
      }
    },
  };

  // Two frames let the browser paint the title on black before building the cave.
  // Navigation during loading cancels the work before it creates a WebGL context.
  loadFrame = requestAnimationFrame(() => {
    loadFrame = requestAnimationFrame(() => {
      if (disposed) return;
      try {
        game = createGame(gameEl, gameOptions);
        if (devHud) {
          gameEl.querySelector(":scope > canvas").addEventListener("pointermove", devHud.onPointer(game));
          window.game = game;
        }
        if (params.has("watch") && bestRun) startWatching({ ...bestRun, label: "your best run" });
      } catch (error) {
        console.error(error);
        $("#loading").innerHTML = `<h2>Couldn't open the cave</h2><p>Try reloading the game.</p><a class="button big" href="${back.href}" data-link="up">${esc(back.label)}</a>`;
      }
    });
  });

  function updateGuide(w, controls) {
    const initial = w.startTick < 0 && !watched && !game.pilot;
    const introHidden = !!watched || w.done || performance.now() >= introUntil;
    if (introEl.hidden !== introHidden) { introEl.hidden = introHidden; guidePlaced = false; }
    if (cues.hidden !== !initial) { cues.hidden = !initial; guidePlaced = false; }
    guide.hidden = finished || !!watched || (!initial && introHidden);
    if (guide.hidden) return;
    const mode = controls.hasTilt || onPhone() ? "tilt" : "keys";
    if (mode !== guideMode) {
      guideMode = mode;
      cues.innerHTML = controlPictures(mode === "tilt");
      guidePlaced = false;
    }
    if (guidePlaced) return;
    const box = gameEl.getBoundingClientRect();
    const point = game.worldToScreen(w.rocket.x, w.rocket.y);
    const hudBox = $(".hud").getBoundingClientRect();
    const hudStyle = getComputedStyle($(".hud"));
    const position = guidePosition({ x: point.x - box.left, y: point.y - box.top }, box, guide.getBoundingClientRect(), {
      top: hudBox.bottom - box.top + 12,
      left: Math.max(16, parseFloat(hudStyle.paddingLeft)), right: Math.max(16, parseFloat(hudStyle.paddingRight)),
      bottom: 16 + parseFloat(getComputedStyle(gameEl).getPropertyValue("--safe-bottom")),
    });
    guide.style.left = `${position.x}px`;
    guide.style.top = `${position.y}px`;
    guidePlaced = true;
  }

  // The results: this run's stars, the saved best run, then the time against par.
  // Watching a run, the replay's results instead.
  function finish(w) {
    finished = true;
    guide.hidden = true;
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
    $("#watch").disabled = true;
    makeReplay(def, w, run.codes, { cheated: run.cheated }).then((replay) => {
      made.replay = replay;
      const isBest = !extra && keepRun(runId, replay);
      if (isBest) bestRun = { codes: made.codes, replay };
      if (disposed || made !== lastRun || !finished || watched) return;
      $("#watch").disabled = false;
      if (mine) $("#awards").innerHTML = `<p class="hint">${finishNote(replay, isBest)}</p>`;
      syncPauseMenu();
    }).catch(() => {
      if (!disposed && made === lastRun && finished && !watched) $("#watch").hidden = true;
    });
    let result = null;
    if (!extra && !mine && !w.assisted && !run.cheated) {
      result = recordRun(progress, def, { time, crystals: all });
      saveProgress(progress);
    }
    const record = progress.levels[def.id];
    const best = record?.best;
    const bestStars = $("#best-stars");
    bestStars.hidden = extra || !!mine || !record;
    if (!bestStars.hidden) bestStars.innerHTML = `Best run ${stars(starsOf(def, record))}<small>${formatTime(record.run?.time ?? record.best)}</small>`;
    $("#awards").innerHTML = mine
      ? ""
      : w.assisted
      ? `<p class="hint">Flown with the autopilot, so no stars</p>`
      : run.cheated
      ? `<p class="hint">Flown with a cheat, so no stars</p>`
      : result
      ? [
          "Finished",
          `Par ${formatTime(def.par)}`,
          level.crystals.length > 1 ? `All ${level.crystals.length} crystals` : "The crystal",
        ]
          .map(
            (label, i) =>
              `<div class="award reveal${result.after[i] ? " on" : ""}" style="--i: ${i}" role="img" aria-label="${label}: ${result.after[i] ? "earned" : "not earned"}">${icon("star")}<small>${label}</small></div>`,
          )
          .join("")
      : "";
    showResults(w, { newBest: result?.newBest && result.before[0], best });
  }

  function showResults(w, { newBest = false, best } = {}) {
    const time = clock(w);
    $("#results").innerHTML = `<dt class="time-label">Time</dt><dd class="result-time"><b class="digits" id="finish-time" aria-label="${formatTime(time)}"></b>${newBest ? `<strong class="new-best">${icon("star")}New best</strong>` : ""}</dd>
      ${def.par ? `<dt>Par</dt><dd>${formatTime(def.par)}${best !== undefined && !newBest ? `<small>Fastest ${formatTime(best)}</small>` : ""}</dd>` : ""}
      ${level.crystals.length ? `<dt>${icon("crystal")}Crystals</dt><dd>${crystalCount(w)} of ${level.crystals.length}</dd>` : ""}
      <dt>${icon("retry")}Restarts</dt><dd>${w.restarts}</dd>`;
    cancelAnimationFrame(countFrame);
    const digits = $("#finish-time");
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setDigits(digits, formatTime(time)); return; }
    const began = performance.now() + COUNT_AFTER;
    const count = (now) => {
      const t = Math.max(0, Math.min(1, (now - began) / COUNT_MS));
      setDigits(digits, formatTime(time * (1 - (1 - t) ** 3)));
      if (t < 1 && !disposed) countFrame = requestAnimationFrame(count);
    };
    setDigits(digits, formatTime(0));
    countFrame = requestAnimationFrame(count);
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
    if ($("#ending")) $("#ending").hidden = true;
    $("#best-stars").hidden = true;
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
    showResults(w);
    $("#retry span").textContent = "Play";
    $("#watch span").textContent = "Watch again";
    $("#watch").disabled = false;
  }

  // Watches a recorded run from the start: { codes, replay, label }.
  function startWatching(run) {
    cancelAnimationFrame(countFrame);
    watched = run;
    game.watch(run.codes);
    finished = false;
    guide.hidden = true;
    $("#done").hidden = true;
    $("#pause-btn").hidden = $("#map-btn").hidden = false;
    $("#auto-btn").hidden = true;
    syncPauseMenu();
  }

  // Back to playing, from the start.
  function playAgain() {
    cancelAnimationFrame(countFrame);
    watched = null;
    game.restartLevel();
    finished = false;
    introUntil = 0;
    guidePlaced = false;
    $("#done").hidden = true;
    $("#done-title").textContent = doneTitle;
    if ($("#ending")) $("#ending").hidden = false;
    $("#retry span").textContent = "Retry";
    $("#watch span").textContent = "Watch";
    $("#watch").hidden = false;
    $("#pause-btn").hidden = $("#map-btn").hidden = $("#auto-btn").hidden = false;
    syncPauseMenu();
  }

  const toggleAutopilot = () => {
    if (game && !finished && !watched) game.setAutopilot(!game.pilot);
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
    if (!game || !ready || finished || !pauseMenu.hidden) return;
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
    if (bestRun) $("#watch-best").innerHTML = `${icon("play")}Watch best run <small>${formatTime(bestRun.replay.time)}</small>`;
  }
  const closePause = () => {
    pauseMenu.hidden = true;
    game.resume();
    document.activeElement?.blur(); // so keys fly the rocket again
  };
  $("#pause-btn").addEventListener("click", openPause);

  // The map: the parts of the cave seen so far. The game waits while it's open.
  const openMap = () => {
    if (!game || !ready || finished || !pauseMenu.hidden || !mapEl.hidden) return;
    game.pause();
    mapEl.hidden = false;
    drawMap($("#map-canvas"), game.world);
    $("#map-close").focus();
  };
  function closeMap() {
    if (mapEl.hidden) return;
    mapEl.hidden = true;
    game.resume();
    document.activeElement?.blur();
  }
  $("#map-btn").addEventListener("click", openMap);
  mapEl.addEventListener("click", closeMap);
  $("#map-close").addEventListener("click", (e) => { e.stopPropagation(); closeMap(); });
  $("#resume").addEventListener("click", closePause);
  $("#restart-pad").addEventListener("click", () => {
    game.restartFromPad();
    closePause();
  });
  $("#restart-level").addEventListener("click", () => {
    playAgain();
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
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!game || !ready) return;
    if (e.code === "Tab") {
      const overlay = [pauseMenu, mapEl, $("#done")].find((el) => !el.hidden);
      if (overlay) {
        const buttons = [...overlay.querySelectorAll("button, a[href]")].filter((el) => !el.disabled && el.getClientRects().length);
        const first = buttons[0], last = buttons.at(-1);
        if (e.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || !overlay.contains(document.activeElement))) { e.preventDefault(); first?.focus(); }
      }
      return;
    }
    if (e.repeat) return;
    if (e.code === "KeyO" && mapEl.hidden) toggleAutopilot();
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

  // The settings, over the pause menu: the level takes them up as they change.
  const applySettings = ({ fullTilt, fps }) => {
    game?.setFullTilt(fullTilt);
    fpsEl.hidden = !fps && !dev;
  };
  $("#settings").addEventListener("click", () => openSettings({ inGame: true, onChange: applySettings }));
  applySettings(settings);

  return () => {
    disposed = true;
    cancelAnimationFrame(loadFrame);
    cancelAnimationFrame(countFrame);
    if (window.game === game) delete window.game;
    window.removeEventListener("keydown", onKey);
    document.removeEventListener("visibilitychange", onHidden);
    window.removeEventListener("resize", onResize);
    for (const u of unbindFs) u();
    game?.dispose();
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
