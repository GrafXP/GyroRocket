import { loadSettings, saveSettings } from "../progress.js";
import { tiltAngle, steerOf, screenAngle, onPhone } from "../controls.js";
import { MAX_LEAN } from "../sim/rocket.js";
import { fullscreenSupported, isFullscreen, toggleFullscreen, onFullscreenChange } from "../fullscreen.js";
import { THEME_PICKER, bindThemePicker } from "./dom.js";
import { icon, toggle, slider, ROCKET } from "./kit.js";
import { openSheet } from "./sheet.js";

const TILT_MIN = 15; // degrees of tilt for full steer, at the sensitivity slider's ends
const TILT_MAX = 60;
const SWAY = 28; // degrees the picture's phone rocks each way, until the real one is heard from
const BUILD = typeof __BUILD__ === "string" ? `built ${__BUILD__}` : "from source"; // vite.config.js says which build

// The picture for the steering: a phone that tilts as yours does, inside the arc
// of tilt that steers, and the rocket leaning as far as that tilt makes it. The
// arc's ends are where the rocket leans all the way, and the slider moves them.
const [PX, PY, PR] = [56, 62, 40]; // the phone's middle, and the arc's radius
const PICTURE = `<svg class="steer-pic" viewBox="0 0 200 100" aria-hidden="true">
  <path class="track" d="${arc(75, false)}"/>
  <path class="range" id="steer-range"/>
  <g id="steer-phone">
    <path class="needle" d="M${PX} ${PY - 14}V${PY - PR + 4}"/>
    <rect class="phone" x="${PX - 26}" y="${PY - 14}" width="52" height="28" rx="4"/>
    <circle class="needle" cx="${PX}" cy="${PY - PR}" r="3"/>
  </g>
  <g id="steer-rocket">${ROCKET}</g>
</svg>`;

// The arc from `degrees` left of straight up to as far right, with a tick at each
// end unless it's told not to.
function arc(degrees, ticks = true) {
  const a = (degrees * Math.PI) / 180;
  const at = (r, side) => `${(PX + side * r * Math.sin(a)).toFixed(1)} ${(PY - r * Math.cos(a)).toFixed(1)}`;
  const tick = (side) => (ticks ? `M${at(PR - 5, side)}L${at(PR + 5, side)}` : "");
  return `${tick(-1)}M${at(PR, -1)}A${PR} ${PR} 0 0 1 ${at(PR, 1)}${tick(1)}`;
}

// The settings sheet, from the menu and from the pause menu: steering, the screen,
// the pilot and the rest. They're saved as they're changed, and onChange(settings)
// is told, for a level in play to take them up. `inGame` leaves out what leads
// away to another page.
export function openSettings({ inGame = false, onChange } = {}) {
  const settings = loadSettings();
  const installed = !!globalThis.matchMedia?.("(display-mode: fullscreen), (display-mode: standalone)").matches;
  const sheet = openSheet({
    title: "Settings",
    cls: "settings",
    body: `<section class="steer" id="steer">
        <h3>Steering</h3>
        ${PICTURE}
        ${slider({ label: "Tilt sensitivity", id: "tilt", min: TILT_MIN, max: TILT_MAX, step: 5, ends: ["Gentle", "Sharp"] })}
        <p class="steer-keys"><span><kbd>←</kbd><kbd>→</kbd> or <kbd>A</kbd><kbd>D</kbd> steer</span><span><kbd>↑</kbd> <kbd>W</kbd> or <kbd>Space</kbd> burns</span></p>
      </section>
      <section>
        <h3>Screen</h3>
        ${fullscreenSupported ? toggle({ label: "Fullscreen", id: "set-fs" }) : ""}
        <div class="setting"><span>Theme</span>${THEME_PICKER}</div>
        ${installed ? "" : `<p class="hint">Add the game to your home screen, and it opens fullscreen every time.</p>`}
      </section>
      ${
        inGame
          ? ""
          : `<section>
        <h3>Pilot</h3>
        <a class="button" href="/profile" data-link>${icon("pilot")}Your name and code</a>
      </section>`
      }
      <section>
        <h3>More</h3>
        ${toggle({ label: "Show the frame rate", id: "set-fps", on: settings.fps })}
        <p class="hint">${inGame ? "" : `<a href="/help#privacy" data-link>Privacy and storage</a> · `}Gyro Rocket, ${BUILD}</p>
      </section>`,
    onClose() {
      cancelAnimationFrame(raf);
      window.removeEventListener("deviceorientation", onOrientation);
      for (const u of unbind) u();
    },
  });
  const { $ } = sheet;
  const save = () => {
    saveSettings(settings);
    onChange?.(settings);
  };

  // The slider runs from gentle (full steer at TILT_MAX°) to sharp.
  const tiltEl = $("#tilt");
  const syncTilt = () => {
    tiltEl.value = TILT_MIN + TILT_MAX - settings.fullTilt;
    tiltEl.setAttribute("aria-valuetext", `Full steer at ${settings.fullTilt}° of tilt`);
    $("#steer-range").setAttribute("d", arc(settings.fullTilt));
  };
  tiltEl.addEventListener("input", () => {
    settings.fullTilt = TILT_MIN + TILT_MAX - Number(tiltEl.value);
    save();
    syncTilt();
  });
  syncTilt();

  // The picture follows the phone. Until the phone's been heard from, it rocks by
  // itself on a phone, to show what the slider does (unless the phone's set to
  // reduce motion); with nothing to tilt, the keys are shown instead.
  const sway = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : SWAY;
  let tilt = null;
  const onOrientation = (e) => {
    if (e.beta != null && e.gamma != null) tilt = tiltAngle(e.beta, e.gamma, screenAngle());
  };
  window.addEventListener("deviceorientation", onOrientation);
  let raf = 0;
  const draw = (now) => {
    raf = requestAnimationFrame(draw);
    $("#steer").dataset.with = tilt !== null || onPhone() ? "tilt" : "keys";
    const shown = Math.max(-80, Math.min(80, tilt ?? sway * Math.sin(now / 700)));
    const lean = (steerOf(shown, settings.fullTilt) * MAX_LEAN * 180) / Math.PI;
    $("#steer-phone").setAttribute("transform", `rotate(${shown.toFixed(1)} ${PX} ${PY})`);
    $("#steer-rocket").setAttribute("transform", `translate(150 54) rotate(${lean.toFixed(1)})`);
  };
  draw(performance.now());

  const unbind = [bindThemePicker($(".theme"))];
  const fs = $("#set-fs");
  if (fs) {
    const sync = () => (fs.checked = isFullscreen());
    fs.addEventListener("change", toggleFullscreen);
    sync();
    unbind.push(onFullscreenChange(sync));
  }
  $("#set-fps").addEventListener("change", (e) => {
    settings.fps = e.target.checked;
    save();
  });
  return sheet;
}
