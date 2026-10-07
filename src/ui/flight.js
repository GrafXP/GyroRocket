import { WORLDS, endingOf } from "../levels/index.js";
import { padUnder, gateTimers } from "../sim/world.js";
import { rising } from "../sim/hazards/rise.js";
import { TICK_RATE } from "../sim/rocket.js";

// An introduction belongs to a world the player hasn't finished anything in,
// and is shown only once while the game is open. Retry doesn't introduce it again.
export function introduceWorld(def, progress, seen) {
  const world = WORLDS.find((w) => w.number === def.world);
  if (!world || seen.has(world.number) || world.levels.some((l) => progress.levels[l.id])) return null;
  seen.add(world.number);
  return world;
}

export function completionTitle(def) {
  const ending = endingOf(def.id);
  if (ending) return ending.title;
  const world = WORLDS.find((w) => w.levels.at(-1).id === def.id);
  return world ? `${world.name} complete` : "Level complete";
}

// Pick the corner whose panel is furthest from the rocket, with space for the
// HUD above it. The view supplies the rocket's position in screen pixels.
export function guidePosition(point, { width, height }, { width: panelW, height: panelH }, { top = 112, left = 16, right = 16, bottom = 16 } = {}) {
  const x1 = Math.max(left, width - panelW - right);
  const y1 = Math.max(top, height - panelH - bottom);
  const candidates = [{ x: x1, y: y1 }, { x: x1, y: top }, { x: left, y: y1 }, { x: left, y: top }];
  const distance = ({ x, y }) => Math.hypot(Math.max(x - point.x, 0, point.x - x - panelW), Math.max(y - point.y, 0, point.y - y - panelH));
  return candidates.reduce((best, candidate) => distance(candidate) > distance(best) ? candidate : best);
}

// Short, pictured prompts while flying. Instructions before lift-off are the
// two control pictures, rather than a sentence in this message strip.
export function flightPrompt(w, { phone = false, watching = null, pilot = null, failure = null } = {}) {
  if (w.done) return null;
  if (watching) return { icon: "play", title: "Replay", detail: `Watching ${watching}` };
  if (pilot) return { icon: "auto", title: "Autopilot", detail: pilot.status };
  if (failure) return { icon: "auto", title: "Autopilot stopped", detail: failure.status };
  const back = w.checkpoint.pad === w.level.start ? "the start" : "the last fuel pad";
  const retry = `${phone ? "Tap" : "Press ↑"} to retry from ${back}`;
  if (w.rocket.state === "crashed") {
    const how = { flame: "Burned up", lava: "Into the lava", crush: "Crushed", laser: "Zapped", shot: "Shot down", stalactite: "Hit by falling rock" }[w.rocket.cause] ?? "Crashed";
    return { icon: "retry", title: how, detail: retry };
  }
  if (w.stranded) return { icon: "fuel", title: "Out of fuel", detail: retry };
  if (rising(w) && w.tick - w.rise.from < 3 * TICK_RATE) return { icon: "warning", title: "The lava is rising", detail: "Keep climbing" };
  const on = padUnder(w.level, w.rocket);
  if (on?.kind === "switch") {
    const laser = w.level.lasers.some((l) => l.label === on.opens);
    return { icon: laser ? "laser" : "gate", title: `${laser ? "Laser" : "Gate"} ${on.label} ${laser ? "off" : "open"}`, detail: on.time ? `${on.time} seconds from lift-off` : "" };
  }
  const timer = gateTimers(w)[0];
  if (timer) return { icon: timer.laser ? "laser" : "gate", title: `${timer.laser ? "Laser" : "Gate"} ${timer.gate.switch}`, detail: `${timer.laser ? "Returns" : "Closes"} in ${Math.ceil(timer.seconds)} s` };
  if (on?.kind === "fuel") return { icon: "fuel", title: w.refuelling ? "Refuelling" : "Fuel and hull full", detail: "Your new restart pad" };
  return null;
}
