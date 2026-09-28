import { AIR, ROCK, charAt, cloneGrid, inside, kindOf } from "./grid.js";

// Select an instance, rather than every occurrence of its label. Pads and
// switches are horizontal runs; stalactites are columns; blocks are connected
// shapes. Wall fixtures and pick-ups are single tiles.
export function movableAt(grid, c, r) {
  if (!inside(grid, c, r)) return null;
  const ch = charAt(grid, c, r);
  const kind = kindOf(grid, ch);
  if (!kind && !"SEF*rygbRYGB<>^v!".includes(ch)) return null;
  const dirs =
    "SEF".includes(ch) || kind === "switch"
      ? [
          [-1, 0],
          [1, 0],
        ]
      : ch === "!" || kind === "stalactite"
        ? [
            [0, -1],
            [0, 1],
          ]
        : "RYGB".includes(ch) || ["gate", "mover", "crusher"].includes(kind)
          ? [
              [-1, 0],
              [1, 0],
              [0, -1],
              [0, 1],
            ]
          : [];
  const cells = new Set([r * grid.width + c]);
  const todo = [[c, r]];
  let [c0, c1, r0, r1] = [c, c, r, r];
  while (todo.length) {
    const [cc, rr] = todo.pop();
    c0 = Math.min(c0, cc);
    c1 = Math.max(c1, cc);
    r0 = Math.min(r0, rr);
    r1 = Math.max(r1, rr);
    for (const [dc, dr] of dirs) {
      const nc = cc + dc,
        nr = rr + dr;
      const i = nr * grid.width + nc;
      if (inside(grid, nc, nr) && !cells.has(i) && charAt(grid, nc, nr) === ch) {
        cells.add(i);
        todo.push([nc, nr]);
      }
    }
  }
  return { ch, cells, c0, c1, r0, r1 };
}

// Every preview is based on the original grid so dragging over a tile cannot
// erase it. Clamp the whole instance inside the map; occupied drops are rejected.
export function moveObject(grid, object, dc, dr) {
  dc = Math.max(-object.c0, Math.min(grid.width - 1 - object.c1, Math.round(dc)));
  dr = Math.max(-object.r0, Math.min(grid.height - 1 - object.r1, Math.round(dr)));
  const destinations = [...object.cells].map((i) => i + dr * grid.width + dc);
  if (destinations.some((i) => !object.cells.has(i) && grid.cells[i] !== AIR && grid.cells[i] !== ROCK)) {
    return { grid, dc, dr, problem: "That space is occupied. Drop on rock or air." };
  }
  if (!dc && !dr) return { grid, dc, dr, problem: null };
  const moved = cloneGrid(grid);
  for (const i of object.cells) moved.cells[i] = AIR;
  for (const i of destinations) moved.cells[i] = object.ch.charCodeAt(0);
  if (object.ch === "F" && moved.settings.route) {
    moved.settings.route = moved.settings.route.replace(/\bF@(\d+)\b/g, (stop, column) => {
      const c = Number(column) - 1;
      return c >= object.c0 && c <= object.c1 ? `F@${Number(column) + dc}` : stop;
    });
  }
  return { grid: moved, dc, dr, problem: null };
}
