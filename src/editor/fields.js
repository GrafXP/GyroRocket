import { esc } from "../ui/dom.js";

const NAMES = {
  on: "On (s)",
  off: "Off (s)",
  warn: "Warning (s)",
  offset: "Cycle offset (s)",
  time: "Open time (s; 0 = forever)",
  opens: "Opens / turns off",
  facing: "Facing",
  mode: "Mode",
  length: "Length (tiles)",
  width: "Width (tiles)",
  height: "Height (tiles)",
  reach: "Trigger reach (m)",
  range: "Range (m)",
  strength: "Strength (m/s²)",
  period: "Period (s)",
  rest: "Rest (s)",
  slam: "Slam (s)",
  hold: "Hold (s)",
  back: "Return (s)",
  windup: "Wind-up (s)",
  reload: "Reload (s)",
  speed: "Speed (m/s)",
  damage: "Damage",
  push: "Push instead of pull",
  name: "Name",
  look: "World colours",
  fuel: "Tank (s of thrust)",
  par: "Par (s)",
  dark: "Dark cave",
  sky: "Sky rows",
  crumble: "Crumble time (s)",
  from: "From (tiles above bottom)",
  to: "To (tiles above bottom)",
  after: "Starts after",
  delay: "Delay (s)",
  route: "Autopilot route",
};

// Controls follow the same types and bounds as validation. The number beside a
// slider also permits precise values; buttons choose finite modes and facings.
export function fieldsMarkup(specs, values, choices = {}, prefix = "") {
  return Object.entries(specs)
    .map(([key, spec]) => {
      const id = `${prefix}${key}`;
      const v = values[key];
      const label = NAMES[key] ?? key;
      let control;
      if ((spec.type === "number" || spec.type === "whole") && !choices[key]) {
        const step = spec.type === "whole" ? 1 : "any";
        control = `<div class="ed-number"><input type="range" data-range="${id}" min="${spec.min}" max="${spec.max}" step="${spec.type === "whole" ? 1 : 0.05}" value="${v ?? spec.min}" aria-label="${label}"><input id="field-${id}" name="${id}" type="number" min="${spec.min}" max="${spec.max}" step="${step}" required value="${v ?? spec.min}"></div>`;
      } else if (spec.type === "oneOf") {
        control = `<input name="${id}" type="hidden" value="${esc(v ?? spec.values[0])}"><div class="segmented" role="group" aria-label="${label}">${spec.values.map((value) => `<button type="button" data-choice="${id}" data-value="${value}" aria-pressed="${value === (v ?? spec.values[0])}">${value}</button>`).join("")}</div>`;
      } else if (spec.type === "boolean") {
        control = `<input id="field-${id}" name="${id}" type="checkbox" ${v ? "checked" : ""}>`;
      } else if (spec.type === "label" || choices[key]) {
        control = `<select id="field-${id}" name="${id}">${(choices[key] ?? []).map(([value, text]) => `<option value="${esc(value)}" ${String(v ?? "") === String(value) ? "selected" : ""}>${esc(text)}</option>`).join("")}</select>`;
      } else if (spec.type === "vector") {
        control = `<div class="ed-vector"><label>Right<input name="${id}-x" type="number" min="-200" max="200" step="1" required value="${v?.[0] ?? 0}"></label><label>Up<input name="${id}-y" type="number" min="-200" max="200" step="1" required value="${v?.[1] ?? 0}"></label></div><button type="button" data-path>Drag the path on the map</button>`;
      } else {
        control = `<input id="field-${id}" name="${id}" maxlength="${spec.max}" value="${esc(v ?? "")}" spellcheck="false" autocomplete="off">`;
      }
      return `<div class="ed-field"><label for="field-${id}">${spec.type === "vector" ? "Travel (tiles; negative = left / down)" : label}</label>${control}</div>`;
    })
    .join("");
}

export function bindFields(form) {
  form.addEventListener("input", (e) => {
    const input = e.target;
    if (input.dataset.range) form.elements.namedItem(input.dataset.range).value = input.value;
    else if (input.type === "number") {
      const range = form.querySelector(`[data-range="${input.name}"]`);
      if (range) range.value = input.value;
    }
  });
  form.addEventListener("click", (e) => {
    const b = e.target.closest("[data-choice]");
    if (!b) return;
    form.elements.namedItem(b.dataset.choice).value = b.dataset.value;
    for (const other of form.querySelectorAll(`[data-choice="${b.dataset.choice}"]`)) other.setAttribute("aria-pressed", other === b);
  });
}

export function readFields(form, specs, prefix = "") {
  const result = {};
  for (const [key, spec] of Object.entries(specs)) {
    const id = `${prefix}${key}`;
    const el = form.elements.namedItem(id);
    if (spec.type === "vector") result[key] = ["x", "y"].map((axis) => Number(form.elements.namedItem(`${id}-${axis}`).value));
    else if (spec.type === "boolean") result[key] = el.checked;
    else if (spec.type === "number" || spec.type === "whole") result[key] = Number(el.value);
    else if (el.value !== "" || spec.type === "string") result[key] = el.value;
  }
  return result;
}
