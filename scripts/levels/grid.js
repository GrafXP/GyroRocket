// Building the big levels of part two (PLAN-CONTENT.md) in code: a script per
// level (scripts/levels/7-1.js…) draws it on a Grid, in rectangles of rock and air
// with pads, things and ragged edges, and buildLevel writes it out as a plain level
// module in src/levels/, with a picture of it in previews/ (ignored by git). The
// level module is what the game plays; its script is how to change it and build
// it again:
//
//   node scripts/levels/7-1.js          writes src/levels/7-1.js and previews/7-1.png
//   node scripts/levels/check.js 7-1    checks it, flies it, suggests a tank and par
//   node scripts/levels/trace.js 7-1    where the autopilot was before it gave up
//   node scripts/levels/render.js 7-1   runs the render code over it, in node
//
// The grid is in editor coordinates: c from the left, r from the top, from 0.
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import { parseLevel } from "../../src/sim/level.js";

const REPO = fileURLToPath(new URL("../..", import.meta.url));

export class Grid {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.g = Array.from({ length: h }, () => Array(w).fill("#"));
    this.things = {};
    this.keep = []; // boxes roughen leaves alone
  }
  in(c, r) {
    return c >= 0 && r >= 0 && c < this.w && r < this.h;
  }
  get(c, r) {
    return this.in(c, r) ? this.g[r][c] : "#";
  }
  set(c, r, ch) {
    if (!this.in(c, r)) throw new Error(`off the map: ${c}, ${r}`);
    this.g[r][c] = ch;
    return this;
  }
  fill(c0, r0, c1, r1, ch) {
    for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r++) for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++) this.set(c, r, ch);
    return this;
  }
  air(c0, r0, c1, r1) {
    return this.fill(c0, r0, c1, r1, ".");
  }
  rock(c0, r0, c1, r1) {
    return this.fill(c0, r0, c1, r1, "#");
  }
  // A pad of `kind` (S E F or a switch's label) on row r, from column c, w wide:
  // rock under it and air above it.
  pad(ch, c, r, w = 3) {
    this.fill(c, r, c + w - 1, r, ch);
    this.fill(c - 1, r + 1, c + w, r + 1, "#");
    this.fill(c, r - 3, c + w - 1, r - 1, ".");
    this.protect(c - 2, r - 4, c + w + 1, r + 2);
    return this;
  }
  // A ledge of rock for a pad: rows r+1..r+depth from c-1 to c+w, and the pad on row r.
  ledge(ch, c, r, w = 3, depth = 2) {
    this.fill(c - 1, r + 1, c + w, r + depth, "#");
    return this.pad(ch, c, r, w);
  }
  thing(ch, spec) {
    if (this.things[ch] && JSON.stringify(this.things[ch]) !== JSON.stringify(spec)) throw new Error(`thing ${ch} set up twice`);
    this.things[ch] = spec;
    return ch;
  }
  protect(c0, r0, c1, r1) {
    this.keep.push([c0, r0, c1, r1]);
    return this;
  }
  kept(c, r) {
    return this.keep.some(([c0, r0, c1, r1]) => c >= c0 && c <= c1 && r >= r0 && r <= r1);
  }
  // Ragged rock: eats into rock that borders air, where the rock is thick enough
  // behind it, so passages only ever get wider. `amount` 0..1.
  roughen(seed = 1, amount = 0.35, passes = 2) {
    let s = seed * 9301 + 49297;
    const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const noise = (c, r) => {
      const n = Math.sin(c * 12.9898 + r * 78.233 + seed * 3.7) * 43758.5453;
      return n - Math.floor(n);
    };
    for (let p = 0; p < passes; p++) {
      const eat = [];
      for (let r = 1; r < this.h - 1; r++) {
        for (let c = 1; c < this.w - 1; c++) {
          if (this.g[r][c] !== "#" || this.kept(c, r)) continue;
          const dirs = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ];
          const open = dirs.filter(([dc, dr]) => this.get(c + dc, r + dr) === ".");
          if (open.length !== 1) continue;
          const [dc, dr] = open[0];
          // Thick behind: three more rock tiles the other way, and rock to both sides.
          let thick = true;
          for (let k = 1; k <= 3; k++) if (this.get(c - dc * k, r - dr * k) !== "#") thick = false;
          if (!thick) continue;
          // Don't eat under something standing on this rock, or the rock things hang from.
          const beyond = this.get(c + dc, r + dr);
          if (beyond !== ".") continue;
          const around = [
            [c + 1, r],
            [c - 1, r],
            [c, r + 1],
            [c, r - 1],
            [c + 1, r + 1],
            [c - 1, r - 1],
            [c + 1, r - 1],
            [c - 1, r + 1],
          ];
          if (around.some(([x, y]) => !"#.".includes(this.get(x, y)))) continue;
          if (noise(Math.floor(c / 2) + p * 31, Math.floor(r / 2)) < amount) eat.push([c, r]);
        }
      }
      for (const [c, r] of eat) this.g[r][c] = ".";
    }
    rand();
    return this;
  }
  text() {
    return this.g.map((row) => row.join("")).join("\n");
  }
}

const val = (v) => (Array.isArray(v) ? `[${v.map(val).join(", ")}]` : typeof v === "string" ? JSON.stringify(v) : String(v));
const obj = (o) => `{ ${Object.entries(o).map(([k, v]) => `${k}: ${val(v)}`).join(", ")} }`;
const key = (k) => (/^[0-9]$/.test(k) ? k : /^[A-Za-z]\w*$/.test(k) ? k : JSON.stringify(k));

// Writes src/levels/<id>.js.
export function writeLevel(id, grid, { header, name, fuel, par, route, dark, rise, crumble, sky }) {
  const lines = [];
  for (const h of header.trim().split("\n")) lines.push(h ? `// ${h}` : "//");
  lines.push("export default {");
  lines.push(`  name: ${JSON.stringify(name)},`);
  lines.push(`  fuel: ${fuel},`);
  lines.push(`  par: ${par},`);
  if (dark) lines.push(`  dark: true,`);
  if (sky) lines.push(`  sky: ${sky},`);
  if (crumble) lines.push(`  crumble: ${crumble},`);
  if (route) lines.push(`  route: ${JSON.stringify(route)},`);
  if (rise) lines.push(`  rise: ${obj(rise)},`);
  const order = Object.keys(grid.things).sort((a, b) => {
    const rank = (k) => (/[0-9]/.test(k) ? 0 : /[a-z]/.test(k) ? 1 : 2);
    return rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0);
  });
  // Only the things on the map.
  const used = new Set(grid.g.flat());
  const things = order.filter((k) => used.has(k));
  if (things.length) {
    lines.push("  things: {");
    for (const k of things) lines.push(`    ${key(k)}: ${obj(grid.things[k])},`);
    lines.push("  },");
  }
  lines.push("  map: `");
  for (const row of grid.g) lines.push(`    ${row.join("")}`);
  lines.push("  `,");
  lines.push("};");
  writeFileSync(`${REPO}/src/levels/${id}.js`, lines.join("\n") + "\n");
}

// Writes src/levels/<id>.js (as writeLevel), parses it as the game will, and
// draws it to previews/<id>.png.
export async function buildLevel(id, grid, settings) {
  writeLevel(id, grid, settings);
  const def = (await import(new URL(`../../src/levels/${id}.js?${Date.now()}`, import.meta.url))).default;
  const level = parseLevel(def);
  mkdirSync(`${REPO}/previews`, { recursive: true });
  png(`${REPO}/previews/${id}.png`, grid, level);
  const named = new Set(grid.g.flat().filter((ch) => grid.things[ch])).size;
  console.log(`${id} ${def.name}: ${grid.w} × ${grid.h}, ${named} things named; previews/${id}.png`);
}

// A picture of the map, `scale` px a tile, with flames, fans and what movers
// sweep shaded in, from the parsed level.
export function png(path, grid, level, scale = 4) {
  const W = grid.w * scale;
  const H = grid.h * scale;
  const px = new Uint8Array(W * H * 3);
  const put = (x, y, [r, g, b], a = 1) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    px[i] = px[i] * (1 - a) + r * a;
    px[i + 1] = px[i + 1] * (1 - a) + g * a;
    px[i + 2] = px[i + 2] * (1 - a) + b * a;
  };
  const colour = (ch) => {
    const kind = grid.things[ch]?.kind;
    if (ch === "#") return [70, 64, 58];
    if (ch === ".") return [14, 13, 16];
    if (ch === "~") return [255, 110, 20];
    if (ch === "%") return [150, 120, 100];
    if (ch === "S") return [255, 255, 255];
    if (ch === "E") return [60, 230, 90];
    if (ch === "F") return [60, 150, 255];
    if (ch === "*") return [210, 90, 255];
    if ("rygb".includes(ch)) return { r: [255, 60, 60], y: [255, 220, 40], g: [60, 220, 60], b: [60, 120, 255] }[ch];
    if ("RYGB".includes(ch)) return { R: [160, 30, 30], Y: [160, 140, 20], G: [30, 130, 30], B: [30, 60, 160] }[ch];
    if ("<>^v".includes(ch) || kind === "flame") return [255, 40, 40];
    if (ch === "!" || kind === "stalactite") return [200, 200, 170];
    return (
      {
        switch: [255, 150, 0],
        gate: [200, 110, 0],
        blob: [255, 200, 0],
        fan: [0, 220, 220],
        magnet: [230, 0, 230],
        mover: [200, 170, 90],
        crusher: [230, 190, 60],
        laser: [255, 0, 120],
        turret: [140, 140, 255],
      }[kind] ?? [255, 0, 255]
    );
  };
  for (let r = 0; r < grid.h; r++) for (let c = 0; c < grid.w; c++) {
    const col = colour(grid.g[r][c]);
    for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++) put(c * scale + x, r * scale + y, col);
  }
  // Metres to pixels: x / 2 * scale, y from the bottom.
  const box = (b, col, a) => {
    const [x0, x1] = [Math.round((Math.min(b.x0, b.x1) / 2) * scale), Math.round((Math.max(b.x0, b.x1) / 2) * scale)];
    const [y0, y1] = [Math.round(H - (Math.max(b.y0, b.y1) / 2) * scale), Math.round(H - (Math.min(b.y0, b.y1) / 2) * scale)];
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) put(x, y, col, a);
  };
  for (const f of level.flames) {
    const w = 1.6;
    box({ x0: Math.min(f.x0, f.x1) - (f.x0 === f.x1 ? w : 0), x1: Math.max(f.x0, f.x1) + (f.x0 === f.x1 ? w : 0), y0: Math.min(f.y0, f.y1) - (f.y0 === f.y1 ? w : 0), y1: Math.max(f.y0, f.y1) + (f.y0 === f.y1 ? w : 0) }, [255, 60, 30], 0.35);
  }
  for (const f of level.fans) box(f, [0, 200, 220], 0.12);
  for (const b of level.blobs) box({ x0: b.x - 0.8, x1: b.x + 0.8, y0: b.y, y1: b.y + b.height * 2 }, [255, 200, 0], 0.3);
  for (const m of level.movers) {
    const [dx, dy] = m.to;
    box({ x0: m.x0 + Math.min(0, dx), y0: m.y0 + Math.min(0, dy), x1: m.x1 + Math.max(0, dx), y1: m.y1 + Math.max(0, dy) }, [230, 190, 60], 0.25);
  }
  for (const l of level.lasers) {
    const w = 0.5;
    box({ x0: Math.min(l.x0, l.x1) - w, x1: Math.max(l.x0, l.x1) + w, y0: Math.min(l.y0, l.y1) - w, y1: Math.max(l.y0, l.y1) + w }, [255, 0, 120], 0.5);
  }
  for (const m of level.magnets) {
    const R = (m.range / 2) * scale;
    const [cx, cy] = [(m.x / 2) * scale, H - (m.y / 2) * scale];
    for (let a = 0; a < 360; a += 1) put(Math.round(cx + R * Math.cos((a * Math.PI) / 180)), Math.round(cy + R * Math.sin((a * Math.PI) / 180)), m.push ? [0, 255, 120] : [230, 0, 230], 0.8);
  }
  // Grid lines every 10 tiles.
  for (let c = 0; c < grid.w; c += 10) for (let y = 0; y < H; y += 2) put(c * scale, y, [120, 120, 120], 0.5);
  for (let r = 0; r < grid.h; r += 10) for (let x = 0; x < W; x += 2) put(x, r * scale, [120, 120, 120], 0.5);
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0;
    Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}
