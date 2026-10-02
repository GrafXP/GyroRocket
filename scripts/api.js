// npm run api [-- <host:port>]
//
// The API for local development: the database it needs, then PHP's own server
// at 127.0.0.1:8081, which Vite proxies /api to.
//
// The database is a MariaDB of your own, kept outside the project and described
// by a my.cnf (server/README.md says how to make one): the one GYRO_DB names, or
// ~/.local/share/gyrorocket/my.cnf. If nothing answers on its port, it's started
// here, and stopped again when the API is. One that's already running is left
// alone, and with no my.cnf only PHP is started, for a database of another kind.

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { connect } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";

const listen = process.argv[2] ?? "127.0.0.1:8081";
const cnf = process.env.GYRO_DB ?? join(homedir(), ".local/share/gyrorocket/my.cnf");
const START_WAIT = 30000; // ms for the database to take connections
const STOP_WAIT = 20000; // ms for it to shut down, before the API gives up on it

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

// A setting from the my.cnf, such as its port.
function setting(name, fallback) {
  const line = readFileSync(cnf, "utf8").match(new RegExp(`^\\s*${name}\\s*=\\s*(.+?)\\s*$`, "m"));
  return line ? line[1] : fallback;
}

// Whether anything takes a connection on the database's port.
async function listening(port) {
  const socket = connect({ host: "127.0.0.1", port });
  try {
    return await new Promise((done) => {
      socket.once("connect", () => done(true)).once("error", () => done(false));
      socket.setTimeout(1000, () => done(false));
    });
  } finally {
    socket.destroy();
  }
}

// Starts the database, unless it's running or there isn't one. Gives the process
// it started, or null.
async function startDatabase() {
  if (!existsSync(cnf)) {
    console.log(`No database of the game's own (${cnf}): starting the API alone.`);
    return null;
  }
  const port = Number(setting("port", 3306));
  if (await listening(port)) {
    console.log(`The database is already running, on port ${port}.`);
    return null;
  }
  const db = spawn("mariadbd", [`--defaults-file=${cnf}`], { stdio: "ignore" });
  let gone = null;
  db.once("error", (e) => (gone = e.message)).once("exit", (code) => (gone ??= `it stopped (${code})`));
  for (const began = Date.now(); Date.now() - began < START_WAIT; await wait(250)) {
    if (gone) break;
    if (!(await listening(port))) continue;
    // It opens its port before it's sure of itself: see that it stays.
    await wait(1000);
    if (!gone && (await listening(port))) {
      console.log(`The database is running, on port ${port}.`);
      return db;
    }
  }
  db.kill();
  throw new Error(`The database didn't start: ${gone ?? "nothing answered in time"}. Its log is ${setting("log-error", "in its data directory")}.`);
}

// Stops a database started here, and waits for it to finish writing.
async function stopDatabase(db) {
  if (!db || db.exitCode !== null) return;
  const stopped = new Promise((done) => db.once("exit", done));
  db.kill("SIGTERM");
  await Promise.race([stopped, wait(STOP_WAIT)]);
  console.log(db.exitCode === null ? "The database is still shutting down." : "The database has stopped.");
}

let db = null;
try {
  db = await startDatabase();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const php = spawn("php", ["-S", listen, "-t", "server/public", "server/router.php"], { stdio: "inherit" });
// Ctrl+C reaches PHP too, as it's in the terminal with us: wait for it, then the database.
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => php.kill(signal === "SIGHUP" ? "SIGTERM" : signal));
php.once("error", async (e) => {
  console.error(`Couldn't start PHP: ${e.message}`);
  await stopDatabase(db);
  process.exit(1);
});
php.once("exit", async (code) => {
  await stopDatabase(db);
  process.exit(code ?? 0);
});
