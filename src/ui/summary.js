import { WORLDS } from "../levels/index.js";
import { starsOf, isUnlocked, nextToPlay } from "../progress.js";

// What the level select shows (ui/levels.js), from the progress: where the player
// is, each world's stars and state, and each level's. No DOM, so the tests run it.
//
// summarize(progress) gives { here, stars, of, worlds }: `here` is the id of the
// level to do next (the last one, once they're all done), and `stars` of `of` are
// earned in all.
// - A world is { number, name, about, part, colors, state, opens, here, stars, of,
//   startsPart, partDone, levels }. Its `state` is "done" (every level finished),
//   "open", or "locked", when `opens` is the level that opens it: the one before
//   its first. `here` says the level to do next is in it. `startsPart` is true for
//   the first world of each part after the first, and `partDone` once every level
//   in the world's part is finished.
// - A level is { id, name, par, crystals, state, opens, here, stars, best }. Its
//   `state` is "done", "open" (it can be played) or "locked", when `opens` is the
//   level before it. `stars` are the three it has earned ([finished, par, every
//   crystal]), `best` its fastest finish in seconds (undefined if none), and
//   `crystals` how many there are to collect.
// `all` opens every level, as the ?unlock flag does.
export function summarize(progress, { worlds = WORLDS, all = false } = {}) {
  const levels = worlds.flatMap((w) => w.levels);
  const here = nextToPlay(progress, levels).id;
  const done = (level) => !!progress.levels[level.id];
  const partDone = (part) => worlds.filter((w) => w.part === part).every((w) => w.levels.every(done));

  const summary = worlds.map((world, w) => {
    const rows = world.levels.map((level) => {
      const i = levels.indexOf(level);
      const record = progress.levels[level.id];
      const open = all || isUnlocked(progress, level.id, levels);
      const before = levels[i - 1];
      return {
        id: level.id,
        name: level.name,
        par: level.par,
        crystals: level.map.split("*").length - 1,
        state: record ? "done" : open ? "open" : "locked",
        opens: record || open ? null : { id: before.id, name: before.name },
        here: level.id === here,
        stars: starsOf(level, record),
        best: record?.best,
      };
    });
    return {
      number: world.number,
      name: world.name,
      about: world.about,
      part: world.part,
      colors: world.colors,
      state: rows.every((l) => l.state === "done") ? "done" : rows[0].state === "locked" ? "locked" : "open",
      opens: rows[0].opens,
      here: rows.some((l) => l.here),
      stars: rows.reduce((n, l) => n + l.stars.filter(Boolean).length, 0),
      of: rows.length * 3,
      startsPart: w > 0 && world.part !== worlds[w - 1].part,
      partDone: partDone(world.part),
      levels: rows,
    };
  });
  return {
    here,
    stars: summary.reduce((n, w) => n + w.stars, 0),
    of: levels.length * 3,
    worlds: summary,
  };
}
