// node scripts/levels/render.js 7-1 7-2…: builds each level's scene parts with
// the render code (src/render/), on a stub canvas since node has none, and updates
// them while the autopilot flies the level, to catch errors without a browser.
// How it looks is for the phone.
const ctx = new Proxy(
  {},
  {
    get: (t, k) =>
      k === "createImageData"
        ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) })
        : k === "createLinearGradient" || k === "createRadialGradient"
          ? () => ({ addColorStop() {} })
          : k === "measureText"
            ? () => ({ width: 10 })
            : typeof k === "string" && /^[a-z]/.test(k)
              ? () => {}
              : undefined,
    set: () => true,
  },
);
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx, style: {} }) };

const { levelById } = await import("../../src/levels/index.js");
const { parseLevel } = await import("../../src/sim/level.js");
const { buildOutline } = await import("../../src/sim/outline.js");
const { createWorld, advance } = await import("../../src/sim/world.js");
const { inputCode } = await import("../../src/sim/input.js");
const { createPilot } = await import("../../src/autopilot.js");
const parts = await Promise.all(["cave", "things", "doors", "hazards", "machines", "defences", "core", "rocket"].map((n) => import(`../../src/render/${n}.js`)));

for (const id of process.argv.slice(2)) {
  const def = levelById(id);
  if (!def) throw new Error(`no level ${id}`);
  const level = parseLevel(def);
  const outline = buildOutline(level);
  const world = createWorld(level, outline);
  const dark = !!level.dark;
  const [cave, things, doors, hazards, machines, defences, core, rocket] = [
    parts[0].createCave(outline, def.colors),
    parts[1].createThings(level, dark),
    parts[2].createDoors(level, dark),
    parts[3].createHazards(level),
    parts[4].createMachines(level),
    parts[5].createDefences(level),
    parts[6].createCore(level, def.colors),
    parts[7].createRocketModel(dark),
  ];
  const pilot = createPilot(world, { restart: false });
  let objects = 0;
  for (const p of [cave, things, doors, hazards, machines, defences, core, rocket]) p.group.traverse(() => objects++);
  for (let t = 0; t < 60 * 600 && !world.done && !pilot.failed; t++) {
    advance(world, inputCode(pilot.input()));
    if (t % 3) continue;
    rocket.update(world.rocket);
    things.update(world);
    doors.update(world);
    hazards.update(world);
    machines.update(world, 0.05);
    defences.update(world);
    core.update(world);
    cave.update();
  }
  console.log(`${id}: ${objects} objects, ${world.done ? "finished" : (pilot.failed ?? "stopped")} in ${(world.tick / 60).toFixed(0)} s, no errors`);
}
