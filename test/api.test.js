import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { SIM_VERSION } from "../src/sim/world.js";

const base = process.env.GYRO_API;
const direct = !!process.env.GYRO_TEST_CONFIG;
const prefix = `T${randomBytes(4).toString("hex")}`;
const tokens = [];

async function request(path, { method = "GET", body, token, headers = {} } = {}) {
  const response = await fetch(`${base}/api${path}`, {
    method, headers: { ...(body !== undefined && { "content-type": "application/json" }), ...(token && { authorization: `Bearer ${token}` }), ...headers },
    ...(body !== undefined && { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
  assert.match(response.headers.get("content-type"), /^application\/json/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(response.headers.get("x-powered-by"), null);
  return { status: response.status, data: await response.json(), headers: response.headers };
}

async function player() {
  const result = await request("/players", { method: "POST", body: {} });
  assert.equal(result.status, 201);
  assert.match(result.data.token, /^[a-f0-9]{64}$/);
  tokens.push(result.data.token);
  return result.data;
}

function db(input) {
  return new Promise((done, fail) => {
    const child = spawn("php", ["test/api-db.php"], { stdio: ["pipe", "pipe", "pipe"] });
    let output = "", error = "";
    child.stdout.on("data", (chunk) => output += chunk);
    child.stderr.on("data", (chunk) => error += chunk);
    child.on("error", fail);
    child.on("exit", (code) => {
      if (code) fail(new Error(`Scratch database helper failed: ${error}`));
      else { try { done(JSON.parse(output)); } catch (error) { fail(error); } }
    });
    child.stdin.end(JSON.stringify(input));
  });
}
const sql = (text, args = []) => db({ sql: text, args });

test("PHP community API on a scratch server", { skip: !base, timeout: 120000 }, async (t) => {
  if (direct) await sql("DELETE FROM hits");
  t.after(async () => {
    if (direct) await sql("DELETE FROM hits");
    for (const token of tokens) {
      await request("/players/me", { method: "DELETE", body: {}, token });
    }
    if (direct) await sql("DELETE FROM hits");
  });

  await t.test("health and route/method errors are JSON with security headers", async () => {
    assert.deepEqual((await request("/health")).data, { api: 1, sim: SIM_VERSION, schema: 1 });
    assert.equal((await request("/no-such-route")).status, 404);
    const method = await request("/players");
    assert.equal(method.status, 405);
    assert.equal(method.headers.get("allow"), "POST");
    assert.equal((await request("/health?secret=x")).status, 400);
    assert.equal((await request("/health", { method: "OPTIONS" })).status, 405);
    assert.equal((await request("/players", { method: "POST", body: {}, headers: { "sec-fetch-site": "cross-site" } })).status, 403);
  });

  await t.test("malformed, nested, oversized, wrong-type and unknown fields are refused", async () => {
    for (const body of ["{", "null", "[]", '"text"', '{"__proto__":{"role":"trusted"}}', '{"role":"trusted"}', '{"deep":' + "[".repeat(20) + "0" + "]".repeat(20) + "}"]) {
      assert.equal((await request("/players", { method: "POST", body })).status, 400);
    }
    assert.equal((await request("/players", { method: "POST", body: " ".repeat(131073) })).status, 413);
    assert.equal((await request("/players", { method: "POST", body: "{}", headers: { "content-type": "text/plain" } })).status, 415);
  });

  await t.test("tokens are required, secret, and preserved across phones", async () => {
    const first = await player();
    assert.equal(first.player.name, null);
    for (const token of [undefined, "x", "0".repeat(64), "' OR 1=1 --"]) assert.equal((await request("/players/me", { token })).status, 401);
    assert.deepEqual((await request("/players/me", { token: first.token.toUpperCase() })).data.player, first.player);
    assert.equal((await request("/players/me", { token: first.token })).data.token, undefined);
    if (direct) {
      const rows = await sql("SELECT token_hash FROM players WHERE id = ?", [first.player.id]);
      assert.equal(rows[0].token_hash, createHash("sha256").update(first.token).digest("hex"));
      assert.notEqual(rows[0].token_hash, first.token);
    }
  });

  await t.test("names are strict, unique ignoring case, and cannot change another player", async () => {
    const first = await player(), second = await player();
    const name = `${prefix} Pilot`;
    assert.equal((await request("/players/me", { method: "PATCH", body: { name: ` ${name} ` }, token: first.token })).data.player.name, name);
    assert.equal((await request("/players/me", { method: "PATCH", body: { name: name.toLowerCase() }, token: second.token })).status, 409);
    assert.equal((await request("/players/me", { method: "PATCH", body: { name, id: first.player.id }, token: second.token })).status, 400);
    assert.equal((await request("/players/me", { token: first.token })).data.player.name, name);
    const attacker = await player();
    for (const invalid of ["ab", "A".repeat(17), "___", "<script>", "' OR 1=1 --", "A\nB", "A\u202eB", 42, null, {}]) {
      assert.equal((await request("/players/me", { method: "PATCH", body: { name: invalid }, token: attacker.token })).status, 400);
    }
  });

  await t.test("export belongs to this player and deletion frees the name and invalidates the code", async () => {
    const first = await player(), second = await player();
    const name = `${prefix} Gone`;
    assert.equal((await request("/players/me", { method: "PATCH", body: { name }, token: first.token })).status, 200);
    const result = await request("/players/me/data", { token: first.token });
    assert.equal(result.status, 200);
    assert.equal(result.data.player.id, first.player.id);
    for (const key of ["levels", "scores", "ratings", "plays", "checks", "reports"]) assert.deepEqual(result.data[key], []);
    assert.equal(JSON.stringify(result.data).includes(first.token), false);
    assert.equal(JSON.stringify(result.data).includes("token_hash"), false);
    assert.equal((await request("/players/me", { method: "DELETE", body: { id: second.player.id }, token: first.token })).status, 400);
    assert.equal((await request("/players/me", { method: "DELETE", body: {}, token: first.token })).data.forgotten, true);
    assert.equal((await request("/players/me", { token: first.token })).status, 401);
    assert.equal((await request("/players/me", { method: "PATCH", body: { name }, token: second.token })).status, 200);
  });

  await t.test("schema mismatch blocks ALL routes until the migration is complete", { skip: !direct }, async () => {
    try {
      await sql("UPDATE schema_migrations SET version = 2 WHERE version = 1");
      assert.equal((await request("/health")).status, 503);
      assert.equal((await request("/players", { method: "POST", body: {} })).status, 503);
    } finally {
      await sql("UPDATE schema_migrations SET version = 1 WHERE version = 2");
    }
    assert.equal((await request("/health")).status, 200);
  });

  await t.test("bans block participation but still allow saving and deleting one's data", { skip: !direct }, async () => {
    const first = await player();
    try {
      await sql("UPDATE players SET banned = TRUE WHERE id = ?", [first.player.id]);
      assert.equal((await request("/players/me", { token: first.token })).status, 403);
      assert.equal((await request("/players/me", { method: "PATCH", body: { name: "Banned" }, token: first.token })).status, 403);
      assert.equal((await request("/players/me/data", { token: first.token })).status, 200);
      assert.equal((await request("/players/me", { method: "DELETE", body: {}, token: first.token })).status, 200);
    } finally {
      await sql("UPDATE players SET banned = FALSE WHERE id = ?", [first.player.id]);
    }
  });

  await t.test("Forget me cascades owned content and others' references without deleting other profiles", { skip: !direct }, async () => {
    const first = await player(), second = await player();
    await sql("INSERT INTO levels (code, player_id, hash, name, look, par, play, thumbnail, width, height) VALUES (?, ?, ?, 'Cave', 1, 10, '{}', '', 16, 12)", [prefix.slice(0, 6), first.player.id, randomBytes(16).toString("hex")]);
    const [{ id: level }] = await sql("SELECT id FROM levels WHERE player_id = ?", [first.player.id]);
    await sql("INSERT INTO scores (player_id, level_id, hash, sim, ticks, crystals, restarts, replay, fingerprint) VALUES (?, ?, ?, 1, 60, 0, 0, '{}', ?)", [first.player.id, level, randomBytes(16).toString("hex"), "a".repeat(64)]);
    const [{ id: score }] = await sql("SELECT id FROM scores WHERE player_id = ?", [first.player.id]);
    await sql("INSERT INTO checks (score_id, player_id, expires_at) VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL 10 MINUTE)", [score, second.player.id]);
    for (const owner of [first.player.id, second.player.id]) {
      await sql("INSERT INTO ratings (level_id, player_id, quality, difficulty, fun) VALUES (?, ?, 3, 3, 3)", [level, owner]);
      await sql("INSERT INTO plays (level_id, player_id) VALUES (?, ?)", [level, owner]);
      await sql("INSERT INTO reports (level_id, player_id, reason) VALUES (?, ?, 'Test')", [level, owner]);
    }
    const exported = (await request("/players/me/data", { token: first.token })).data;
    assert.equal(exported.levels.length, 1);
    assert.equal(exported.scores.length, 1);
    assert.equal(exported.ratings.length, 1);
    assert.equal(exported.plays.length, 1);
    assert.equal(exported.reports.length, 1);
    assert.equal(exported.checks.length, 0);
    assert.equal((await request("/players/me", { method: "DELETE", body: {}, token: first.token })).status, 200);
    for (const [table, field, id] of [["levels", "id", level], ["scores", "id", score], ["checks", "score_id", score], ["ratings", "level_id", level], ["plays", "level_id", level], ["reports", "level_id", level]]) {
      assert.deepEqual(await sql(`SELECT * FROM ${table} WHERE ${field} = ?`, [id]), []);
    }
    assert.equal((await request("/players/me", { token: second.token })).status, 200);
    assert.deepEqual(await sql("SELECT * FROM hits WHERE subject = ?", [`p:${first.player.id}`]), []);
  });

  await t.test("every write/export limit applies per IP and player and expired buckets are pruned", { skip: !direct }, async () => {
    const limits = await db({ op: "limits" });
    const first = await player();
    await request("/players/me", { token: first.token });
    const [{ subject: ip }] = await sql("SELECT subject FROM hits WHERE action = 'auth' AND subject LIKE 'i:%' LIMIT 1");
    assert.match(ip, /^i:[a-f0-9]{64}$/);
    assert.equal(ip.includes("127.0.0.1"), false);
    const cases = [
      ["auth", "/players/me", {}],
      ["players", "/players", { method: "POST", body: {} }],
      ["name", "/players/me", { method: "PATCH", body: { name: `${prefix} Limit` } }],
      ["delete", "/players/me", { method: "DELETE", body: {} }],
      ["data", "/players/me/data", {}],
    ];
    try {
      for (const [action, path, options] of cases) {
        const rule = limits[action];
        for (const [subject, max] of [[ip, rule.ip], ...(rule.player ? [[`p:${first.player.id}`, rule.player]] : [])]) {
          await sql("DELETE FROM hits");
          const start = Math.floor(Date.now() / 1000 / rule.seconds) * rule.seconds;
          await sql("INSERT INTO hits (action, subject, window_start, count, expires_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP() + INTERVAL 1 HOUR)", [action, subject, start, max]);
          const result = await request(path, { ...options, token: action === "players" ? undefined : first.token });
          assert.equal(result.status, 429, `${action} ${subject.slice(0, 2)} limit`);
          assert.ok(Number(result.headers.get("retry-after")) > 0);
        }
      }
      await sql("INSERT INTO hits (action, subject, window_start, count, expires_at) VALUES ('expired', 'i:old', 1, 1, UTC_TIMESTAMP() - INTERVAL 1 DAY)");
      await sql("DELETE FROM hits WHERE action = 'auth'");
      await request("/players/me", { token: first.token, headers: { "x-forwarded-for": "1.2.3.4" } });
      assert.deepEqual(await sql("SELECT * FROM hits WHERE action = 'expired'"), []);
      assert.equal((await sql("SELECT subject FROM hits WHERE action = 'auth'"))[0].subject, ip);
    } finally {
      await sql("DELETE FROM hits");
    }
  });
});
