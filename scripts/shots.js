// npm run shots [-- <label>] [--only=home,pause] [--theme=dark|light|both] [--scale=2]
//
// Pictures of every screen, at a phone's size held sideways (wide) and upright
// (tall), into shots/<label>/, to compare before and after a change to the UI.
// It starts the dev server and drives the Chrome (or Edge) that's installed,
// headless, over its debugging port: no dependency. Set CHROME to say which.
//
// Each screen is a path and, for the states a URL can't reach, a few steps: a
// key, a click, or a poke at window.game (which ?dev gives the play page). One
// that's `full` is pictured from top to bottom, not just what fits the screen.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";

const SIZES = { wide: [844, 390], tall: [390, 844] };

// Some stars to show: worlds 1 and 2 done, and a start on world 3.
const PROGRESS = { levels: {} };
for (let w = 1; w <= 2; w++) for (let l = 1; l <= 8; l++) PROGRESS.levels[`${w}-${l}`] = { best: (l % 3 ? 9 : 400) + l, crystals: (w + l) % 2 === 0 };
Object.assign(PROGRESS.levels, { "3-1": { best: 400, crystals: false }, "3-2": { best: 12, crystals: true } });

const EXIT = `(() => {
  const w = game.world, p = w.level.pads.find((p) => p.kind === "exit");
  Object.assign(w.rocket, { state: "flying", x: (p.x0 + p.x1) / 2, y: p.y + 2.5, vx: 0, vy: 0, angle: 0 });
  w.startTick = w.tick - 431;
})()`;
const CRASH = `Object.assign(game.world.rocket, { state: "flying", y: game.world.rocket.y + 8, vy: -30 })`;
const MY_LEVEL = `import("/src/mylevels.js").then((m) => m.listLevels()[0]?.id ?? m.createLevel(m.newLevel("Crystal run")))`;

const flying = async (p) => {
  await p.key("ArrowUp", "down");
  await p.wait(900);
  await p.key("ArrowRight", "down");
  await p.wait(500);
};
const SCREENS = [
  { name: "home", path: "/" },
  { name: "levels", path: "/levels" },
  { name: "help", path: "/help" },
  { name: "profile", path: "/profile", wait: 1500 },
  { name: "workshop", path: "/editor", before: MY_LEVEL },
  { name: "editor", path: (id) => `/editor/${id}`, before: MY_LEVEL, wait: 800 },
  { name: "editor-palette", path: (id) => `/editor/${id}`, before: MY_LEVEL, wait: 800, steps: (p) => p.click("#swatch") },
  { name: "editor-menu", path: (id) => `/editor/${id}`, before: MY_LEVEL, wait: 800, steps: (p) => p.click("#menu-btn") },
  { name: "play-start", path: "/play/1-1?dev", play: true },
  { name: "play-flying", path: "/play/3-2?dev", play: true, steps: flying },
  { name: "pause", path: "/play/3-2?dev", play: true, steps: (p) => p.key("KeyP") },
  { name: "map", path: "/play/2-3?dev", play: true, steps: (p) => p.key("KeyM") },
  { name: "crash", path: "/play/1-2?dev", play: true, steps: (p) => p.run(CRASH).then(() => p.wait(1600)) },
  { name: "results", path: "/play/3-3?dev", play: true, steps: (p) => p.run(EXIT).then(() => p.wait(3200)) },
  { name: "locked", path: "/play/9-9" },
  { name: "kit", path: "/ui?dev", full: true },
];

const args = process.argv.slice(2);
const flag = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const label = args.find((a) => !a.startsWith("--")) ?? "now";
const only = flag("only")?.split(",");
const themes = flag("theme", "dark") === "both" ? ["dark", "light"] : [flag("theme", "dark")];
const scale = Number(flag("scale", 2));

function findChrome() {
  const places = [
    process.env.CHROME,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  const found = places.find((p) => p && existsSync(p));
  if (!found) throw new Error("No Chrome or Edge found: set CHROME to its path");
  return found;
}

// Starts Chrome and gives the address of its debugging port.
function startChrome(profile) {
  const chrome = spawn(findChrome(), [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--enable-unsafe-swiftshader",
    "--hide-scrollbars",
    "--no-first-run",
    "about:blank",
  ]);
  return new Promise((resolve, reject) => {
    let err = "";
    chrome.stderr.on("data", (chunk) => {
      err += chunk;
      const url = err.match(/DevTools listening on (ws:\S+)/)?.[1];
      if (url) resolve({ chrome, url });
    });
    chrome.on("exit", () => reject(new Error(`Chrome stopped before it was ready:\n${err}`)));
  });
}

// The debugging protocol over a WebSocket: send(method, params) resolves with the
// result, and once(event) with the next event of that name.
function connect(url) {
  const ws = new WebSocket(url);
  const waiting = new Map();
  const listeners = new Map();
  let next = 0;
  let session;
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id) {
      const { resolve, reject } = waiting.get(m.id);
      waiting.delete(m.id);
      if (m.error) reject(new Error(m.error.message));
      else resolve(m.result);
    } else {
      for (const fn of listeners.get(m.method) ?? []) fn(m.params);
      listeners.delete(m.method);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      waiting.set(++next, { resolve, reject });
      ws.send(JSON.stringify({ id: next, method, params, sessionId: session }));
    });
  return new Promise((resolve) => {
    ws.addEventListener("open", () =>
      resolve({
        send,
        once: (event) => new Promise((done) => listeners.set(event, [...(listeners.get(event) ?? []), done])),
        attach: (id) => (session = id),
        close: () => ws.close(),
      }),
    );
  });
}

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

const server = await createServer({ logLevel: "silent", server: { port: 5199 } });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, "");
const profile = mkdtempSync(join(tmpdir(), "gyrorocket-shots-"));
const { chrome, url } = await startChrome(profile);
const cdp = await connect(url);

try {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  cdp.attach((await cdp.send("Target.attachToTarget", { targetId, flatten: true })).sessionId);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  const run = async (expression) => {
    const { result, exceptionDetails } = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };
  const go = async (path) => {
    const loaded = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: base + path });
    await loaded;
  };
  const page = {
    run,
    wait,
    click: (selector) => run(`document.querySelector(${JSON.stringify(selector)}).click()`).then(() => wait(300)),
    // A key by its code: pressed and let go, or just "down" or "up".
    async key(code, how = "press") {
      const key = { code, key: code.replace(/^Key/, "").toLowerCase() };
      if (how !== "up") await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", ...key });
      if (how !== "down") await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...key });
      await wait(300);
    },
  };

  const dir = join("shots", label);
  mkdirSync(dir, { recursive: true });
  for (const theme of themes) {
    for (const [size, [width, height]] of Object.entries(SIZES)) {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: true });
      await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true });
      for (const screen of SCREENS) {
        if (only && !only.includes(screen.name)) continue;
        // Storage first, from a page of the game's own.
        await go("/help");
        await run(`localStorage.setItem("gyrorocket:theme", "${theme}"); localStorage.setItem("gyrorocket:progress", ${JSON.stringify(JSON.stringify(PROGRESS))})`);
        const made = screen.before ? await run(screen.before) : null;
        await go(typeof screen.path === "function" ? screen.path(made) : screen.path);
        await run("document.fonts.ready.then(() => true)");
        if (screen.play) {
          // Past the iPhone's question about the motion sensors, if it's asked, and
          // without the developer's overlays.
          await wait(1500);
          await run(`document.querySelector("#tilt-ask:not([hidden]) #tilt-ok")?.click(); for (const id of ["dev", "fps"]) document.getElementById(id).hidden = true`);
        }
        await wait(screen.wait ?? 400);
        await screen.steps?.(page);
        // The whole page, for one that's `full`; what's on the screen, for the rest.
        const { cssContentSize: all } = await cdp.send("Page.getLayoutMetrics");
        const whole = screen.full ? { captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: all.height, scale: 1 } } : {};
        const { data } = await cdp.send("Page.captureScreenshot", { format: "png", ...whole });
        const file = join(dir, `${screen.name}-${size}${theme === "light" ? "-light" : ""}.png`);
        writeFileSync(file, Buffer.from(data, "base64"));
        console.log(file);
      }
    }
  }
} finally {
  cdp.close();
  chrome.kill();
  await server.close();
  await wait(500); // Chrome lets go of its files
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {}
}
