import { html, formatTime, THEME_PICKER, bindThemePicker } from "./dom.js";
import { ICONS, icon, stars, button, toggle, slider, setDigits } from "./kit.js";
import { WORLDS } from "../levels/index.js";
import { CAVE_COLORS } from "../render/cave.js";
import { css } from "../looks.js";

const TOKENS = ["bg", "panel-solid", "field", "line", "rim", "text", "muted", "accent", "world", "head", "gold", "crystal", "good", "bad"];

// The kit's page, /ui?dev: every component in every state, to look over on the
// phone in both themes. Tapping a world's colour tints the page as that world does.
export function kitPage(el) {
  const $ = html(
    el,
    `<h1>The kit</h1>
    <p>Everything the screens are made of. <span class="hint">A hint is smaller and quieter.</span> <a href="/" data-link>A link.</a></p>
    ${THEME_PICKER}

    <h2>Colours</h2>
    <div class="kit-row">${TOKENS.map((t) => `<span class="kit-swatch" style="--c: var(--${t})"><i></i>${t}</span>`).join("")}</div>
    <div class="kit-row" id="worlds">${WORLDS.map(
      (w) => `<button data-rim="${css(w.colors?.rim ?? CAVE_COLORS.rim)}" style="--edge: ${css(w.colors?.rim ?? CAVE_COLORS.rim)}">${w.number}</button>`,
    ).join("")}</div>

    <h2>Type</h2>
    <h1>Gyro Rocket</h1>
    <h2>3 · Furnace</h2>
    <p>Flamethrowers fire on the clock or when you come near, and lava destroys whatever touches it.</p>
    <p class="kit-clock"><b class="digits" id="clock"></b> <span id="widths" class="hint"></span></p>

    <h2>Buttons</h2>
    <div class="kit-stack">
      ${button({ label: "Resume", big: true })}
      <div class="buttons">${button({ label: "Restart from pad" })}${button({ label: "Restart level" })}</div>
      <div class="buttons">${button({ label: "Autopilot: on", pressed: true })}${button({ label: "Can't press", attrs: "disabled" })}${button({ label: "A link", href: "/ui?dev" })}</div>
      <div class="buttons">${button({ label: "Retry", icon: "retry" })}${button({ label: "Watch", icon: "play" })}${button({ label: "Levels", icon: "home" })}</div>
      <div class="kit-row">
        ${["pause", "map", "auto", "expand", "gear"].map((name) => button({ icon: name, attrs: `aria-label="${name}"` })).join("")}
        ${button({ icon: "auto", pressed: true, attrs: `aria-label="on"` })}
        ${button({ icon: "undo", attrs: `disabled aria-label="disabled"` })}
      </div>
    </div>

    <h2>Cards</h2>
    <div class="cards">
      <a class="card primary" href="/ui?dev" data-link><b>Continue: 3-5 Chimney fire</b><span>The one to press</span></a>
      <a class="card" href="/ui?dev" data-link><b>Levels</b><span>42 of 240 stars</span></a>
    </div>
    <div class="panel"><b>A panel</b><p class="hint">Holds anything. It's see-through over the game.</p></div>

    <h2>Choosing</h2>
    <div class="kit-stack">
      <div class="segmented" role="group" aria-label="Format">
        <button aria-pressed="true">JSON</button><button aria-pressed="false">Level module</button><button aria-pressed="false">Text</button>
      </div>
      ${toggle({ label: "Frame rate display", on: false })}
      ${toggle({ label: "Autopilot", on: true })}
      ${slider({ label: "Tilt sensitivity", id: "kit-tilt", min: 15, max: 60, step: 5, value: 40, note: "Gentle to sharp" })}
      <input placeholder="Your name" aria-label="A line to type in">
      <textarea rows="2" aria-label="More to type in">A box to type more in</textarea>
      <select aria-label="A list to choose from"><option>1-1 Lift-off</option><option>1-2 The gap</option></select>
      <label class="ed-toggle"><input type="checkbox" checked> Open to the sky</label>
    </div>

    <h2>Stars and levels</h2>
    <p>${[0, 1, 2, 3].map((n) => stars([n > 0, n > 1, n > 2])).join(" &nbsp; ")}</p>
    <div class="level-grid">
      <a class="level done" href="/ui?dev" data-link><b>1-1</b>${stars([true, true, true])}<small>Lift-off</small><small class="best">${formatTime(8.4)}</small></a>
      <a class="level done" href="/ui?dev" data-link><b>1-2</b>${stars([true, false, true])}<small>The gap</small><small class="best">${formatTime(21.7)}</small></a>
      <a class="level" href="/ui?dev" data-link><b>1-3</b>${stars([false, false, false])}<small>Chimney</small><small class="best">&nbsp;</small></a>
      <div class="level locked"><b>1-4</b>${icon("lock")}<small>The well</small></div>
    </div>
    <div class="awards">
      ${["Finished", "Par 0:35.0", "The crystal"].map((label, i) => `<div class="award${i < 2 ? " on new" : ""}" style="--i: ${i}">${icon("star")}<small>${label}</small></div>`).join("")}
    </div>

    <h2>In flight</h2>
    <div class="kit-game">
      <div class="score">
        <b>1:07.4</b>
        <span class="gauge"><small>Fuel</small><span class="bar"><i class="fuel" style="width: 64%"></i></span></span>
        <span class="gauge"><small>Hull</small><span class="bar"><i class="hull" data-level="low" style="width: 41%"></i></span></span>
        <span class="readout"><span class="crystals">${icon("crystal")}1/3</span><span class="lava">Lava 12 m ↓</span><span class="speed" data-safe="true">3.2 m/s</span></span>
      </div>
      <div class="message">Crashed! Tap to go back to the last fuel pad</div>
    </div>

    <h2>Icons</h2>
    <div class="kit-row">${ICONS.map((name) => `<span class="kit-icon">${icon(name)}<small>${name}</small></span>`).join("")}</div>`,
  );

  // The clock mustn't jiggle: every time it shows should be as wide as any other.
  document.fonts.ready.then(() => {
    const probe = document.createElement("b");
    probe.className = "digits";
    $("#clock").after(probe);
    const widths = ["0:00.0", "1:11.1", "4:44.4", "8:08.8"].map((time) => {
      setDigits(probe, time);
      return probe.getBoundingClientRect().width.toFixed(1);
    });
    probe.remove();
    $("#widths").textContent = new Set(widths).size === 1 ? `every time is ${widths[0]} px wide` : `times differ: ${widths.join(" ")}`;
  });
  let t = 0;
  const tick = setInterval(() => setDigits($("#clock"), formatTime((t += 0.1))), 100);

  $("#worlds").addEventListener("click", (e) => {
    const rim = e.target.closest("[data-rim]")?.dataset.rim;
    if (rim) document.documentElement.style.setProperty("--world", rim);
  });
  const unbind = bindThemePicker($(".theme"));
  return () => {
    clearInterval(tick);
    unbind();
  };
}
