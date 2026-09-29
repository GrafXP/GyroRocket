import { defineConfig } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

// On the dev server, the play page's *Save this run* (with ?dev) posts the run to
// /__runs, which writes it to runs/ in the project, for `npm run verify` to play
// back in node. The phone's downloads aren't where node can see them.
function saveRuns() {
  return {
    name: "save-runs",
    configureServer(server) {
      server.middlewares.use("/__runs", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          return res.end();
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
          if (body.length > 4e6) req.destroy();
        });
        req.on("end", () => {
          try {
            const run = JSON.parse(body);
            const file = `runs/run-${String(run.id).replace(/[^\w-]+/g, "-")}-${run.ticks}-${Date.now()}.json`;
            mkdirSync("runs", { recursive: true });
            writeFileSync(file, `${JSON.stringify(run)}\n`);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ file }));
          } catch (e) {
            res.statusCode = 400;
            res.end(e.message);
          }
        });
      });
    },
  };
}

export default defineConfig({ plugins: [saveRuns()] });
