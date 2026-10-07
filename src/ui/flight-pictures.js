// The two actions, drawn in SVG so they look the same on every device. Only the
// input pictures change; the player's short labels are always Steer and Burn.
const frame = (cls, body) => `<svg class="control-picture ${cls}" viewBox="0 0 72 52" aria-hidden="true">${body}</svg>`;
const arrows = `<path d="M21 14h30M26 9l-5 5 5 5M46 9l5 5-5 5"/>`;

export function controlPictures(tilt) {
  const steer = tilt
    ? frame("phone-picture", `${arrows}<g class="sway"><rect x="22" y="23" width="28" height="18" rx="2"/><path d="M45 29v6"/></g>`)
    : frame("key-picture", `<rect x="13" y="20" width="21" height="21" rx="2"/><rect x="38" y="20" width="21" height="21" rx="2"/><path d="M28 30h-9m4-4-4 4 4 4M44 30h9m-4-4 4 4-4 4"/>`);
  const burn = tilt
    ? frame("hold-picture", `<circle class="touch-ring" cx="30" cy="17" r="11"/><path d="M25 40V17a4 4 0 0 1 8 0v13l3-3a4 4 0 0 1 6 0l7 8v9H30zM25 29l-4-3a4 4 0 0 0-6 5l10 13"/>`)
    : frame("key-picture", `<rect x="25" y="18" width="22" height="23" rx="2"/><path d="M36 35V24m-5 5 5-5 5 5"/>`);
  return `<div class="control-cue">${steer}<span>Steer<small>${tilt ? "Tilt" : "A / D"}</small></span></div><div class="control-cue">${burn}<span>Burn<small>${tilt ? "Touch and hold" : "W / Space"}</small></span></div>`;
}
