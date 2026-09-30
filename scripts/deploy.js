import { readFile, writeFile, readdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { posix, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

function run(command, args, options = {}) {
  return new Promise((done, fail) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", fail);
    child.on("exit", (code) => code === 0 ? done() : fail(new Error(`${command} failed (${code}).`)));
  });
}

async function files(directory) {
  const list = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) list.push(...await files(path));
    else if (entry.isFile()) list.push(path);
  }
  return list.sort();
}

export function validateDeploy(config) {
  if (!["ftp", "ftps", "ssh"].includes(config.protocol)) throw new Error("Use ftp, ftps or ssh.");
  if (!/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(config.host ?? "")) throw new Error("Set a hostname, without a URL or options.");
  if (!/^[A-Za-z0-9_.@-]+$/.test(config.user ?? "") || config.user.startsWith("-")) throw new Error("Set a valid deployment login.");
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw new Error("Set a port (FTP: 21, SSH: 22).");
  if (typeof config.webRoot !== "string" || !config.webRoot.startsWith("/") || /[\r\n\0]/.test(config.webRoot)) throw new Error("webRoot must be an absolute upload path.");
  if (typeof config.serverDir !== "string" || config.serverDir.startsWith("/") || !/^[A-Za-z0-9_./-]+$/.test(config.serverDir)) throw new Error("serverDir must be relative to the website root.");
  const web = posix.normalize(config.webRoot);
  const server = posix.join(web, config.serverDir);
  // It must be a private sibling, or the explicitly protected /server folder.
  if (server === web || (server.startsWith(`${web}/`) && config.serverDir !== "server")) throw new Error("Use a private sibling for serverDir, or exactly 'server'.");
  if (config.protocol !== "ssh" && (typeof config.password !== "string" || /[\r\n\0]/.test(config.password))) throw new Error("Set an FTP password.");
  const site = new URL(config.site);
  if (site.protocol !== "https:" || site.pathname !== "/" || site.search || site.hash || site.username || site.password) throw new Error("site must be the HTTPS root of the game subdomain.");
  return config;
}

export async function deploymentFiles(config) {
  validateDeploy(config);
  const web = posix.normalize(config.webRoot);
  const server = posix.join(web, config.serverDir);
  const list = [];
  // Protect the fallback private directory BEFORE putting files there.
  list.push({ local: "server/.htaccess", remote: posix.join(server, ".htaccess") });
  list.push({ local: "dist/.htaccess", remote: posix.join(web, ".htaccess") });
  for (const path of await files("server")) {
    if (path === "server/.htaccess" || path === "server/config.php" || path.startsWith("server/public/")) continue;
    list.push({ local: path, remote: posix.join(server, path.slice(7)) });
  }
  for (const path of await files("dist")) {
    if (["dist/.htaccess", "dist/index.html"].includes(path)) continue;
    list.push({ local: path, remote: posix.join(web, path.slice(5)) });
  }
  const entry = await readFile("server/public/api/index.php", "utf8");
  // serverDir uses a narrow alphabet; it cannot inject PHP code.
  list.push({ content: entry.replace("/* deploy:server-root */ dirname(__DIR__, 2)", `/* deploy:server-root */ dirname(__DIR__) . '/${config.serverDir}'`), remote: posix.join(web, "api/index.php") });
  list.push({ local: "dist/index.html", remote: posix.join(web, "index.html") });
  return list;
}

const shellQuote = (value) => `'${value.replace(/'/g, "'\\''")}'`;
const curlQuote = (value) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

export async function upload(config, list, directory) {
  if (config.protocol === "ssh") {
    const destination = `${config.user}@${config.host}`;
    for (const folder of new Set(list.map((file) => posix.dirname(file.remote)))) {
      await run("ssh", ["-o", "BatchMode=yes", "-p", String(config.port), destination, `mkdir -p -- ${shellQuote(folder)}`]);
    }
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      const local = await localFile(file, directory, i);
      const temporary = `${file.remote}.upload`;
      // Modern scp uses SFTP; the rename commits each complete file.
      await run("scp", ["-o", "BatchMode=yes", "-P", String(config.port), local, `${destination}:${temporary}`]);
      await run("ssh", ["-o", "BatchMode=yes", "-p", String(config.port), destination, `mv -f -- ${shellQuote(temporary)} ${shellQuote(file.remote)}`]);
    }
    return;
  }
  // Keep the password out of command arguments and terminal output. The temp
  // config is private and is removed even if a transfer fails.
  const authFile = join(directory, "curl.conf");
  await writeFile(authFile, `user = ${curlQuote(`${config.user}:${config.password}`)}\n`, { mode: 0o600 });
  for (let i = 0; i < list.length; i++) {
    const file = list[i];
    const local = await localFile(file, directory, i);
    const name = posix.basename(file.remote);
    const remotePath = `${file.remote}.upload`.split("/").map(encodeURIComponent).join("/");
    await run("curl", [
      "--config", authFile, "--fail", "--silent", "--show-error", "--connect-timeout", "15", "--max-time", "120",
      "--ftp-create-dirs", ...(config.protocol === "ftps" ? ["--ssl-reqd"] : []),
      "--upload-file", local, "--quote", `-RNFR ${name}.upload`, "--quote", `-RNTO ${name}`,
      `ftp://${config.host}:${config.port}${remotePath}`,
    ]);
  }
}

async function localFile(file, directory, index) {
  if (file.local) return file.local;
  const local = join(directory, `entry-${index}.php`);
  await writeFile(local, file.content, { mode: 0o600 });
  return local;
}

async function main() {
  const dry = process.argv.includes("--dry-run");
  const config = validateDeploy(JSON.parse(await readFile("deploy.json", "utf8")));
  await run("npm", ["run", "build"]);
  const list = await deploymentFiles(config);
  if (dry) {
    for (const file of list) console.log(`${file.local ?? "generated api/index.php"} → ${file.remote}`);
    console.log("Dry run: no uploads. config.php is never uploaded; migrations are run by hand.");
    return;
  }
  const directory = await mkdtemp(join(tmpdir(), "gyro-deploy-"));
  try {
    await upload(config, list, directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  console.log("Uploaded. Run any pending SQL migrations in phpMyAdmin, then check /api/health.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    // Do not print the config, a failed command, or the credentials it contains.
    console.error(error.code === "ENOENT" ? "Copy deploy.example.json to deploy.json and fill in the host settings first." : error.message);
    process.exitCode = 1;
  });
}
