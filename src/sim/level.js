// A level's map, parsed from text. Rows run top to bottom as written. In the sim,
// tile (c, j) is column c from the left and row j from the bottom, covering x from
// c·TILE to (c+1)·TILE and y from j·TILE to (j+1)·TILE. Everything outside the map
// is rock.

export const TILE = 2; // metres
const PAD_KINDS = { S: "start", E: "exit", F: "fuel" };
const PAD_WIDTH = 3; // tiles, at least
const HEADROOM = 3; // tiles of air above a pad, for the rocket to stand in

// Parses a level module's export ({ name, map, ... }). Throws on anything wrong
// with the map, naming the row and column as written.
export function parseLevel({ name = "level", map, ...settings }) {
  const lines = map.split("\n");
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  const rows = lines.map((l) => l.slice(indent).trimEnd());
  const width = Math.max(...rows.map((r) => r.length));
  const height = rows.length;
  const where = (c, j) => `${name}: row ${height - j}, column ${c + 1}`;

  const solid = new Uint8Array(width * height);
  const letters = [];
  rows.forEach((row, r) => {
    const j = height - 1 - r;
    for (let c = 0; c < width; c++) {
      const ch = row[c] ?? "#"; // short rows are filled with rock
      if (ch === "#") solid[j * width + c] = 1;
      else if (ch !== "." && !PAD_KINDS[ch]) throw new Error(`${where(c, j)}: unknown tile "${ch}"`);
      letters.push(ch);
    }
  });

  if (settings.fuel !== undefined && !(settings.fuel > 0)) throw new Error(`${name}: fuel must be a number of seconds`);
  const level = { name, width, height, solid, pads: [], ...settings };
  const letter = (c, j) => letters[(height - 1 - j) * width + c];

  // A pad is a run of its letter in a row, standing on rock with air above.
  for (let j = 0; j < height; j++) {
    for (let c = 0; c < width; c++) {
      const kind = PAD_KINDS[letter(c, j)];
      if (!kind || letter(c - 1, j) === letter(c, j)) continue;
      let c1 = c;
      while (c1 + 1 < width && letter(c1 + 1, j) === letter(c, j)) c1++;
      if (c1 - c + 1 < PAD_WIDTH) throw new Error(`${where(c, j)}: a pad is at least ${PAD_WIDTH} tiles wide`);
      for (let k = c; k <= c1; k++) {
        if (!isSolid(level, k, j - 1)) throw new Error(`${where(k, j)}: a pad must stand on rock`);
        for (let h = 1; h < HEADROOM; h++) {
          if (isSolid(level, k, j + h)) throw new Error(`${where(k, j)}: a pad needs ${HEADROOM} tiles of air above it`);
        }
      }
      level.pads.push({ kind, c0: c, c1, j, ...flatSpan(level, c, c1, j), y: j * TILE });
    }
  }

  for (const kind of ["start", "exit"]) {
    const n = level.pads.filter((p) => p.kind === kind).length;
    if (n !== 1) throw new Error(`${name}: needs one ${kind} pad, has ${n}`);
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
