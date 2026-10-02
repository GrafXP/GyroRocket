import { levelById } from "../levels/index.js";
import { loadProgress, allUnlocked } from "../progress.js";
import { finishOf } from "../runs.js";
import { CAVE_COLORS } from "../render/cave.js";
import { css } from "../looks.js";
import { html, esc, formatTime } from "./dom.js";
import { icon, stars as starsHtml, ROCKET, ROCKET_BOX } from "./kit.js";
import { backButton } from "./frame.js";
import { openSheet } from "./sheet.js";
import { summarize } from "./summary.js";
import { layout } from "./way.js";

const PART_NAMES = ["Part one", "Part two", "Part three"];
const WIDE = 8; // stops to a row on a phone held sideways,
const TALL = 4; // and on one held upright (style/levels.css says which shows)

// The levels, /levels: the way down. Under the night sky, a band of rock for each
// world, in its colours, with its levels as stops along a tunnel, which runs on
// from each world into the next one that's open. The stop to do next glows, with
// the rocket on it; a locked world is its name and what opens it. The page opens
// at the world the player has reached. A stop opens the level's card, a sheet:
// its best time and par, what its three stars are for, and Play.
// With ?dev, the test caves and the note about the ?unlock flag are at the bottom.
export function levels(el) {
  const dev = new URLSearchParams(location.search).has("dev");
  const all = allUnlocked();
  const summary = summarize(loadProgress(), { all });
  let rows = 0; // the rows of stops above a world, sideways: each one turns the tunnel round
  const $ = html(
    el,
    `<div class="way" id="way">
      ${backButton()}
      <header class="sky">
        <h1 class="page-title">Levels</h1>
        <p>${icon("star")}${summary.stars} of ${summary.of}</p>
        <i class="moon"></i>
      </header>
      ${summary.worlds
        .map((world, w) => {
          const open = world.state !== "locked";
          const flip = rows % 2 === 1;
          if (open) rows++;
          const next = summary.worlds[w + 1];
          return (world.startsPart ? partRule(world, open, flip) : "") + band(world, { flip, exit: !!next && next.state !== "locked" });
        })
        .join("")}
      ${
        dev
          ? `<p class="hint way-dev">The <a href="/play/test" data-link>test cave</a>, and the <a href="/play/big" data-link>big cave</a>, a 200 × 150 stress test.
          ${all ? `Every level is open (the ?unlock flag). <a href="/levels?unlock=off">Lock them again</a>` : `<a href="/levels?unlock&dev">Open every level</a>`}</p>`
          : ""
      }
    </div>`,
  );

  $("#way").addEventListener("click", (e) => {
    const id = e.target.closest("[data-level]")?.dataset.level;
    const world = id && summary.worlds.find((w) => w.levels.some((l) => l.id === id));
    if (world) openCard(world, world.levels.find((l) => l.id === id), dev);
  });

  // Open at the world the player's in, once the page is laid out.
  const raf = requestAnimationFrame(() => $(".band.here")?.scrollIntoView({ block: "center" }));
  return () => cancelAnimationFrame(raf);
}

// A world's colours, as the band's own properties.
const colours = (world) =>
  Object.entries({ ...CAVE_COLORS, ...world.colors })
    .filter(([name]) => ["face", "rim", "back"].includes(name))
    .map(([name, colour]) => `--${name}: ${css(colour)}`)
    .join("; ");

// A percentage of the way across or down a picture `of` wide or high.
const pc = (n, of) => `${+((n / of) * 100).toFixed(3)}%`;

// The rule where a part of the game starts, with the tunnel through it if the
// world under it is open (at the right, if `flip`).
function partRule(world, open, flip) {
  return `<div class="part-rule" style="${colours(world)}; --in-w: ${pc(layout(WIDE, WIDE, flip).in, WIDE * 100)}; --in-t: ${pc(layout(WIDE, TALL).in, TALL * 100)}">
    <div class="band-in"><div class="rule">${open ? `<i class="shaft"></i>` : ""}<span>${PART_NAMES[world.part - 1]}${world.partDone ? icon("check") : ""}</span></div></div>
  </div>`;
}

// A world's band (a world from ui/summary.js): its number, name, stars and what
// it's about, over its stops along the tunnel, which starts at the right if `flip`
// and goes on out of the bottom if `exit`. A locked world's has its name and what
// opens it.
export function band(world, { flip = false, exit = false } = {}) {
  const head = `<h2><b>${world.number}</b>${esc(world.name)}</h2>`;
  if (world.state === "locked") {
    return `<section class="band locked" style="${colours(world)}"><div class="band-in">
      <header class="band-head">${head}<p>${icon("lock")}Finish ${world.opens.id} ${esc(world.opens.name)} to open it.</p></header>
    </div></section>`;
  }
  const [wide, tall] = [layout(world.levels.length, WIDE, flip), layout(world.levels.length, TALL)];
  const tunnel = (l, cls) => `<svg class="${cls}" viewBox="0 0 ${l.width} ${l.height}" aria-hidden="true"><path class="rim" d="${l.path(exit)}"/><path class="air" d="${l.path(exit)}"/></svg>`;
  const place = (i) => `--xw: ${pc(wide.stops[i][0], wide.width)}; --yw: ${pc(wide.stops[i][1], wide.height)}; --xt: ${pc(tall.stops[i][0], tall.width)}; --yt: ${pc(tall.stops[i][1], tall.height)}`;
  return `<section class="band${world.here ? " here" : ""}" id="world-${world.number}" style="${colours(world)}; --in-w: ${pc(wide.in, wide.width)}; --in-t: ${pc(tall.in, tall.width)}"><div class="band-in">
    <header class="band-head">
      <i class="shaft"></i>
      <div>${head}<span class="band-stars">${icon("star")}${world.stars}/${world.of}</span></div>
      <p>${esc(world.about)}</p>
    </header>
    <div class="tunnel" style="--wide: ${wide.width} / ${wide.height}; --tall: ${tall.width} / ${tall.height}">
      ${tunnel(wide, "wide")}${tunnel(tall, "tall")}
      ${world.levels
        .map((l, i) => {
          const label = `${l.id} ${esc(l.name)}, ${l.state === "locked" ? "locked" : `${l.stars.filter(Boolean).length} of 3 stars`}${l.here ? ", the next to do" : ""}`;
          return `${l.here ? `<i class="glow" style="${place(i)}"></i>` : ""}<button class="stop ${l.state}${l.here ? " here" : ""}" data-level="${l.id}" style="${place(i)}" aria-label="${label}">
            <b>${l.id}</b>${l.state === "locked" ? icon("lock") : starsHtml(l.stars)}
          </button>${l.here ? `<svg class="marker" viewBox="${ROCKET_BOX}" style="${place(i)}" aria-hidden="true">${ROCKET}</svg>` : ""}`;
        })
        .join("")}
    </div>
  </div></section>`;
}

// A level's card, on a sheet: where it is, the best time against par, the three
// stars and what each is for, Watch best run if one's kept, and Play; or for a
// locked level, what opens it.
function openCard(world, level, dev) {
  const best = level.state === "locked" ? null : finishOf(level.id, levelById(level.id));
  const goals = ["Finish the level", `Beat par, ${formatTime(level.par)}`, level.crystals > 1 ? `Collect all ${level.crystals} crystals in one run` : "Collect the crystal"];
  const query = dev ? "?dev" : "";
  openSheet({
    title: `${level.id} ${esc(level.name)}`,
    cls: "level-card",
    body: `<p class="hint">World ${world.number} · ${esc(world.name)}</p>
      <p class="card-time">${
        level.best === undefined ? `<b>Not flown yet</b>` : `<small>Best</small><b>${formatTime(level.best)}</b>`
      }<small>Par</small><span>${formatTime(level.par)}</span></p>
      <ul class="goals">${goals.map((goal, i) => `<li${level.stars[i] ? ` class="on"` : ""}>${icon("star")}${goal}${level.stars[i] ? `<span class="hint">done</span>` : ""}</li>`).join("")}</ul>
      ${
        level.state === "locked"
          ? `<p class="card-locked">${icon("lock")}Finish ${level.opens.id} ${esc(level.opens.name)} to open it.</p>`
          : `${best ? `<a class="button" href="/play/${level.id}?watch${dev ? "&dev" : ""}" data-link>Watch best run, ${formatTime(best.time)}</a>` : ""}
            <a class="button big" href="/play/${level.id}${query}" data-link>${icon("play")}Play</a>`
      }`,
  });
}
