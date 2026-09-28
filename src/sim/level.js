// A level's map, parsed from text. Rows run top to bottom as written. In the sim,
// tile (c, j) is column c from the left and row j from the bottom, covering x from
// c·TILE to (c+1)·TILE and y from j·TILE to (j+1)·TILE. Everything outside the map
// is rock.

export const TILE = 2; // metres
const PAD_KINDS = { S: "start", E: "exit", F: "fuel" };
const PAD_WIDTH = 3; // tiles, at least
const HEADROOM = 3; // tiles of air above a pad, for the rocket to stand in
export const KEY_COLORS = { r: "red", y: "yellow", g: "green", b: "blue" };
const DOOR_COLORS = { R: "red", Y: "yellow", G: "green", B: "blue" };
const FACINGS = { right: [1, 0], left: [-1, 0], up: [0, 1], down: [0, -1] };
const FLAME_LETTERS = { ">": "right", "<": "left", "^": "up", v: "down" };
// A flamethrower's settings, unless `things` says otherwise: `length` in tiles,
// times in seconds. `mode` is "cycle" (off, then on, over and over, the last `warn`
// seconds of off flickering), "always" (on), or "near" (fires as the rocket comes
// within `reach` metres of the flame, then rests for `off`).
export const FLAME = { length: 5, on: 1.5, off: 2, warn: 0.5, offset: 0, mode: "cycle", reach: 4 };
// A lava blob: thrown `height` tiles up every `period` seconds, bubbling for `warn` first.
export const BLOB = { height: 6, period: 3, warn: 0.6, offset: 0 };
// A fan blows a column `width` tiles wide and `length` long, pushing at `strength`
// m/s² (a full burn beats 14); a magnet pulls (or with `push`, pushes) at up to
// `strength` m/s² right by it, fading to nothing at `range` metres. Either can be
// "always" on or "cycle" like a flamethrower, winding up for `warn` seconds.
export const FAN = { length: 8, width: 3, strength: 14, mode: "always", on: 3, off: 3, warn: 0.5, offset: 0 };
export const MAGNET = { strength: 16, range: 16, push: false, mode: "always", on: 3, off: 3, warn: 0.5, offset: 0 };
// A mover slides `to` [dx, dy] tiles from where it's drawn and back, smoothly, once
// every `period` seconds. A crusher rests where it's drawn, shakes for `warn`,
// slams out by `to` in `slam` seconds, holds, and goes `back`.
export const MOVER = { to: [0, 0], period: 6, offset: 0 };
export const CRUSHER = { to: [0, 0], rest: 2, warn: 0.6, slam: 0.15, hold: 0.6, back: 1, offset: 0 };
// A laser shoots a beam from its emitter to the first rock, "always" or on a
// "cycle" (flickering for `warn` before it comes on); a switch can turn it off. A
// turret fires a shot at `speed` m/s at the rocket when it can see it within
// `range` m, after winding up for `windup` s, then reloads; a shot costs `damage`.
export const LASER = { mode: "always", on: 2, off: 2, warn: 0.5, offset: 0 };
export const TURRET = { range: 40, windup: 0.5, reload: 0.7, speed: 6, damage: 30, offset: 0 };
// A stalactite shakes for `warn` seconds once the rocket is below it and within
// `reach` metres to either side, then drops; a hit costs `damage`. It's
// STALACTITE_WIDTH across where it hangs from the roof, and comes to a point.
export const STALACTITE = { reach: 5, warn: 0.7, damage: 40 };
export const STALACTITE_WIDTH = 1.6; // m
// Crumbling rock falls away `crumble` seconds after the rocket touches it.
export const CRUMBLE = 1;
export const RESERVED = new Set([..."#.*~SEF<>^vrygbRYGB!%"]);

// Parses a level module's export ({ name, map, things, ... }). Throws on anything
// wrong with it, naming the row and column as written.
//
// Besides rock, air and pads, a map has crystals (*), keys (r y g b) and the doors
// they open (R Y G B: a rectangle of its letter), flamethrowers (> < ^ v, facing
// that way), lava (~), and digits (or other letters not used for anything else)
// for the things set up in `things` by that character:
// - { kind: "switch", opens: "2", time: 8 } is a small pad that opens gate 2 when
//   landed on (for `time` seconds, or for good);
// - { kind: "gate" } is a rectangle that stays shut until then;
// - { kind: "flame", facing: "left", ...FLAME settings } is a flamethrower;
// - { kind: "blob", ...BLOB settings } is lava that throws up blobs;
// - { kind: "fan", facing: "up", ...FAN settings } is a fan;
// - { kind: "magnet", ...MAGNET settings } is a magnet;
// - { kind: "mover", to: [dx, dy], ...MOVER settings } is a sliding block, a
//   rectangle of its character where it starts;
// - { kind: "crusher", to: [dx, dy], ...CRUSHER settings } is a piston's head, a
//   rectangle of its character where it rests;
// - { kind: "laser", facing: "up", ...LASER settings } is a laser gate's emitter;
//   a switch can name it in `opens`, to turn it off;
// - { kind: "turret", ...TURRET settings } is a gun turret;
// - { kind: "stalactite", ...STALACTITE settings } is a stalactite, like `!`.
// A stalactite (!) hangs from the rock above it; a column of them is a longer one.
// Crumbling rock (%) is rock until it's touched, then falls away (level.crumbles).
// `dark: true` makes a level dark but for the rocket's headlight and what glows.
// `crumble` is how long crumbling rock takes to fall (CRUMBLE seconds).
// `rise: { speed, from, to, after, delay }` fills the cave with lava from `from`
// tiles above the map's bottom (0), rising `speed` m/s up to `to` (the top), from
// lift-off, or `delay` seconds after the key (r y g b) or switch named in `after`.
// `sky: n` opens the top n rows of the map to the sky, and everything above it.
// Door, gate, mover, crusher and stalactite tiles are air to the rock outline; they
// block as shapes of their own (level.doors, level.movers, level.stalactites).
// Flamethrowers, fans, magnets, lava and crumbling rock are rock.
export function parseLevel({ name = "level", map, things = {}, ...settings }) {
  const rows = mapRows(map);
  const width = Math.max(...rows.map((r) => r.length));
  const height = rows.length;
  const where = (c, j) => `${name}: row ${height - j}, column ${c + 1}`;
  const kindOf = (ch) => (RESERVED.has(ch) ? null : (things[ch]?.kind ?? null));

  const solid = new Uint8Array(width * height);
  const lava = new Uint8Array(width * height);
  const letters = [];
  const crystals = [];
  const keys = [];
  const nozzles = [];
  const blobs = [];
  const fans = [];
  const magnets = [];
  const emitters = [];
  const turrets = [];
  const crumbly = new Uint8Array(width * height);
  const crumbles = [];
  const hanging = [];
  rows.forEach((row, r) => {
    const j = height - 1 - r;
    for (let c = 0; c < width; c++) {
      const ch = row[c] ?? "#"; // short rows are filled with rock
      const at = { x: (c + 0.5) * TILE, y: (j + 0.5) * TILE };
      if (ch === "#") solid[j * width + c] = 1;
      else if (FLAME_LETTERS[ch] || kindOf(ch) === "flame") {
        solid[j * width + c] = 1;
        nozzles.push({ c, j, ...FLAME, facing: FLAME_LETTERS[ch], ...(FLAME_LETTERS[ch] ? {} : things[ch]) });
      } else if (ch === "%") {
        solid[j * width + c] = crumbly[j * width + c] = 1;
        crumbles.push({ c, j, x0: c * TILE, y0: j * TILE, x1: (c + 1) * TILE, y1: (j + 1) * TILE });
      } else if (ch === "!" || kindOf(ch) === "stalactite") hanging.push({ c, j, ch });
      else if (ch === "~" || kindOf(ch) === "blob") {
        solid[j * width + c] = lava[j * width + c] = 1;
        if (kindOf(ch) === "blob") blobs.push({ ...BLOB, ...things[ch], x: at.x, y: (j + 1) * TILE });
      } else if (kindOf(ch) === "fan") {
        solid[j * width + c] = 1;
        fans.push({ c, j, ...FAN, ...things[ch] });
      } else if (kindOf(ch) === "magnet") {
        solid[j * width + c] = 1;
        magnets.push({ ...MAGNET, ...things[ch], ...at });
      } else if (kindOf(ch) === "laser") {
        solid[j * width + c] = 1;
        emitters.push({ c, j, label: ch, ...LASER, ...things[ch] });
      } else if (kindOf(ch) === "turret") {
        solid[j * width + c] = 1;
        turrets.push({ c, j, ...TURRET, ...things[ch], ...at });
      } else if (ch === "*") crystals.push(at);
      else if (KEY_COLORS[ch]) {
        if (keys.some((k) => k.color === KEY_COLORS[ch])) throw new Error(`${where(c, j)}: a second ${KEY_COLORS[ch]} key`);
        keys.push({ color: KEY_COLORS[ch], ...at });
      } else if (!RESERVED.has(ch) && !kindOf(ch)) {
        if (!/[0-9A-Za-z]/.test(ch)) throw new Error(`${where(c, j)}: unknown tile "${ch}"`);
        throw new Error(`${where(c, j)}: "${ch}" isn't set up in things as a switch, gate, flame, blob, fan, magnet, mover, crusher, laser, turret or stalactite`);
      } else if (kindOf(ch) && !["switch", "gate", "mover", "crusher"].includes(kindOf(ch))) {
        throw new Error(`${where(c, j)}: "${ch}" is set up as a "${kindOf(ch)}", which isn't a kind of thing`);
      }
      letters.push(ch);
    }
  });

  if (settings.fuel !== undefined && !(settings.fuel > 0)) throw new Error(`${name}: fuel must be a number of seconds`);
  if (settings.sky !== undefined && !(Number.isInteger(settings.sky) && settings.sky > 0 && settings.sky < height)) {
    throw new Error(`${name}: sky must be a number of rows at the top of the map`);
  }
  const level = {
    name,
    width,
    height,
    solid,
    lava,
    pads: [],
    crystals,
    keys,
    doors: [],
    flames: [],
    blobs,
    fans: [],
    magnets,
    movers: [],
    lasers: [],
    turrets,
    crumbly,
    crumbles,
    stalactites: [],
    things,
    crumble: CRUMBLE,
    ...settings,
    rise: null,
  };
  const letter = (c, j) => (c < 0 || j < 0 || c >= width || j >= height ? "#" : letters[(height - 1 - j) * width + c]);

  // A pad is a run of its letter in a row, standing on rock with air above. So is
  // a switch.
  for (let j = 0; j < height; j++) {
    for (let c = 0; c < width; c++) {
      const ch = letter(c, j);
      const kind = PAD_KINDS[ch] ?? (kindOf(ch) === "switch" ? "switch" : null);
      if (!kind || letter(c - 1, j) === ch) continue;
      let c1 = c;
      while (c1 + 1 < width && letter(c1 + 1, j) === ch) c1++;
      if (c1 - c + 1 < PAD_WIDTH) throw new Error(`${where(c, j)}: a pad is at least ${PAD_WIDTH} tiles wide`);
      for (let k = c; k <= c1; k++) {
        if (!isSolid(level, k, j - 1)) throw new Error(`${where(k, j)}: a pad must stand on rock`);
        if (crumbly[(j - 1) * width + k]) throw new Error(`${where(k, j)}: a pad can't stand on crumbling rock`);
        for (let h = 1; h < HEADROOM; h++) {
          if (isSolid(level, k, j + h)) throw new Error(`${where(k, j)}: a pad needs ${HEADROOM} tiles of air above it`);
        }
      }
      const pad = { kind, c0: c, c1, j, ...flatSpan(level, c, c1, j), y: j * TILE };
      if (kind === "switch") Object.assign(pad, { label: ch, opens: String(things[ch].opens), time: things[ch].time ?? 0 });
      level.pads.push(pad);
    }
  }

  // Doors, gates, movers and crushers: each a rectangle of its character.
  const taken = new Uint8Array(width * height);
  const rectangle = (c, j) => {
    const ch = letter(c, j);
    // All the tiles joined to this one, which must fill their bounding box.
    let [cMin, c1, j1, count] = [c, c, j, 0];
    const todo = [[c, j]];
    taken[j * width + c] = 1;
    while (todo.length) {
      const [cc, jj] = todo.pop();
      count++;
      [cMin, c1, j1] = [Math.min(cMin, cc), Math.max(c1, cc), Math.max(j1, jj)];
      for (const [nc, nj] of [
        [cc + 1, jj],
        [cc - 1, jj],
        [cc, jj + 1],
        [cc, jj - 1],
      ]) {
        if (letter(nc, nj) === ch && !taken[nj * width + nc]) {
          taken[nj * width + nc] = 1;
          todo.push([nc, nj]);
        }
      }
    }
    // It was met at its lowest row's first tile, so its box starts at (c, j) if it's a rectangle.
    if (cMin !== c || count !== (c1 - c + 1) * (j1 - j + 1)) throw new Error(`${where(c, j)}: a ${kindOf(ch) ?? "door"} must be a rectangle`);
    return { c0: c, j0: j, c1, j1, x0: c * TILE, y0: j * TILE, x1: (c1 + 1) * TILE, y1: (j1 + 1) * TILE };
  };
  for (let j = 0; j < height; j++) {
    for (let c = 0; c < width; c++) {
      const ch = letter(c, j);
      const kind = DOOR_COLORS[ch] ? "door" : kindOf(ch);
      if (!["door", "gate", "mover", "crusher"].includes(kind) || taken[j * width + c]) continue;
      const box = rectangle(c, j);
      if (kind === "door" || kind === "gate") {
        level.doors.push({
          key: DOOR_COLORS[ch] ?? null, // the key that opens it, for a door
          gate: DOOR_COLORS[ch] ? null : ch, // its character, for a gate
          ...box,
        });
      } else {
        const spec = { ...(kind === "mover" ? MOVER : CRUSHER), ...things[ch] };
        const to = things[ch].to;
        if (!Array.isArray(to) || to.length !== 2 || !(to[0] || to[1])) throw new Error(`${where(c, j)}: a ${kind} needs to: [dx, dy], in tiles`);
        level.movers.push({ ...spec, kind, ...box, to: [spec.to[0] * TILE, spec.to[1] * TILE] });
      }
    }
  }

  // Stalactites: each a column of its character, hanging from rock.
  for (const { c, j, ch } of hanging) {
    if (letter(c, j + 1) === ch) continue; // not the top of its column
    if (!isSolid(level, c, j + 1) || crumbly[(j + 1) * width + c]) throw new Error(`${where(c, j)}: a stalactite must hang from rock`);
    let j0 = j;
    while (letter(c, j0 - 1) === ch) j0--;
    const x = (c + 0.5) * TILE;
    const [top, tip] = [(j + 1) * TILE, j0 * TILE];
    const half = STALACTITE_WIDTH / 2;
    const { reach, warn, damage } = { ...STALACTITE, ...(ch === "!" ? {} : things[ch]) };
    level.stalactites.push({ c, j0, j1: j, x, top, tip, reach, warn, damage, x0: x - half, x1: x + half, y0: tip, y1: top });
  }

  // Flames: from the nozzle's face, as far as `length` tiles or the first rock.
  for (const n of nozzles) {
    const dir = FACINGS[n.facing];
    if (!dir) throw new Error(`${where(n.c, n.j)}: a flamethrower faces left, right, up or down, not "${n.facing}"`);
    if (!["cycle", "always", "near"].includes(n.mode)) throw new Error(`${where(n.c, n.j)}: a flamethrower's mode is cycle, always or near`);
    let tiles = 0;
    while (tiles < n.length && !isSolid(level, n.c + dir[0] * (tiles + 1), n.j + dir[1] * (tiles + 1))) tiles++;
    if (!tiles) throw new Error(`${where(n.c, n.j)}: this flamethrower points into rock`);
    const [x0, y0] = [(n.c + 0.5 + dir[0] / 2) * TILE, (n.j + 0.5 + dir[1] / 2) * TILE];
    const { c, j, facing, on, off, warn, offset, mode, reach } = n;
    level.flames.push({ c, j, facing, on, off, warn, offset, mode, reach, x0, y0, x1: x0 + dir[0] * tiles * TILE, y1: y0 + dir[1] * tiles * TILE });
  }

  // Lasers: from the emitter's face to the first rock.
  for (const e of emitters) {
    const dir = FACINGS[e.facing];
    if (!dir) throw new Error(`${where(e.c, e.j)}: a laser faces left, right, up or down, not "${e.facing}"`);
    if (!["always", "cycle"].includes(e.mode)) throw new Error(`${where(e.c, e.j)}: a laser's mode is always or cycle`);
    let tiles = 0;
    while (tiles < 60 && !isSolid(level, e.c + dir[0] * (tiles + 1), e.j + dir[1] * (tiles + 1))) tiles++;
    if (!tiles) throw new Error(`${where(e.c, e.j)}: this laser points into rock`);
    const [x0, y0] = [(e.c + 0.5 + dir[0] / 2) * TILE, (e.j + 0.5 + dir[1] / 2) * TILE];
    const { c, j, label, facing, mode, on, off, warn, offset } = e;
    level.lasers.push({ c, j, label, facing, mode, on, off, warn, offset, x0, y0, x1: x0 + dir[0] * tiles * TILE, y1: y0 + dir[1] * tiles * TILE });
  }

  // Fans: their column of air, from the housing's face as far as `length` tiles
  // or the first rock, `width` tiles wide.
  for (const f of fans) {
    const dir = FACINGS[f.facing];
    if (!dir) throw new Error(`${where(f.c, f.j)}: a fan faces left, right, up or down, not "${f.facing}"`);
    let tiles = 0;
    while (tiles < f.length && !isSolid(level, f.c + dir[0] * (tiles + 1), f.j + dir[1] * (tiles + 1))) tiles++;
    if (!tiles) throw new Error(`${where(f.c, f.j)}: this fan blows into rock`);
    const [cx, cy] = [(f.c + 0.5) * TILE, (f.j + 0.5) * TILE];
    const [along, across] = [TILE / 2 + tiles * TILE, (f.width * TILE) / 2];
    const [ex, ey] = [cx + dir[0] * along, cy + dir[1] * along]; // the far end's middle
    const [fx, fy] = [cx + (dir[0] * TILE) / 2, cy + (dir[1] * TILE) / 2]; // the face's middle
    const { facing, strength, mode, on, off, warn, offset } = f;
    level.fans.push({
      c: f.c,
      j: f.j,
      facing,
      dir,
      strength,
      mode,
      on,
      off,
      warn,
      offset,
      x0: Math.min(fx, ex) - (dir[1] ? across : 0),
      x1: Math.max(fx, ex) + (dir[1] ? across : 0),
      y0: Math.min(fy, ey) - (dir[0] ? across : 0),
      y1: Math.max(fy, ey) + (dir[0] ? across : 0),
    });
  }

  for (const kind of ["start", "exit"]) {
    const n = level.pads.filter((p) => p.kind === kind).length;
    if (n !== 1) throw new Error(`${name}: needs one ${kind} pad, has ${n}`);
  }
  for (const door of level.doors) {
    if (door.key && !keys.some((k) => k.color === door.key)) throw new Error(`${where(door.c0, door.j0)}: no ${door.key} key for this door`);
  }
  // Each switch names the gate it opens, or the laser it turns off; each gate has a switch.
  for (const pad of level.pads.filter((p) => p.kind === "switch")) {
    const gate = level.doors.find((d) => d.gate === pad.opens) ?? level.lasers.find((l) => l.label === pad.opens);
    if (!gate) throw new Error(`${name}: switch ${pad.label} opens "${pad.opens}", which isn't a gate or laser on the map`);
    if (!(pad.time >= 0)) throw new Error(`${name}: switch ${pad.label}'s time must be a number of seconds`);
    gate.switch = pad.label;
    gate.time = pad.time;
  }
  for (const gate of level.doors.filter((d) => d.gate)) {
    if (!gate.switch) throw new Error(`${where(gate.c0, gate.j0)}: no switch opens gate ${gate.gate}`);
  }
  level.start = level.pads.find((p) => p.kind === "start");
  level.exit = level.pads.find((p) => p.kind === "exit");
  if (settings.rise) level.rise = parseRise(level, settings.rise);
  return level;
}

// A map's rows as written, top to bottom: without the blank lines before and
// after, the indent they share, or spaces at their ends.
export function mapRows(map) {
  const lines = map.split("\n");
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return lines.map((l) => l.slice(indent).trimEnd());
}

// A level's rising lava, from its `rise` setting: heights in metres.
function parseRise(level, { speed, from = 0, to = level.height, after = null, delay = 0 }) {
  const { name } = level;
  if (!(speed > 0)) throw new Error(`${name}: rising lava needs a speed, in m/s`);
  if (!(from >= 0 && to > from)) throw new Error(`${name}: rising lava goes up, from ${from} to ${to}?`);
  if (!(delay >= 0)) throw new Error(`${name}: rising lava's delay must be a number of seconds`);
  if (after !== null) {
    const key = KEY_COLORS[after];
    const known = key ? level.keys.some((k) => k.color === key) : level.pads.some((p) => p.kind === "switch" && p.label === String(after));
    if (!known) throw new Error(`${name}: rising lava comes after "${after}", which isn't a key or switch on the map`);
  }
  return { speed, from: from * TILE, to: to * TILE, after: after === null ? null : String(after), delay };
}

// Whether the point (x, y) is in a lava tile.
export function lavaAt(level, x, y) {
  const [c, j] = [Math.floor(x / TILE), Math.floor(y / TILE)];
  return c >= 0 && j >= 0 && c < level.width && j < level.height && level.lava[j * level.width + c] === 1;
}

// Whether tile (c, j) is rock, as parsed. Outside the map is rock, but for the
// sky above a level that has one.
export function isSolid(level, c, j) {
  if (j >= level.height && level.sky) return false;
  if (c < 0 || j < 0 || c >= level.width || j >= level.height) return true;
  return level.solid[j * level.width + c] === 1;
}

// The flat part of the floor under a pad, from x0 to x1. The rock outline cuts
// every corner (see outline.js), so where the floor doesn't carry on past a pad's
// end, the flat part stops half a tile short of it.
function flatSpan(level, c0, c1, j) {
  const goesOn = (c) => !isSolid(level, c, j) && isSolid(level, c, j - 1);
  return {
    x0: (goesOn(c0 - 1) ? c0 : c0 + 0.5) * TILE,
    x1: (goesOn(c1 + 1) ? c1 + 1 : c1 + 0.5) * TILE,
  };
}
