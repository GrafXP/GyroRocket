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

// Parses a level module's export ({ name, map, things, ... }). Throws on anything
// wrong with it, naming the row and column as written.
//
// Besides rock, air and pads, a map has crystals (*), keys (r y g b) and the doors
// they open (R Y G B: a rectangle of its letter), and digits for the things set up
// in `things` by digit: { kind: "switch", opens: "2", time: 8 } is a small pad that
// opens gate 2 when landed on (for `time` seconds, or for good), and { kind: "gate" }
// is a rectangle that stays shut until then. Door and gate tiles are air to the
// rock outline; they block as rectangles while shut (level.doors).
export function parseLevel({ name = "level", map, things = {}, ...settings }) {
  const lines = map.split("\n");
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  const rows = lines.map((l) => l.slice(indent).trimEnd());
  const width = Math.max(...rows.map((r) => r.length));
  const height = rows.length;
  const where = (c, j) => `${name}: row ${height - j}, column ${c + 1}`;
  const kindOf = (ch) => (/[1-9]/.test(ch) ? things[ch]?.kind : null);

  const solid = new Uint8Array(width * height);
  const letters = [];
  const crystals = [];
  const keys = [];
  rows.forEach((row, r) => {
    const j = height - 1 - r;
    for (let c = 0; c < width; c++) {
      const ch = row[c] ?? "#"; // short rows are filled with rock
      const at = { x: (c + 0.5) * TILE, y: (j + 0.5) * TILE };
      if (ch === "#") solid[j * width + c] = 1;
      else if (ch === "*") crystals.push(at);
      else if (KEY_COLORS[ch]) {
        if (keys.some((k) => k.color === KEY_COLORS[ch])) throw new Error(`${where(c, j)}: a second ${KEY_COLORS[ch]} key`);
        keys.push({ color: KEY_COLORS[ch], ...at });
      } else if (/[1-9]/.test(ch) && kindOf(ch) !== "switch" && kindOf(ch) !== "gate") {
        throw new Error(`${where(c, j)}: "${ch}" isn't set up in things as a switch or a gate`);
      } else if (ch !== "." && !PAD_KINDS[ch] && !DOOR_COLORS[ch] && !kindOf(ch)) {
        throw new Error(`${where(c, j)}: unknown tile "${ch}"`);
      }
      letters.push(ch);
    }
  });

  if (settings.fuel !== undefined && !(settings.fuel > 0)) throw new Error(`${name}: fuel must be a number of seconds`);
  const level = { name, width, height, solid, pads: [], crystals, keys, doors: [], things, ...settings };
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
        for (let h = 1; h < HEADROOM; h++) {
          if (isSolid(level, k, j + h)) throw new Error(`${where(k, j)}: a pad needs ${HEADROOM} tiles of air above it`);
        }
      }
      const pad = { kind, c0: c, c1, j, ...flatSpan(level, c, c1, j), y: j * TILE };
      if (kind === "switch") Object.assign(pad, { label: ch, opens: String(things[ch].opens), time: things[ch].time ?? 0 });
      level.pads.push(pad);
    }
  }

  // Doors and gates: each a rectangle of its letter.
  const taken = new Uint8Array(width * height);
  for (let j = 0; j < height; j++) {
    for (let c = 0; c < width; c++) {
      const ch = letter(c, j);
      if ((!DOOR_COLORS[ch] && kindOf(ch) !== "gate") || taken[j * width + c]) continue;
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
      if (cMin !== c || count !== (c1 - c + 1) * (j1 - j + 1)) throw new Error(`${where(c, j)}: a door or gate must be a rectangle`);
      level.doors.push({
        key: DOOR_COLORS[ch] ?? null, // the key that opens it, for a door
        gate: DOOR_COLORS[ch] ? null : ch, // its digit, for a gate
        c0: c,
        j0: j,
        c1,
        j1,
        x0: c * TILE,
        y0: j * TILE,
        x1: (c1 + 1) * TILE,
        y1: (j1 + 1) * TILE,
      });
    }
  }

  for (const kind of ["start", "exit"]) {
    const n = level.pads.filter((p) => p.kind === kind).length;
    if (n !== 1) throw new Error(`${name}: needs one ${kind} pad, has ${n}`);
  }
  for (const door of level.doors) {
    if (door.key && !keys.some((k) => k.color === door.key)) throw new Error(`${where(door.c0, door.j0)}: no ${door.key} key for this door`);
  }
  // Each switch names the gate it opens; each gate has a switch.
  for (const pad of level.pads.filter((p) => p.kind === "switch")) {
    const gate = level.doors.find((d) => d.gate === pad.opens);
    if (!gate) throw new Error(`${name}: switch ${pad.label} opens "${pad.opens}", which isn't a gate on the map`);
    if (!(pad.time >= 0)) throw new Error(`${name}: switch ${pad.label}'s time must be a number of seconds`);
    gate.switch = pad.label;
    gate.time = pad.time;
  }
  for (const gate of level.doors.filter((d) => d.gate)) {
    if (!gate.switch) throw new Error(`${where(gate.c0, gate.j0)}: no switch opens gate ${gate.gate}`);
  }
  level.start = level.pads.find((p) => p.kind === "start");
  level.exit = level.pads.find((p) => p.kind === "exit");
  return level;
}

export function isSolid(level, c, j) {
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
