import { WORLDS, LEVELS } from "../levels/index.js";
import { loadProgress, nextToPlay, starCount } from "../progress.js";
import { requestTiltPermission, tiltNeedsAsking, onPhone } from "../controls.js";
import { createBackdrop } from "../render/backdrop.js";
import { html, esc } from "./dom.js";
import { icon } from "./kit.js";
import { openSettings } from "./settings.js";

const STARTED = "gyrorocket:started"; // kept for the session, once the title's been tapped past

// The title, /: the game's name over a cave (render/backdrop.js) in the colours
// of the world the player has reached, with the rocket on its pad. The first time
// in a session it waits for a tap, which on an iPhone is the tap that asks for the
// motion sensors. Then the menu: Play, which goes straight into the next level to
// do, the levels, the workshop, how to play, and the settings.
export function title(el) {
  const progress = loadProgress();
  const next = nextToPlay(progress);
  const fresh = !Object.keys(progress.levels).length || progress.levels[next.id]; // nothing flown yet, or everything
  const stars = LEVELS.reduce((n, l) => n + starCount(l, progress.levels[l.id]), 0);
  const $ = html(
    el,
    `<div class="title" id="title">
      <div class="title-cave" id="cave"></div>
      <h1>Gyro<br><span>Rocket</span></h1>
      <button class="title-start" id="start">${onPhone() ? "Tap" : "Click"} to start</button>
      <nav class="title-menu" id="menu" aria-label="Menu" hidden>
        <a class="button big" id="play" href="/play/${next.id}" data-link>
          <b>${icon("play")}${fresh ? "Play" : "Continue"}</b><small>${next.id} ${esc(next.name)}</small>
        </a>
        <a class="button" href="/levels" data-link>Levels<small>${icon("star")}${stars} of ${LEVELS.length * 3}</small></a>
        <a class="button" href="/editor" data-link>Workshop</a>
        <div class="buttons">
          <a class="button" href="/help" data-link>How to play</a>
          <button class="icon-btn" id="settings" aria-label="Settings">${icon("gear")}</button>
        </div>
      </nav>
    </div>`,
  );

  // The cave, if the phone can draw it: the menu works without.
  let backdrop = null;
  try {
    backdrop = createBackdrop($("#cave"), WORLDS[next.world - 1].colors);
  } catch {}

  const showMenu = () => {
    $("#start").hidden = true;
    $("#menu").hidden = false;
  };
  const start = () => {
    $("#title").removeEventListener("click", start);
    if (tiltNeedsAsking()) requestTiltPermission();
    try {
      sessionStorage.setItem(STARTED, "1");
    } catch {}
    showMenu();
    $("#play").focus({ preventScroll: true });
  };
  let started = false;
  try {
    started = !!sessionStorage.getItem(STARTED);
  } catch {}
  // Tapped past already this session: straight to the menu, unless the sensors
  // are still to be asked for, which takes a tap.
  if (started && !tiltNeedsAsking()) showMenu();
  else {
    $("#title").addEventListener("click", start); // a tap anywhere
    $("#start").focus({ preventScroll: true });
  }

  $("#settings").addEventListener("click", () => openSettings());
  return () => backdrop?.dispose();
}
