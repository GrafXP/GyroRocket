import { parseLevel } from "../src/sim/level.js";
import { buildOutline } from "../src/sim/outline.js";

export const level = (map, name = "test") => parseLevel({ name, map });

// A 40×14 room: the start pad on the left, a pyramid (45° slopes), the exit pad,
// a column 2 tiles wide, too narrow to land on, and a fuel pad. Floors are at y = 2 m.
export const ROOM = `
  ########################################
  #......................................#
  #......................................#
  #......................................#
  #......................................#
  #......................................#
  #......................................#
  #......................................#
  #......................................#
  #..................#...........##......#
  #.................###..........##......#
  #................#####.........##......#
  #...SSS.........#######...EEE..##.FFF..#
  ########################################
`;

export const room = () => {
  const l = level(ROOM, "room");
  return { level: l, outline: buildOutline(l) };
};

// A small seeded random number generator (mulberry32), for repeatable fuzzing.
export function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
