import { esc } from "../ui/dom.js";
import { THING_SETTINGS, LEVEL_SETTINGS, RISE_SETTINGS } from "../sim/validate.js";
import { CRUMBLE } from "../sim/level.js";
import { TANK } from "../sim/rocket.js";
import { WORLDS } from "../levels/index.js";
import { KIND_NAMES, tileName } from "./tiles.js";
import { thingDefaults, targetsFor, triggersFor, validateThingEdit, validateSettingsEdit } from "./things.js";
import { fieldsMarkup, bindFields, readFields } from "./fields.js";

function sheet(host, title, body, apply) {
  host.innerHTML = `<form class="ed-sheet ed-form"><h2>${esc(title)}</h2>${body}<p class="ed-error" role="alert" hidden></p><div class="buttons ed-actions"><button type="button" data-cancel>Cancel</button><button type="submit">Apply</button></div></form>`;
  host.hidden = false;
  const form = host.querySelector("form");
  bindFields(form);
  const run = (callback) => {
    if (!form.reportValidity()) return;
    try {
      callback();
    } catch (e) {
      const error = form.querySelector(".ed-error");
      error.textContent = e.message;
      error.hidden = false;
    }
  };
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    run(() => {
      apply(form);
      host.hidden = true;
    });
  });
  form.querySelector("[data-cancel]").onclick = () => {
    host.hidden = true;
  };
  form.querySelector("input:not([type=hidden]), select, button")?.focus({ preventScroll: true });
  return { form, run };
}

export function openThingSheet(host, { grid, ch, onApply, onPath }) {
  const thing = grid.things[ch];
  const specs = THING_SETTINGS[thing.kind];
  const targets = targetsFor(grid);
  const choices = { opens: [["", "Choose a gate or laser"], ...targets.map((label) => [label, tileName(label, grid.things)])] };
  const help =
    thing.kind === "switch"
      ? "Land on this switch to open one gate or turn off one laser. All instances of that label respond. Place a gate or laser first, then choose it here."
      : thing.kind === "gate"
        ? "Paint this gate as a rectangle, then inspect a switch and choose this gate as its target."
        : "Settings apply everywhere this label is painted.";
  const { form, run } = sheet(
    host,
    `${KIND_NAMES[thing.kind]} ${ch}`,
    `<p class="hint">${help}</p>${fieldsMarkup(specs, { ...thingDefaults(thing.kind), ...thing }, choices)}`,
    (f) => onApply(read(f)),
  );
  const read = (f) => validateThingEdit(grid, ch, { kind: thing.kind, ...readFields(f, specs) });
  form.querySelector("[data-path]")?.addEventListener("click", () =>
    run(() => {
      onApply(read(form));
      host.hidden = true;
      onPath();
    }),
  );
}

export function openSettingsSheet(host, { grid, onApply }) {
  const pick = (keys) => Object.fromEntries(keys.map((key) => [key, LEVEL_SETTINGS[key]]));
  const main = pick(["name", "look", "fuel", "par", "dark", "crumble"]);
  const sky = { sky: { ...LEVEL_SETTINGS.sky, max: grid.height - 1 } };
  const route = pick(["route"]);
  const current = grid.settings;
  const values = { name: "", look: 1, fuel: TANK, par: 60, crumble: CRUMBLE, ...current };
  const choices = { look: WORLDS.map((w, i) => [i + 1, `${i + 1} · ${w.name}`]) };
  const riseChoices = { after: [["", "Lift-off"], ...triggersFor(grid).map((ch) => [ch, tileName(ch, grid.things)])] };
  const body = `${fieldsMarkup(main, values, choices)}
    <label class="ed-toggle"><input type="checkbox" name="use-sky" ${current.sky ? "checked" : ""}> Open to the sky</label>
    <fieldset data-sky>${fieldsMarkup(sky, { sky: current.sky ?? 3 })}</fieldset>
    <label class="ed-toggle"><input type="checkbox" name="use-rise" ${current.rise ? "checked" : ""}> Rising lava</label>
    <fieldset data-rise>${fieldsMarkup(RISE_SETTINGS, { speed: 1, from: 0, to: grid.height, delay: 0, ...current.rise }, riseChoices, "rise-")}</fieldset>
    <details><summary>Advanced</summary>${fieldsMarkup(route, current)}<p class="hint">Stops in order: r y g b for keys, F for the nearest fuel pad, F@12 for its column, a switch's label, E for exit. Example: r F 1 E. Leave blank for fuel pads then exit.</p></details>`;
  const { form } = sheet(host, "Level settings", body, (f) => {
    const settings = { ...current, ...readFields(f, main), ...readFields(f, route) };
    if (!settings.route.trim()) delete settings.route;
    else settings.route = settings.route.trim().replace(/\s+/g, " ");
    if (f.elements.namedItem("use-sky").checked) Object.assign(settings, readFields(f, sky));
    else delete settings.sky;
    if (f.elements.namedItem("use-rise").checked) settings.rise = readFields(f, RISE_SETTINGS, "rise-");
    else delete settings.rise;
    onApply(validateSettingsEdit(grid, settings));
  });
  const sync = () => {
    for (const key of ["sky", "rise"]) {
      const section = form.querySelector(`[data-${key}]`);
      section.hidden = section.disabled = !form.elements.namedItem(`use-${key}`).checked;
    }
  };
  form.addEventListener("change", sync);
  sync();
}
