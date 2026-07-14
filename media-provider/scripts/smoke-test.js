#!/usr/bin/env node
/**
 * Smoke tests for MediaProviderManager — no live network required (fake only).
 */
import assert from "node:assert/strict";
import { MediaProviderManager } from "../src/MediaProviderManager.js";
import { validateStream, toPlayerHandoff } from "../src/contracts.js";

async function main() {
  const mgr = new MediaProviderManager({ enabledIds: ["fake"] });
  await mgr.init();

  const manifest = mgr.getManifest();
  assert.equal(manifest.id, "community.kai.media-provider");
  assert.ok(manifest.catalogs.length >= 3, "expected anime catalogs");
  assert.ok(manifest.types.includes("anime"));

  const featured = mgr.getCatalog("anime-featured");
  assert.ok(featured.metas.length >= 3, "featured catalog empty");
  assert.ok(
    featured.metas.some((m) => m.name === "Solo Leveling"),
    "Solo Leveling missing",
  );
  assert.ok(
    featured.metas.some((m) => m.name === "Attack on Titan"),
    "Attack on Titan missing",
  );

  const meta = mgr.getMeta("kai:solo-leveling");
  assert.ok(meta?.meta?.episodes?.length >= 1);

  const search = mgr.search("titan");
  assert.ok(search.metas.some((m) => /titan/i.test(m.name)));

  const { streams, errors } = await mgr.getStreams({
    contentId: "kai:solo-leveling",
    episodeId: "kai:solo-leveling:1:1",
  });
  assert.equal(errors.length, 0);
  assert.ok(streams.length >= 2, "expected fake test magnets");

  for (const s of streams) {
    const v = validateStream(s);
    assert.ok(v.ok, `invalid stream: ${v.errors.join(",")}`);
    assert.ok(s.infoHash || s.sources?.[0]?.startsWith("magnet:"));
    assert.equal(s.provider, "fake");
  }

  const handoff = await mgr.buildPlayerHandoff({
    contentId: "kai:attack-on-titan",
    streamIndex: 0,
  });
  assert.equal(handoff.kind, "magnet");
  assert.ok(handoff.uri.startsWith("magnet:?xt=urn:btih:"));
  assert.ok(handoff.stream.infoHash);
  assert.equal(handoff.playbackHints.is_anime, true);
  assert.equal(handoff.mpv.loadfile, null, "magnets must not go straight to loadfile");
  assert.ok(
    handoff.mpv.streamingServerTemplate?.includes("{infoHash}"),
    "expected EngineFS URL template for Phase 3",
  );
  assert.ok(handoff.mpv.scriptMessages?.[0]?.target === "profile_manager");

  // Contract helper
  const raw = toPlayerHandoff(streams[0], { contentId: "kai:solo-leveling" });
  assert.equal(raw.kind, "magnet");

  const health = await mgr.health();
  assert.equal(health.ok, true);

  console.log("✓ smoke tests passed");
  console.log(`  catalogs: ${manifest.catalogs.map((c) => c.id).join(", ")}`);
  console.log(`  featured titles: ${featured.metas.map((m) => m.name).join(" | ")}`);
  console.log(`  streams for Solo Leveling ep1: ${streams.length}`);
  console.log(`  handoff uri: ${handoff.uri.slice(0, 64)}…`);
}

main().catch((err) => {
  console.error("✗ smoke tests failed");
  console.error(err);
  process.exit(1);
});
