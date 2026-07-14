#!/usr/bin/env node
import http from "node:http";
import { MediaProviderManager } from "./MediaProviderManager.js";
import { createApiHandler } from "./routes/api.js";
import { DEFAULT_PORT } from "./contracts.js";

const port = Number(process.env.PORT || DEFAULT_PORT);

const manager = new MediaProviderManager();
await manager.init();

const handler = createApiHandler(manager);
const server = http.createServer((req, res) => {
  handler(req, res);
});

server.listen(port, "127.0.0.1", () => {
  const base = `http://127.0.0.1:${port}`;
  console.log("");
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   Kai MediaProviderManager  ·  Phase 1       ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log(`  Listening  ${base}`);
  console.log(`  Manifest   ${base}/manifest.json`);
  console.log(`  Catalog    ${base}/catalog/anime/anime-featured.json`);
  console.log(`  Meta       ${base}/meta/anime/kai:solo-leveling.json`);
  console.log(`  Streams    ${base}/stream/anime/kai:solo-leveling.json`);
  console.log(`  Handoff    ${base}/play/kai:solo-leveling`);
  console.log(`  Health     ${base}/health`);
  console.log("");
  console.log(
    `  Providers  ${(process.env.MEDIA_PROVIDERS || "fake").split(",").join(", ")}`,
  );
  console.log("  (Add nyaa,piratebay,ygg via MEDIA_PROVIDERS env)");
  console.log("");
});

function shutdown(signal) {
  console.log(`\n[${signal}] shutting down…`);
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
