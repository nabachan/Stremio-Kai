import { FakeDataProvider } from "./providers/FakeDataProvider.js";
import { NyaaProvider } from "./providers/NyaaProvider.js";
import { PirateBayProvider } from "./providers/PirateBayProvider.js";
import { YggProvider } from "./providers/YggProvider.js";
import {
  PROVIDER_IDS,
  toPlayerHandoff,
  validateStream,
} from "./contracts.js";
import { buildPlayerHandoffEnvelope } from "./bridge/PlayerHandoff.js";

/**
 * Central orchestrator replacing Stremio auth + addon catalog/stream pipeline.
 *
 * Responsibilities:
 *  - Own anime catalog/meta (via FakeData by default)
 *  - Aggregate streams from pluggable providers (fake / nyaa / tpb / ygg)
 *  - Emit player handoff payloads compatible with the existing MPV/SVP path
 */
export class MediaProviderManager {
  /**
   * @param {{
   *   providers?: import('./providers/BaseProvider.js').BaseProvider[],
   *   enabledIds?: string[],
   * }} [options]
   */
  constructor(options = {}) {
    const enabledIds = normalizeEnabledIds(
      options.enabledIds || parseEnabledFromEnv(),
    );

    this.providers =
      options.providers ||
      [
        new FakeDataProvider({ enabled: enabledIds.has(PROVIDER_IDS.FAKE) }),
        new NyaaProvider({ enabled: enabledIds.has(PROVIDER_IDS.NYAA) }),
        new PirateBayProvider({
          enabled: enabledIds.has(PROVIDER_IDS.PIRATEBAY),
        }),
        new YggProvider({ enabled: enabledIds.has(PROVIDER_IDS.YGG) }),
      ];

    /** @type {FakeDataProvider|null} */
    this.catalogProvider =
      this.providers.find((p) => p instanceof FakeDataProvider) || null;

    this._ready = false;
  }

  /** Initialize all enabled providers. */
  async init() {
    const results = await Promise.allSettled(
      this.providers.map(async (p) => {
        if (!p.enabled) return;
        await p.init();
      }),
    );

    const failures = results
      .map((r, i) => ({ r, p: this.providers[i] }))
      .filter(({ r, p }) => p.enabled && r.status === "rejected");

    for (const { p, r } of failures) {
      console.error(`[MediaProviderManager] init failed for ${p.id}:`, r.reason);
      p.enabled = false;
    }

    if (!this.catalogProvider?.enabled) {
      throw new Error(
        "MediaProviderManager: FakeDataProvider is required and must be enabled (catalog source).",
      );
    }

    this._ready = true;
    return this;
  }

  assertReady() {
    if (!this._ready) {
      throw new Error("MediaProviderManager not initialized — call init() first");
    }
  }

  /** Manifest replacing Stremio addon manifest for this local engine. */
  getManifest() {
    this.assertReady();
    return {
      id: "community.kai.media-provider",
      version: "1.0.0",
      name: "Kai Media Provider",
      description:
        "Standalone anime catalog & magnet streams — no Stremio login, no remote addons.",
      resources: ["catalog", "meta", "stream"],
      types: ["series"],
      catalogs: this.catalogProvider.listCatalogs().map((c) => ({
        ...c,
        type: "series",
      })),
      idPrefixes: ["kai:"],
      behaviorHints: {
        adult: false,
        p2p: true,
        configurable: false,
      },
      providers: this.providers.map((p) => ({
        id: p.id,
        name: p.name,
        enabled: p.enabled,
        priority: p.priority,
      })),
    };
  }

  /**
   * @param {string} catalogId
   */
  getCatalog(catalogId) {
    this.assertReady();
    const metas = this.catalogProvider.getCatalog(catalogId);
    return {
      metas,
      cacheMaxAge: 300,
      staleRevalidate: 3600,
    };
  }

  /** @param {string} [query] */
  search(query = "") {
    this.assertReady();
    return {
      metas: this.catalogProvider.searchCatalog(query),
      cacheMaxAge: 60,
    };
  }

  /** @param {string} id */
  getMeta(id) {
    this.assertReady();
    const meta = this.catalogProvider.getMeta(id);
    if (!meta) return null;
    return { meta, cacheMaxAge: 300 };
  }

  /**
   * Aggregate streams across enabled providers (priority ascending).
   * Fake streams are always first when FakeData is enabled — for bridge testing.
   *
   * @param {{ contentId: string, episodeId?: string, type?: string }} params
   */
  async getStreams(params) {
    this.assertReady();
    const { contentId, episodeId } = params;
    if (!contentId) throw new Error("getStreams: contentId required");

    const meta = this.catalogProvider.getMeta(contentId);
    const episode = resolveEpisode(meta, episodeId);

    const request = {
      query: meta?.name || contentId,
      contentId,
      episodeId,
      season: episode?.season,
      episode: episode?.episode,
    };

    const enabled = [...this.providers]
      .filter((p) => p.enabled)
      .sort((a, b) => a.priority - b.priority);

    const settled = await Promise.allSettled(
      enabled.map(async (p) => {
        const streams = await p.searchStreams(request);
        return streams.map((s) => ({ ...s, provider: s.provider || p.id }));
      }),
    );

    /** @type {import('./contracts.js').StreamObject[]} */
    const streams = [];
    const errors = [];

    settled.forEach((result, idx) => {
      const provider = enabled[idx];
      if (result.status === "fulfilled") {
        streams.push(...result.value);
      } else {
        errors.push({
          provider: provider.id,
          message: String(result.reason?.message || result.reason),
        });
        console.warn(
          `[MediaProviderManager] ${provider.id} failed:`,
          result.reason,
        );
      }
    });

    return {
      streams: dedupeStreams(streams),
      errors,
      cacheMaxAge: 120,
    };
  }

  /**
   * Build the exact handoff envelope the player integration expects.
   * Phase 3 will post this through the existing WebView → MPV transport;
   * for Phase 1 we expose it over HTTP so you can verify the bridge contract.
   *
   * @param {{ contentId: string, episodeId?: string, streamIndex?: number, stream?: object }} params
   */
  async buildPlayerHandoff(params) {
    this.assertReady();
    const { contentId, episodeId, streamIndex = 0 } = params;
    let stream = params.stream;

    if (!stream) {
      const { streams } = await this.getStreams({ contentId, episodeId });
      stream = streams[streamIndex];
    }
    if (!stream) {
      throw new Error("buildPlayerHandoff: no stream available");
    }

    const validation = validateStream(stream);
    if (!validation.ok) {
      throw new Error(
        `buildPlayerHandoff: invalid stream (${validation.errors.join(", ")})`,
      );
    }

    const meta = this.catalogProvider.getMeta(contentId);
    const handoff = toPlayerHandoff(stream, {
      contentId,
      episodeId,
      playbackHints: {
        is_anime: true,
        title: meta?.name,
        detection_reason: "kai-media-provider",
      },
    });

    return buildPlayerHandoffEnvelope(handoff);
  }

  async health() {
    const providers = await Promise.all(
      this.providers.map(async (p) => {
        const h = await p.health().catch((e) => ({
          ok: false,
          detail: e.message,
        }));
        return { id: p.id, name: p.name, enabled: p.enabled, ...h };
      }),
    );
    return {
      ok: this._ready && providers.some((p) => p.id === PROVIDER_IDS.FAKE && p.ok),
      ready: this._ready,
      providers,
    };
  }
}

function parseEnabledFromEnv() {
  const raw = process.env.MEDIA_PROVIDERS || "fake";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeEnabledIds(ids) {
  const set = new Set(ids);
  // Fake catalog is mandatory for Phase 1 / offline
  set.add(PROVIDER_IDS.FAKE);
  return set;
}

function resolveEpisode(meta, episodeId) {
  if (!meta?.episodes || !episodeId) return null;
  return meta.episodes.find((e) => e.id === episodeId) || null;
}

function dedupeStreams(streams) {
  const seen = new Set();
  const out = [];
  for (const s of streams) {
    const key =
      (s.infoHash && `ih:${String(s.infoHash).toLowerCase()}`) ||
      (s.sources?.[0] && `src:${s.sources[0]}`) ||
      (s.url && `url:${s.url}`) ||
      `t:${s.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export { PROVIDER_IDS };
