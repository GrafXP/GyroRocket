// Optional browser checks alongside the pictures:
// npm run shots -- u4 --only=play-start,pause,results --theme=both --check-flight --check-starts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LEVELS } from "../src/levels/index.js";
import { TICK_RATE } from "../src/sim/rocket.js";

const ready = async (p, id, progress = { levels: {} }, query = "") => {
  await p.go("/help");
  await p.run(`localStorage.setItem("gyrorocket:progress", ${JSON.stringify(JSON.stringify(progress))})`);
  await p.go(`/play/${id}?dev${query}`);
  await p.waitForFlight();
  await p.run(`document.fonts.ready.then(() => true)`);
  await p.run(`document.querySelector("#tilt-ask:not([hidden]) #tilt-ok")?.click()`);
  await until(p, `document.getElementById("tilt-ask").hidden`);
};
const until = async (p, expression) => {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (await p.run(expression)) return;
    await p.wait(50);
  }
  assert.fail(`Timed out: ${expression}`);
};
const clearGuide = async (p) => {
  assert.equal(await p.run(`(() => {
    const g = document.getElementById("flight-guide"), box = g.getBoundingClientRect();
    const r = game.world.rocket, a = game.worldToScreen(r.x - 1.8, r.y + 3), b = game.worldToScreen(r.x + 1.8, r.y - 2.5);
    return !g.hidden && box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight
      && (box.right < a.x || box.left > b.x || box.bottom < a.y || box.top > b.y);
  })()`), true, "control card fits the screen and leaves the whole rocket clear");
};
const finish = async (p, seconds) => {
  await p.run(`(() => {
    const w = game.world, pad = w.level.pads.find(p => p.kind === "exit");
    Object.assign(w.rocket, { state: "flying", x: (pad.x0 + pad.x1) / 2, y: pad.y + 2.5, vx: 0, vy: 0, angle: 0 });
    w.tick = Math.max(w.tick, ${seconds * TICK_RATE}); w.startTick = w.tick - ${seconds * TICK_RATE};
  })()`);
  await until(p, `!document.getElementById("done").hidden`);
};

export async function checkStarts(p) {
  for (const def of LEVELS) {
    await ready(p, def.id);
    try { await clearGuide(p); } catch (error) { throw new Error(`${def.id}: ${error.message}`); }
  }
}

export async function checkFlight(p) {
  await ready(p, "1-1");
  await clearGuide(p);
  assert.equal(await p.run(`document.querySelectorAll(".control-cue").length`), 2);
  assert.match(await p.run(`document.getElementById("level-intro").textContent`), /World 1.*Training caves/);
  const hud = await p.run(`(() => {
    const button = document.getElementById("pause-btn"), b = button.getBoundingClientRect();
    const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    return { clear: button.contains(hit), hit: hit?.outerHTML.slice(0, 300), box: b.toJSON(), loading: document.getElementById("game").className };
  })()`);
  assert.equal(hud.clear, true, `canvas fade leaves the HUD visible and tappable: ${JSON.stringify(hud)}`);
  await p.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 200, y: 280 }] });
  await until(p, "game.world.startTick >= 0");
  await p.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  assert.equal(await p.run(`document.getElementById("control-cues").hidden`), true, "lifting off dismisses controls");

  await p.key("KeyP");
  assert.equal(await p.run(`!game.running && !document.getElementById("pause").hidden && document.activeElement.id === "resume"`), true);
  const tick = await p.run("game.world.tick");
  await p.wait(100);
  assert.equal(await p.run("game.world.tick"), tick);
  await p.click("#settings");
  assert.equal(await p.run(`!!document.querySelector("dialog[open]")`), true);
  await p.key("ArrowUp");
  assert.equal(await p.run("game.world.tick"), tick, "settings keys never fly the rocket");
  await p.key("Escape");
  await until(p, `!document.querySelector("dialog[open]")`);
  assert.equal(await p.run(`!game.running && !document.getElementById("pause").hidden`), true, "closing settings leaves pause open");
  await p.click("#resume");
  assert.equal(await p.run("game.running"), true);
  await p.key("KeyM");
  assert.equal(await p.run(`!game.running && !document.getElementById("map").hidden && document.getElementById("map-canvas").height > 0`), true);
  await p.click("#map-close");
  assert.equal(await p.run("game.running"), true);

  await ready(p, "3-3", { levels: { "3-3": { best: 20, run: { time: 20, crystals: true } } } });
  await finish(p, 7);
  assert.equal(await p.run(`document.querySelectorAll("#awards .award.on").length`), 2, "current run has no crystal star");
  assert.equal(await p.run(`document.querySelectorAll("#best-stars .on").length`), 3, "best star run remains underneath");
  assert.equal(await p.run(`!!document.querySelector(".new-best")`), true, "faster time is acknowledged");
  await until(p, `document.getElementById("finish-time").textContent === document.getElementById("finish-time").getAttribute("aria-label")`);
  await p.click("#retry");
  await until(p, `!document.getElementById("flight-guide").hidden`);
  assert.equal(await p.run(`game.world.startTick < 0 && document.getElementById("done").hidden && document.getElementById("level-intro").hidden`), true, "retry starts fresh without another intro");
  await finish(p, 100);
  assert.equal(await p.run(`document.querySelectorAll("#awards .award.on").length`), 1);
  assert.equal(await p.run(`document.querySelectorAll("#best-stars .on").length`), 3);
  assert.equal(await p.run(`JSON.parse(localStorage.getItem("gyrorocket:progress")).levels["3-3"].run.time`), 20);

  const replay = JSON.parse(readFileSync(new URL("../test/replays/1-8.json", import.meta.url), "utf8"));
  await p.run(`localStorage.setItem("gyrorocket:run:1-8", ${JSON.stringify(JSON.stringify(replay))})`);
  await ready(p, "1-8", { levels: {} }, "&watch");
  await until(p, "game.watching");
  assert.equal(await p.run(`document.getElementById("flight-guide").hidden && document.getElementById("auto-btn").hidden`), true);
  await p.key("KeyP");
  assert.equal(await p.run(`!document.getElementById("stop-watch").hidden && document.getElementById("restarts").hidden`), true);
  await p.click("#stop-watch");
  assert.equal(await p.run("!game.watching && game.running && game.world.startTick < 0"), true);

  await p.cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await ready(p, "3-3");
  await finish(p, 7);
  assert.equal(await p.run(`document.getElementById("finish-time").textContent === document.getElementById("finish-time").getAttribute("aria-label")`), true, "reduced motion shows final time immediately");
  assert.equal(await p.run(`document.getElementById("game").getAnimations({ subtree: true }).length`), 0, "reduced motion disables flight UI animations");
  await p.cdp.send("Emulation.setEmulatedMedia", { features: [] });
}

export async function checkKeyboard(p) {
  await p.cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await p.cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await ready(p, "1-1");
  assert.equal(await p.run(`document.querySelectorAll(".key-picture").length`), 2, "desktop shows both keyboard pictures");
  await p.key("ArrowUp", "down");
  await until(p, "game.world.startTick >= 0");
  await p.key("ArrowUp", "up");
  await p.key("KeyP");
  const focus = new Set();
  for (let i = 0; i < 10; i++) {
    await p.key("Tab");
    const state = await p.run(`({ inside: document.getElementById("pause").contains(document.activeElement), id: document.activeElement.id })`);
    assert.equal(state.inside, true, "Tab stays inside pause");
    focus.add(state.id);
  }
  assert.ok(focus.size > 2, "Tab moves among the pause controls");
  assert.equal(await p.run(`(() => {
    const menu = document.getElementById("pause");
    const buttons = [...menu.querySelectorAll("button, a[href]")].filter(el => !el.disabled && el.getClientRects().length);
    buttons.at(-1).focus();
    const held = new KeyboardEvent("keydown", { code: "Tab", key: "Tab", repeat: true, bubbles: true, cancelable: true });
    document.activeElement.dispatchEvent(held);
    return held.defaultPrevented && document.activeElement === buttons[0];
  })()`), true, "holding Tab keeps focus inside pause too");

  assert.equal(await p.run(`import("/src/ui/dom.js").then(({ go }) => {
    go("/play/10-8?dev");
    const black = document.getElementById("game").classList.contains("is-loading")
      && document.getElementById("loading").textContent.includes("Heart of the world")
      && !document.querySelector("#game > canvas");
    go("/levels");
    return black;
  })`), true, "the large cave has a title before any WebGL work");
  await p.wait(100);
  assert.equal(await p.run(`!window.game?.world && !document.body.classList.contains("playing") && !document.querySelector("#view canvas")`), true, "leaving during loading cancels the pending game");
}
