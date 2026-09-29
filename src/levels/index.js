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
import l6_1 from "./6-1.js";
import l6_2 from "./6-2.js";
import l6_3 from "./6-3.js";
import l6_4 from "./6-4.js";
import l6_5 from "./6-5.js";
import l6_6 from "./6-6.js";
import l6_7 from "./6-7.js";
import l6_8 from "./6-8.js";
import l7_1 from "./7-1.js";
import l7_2 from "./7-2.js";
import l7_3 from "./7-3.js";
import l7_4 from "./7-4.js";
import l7_5 from "./7-5.js";
import l7_6 from "./7-6.js";
import l7_7 from "./7-7.js";
import l7_8 from "./7-8.js";
import l8_1 from "./8-1.js";
import l8_2 from "./8-2.js";
import l8_3 from "./8-3.js";
import l8_4 from "./8-4.js";
import l8_5 from "./8-5.js";
import l8_6 from "./8-6.js";
import l8_7 from "./8-7.js";
import l8_8 from "./8-8.js";
import testCave from "./testcave.js";
import bigCave from "./bigcave.js";

// The worlds in order, each with its levels in order. A level's id is
// "world-level", like "1-3", which is also its URL: /play/1-3. A world's `colors`
// are its rock's (render/cave.js), the world 1 ones if not given. Worlds come in
// parts (`part`, 1 if not given), and a world that ends one has an `ending`, for
// the results of its last level.
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
  {
    name: "Core",
    about: "Stalactites drop on you, crumbling rock gives way, and the lava rises: get out, up to the surface.",
    colors: { face: 0x3b2c28, wall: 0x503a33, rim: 0xe0783a, back: 0x160a07, crumble: 0x9a8070, cracks: 0xff9a40 },
    ending: { title: "Out of the core!", text: "From the heart of the planet up to the surface, and the stars." },
    levels: [l6_1, l6_2, l6_3, l6_4, l6_5, l6_6, l6_7, l6_8],
  },
  {
    name: "Foundry",
    about: "The old machines still run, and the fire with them: time your way through.",
    part: 2,
    colors: { face: 0x34302c, wall: 0x433d37, rim: 0xc8a050, back: 0x100e0c, crumble: 0x7a6a5a, cracks: 0xffa040 },
    levels: [l7_1, l7_2, l7_3, l7_4, l7_5, l7_6, l7_7, l7_8],
  },
  {
    name: "The Vaults",
    about: "Sealed vaults deep in the rock, and what was left to guard them: find your way in.",
    part: 2,
    colors: { face: 0x36403d, wall: 0x44504c, rim: 0x5cc4b4, back: 0x0b1110, crumble: 0x84928c, cracks: 0x50e0c8 },
    levels: [l8_1, l8_2, l8_3, l8_4, l8_5, l8_6, l8_7, l8_8],
  },
].map((world, w) => ({
  ...world,
  number: w + 1,
  part: world.part ?? 1,
  levels: world.levels.map((level, i) => ({ ...level, id: `${w + 1}-${i + 1}`, world: w + 1, colors: world.colors })),
}));

export const LEVELS = WORLDS.flatMap((w) => w.levels);

// Levels outside the worlds: the test cave from phases 1 and 2, at /play/test,
// and the stress level for big levels (PLAN-CONTENT.md), at /play/big.
export const TEST_CAVE = { ...testCave, id: "test" };
export const BIG_CAVE = { ...bigCave, id: "big" };
export const EXTRAS = [TEST_CAVE, BIG_CAVE];

export const levelById = (id) => EXTRAS.find((l) => l.id === id) ?? LEVELS.find((l) => l.id === id) ?? null;

// The level after `id`, or null after the last.
export const nextLevel = (id) => LEVELS[LEVELS.findIndex((l) => l.id === id) + 1] ?? null;

// What finishing level `id` means, if it's the last of a world that ends a part
// of the game: { title, text }. Otherwise null.
export const endingOf = (id) => WORLDS.find((w) => w.ending && w.levels.at(-1).id === id)?.ending ?? null;
