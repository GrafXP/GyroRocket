import l1_1 from "./1-1.js";
import l1_2 from "./1-2.js";
import l1_3 from "./1-3.js";
import l1_4 from "./1-4.js";
import l1_5 from "./1-5.js";
import l1_6 from "./1-6.js";
import l1_7 from "./1-7.js";
import l1_8 from "./1-8.js";
import l2_1 from "./2-1.js";
import l2_2 from "./2-2.js";
import l2_3 from "./2-3.js";
import l2_4 from "./2-4.js";
import l2_5 from "./2-5.js";
import l2_6 from "./2-6.js";
import l2_7 from "./2-7.js";
import l2_8 from "./2-8.js";
import l3_1 from "./3-1.js";
import l3_2 from "./3-2.js";
import l3_3 from "./3-3.js";
import l3_4 from "./3-4.js";
import l3_5 from "./3-5.js";
import l3_6 from "./3-6.js";
import l3_7 from "./3-7.js";
import l3_8 from "./3-8.js";
import l4_1 from "./4-1.js";
import l4_2 from "./4-2.js";
import l4_3 from "./4-3.js";
import l4_4 from "./4-4.js";
import l4_5 from "./4-5.js";
import l4_6 from "./4-6.js";
import l4_7 from "./4-7.js";
import l4_8 from "./4-8.js";
import l5_1 from "./5-1.js";
import l5_2 from "./5-2.js";
import l5_3 from "./5-3.js";
import l5_4 from "./5-4.js";
import l5_5 from "./5-5.js";
import l5_6 from "./5-6.js";
import l5_7 from "./5-7.js";
import l5_8 from "./5-8.js";
import testCave from "./testcave.js";

// The worlds in order, each with its levels in order. A level's id is
// "world-level", like "1-3", which is also its URL: /play/1-3. A world's `colors`
// are its rock's (render/cave.js), the world 1 ones if not given.
export const WORLDS = [
  {
    name: "Training caves",
    about: "Learn to fly: up, across and down, landing on ledges, and refuelling.",
    levels: [l1_1, l1_2, l1_3, l1_4, l1_5, l1_6, l1_7, l1_8],
  },
  {
    name: "Old mine",
    about: "Keys open the doors of their colour; switches open gates, some only for a while.",
    colors: { face: 0x7a6650, wall: 0x8c7458, rim: 0xc7a577, back: 0x241a12 },
    levels: [l2_1, l2_2, l2_3, l2_4, l2_5, l2_6, l2_7, l2_8],
  },
  {
    name: "Furnace",
    about: "Flamethrowers fire on the clock or when you come near, and lava destroys whatever touches it.",
    colors: { face: 0x6e3b2e, wall: 0x8a4a36, rim: 0xe0875a, back: 0x2a0d08 },
    levels: [l3_1, l3_2, l3_3, l3_4, l3_5, l3_6, l3_7, l3_8],
  },
  {
    name: "Works",
    about: "Fans blow, magnets pull and push, blocks slide, and crushers slam.",
    colors: { face: 0x5d646e, wall: 0x707a86, rim: 0xa9b4c2, back: 0x1b1f26 },
    levels: [l4_1, l4_2, l4_3, l4_4, l4_5, l4_6, l4_7, l4_8],
  },
  {
    name: "Deep dark",
    about: "Caves with no light but your own, laser gates, and turrets that shoot when they can see you.",
    colors: { face: 0x3a4050, wall: 0x4a5266, rim: 0x7f8fb0, back: 0x0c0e14 },
    levels: [l5_1, l5_2, l5_3, l5_4, l5_5, l5_6, l5_7, l5_8],
  },
].map((world, w) => ({
  ...world,
  number: w + 1,
  levels: world.levels.map((level, i) => ({ ...level, id: `${w + 1}-${i + 1}`, world: w + 1, colors: world.colors })),
}));

export const LEVELS = WORLDS.flatMap((w) => w.levels);

// The test cave from phases 1 and 2, outside the worlds, at /play/test.
export const TEST_CAVE = { ...testCave, id: "test" };

export const levelById = (id) => (id === TEST_CAVE.id ? TEST_CAVE : (LEVELS.find((l) => l.id === id) ?? null));

// The level after `id`, or null after the last.
export const nextLevel = (id) => LEVELS[LEVELS.findIndex((l) => l.id === id) + 1] ?? null;
