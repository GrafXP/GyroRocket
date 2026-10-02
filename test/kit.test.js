import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ICONS, icon, stars, button, toggle, slider } from "../src/ui/kit.js";

// Every .js file under `dir`.
const sources = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sources(join(dir, e.name)) : e.name.endsWith(".js") ? [join(dir, e.name)] : []));

test("every icon the game asks for by name is one the kit has", () => {
  for (const file of sources("src")) {
    for (const [, name] of readFileSync(file, "utf8").matchAll(/\bicon\("([\w-]+)"/g)) {
      assert.ok(ICONS.includes(name), `${file} asks for the icon "${name}"`);
    }
  }
});

test("an icon is drawn as lines, or filled, and takes more classes", () => {
  assert.match(icon("pause"), /^<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M[^"]+"\/><\/svg>$/);
  assert.match(icon("star"), /class="icon solid"/);
  assert.match(icon("star", "on"), /class="icon solid on"/);
});

test("stars light one for each that's earned, and say how many", () => {
  const html = stars([true, false, true]);
  assert.match(html, /aria-label="2 of 3 stars"/);
  assert.equal(html.match(/class="icon solid on"/g).length, 2);
  assert.equal(html.match(/<svg/g).length, 3);
});

test("a button is a button, or a link that looks like one", () => {
  assert.equal(button({ label: "Retry" }), "<button>Retry</button>");
  assert.equal(button({ label: "Resume", id: "resume", big: true }), `<button id="resume" class="big">Resume</button>`);
  assert.equal(button({ label: "Levels", href: "/levels" }), `<a href="/levels" data-link class="button">Levels</a>`);
  assert.match(button({ icon: "pause", attrs: `aria-label="Pause"` }), /^<button class="icon-btn" aria-label="Pause"><svg/);
  assert.match(button({ label: "Autopilot", pressed: false }), /aria-pressed="false"/);
});

test("a switch and a slider carry their labels and values", () => {
  assert.match(toggle({ label: "Frame rate", id: "fps", on: true }), /<span>Frame rate<\/span><input type="checkbox" role="switch" id="fps" checked>/);
  assert.doesNotMatch(toggle({ label: "Frame rate" }), /checked/);
  const html = slider({ label: "Tilt", id: "tilt", min: 15, max: 60, step: 5, value: 35, note: "Gentle" });
  assert.match(html, /<input type="range" id="tilt" min="15" max="60" step="5" value="35">/);
  assert.match(html, /id="tilt-note">Gentle</);
  // Or a word at each end, in the note's place.
  const ends = slider({ label: "Tilt", id: "tilt", min: 15, max: 60, ends: ["Gentle", "Sharp"] });
  assert.match(ends, /<span class="ends"><small>Gentle<\/small><small>Sharp<\/small><\/span>/);
  assert.doesNotMatch(ends, /tilt-note/);
});
