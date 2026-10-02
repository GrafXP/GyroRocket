import { WORLDS } from "../levels/index.js";
import { loadProgress, isUnlocked, allUnlocked, starsOf, starCount } from "../progress.js";
import { formatTime } from "./dom.js";
import { icon, stars as starsHtml } from "./kit.js";
import { frame } from "./frame.js";

const PART_NAMES = ["Part one", "Part two", "Part three"];

// Every world's levels, with the stars earned and best times; locked levels greyed
// out. Once the game has more than one part, each part gets a heading, which says
// so once every level in it is finished.
export function levels(el) {
  const progress = loadProgress();
  const all = allUnlocked();
  const parts = WORLDS.at(-1).part > 1;
  const finished = (part) => WORLDS.filter((w) => w.part === part).every((w) => w.levels.every((l) => progress.levels[l.id]));
  frame(
    el,
    "Levels",
    `${WORLDS.map((world, w) => {
      const stars = world.levels.reduce((n, l) => n + starCount(l, progress.levels[l.id]), 0);
      const done = finished(world.part) ? ` <small>${icon("check")} done</small>` : "";
      const part = parts && world.part !== WORLDS[w - 1]?.part ? `<h2 class="part">${PART_NAMES[world.part - 1]}${done}</h2>` : "";
      return `${part}<section class="world">
        <h2>${world.number} · ${world.name} <small>${icon("star")} ${stars}/${world.levels.length * 3}</small></h2>
        <p class="hint">${world.about}</p>
        <div class="level-grid">
          ${world.levels
            .map((l) => {
              const record = progress.levels[l.id];
              if (!all && !isUnlocked(progress, l.id)) {
                return `<div class="level locked" aria-label="${l.id} ${l.name}, locked"><b>${l.id}</b>${icon("lock")}<small>${l.name}</small></div>`;
              }
              return `<a class="level${record ? " done" : ""}" href="/play/${l.id}" data-link>
                <b>${l.id}</b>${starsHtml(starsOf(l, record))}<small>${l.name}</small>
                <small class="best">${record ? formatTime(record.best) : "&nbsp;"}</small>
              </a>`;
            })
            .join("")}
        </div>
      </section>`;
    }).join("")}
    <p class="hint">There's also the <a href="/play/test" data-link>test cave</a>, and the <a href="/play/big" data-link>big cave</a>, a 200 × 150 stress test.</p>
    ${all ? `<p class="hint">Every level is open (the ?unlock debug flag). <a href="/levels?unlock=off">Lock them again</a></p>` : ""}`,
  );
}
