import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateDeploy, deploymentFiles } from "../scripts/deploy.js";

const config = {
  protocol: "ftps", host: "ftp.example.com", port: 21, user: "pilot", password: 'private"pass\\word',
  webRoot: "/public_html", serverDir: "../gyrorocket-server", site: "https://game.example.com",
};

test("deployment rejects unsafe hosts, public private-files paths and non-HTTPS sites", () => {
  assert.equal(validateDeploy(config), config);
  for (const change of [
    { host: "-oProxyCommand=bad" }, { host: "ftp://example.com" }, { user: "-bad" },
    { port: 0 }, { password: "pass\nconfig" }, { serverDir: "files" },
    { serverDir: "." }, { serverDir: "server'; code" }, { webRoot: "relative" },
    { site: "http://example.com" }, { site: "https://example.com/path" },
  ]) assert.throws(() => validateDeploy({ ...config, ...change }));
  assert.doesNotThrow(() => validateDeploy({ ...config, serverDir: "server" }));
  assert.doesNotThrow(() => validateDeploy({ ...config, protocol: "ssh", port: 22, password: undefined }));
});

test("deploy protects private files first, preserves credentials and publishes assets before HTML", async () => {
  const original = process.cwd();
  const directory = await mkdtemp(join(tmpdir(), "gyro-deploy-test-"));
  try {
    await mkdir(join(directory, "dist/assets"), { recursive: true });
    await mkdir(join(directory, "server/public/api"), { recursive: true });
    await mkdir(join(directory, "server/lib"));
    for (const [path, text] of [
      ["dist/.htaccess", "headers"], ["dist/index.html", "new game"], ["dist/assets/game.js", "game"],
      ["server/.htaccess", "Require all denied"], ["server/config.php", "REAL SECRET"],
      ["server/config.example.php", "example"], ["server/lib/bootstrap.php", "bootstrap"],
      ["server/public/api/index.php", "$serverRoot = /* deploy:server-root */ dirname(__DIR__, 2);"],
    ]) await writeFile(join(directory, path), text);
    process.chdir(directory);
    for (const serverDir of ["../gyrorocket-server", "server"]) {
      const list = await deploymentFiles({ ...config, serverDir });
      assert.equal(list[0].local, "server/.htaccess");
      assert.equal(list[1].local, "dist/.htaccess");
      assert.equal(list.at(-1).local, "dist/index.html");
      assert.equal(list.some((file) => file.local === "server/config.php"), false);
      assert.equal(list.some((file) => file.local?.startsWith("server/public")), false);
      assert.equal(list.some((file) => file.remote.includes("..")), false);
      assert.ok(list.at(-2).content.includes(`dirname(__DIR__) . '/${serverDir}'`));
      assert.equal(list.at(-2).remote, "/public_html/api/index.php");
      assert.ok(list.findIndex((file) => file.local === "dist/assets/game.js") < list.length - 1);
    }
  } finally {
    process.chdir(original);
    await rm(directory, { recursive: true, force: true });
  }
});
