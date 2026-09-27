import l1_1 from "./1-1.js";
import l1_2 from "./1-2.js";
import l1_3 from "./1-3.js";
import l1_4 from "./1-4.js";
import l1_5 from "./1-5.js";
import l1_6 from "./1-6.js";
import l1_7 from "./1-7.js";
import l1_8 from "./1-8.js";
import testCave from "./testcave.js";

// The worlds in order, each with its levels in order. A level's id is
// "world-level", like "1-3", which is also its URL: /play/1-3.
export const WORLDS = [
  {
    name: "Training caves",
    about: "Learn to fly: up, across and down, landing on ledges, and refuelling.",
    levels: [l1_1, l1_2, l1_3, l1_4, l1_5, l1_6, l1_7, l1_8],
  },
].map((world, w) => ({
  ...world,
  number: w + 1,
  levels: world.levels.map((level, i) => ({ ...level, id: `${w + 1}-${i + 1}`, world: w + 1 })),
}));

export const LEVELS = WORLDS.flatMap((w) => w.levels);

// The test cave from phases 1 and 2, outside the worlds, at /play/test.
export const TEST_CAVE = { ...testCave, id: "test" };

export const levelById = (id) => (id === TEST_CAVE.id ? TEST_CAVE : (LEVELS.find((l) => l.id === id) ?? null));

// The level after `id`, or null after the last.
export const nextLevel = (id) => LEVELS[LEVELS.findIndex((l) => l.id === id) + 1] ?? null;
