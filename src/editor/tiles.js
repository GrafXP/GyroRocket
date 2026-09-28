import { KEY_LOOKS, GATE_COLOR, css, drawShape } from "../looks.js";
import { KEY_COLORS } from "../sim/level.js";
import { WORLDS } from "../levels/index.js";

// How each tile looks in the editor, flat and seen straight on: the palette's
// tiles, their names, and drawing them on a 2D canvas.

export const AIR_COLOR = "#14161d";
export const OUTSIDE_COLOR = "#0b0c10";
const ROCK = 0x8a7a68; // render/cave.js's, for worlds that don't set their own
const CRUMBLE = 0xc4b294;
const CRACKS = "#ff8a3a";
const LAVA = "#d9480f";
const LAVA_GLOW = "#ffb347";
const FLAME = "#ff9a2e";
const STEEL = "#59616e";
const PADS = { S: "#9aa1ad", E: "#3fbf6a", F: "#3fa9f5" };
const CRYSTAL = "#d86bff";
const DOOR_COLORS = { R: "red", Y: "yellow", G: "green", B: "blue" };
const FLAME_FACING = { ">": "right", "<": "left", "^": "up", v: "down" };
const DIRS = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] }; // on screen, y down

export const PALETTE = [
  { name: "Cave", tiles: "#.%~" },
  { name: "Pads", tiles: "SEF" },
  { name: "Pick-ups", tiles: "*rygb" },
  { name: "Doors", tiles: "RYGB" },
  { name: "Hazards", tiles: "><^v!" },
];

const NAMES = {
  "#": "Rock",
  ".": "Air",
  "%": "Crumbling rock",
  "~": "Lava",
  S: "Start pad",
  E: "Exit pad",
  F: "Fuel pad",
  "*": "Crystal",
  r: "Red key",
  y: "Yellow key",
  g: "Green key",
  b: "Blue key",
  R: "Red door",
  Y: "Yellow door",
  G: "Green door",
  B: "Blue door",
  ">": "Flame, right",
  "<": "Flame, left",
  "^": "Flame, up",
  v: "Flame, down",
  "!": "Stalactite",
};
const KIND_NAMES = {
  switch: "Switch",
  gate: "Gate",
  flame: "Flame",
  blob: "Lava blobs",
  fan: "Fan",
  magnet: "Magnet",
  mover: "Moving block",
  crusher: "Crusher",
  laser: "Laser",
  turret: "Turret",
  stalactite: "Stalactite",
};

export function tileName(ch, things = {}) {
  if (NAMES[ch]) return NAMES[ch];
  const kind = things[ch]?.kind;
  return kind ? `${KIND_NAMES[kind] ?? kind} ${ch}` : `"${ch}" (not set up)`;
}

// The colours of a level's look: its rock and crumbling rock.
export function lookColors(look = 1) {
  const colors = WORLDS[look - 1]?.colors ?? {};
  return { rock: css(colors.face ?? ROCK), crumble: css(colors.crumble ?? CRUMBLE) };
}

// How tile `ch` looks: `base` fills the whole tile (null for air), `glyph` draws
// on top when there's room, and `dot` is the colour it shows as when tiles are
// too small for glyphs.
export function tileLook(ch, things, colors) {
  const thing = things[ch];
  const kind = thing?.kind;
  if (ch === "#") return { base: colors.rock };
  if (ch === ".") return { base: null };
  if (ch === "%") return { base: colors.crumble, glyph: cracks };
  if (ch === "~") return { base: LAVA, glyph: waves };
  if (PADS[ch]) return { base: null, dot: PADS[ch], glyph: pad(PADS[ch], ch) };
  if (ch === "*") return { base: null, dot: CRYSTAL, glyph: crystal };
  if (KEY_COLORS[ch]) {
    const { color, shape } = KEY_LOOKS[KEY_COLORS[ch]];
    return { base: null, dot: css(color), glyph: (ctx, x, y, s) => shapeAt(ctx, shape, css(color), x, y, s, 0.36) };
  }
  if (DOOR_COLORS[ch]) return { base: STEEL, glyph: door(KEY_LOOKS[DOOR_COLORS[ch]]) };
  if (FLAME_FACING[ch]) return { base: colors.rock, glyph: nozzle(FLAME_FACING[ch]) };
  if (ch === "!") return { base: null, dot: colors.crumble, glyph: stalactite(colors.crumble) };
  const label = (draw) => (ctx, x, y, s) => {
    draw?.(ctx, x, y, s);
    labelAt(ctx, ch, x, y, s);
  };
  switch (kind) {
    case "switch":
      return { base: null, dot: css(GATE_COLOR), glyph: pad(css(GATE_COLOR), ch) };
    case "gate":
      return { base: css(GATE_COLOR), glyph: label(stripes) };
    case "mover":
      return { base: "#8c96a6", glyph: label() };
    case "crusher":
      return { base: "#b33a3a", glyph: label() };
    case "flame":
      return { base: colors.rock, glyph: label(nozzle(thing.facing)) };
    case "blob":
      return { base: LAVA, glyph: label(bubble) };
    case "fan":
      return { base: colors.rock, glyph: label(fan) };
    case "magnet":
      return { base: colors.rock, glyph: label(ring(thing.push ? "#4a90f0" : "#e5484d")) };
    case "laser":
      return { base: colors.rock, glyph: label(dotOf("#ff3030", 0.18)) };
    case "turret":
      return { base: colors.rock, glyph: label(dotOf("#2b2f38", 0.34)) };
    case "stalactite":
      return { base: null, dot: colors.crumble, glyph: label(stalactite(colors.crumble)) };
  }
  return { base: "#c026d3", glyph: label() }; // not set up: the parser will say so
}

// Draws tile `ch` in the square at (x, y), `s` pixels across, with its base.
export function drawTile(ctx, ch, x, y, s, things, colors) {
  const look = tileLook(ch, things, colors);
  ctx.fillStyle = look.base ?? AIR_COLOR;
  ctx.fillRect(x, y, s, s);
  look.glyph?.(ctx, x, y, s);
}

function pad(color, letter) {
  return (ctx, x, y, s) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y + s * 0.62, s, s * 0.38);
    if (s >= 14) {
      ctx.font = `700 ${Math.round(s * 0.42)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(letter, x + s / 2, y + s * 0.32);
    }
  };
}

function crystal(ctx, x, y, s) {
  const [cx, cy, r] = [x + s / 2, y + s / 2, s * 0.34];
  ctx.fillStyle = CRYSTAL;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r * 0.75, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r * 0.75, cy);
  ctx.closePath();
  ctx.fill();
}

function shapeAt(ctx, shape, color, x, y, s, size) {
  ctx.fillStyle = color;
  drawShape(ctx, shape, x + s / 2, y + s / 2, s * size);
}

function door({ color, shape }) {
  return (ctx, x, y, s) => {
    const w = Math.max(1, s * 0.12);
    ctx.strokeStyle = css(color);
    ctx.lineWidth = w;
    ctx.strokeRect(x + w / 2, y + w / 2, s - w, s - w);
    if (s >= 10) shapeAt(ctx, shape, css(color), x, y, s, 0.22);
  };
}

function nozzle(facing) {
  const [dx, dy] = DIRS[facing] ?? [0, 0];
  return (ctx, x, y, s) => {
    if (!dx && !dy) return;
    const [cx, cy] = [x + s / 2, y + s / 2];
    ctx.fillStyle = FLAME;
    ctx.beginPath();
    ctx.moveTo(cx + (dx * s) / 2, cy + (dy * s) / 2);
    ctx.lineTo(cx - dy * s * 0.3 - dx * s * 0.15, cy + dx * s * 0.3 - dy * s * 0.15);
    ctx.lineTo(cx + dy * s * 0.3 - dx * s * 0.15, cy - dx * s * 0.3 - dy * s * 0.15);
    ctx.closePath();
    ctx.fill();
  };
}

function stalactite(color) {
  return (ctx, x, y, s) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + s * 0.18, y);
    ctx.lineTo(x + s * 0.82, y);
    ctx.lineTo(x + s / 2, y + s * 0.92);
    ctx.closePath();
    ctx.fill();
  };
}

function cracks(ctx, x, y, s) {
  if (s < 8) return;
  ctx.strokeStyle = CRACKS;
  ctx.lineWidth = Math.max(1, s * 0.06);
  ctx.beginPath();
  ctx.moveTo(x + s * 0.2, y + s * 0.15);
  ctx.lineTo(x + s * 0.45, y + s * 0.5);
  ctx.lineTo(x + s * 0.3, y + s * 0.85);
  ctx.moveTo(x + s * 0.45, y + s * 0.5);
  ctx.lineTo(x + s * 0.8, y + s * 0.6);
  ctx.stroke();
}

function waves(ctx, x, y, s) {
  if (s < 8) return;
  ctx.strokeStyle = LAVA_GLOW;
  ctx.lineWidth = Math.max(1, s * 0.08);
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.3);
  ctx.quadraticCurveTo(x + s * 0.25, y + s * 0.12, x + s * 0.5, y + s * 0.3);
  ctx.quadraticCurveTo(x + s * 0.75, y + s * 0.48, x + s, y + s * 0.3);
  ctx.stroke();
}

function stripes(ctx, x, y, s) {
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.55);
  ctx.lineTo(x + s * 0.55, y);
  ctx.lineTo(x + s * 0.85, y);
  ctx.lineTo(x, y + s * 0.85);
  ctx.closePath();
  ctx.fill();
}

function bubble(ctx, x, y, s) {
  ctx.fillStyle = "#7a1f05";
  ctx.beginPath();
  ctx.arc(x + s / 2, y + s * 0.4, s * 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function fan(ctx, x, y, s) {
  const [cx, cy, r] = [x + s / 2, y + s / 2, s * 0.32];
  ctx.strokeStyle = "#7fe0ff";
  ctx.lineWidth = Math.max(1, s * 0.08);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.moveTo(cx - r, cy);
  ctx.lineTo(cx + r, cy);
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx, cy + r);
  ctx.stroke();
}

function ring(color) {
  return (ctx, x, y, s) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, s * 0.14);
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s / 2, s * 0.3, 0, Math.PI * 2);
    ctx.stroke();
  };
}

function dotOf(color, radius) {
  return (ctx, x, y, s) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s / 2, s * radius, 0, Math.PI * 2);
    ctx.fill();
  };
}

// A thing's character, so things of a kind can be told apart.
function labelAt(ctx, ch, x, y, s) {
  if (s < 12) return;
  ctx.font = `700 ${Math.round(s * 0.5)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(2, s * 0.1);
  ctx.strokeStyle = "rgb(0 0 0 / 0.7)";
  ctx.strokeText(ch, x + s / 2, y + s / 2);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(ch, x + s / 2, y + s / 2);
}
