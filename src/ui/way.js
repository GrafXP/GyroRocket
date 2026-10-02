// The way down's geometry (ui/levels.js): where a world's stops are, and the
// tunnel that joins them. No DOM, so the tests run it.
//
// The stops stand in rows, `perRow` to a row, a column COLUMN wide each, and they
// go alternately high and low, so that the tunnel from one to the next has a 45°
// stretch in it, as the caves' rock has. The rows snake: one runs left to right,
// the next back again, a straight drop between them. The tunnel comes in from the
// top over the first stop and can go out at the bottom under the last, so one
// world's way out is the next one's way in.

export const COLUMN = 100;
const HIGH = 50; // a row's high stops, from the row's top
const LOW = 90; // and its low ones: 40 lower, which is the 45° stretch
const ROW = 150; // from one row's top to the next's: room for the rocket to stand on a stop under another
const LEVEL = (COLUMN - (LOW - HIGH)) / 2; // the level stretch either side of the slope

// The layout of `count` stops, `perRow` to a row. `flip` starts the first row at
// the right, for a world whose way in is there. Gives { width, height, stops, in,
// out, path }: the stops' centres as [x, y], the x where the tunnel comes in and
// where it'd go out, and path(exit), its line as an SVG path, down to the bottom
// if `exit`.
export function layout(count, perRow, flip = false) {
  const width = perRow * COLUMN;
  const rows = Math.ceil(count / perRow);
  const height = (rows - 1) * ROW + LOW + HIGH;
  const stops = Array.from({ length: count }, (_, i) => {
    const [row, k] = [Math.floor(i / perRow), i % perRow];
    const leftwards = (row % 2 === 1) !== flip;
    const x = COLUMN / 2 + COLUMN * (leftwards ? perRow - 1 - k : k);
    return [x, row * ROW + (k % 2 ? LOW : HIGH)];
  });
  const path = (exit = false) => {
    let d = `M${stops[0][0]} 0V${stops[0][1]}`;
    for (let i = 1; i < count; i++) {
      const [[ax, ay], [bx, by]] = [stops[i - 1], stops[i]];
      if (ax === bx) d += `V${by}`; // the drop to the next row
      else {
        const way = Math.sign(bx - ax);
        d += `H${ax + way * LEVEL}L${bx - way * LEVEL} ${by}H${bx}`;
      }
    }
    return exit ? `${d}V${height}` : d;
  };
  return { width, height, stops, in: stops[0][0], out: stops.at(-1)[0], path };
}
