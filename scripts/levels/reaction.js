// How dense and quick a level is, along the autopilot's route (PLAN-CONTENT.md,
// *Harder by reaction*):
//
//   node scripts/levels/reaction.js 9-3     one level
//   node scripts/levels/reaction.js 7 8     whole worlds, level by level and in all
//   node scripts/levels/reaction.js 9-3 --quiet   and where its route is quiet
//   node scripts/levels/reaction.js 9-3 --legs    and how dense each leg is
//
// A hazard is *passed* when the rocket's shape comes within NEAR metres of what
// it covers: a flame's or a beam's length, a blob's throw, the whole travel of a
// block or crusher, the column under a stalactite (while it hangs or falls), a
// patch of crumbling rock (while any of it stands), a cycling fan's column, the
// strong part of a magnet's pull (within 60% of its range), or a turret within
// TURRET_NEAR metres. Coming back past one counts again once the rocket has been
// well away. The route is *quiet* where nothing is that close, counting only
// where the rocket moves, not where it waits. *Triggered* hazards go off because
// of the rocket: stalactites, crumbling rock, "near" flames and turrets. A
// hazard's *window* is how long it's clear before its warning (a flame's or
// beam's off time less its warning, a "near" flame's rest, a crusher's rest, and
// how long a blob's column is clear halfway up its throw), and its *warning* how
// long it warns before it hurts.
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TILE } from "../../src/sim/level.js";
import { flightTime } from "../../src/sim/hazards/blob.js";
import { TICK_RATE, circlesAt } from "../../src/sim/rocket.js";

export const NEAR = 6; // m
const TURRET_NEAR = 24; // m
const AWAY = 10; // m it goes past NEAR before passing the same hazard counts again
const MOVING = 1; // m/s: slower than this, it's waiting
const MAGNET_SHARE = 0.6; // of its range: the strong part of a magnet's pull

// The floors (PLAN-CONTENT.md): nothing in part two warns for less than
// MIN_WARNING, or is clear for less than MIN_WINDOW, on its own settings.
export const MIN_WARNING = 0.4; // s
export const MIN_WINDOW = 1; // s

const segment = (x0, y0, x1, y1) => (x, y) => {
  const [dx, dy] = [x1 - x0, y1 - y0];
  const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x0 + dx * t - x, y0 + dy * t - y);
};
const box = (x0, y0, x1, y1) => (x, y) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1));

// The level's hazards, each { kind, triggered, window, warning, distance(world, x, y) }:
// `distance` is from (x, y) to what it covers, Infinity while it's gone or off for
// good, and `window` and `warning` are in seconds (Infinity where there's none).
export function hazardsOf(level) {
  const list = [];
  const add = (kind, h) => list.push({ kind, triggered: false, window: Infinity, warning: Infinity, ...h });
  level.flames.forEach((f) => {
    const d = segment(f.x0, f.y0, f.x1, f.y1);
    if (f.mode === "always") add("flame", { distance: (w, x, y) => d(x, y) });
    else if (f.mode === "near") add("flame", { triggered: true, window: f.off, warning: f.warn, distance: (w, x, y) => d(x, y) });
    else add("flame", { window: f.off - f.warn, warning: f.warn, distance: (w, x, y) => d(x, y) });
  });
  level.lasers.forEach((l, i) => {
    const d = segment(l.x0, l.y0, l.x1, l.y1);
    const cycle = l.mode === "cycle";
    add("laser", { window: cycle ? l.off - l.warn : Infinity, warning: cycle ? l.warn : Infinity, distance: (w, x, y) => (w.lasers[i].open && w.lasers[i].until < 0 ? Infinity : d(x, y)) });
  });
  level.blobs.forEach((b) => {
    const d = segment(b.x, b.y, b.x, b.y + b.height * TILE);
    // Halfway up, it's above you for 1/√2 of its flight.
    add("blob", { window: b.period - flightTime(b) / Math.SQRT2, warning: b.warn, distance: (w, x, y) => d(x, y) });
  });
  level.movers.forEach((m) => {
    const [dx, dy] = m.to;
    const d = box(m.x0 + Math.min(0, dx), m.y0 + Math.min(0, dy), m.x1 + Math.max(0, dx), m.y1 + Math.max(0, dy));
    if (m.kind === "crusher") add("crusher", { window: m.rest, warning: m.warn, distance: (w, x, y) => d(x, y) });
    else add("mover", { distance: (w, x, y) => d(x, y) });
  });
  level.stalactites.forEach((s, i) => {
    let floor = s.tip;
    while (floor > 0 && !solid(level, s.x, floor)) floor -= 0.5;
    const d = box(s.x0, floor, s.x1, s.top);
    add("stalactite", { triggered: true, warning: s.warn, distance: (w, x, y) => (w.stalactites[i].gone >= 0 ? Infinity : d(x, y)) });
  });
  patches(level).forEach((tiles) => {
    const d = tiles.map((i) => {
      const t = level.crumbles[i];
      return [i, box(t.x0, t.y0, t.x1, t.y1)];
    });
    add("crumbling rock", {
      triggered: true,
      warning: level.crumble,
      distance: (w, x, y) => Math.min(...d.map(([i, f]) => (w.crumbles[i].fell >= 0 ? Infinity : f(x, y)))),
    });
  });
  level.fans.forEach((f) => {
    if (f.mode !== "cycle") return;
    const d = box(f.x0, f.y0, f.x1, f.y1);
    add("fan", { warning: f.warn, distance: (w, x, y) => d(x, y) });
  });
  // A magnet and a turret are passed inside a distance of their own, not NEAR from
  // them: their distances are made up to come to NEAR there.
  level.magnets.forEach((m) => {
    const cycle = m.mode === "cycle";
    add("magnet", { warning: cycle ? m.warn : Infinity, distance: (w, x, y) => Math.hypot(x - m.x, y - m.y) - m.range * MAGNET_SHARE + NEAR });
  });
  level.turrets.forEach((t) => {
    add("turret", { triggered: true, warning: t.windup, distance: (w, x, y) => Math.hypot(x - t.x, y - t.y) - TURRET_NEAR + NEAR });
  });
  return list;
}

const solid = (level, x, y) => {
  const [c, j] = [Math.floor(x / TILE), Math.floor(y / TILE)];
  return c < 0 || j < 0 || c >= level.width || j >= level.height || level.solid[j * level.width + c] === 1;
};

// The level's crumbling rock in patches: lists of indices into level.crumbles,
// joined side by side.
function patches(level) {
  const at = new Map(level.crumbles.map((t, i) => [t.j * level.width + t.c, i]));
  const seen = new Set();
  const out = [];
  level.crumbles.forEach((t, i) => {
    if (seen.has(i)) return;
    const patch = [];
    const todo = [i];
    seen.add(i);
    while (todo.length) {
      const k = todo.pop();
      patch.push(k);
      const { c, j } = level.crumbles[k];
      for (const [cc, jj] of [
        [c - 1, j],
        [c + 1, j],
        [c, j - 1],
        [c, j + 1],
      ]) {
        const n = cc >= 0 && cc < level.width ? at.get(jj * level.width + cc) : undefined;
        if (n !== undefined && !seen.has(n)) {
          seen.add(n);
          todo.push(n);
        }
      }
    }
    out.push(patch);
  });
  return out;
}

// A watcher for flyLevel's `each`: call `tick(world)` after every tick, then
// `report()` for { metres, quiet (m), passes: [{ kind, triggered, window,
// warning }], stretches }: `stretches` are the quiet ones, each { from, to,
// metres } with `from` and `to` as { r, c } on the map (1 up, as the editor
// shows them).
export function watchReaction(level) {
  const hazards = hazardsOf(level);
  const near = hazards.map(() => false);
  const passes = [];
  const stretches = [];
  let metres = 0;
  let quiet = 0;
  let last = null;
  let stretch = null;
  const at = (r) => ({ r: level.height - Math.floor(r.y / TILE), c: Math.floor(r.x / TILE) + 1 });
  return {
    tick(world) {
      const r = world.rocket;
      const circles = circlesAt(r.x, r.y, r.angle);
      let any = false;
      hazards.forEach((h, i) => {
        let d = Infinity;
        for (const c of circles) d = Math.min(d, h.distance(world, c.x, c.y) - c.r);
        if (d <= NEAR) {
          any = true;
          if (!near[i]) passes.push(h);
          near[i] = true;
        } else if (d > NEAR + AWAY) near[i] = false;
      });
      if (last && r === last.rocket) {
        const step = Math.hypot(r.x - last.x, r.y - last.y);
        if (step * TICK_RATE >= MOVING) {
          metres += step;
          if (!any) {
            quiet += step;
            stretch ??= { from: at(r), metres: 0 };
            stretch.metres += step;
            stretch.to = at(r);
          }
        }
      }
      if (any && stretch) {
        stretches.push(stretch);
        stretch = null;
      }
      last = { rocket: r, x: r.x, y: r.y };
    },
    report: () => ({ metres, quiet, passes, stretches: stretch ? [...stretches, stretch] : stretches }),
  };
}

// The numbers from one or more reports, added together: hazards passed per 100
// m, the share of the route that's quiet and of the passes that are triggered,
// and the shortest window and warning of what's passed.
export function summary(reports) {
  const metres = reports.reduce((a, r) => a + r.metres, 0);
  const quiet = reports.reduce((a, r) => a + r.quiet, 0);
  const passes = reports.flatMap((r) => r.passes);
  const least = (key) => Math.min(...passes.map((p) => p[key]));
  return {
    metres,
    passed: passes.length,
    per100: (passes.length / metres) * 100,
    quiet: quiet / metres,
    triggered: passes.length ? passes.filter((p) => p.triggered).length / passes.length : 0,
    window: least("window"),
    warning: least("warning"),
  };
}

const s = (v) => (v === Infinity ? "—" : `${v.toFixed(1)} s`);
export const describe = (n) =>
  `${n.per100.toFixed(1)} hazards passed per 100 m (${n.passed} in ${Math.round(n.metres)} m), ${Math.round(n.quiet * 100)}% quiet, ${Math.round(n.triggered * 100)}% triggered, shortest window ${s(n.window)}, warning ${s(n.warning)}`;

// What in the level breaks the floors, on each thing's own settings, as a list of
// sentences (empty if nothing does).
export function belowFloors(level) {
  const out = [];
  for (const h of hazardsOf(level)) {
    if (h.warning < MIN_WARNING) out.push(`a ${h.kind} warns for ${h.warning} s, under ${MIN_WARNING} s`);
    if (h.window < MIN_WINDOW) out.push(`a ${h.kind} is clear for ${h.window.toFixed(2)} s, under ${MIN_WINDOW} s`);
  }
  return [...new Set(out)];
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { WORLDS, levelById } = await import("../../src/levels/index.js");
  const { parseLevel } = await import("../../src/sim/level.js");
  const { flyLevel } = await import("../../src/autofly.js");
  // The level's report, and with `byLeg` one for each leg too.
  const measure = (def, byLeg) => {
    const level = parseLevel(def);
    const watch = watchReaction(level);
    const legs = [];
    let leg = watchReaction(level);
    const { failed, legs: flown } = flyLevel(def, {
      each: (world) => {
        watch.tick(world);
        if (byLeg) leg.tick(world);
      },
      progress: ({ legs: done }) => {
        if (!byLeg || done.length === legs.length) return;
        legs.push(leg.report());
        leg = watchReaction(level);
      },
    });
    if (byLeg && legs.length < flown.length) legs.push(leg.report());
    return { ...watch.report(), failed, legs: legs.map((report, i) => ({ name: flown[i].name, seconds: flown[i].seconds, report })) };
  };
  const showQuiet = process.argv.includes("--quiet");
  const showLegs = process.argv.includes("--legs");
  for (const arg of process.argv.slice(2).filter((a) => !a.startsWith("--"))) {
    const world = /^\d+$/.test(arg) ? WORLDS[Number(arg) - 1] : null;
    const defs = world ? world.levels : [levelById(arg)];
    if (!defs[0]) throw new Error(`no level or world ${arg}`);
    const reports = defs.map((def) => {
      const report = measure(def, showLegs);
      console.log(`${def.id} ${def.name.padEnd(18)} ${describe(summary([report]))}${report.failed ? ` (FAILED: ${report.failed})` : ""}`);
      if (showLegs) {
        for (const l of report.legs) console.log(`  ${l.name.padEnd(24)} ${l.seconds.toFixed(1).padStart(5)} s  ${describe(summary([l.report]))}`);
      }
      if (showQuiet) {
        for (const q of report.stretches.filter((q) => q.metres >= 5)) console.log(`  quiet ${Math.round(q.metres)} m, from row ${q.from.r}, column ${q.from.c} to row ${q.to.r}, column ${q.to.c}`);
      }
      return report;
    });
    if (world) console.log(`World ${world.number} ${world.name}: ${describe(summary(reports))}\n`);
  }
}
