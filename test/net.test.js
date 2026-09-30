import { test } from "node:test";
import assert from "node:assert/strict";
import { createApi, ApiError, checkVersion } from "../src/net/api.js";
import { createPlayerClient, PLAYER_KEY, tokenFromCode, transferCode } from "../src/net/player.js";
import { SIM_VERSION } from "../src/sim/world.js";

const TOKEN = "abcdef12".repeat(8);
const OTHER = "12345678".repeat(8);
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json", ...headers },
});

function storage(initial = null) {
  const data = new Map(initial ? [[PLAYER_KEY, initial]] : []);
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
}

test("API sends JSON and an explicit token to this site, without cookies", async () => {
  let sent;
  const api = createApi({ fetchImpl: async (...args) => { sent = args; return json({ player: { name: "Pilot" } }); } });
  const response = await api("/api/players/me", { method: "PATCH", body: { name: "Pilot" }, token: TOKEN });
  assert.equal(response.player.name, "Pilot");
  const [path, options] = sent;
  assert.equal(path, "/api/players/me");
  assert.equal(options.headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(options.headers["Content-Type"], "application/json");
  assert.equal(options.body, '{"name":"Pilot"}');
  assert.equal(options.credentials, "omit");
  assert.equal(options.redirect, "error");
  assert.equal(options.cache, "no-store");
  await assert.rejects(api("https://elsewhere.example/api/players", { token: TOKEN }), /same-origin/);
  await assert.rejects(api("//elsewhere/api/players", { token: TOKEN }), /same-origin/);
});

test("API errors retain status and retry time, and offline/HTML failures stay readable", async () => {
  const limited = createApi({ fetchImpl: async () => json({ error: "Too many" }, 429, { "retry-after": "30" }) });
  await assert.rejects(limited("/api/players"), (error) => error instanceof ApiError && error.status === 429 && error.retryAfter === "30");
  const down = createApi({ fetchImpl: async () => { throw new TypeError("network"); } });
  await assert.rejects(down("/api/health"), /Couldn't reach/);
  const html = createApi({ fetchImpl: async () => new Response("<html>host error</html>", { status: 502 }) });
  await assert.rejects(html("/api/health"), /server is unavailable/);
  const malformed = createApi({ fetchImpl: async () => json([]) });
  await assert.rejects(malformed("/api/health"), ApiError);
});

test("API requests time out and can be cancelled when leaving a page", async () => {
  const hanging = (_, options) => new Promise((done, reject) => {
    if (options.signal.aborted) reject(options.signal.reason);
    else options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
  });
  const api = createApi({ fetchImpl: hanging, timeout: 20 });
  await assert.rejects(api("/api/health"), /too long/);
  const controller = new AbortController();
  const pending = api("/api/health", { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, (error) => error.name === "AbortError");
  await assert.rejects(api("/api/health", { signal: controller.signal }), (error) => error.name === "AbortError");
});

test("community versions must match the cached game's API and sim", () => {
  assert.deepEqual(checkVersion({ api: 1, sim: SIM_VERSION }), { api: 1, sim: SIM_VERSION });
  assert.throws(() => checkVersion({ api: 1, sim: SIM_VERSION + 1 }), /Update the game/);
  assert.throws(() => checkVersion({ api: 2, sim: SIM_VERSION }), /Update the game/);
  assert.throws(() => checkVersion(null), /Update the game/);
});

test("player codes round-trip with spaces, hyphens and uppercase; malformed codes fail", () => {
  assert.equal(transferCode(TOKEN).split("-").length, 8);
  assert.equal(tokenFromCode(transferCode(TOKEN).toUpperCase().replaceAll("-", " \n")), TOKEN);
  for (const code of ["", "pilot", "0".repeat(63), "g".repeat(64), TOKEN + "/"]) assert.throws(() => tokenFromCode(code), /whole player code/);
});

test("a player is created on demand, kept before naming, and reused", async () => {
  const store = storage();
  const calls = [];
  let nameFails = true;
  const client = createPlayerClient({ storage: () => store, request: async (path, options = {}) => {
    calls.push({ path, options });
    if (path === "/api/health") return { api: 1, sim: SIM_VERSION };
    if (path === "/api/players") return { token: TOKEN, player: { id: "1", name: null } };
    if (options.method === "PATCH") {
      if (nameFails) throw new ApiError("Name taken", 409);
      return { player: { id: "1", name: options.body.name } };
    }
    return { player: { id: "1", name: null } };
  } });
  assert.equal(await client.me(), null);
  assert.equal(calls.length, 0);
  await assert.rejects(client.rename("Pilot"), /Name taken/);
  assert.equal(client.token(), TOKEN);
  nameFails = false;
  assert.equal((await client.rename(" Pilot ")).name, "Pilot");
  assert.equal(calls.filter((call) => call.path === "/api/players").length, 1);
  assert.equal(calls.at(-1).options.token, TOKEN);
});

test("a failed code transfer keeps the old identity, and a checked code replaces it", async () => {
  const store = storage(TOKEN);
  let fail = true;
  const client = createPlayerClient({ storage: () => store, request: async (path, options) => {
    if (path === "/api/health") return { api: 1, sim: SIM_VERSION };
    assert.equal(options.token, OTHER);
    if (fail) throw new ApiError("Bad code", 401);
    return { player: { id: "2", name: "Other" } };
  } });
  await assert.rejects(client.useCode(transferCode(OTHER)), /Bad code/);
  assert.equal(client.token(), TOKEN);
  fail = false;
  assert.equal((await client.useCode(transferCode(OTHER))).name, "Other");
  assert.equal(client.token(), OTHER);
});

test("deleting a profile keeps its code on failure, then removes only its identity", async () => {
  const store = storage(TOKEN);
  store.setItem("gyrorocket:progress", "local progress");
  let fail = true;
  const client = createPlayerClient({ storage: () => store, request: async (path, options) => {
    assert.equal(path, "/api/players/me");
    assert.equal(options.method, "DELETE");
    assert.equal(options.token, TOKEN);
    assert.deepEqual(options.body, {});
    if (fail) throw new ApiError("Offline");
    return { forgotten: true };
  } });
  await assert.rejects(client.forget(), /Offline/);
  assert.equal(client.token(), TOKEN);
  fail = false;
  await client.forget();
  assert.equal(client.token(), null);
  assert.equal(store.getItem("gyrorocket:progress"), "local progress");
});

test("invalid names and unavailable storage never create an unreachable player", async () => {
  let requests = 0;
  const request = async (path) => {
    requests++;
    if (path === "/api/health") return { api: 1, sim: SIM_VERSION };
    throw new Error("Must not create a player");
  };
  const client = createPlayerClient({ storage: () => { throw new Error("no storage"); }, request });
  assert.equal(client.token(), null);
  for (const name of ["ab", "<script>", "___", "x".repeat(17)]) {
    await assert.rejects(client.rename(name), /3–16/);
  }
  assert.equal(requests, 0);
  await assert.rejects(client.rename("Pilot"), /Allow storage/);
  assert.equal(requests, 1); // just the health check
});

test("a profile deleted elsewhere can be replaced without clearing local levels or progress", async () => {
  const store = storage(TOKEN);
  store.setItem("gyrorocket:progress", "keep");
  let online = false, created = 0;
  const client = createPlayerClient({ storage: () => store, request: async (path, options = {}) => {
    if (path === "/api/health") return { api: 1, sim: SIM_VERSION };
    if (path === "/api/players") { created++; return { token: OTHER, player: { name: null } }; }
    if (options.method === "PATCH") return { player: { name: "New pilot" } };
    throw new ApiError(online ? "Unrecognised" : "Unavailable", online ? 401 : 503);
  } });
  await assert.rejects(client.me(), /Unavailable/);
  assert.equal(client.token(), TOKEN);
  online = true;
  assert.equal(await client.me(), null);
  assert.equal(client.token(), null);
  assert.equal(created, 0);
  assert.equal((await client.rename("New pilot")).name, "New pilot");
  assert.equal(client.token(), OTHER);
  assert.equal(store.getItem("gyrorocket:progress"), "keep");
});
