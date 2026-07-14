import { BaseProvider } from "./BaseProvider.js";
import { PROVIDER_IDS } from "../contracts.js";

/**
 * YGG (yggtorrent) provider scaffold.
 *
 * YGG is auth-gated / Cloudflare-protected and has no stable public JSON API.
 * This provider stays disabled-by-default and returns no live results unless a
 * custom PROXY endpoint is configured (MEDIA_YGG_PROXY_URL), so the manager
 * interface is complete without embedding brittle scrapers.
 *
 * Expected proxy response (JSON array):
 * [{ title, infoHash, magnet?, seeders?, size?, quality? }, ...]
 */
export class YggProvider extends BaseProvider {
  /**
   * @param {{ enabled?: boolean, proxyUrl?: string, fetchImpl?: typeof fetch, timeoutMs?: number }} [options]
   */
  constructor(options = {}) {
    super({
      id: PROVIDER_IDS.YGG,
      name: "YGG (proxy)",
      enabled: options.enabled === true,
      priority: 50,
    });
    this.proxyUrl =
      options.proxyUrl || process.env.MEDIA_YGG_PROXY_URL || null;
    this.fetchImpl = options.fetchImpl || fetch;
    this.timeoutMs = options.timeoutMs || 12_000;
  }

  /**
   * @param {{ query: string, contentId?: string, episodeId?: string, season?: number, episode?: number }} request
   */
  async searchStreams(request) {
    if (!this.enabled) return [];
    if (!this.proxyUrl) {
      console.warn(
        "[YggProvider] enabled but MEDIA_YGG_PROXY_URL is not set — returning []",
      );
      return [];
    }

    const q = this.buildQuery(request);
    if (!q) return [];

    const url = new URL(this.proxyUrl);
    url.searchParams.set("q", q);
    if (request.season != null) url.searchParams.set("season", String(request.season));
    if (request.episode != null)
      url.searchParams.set("episode", String(request.episode));

    const rows = await this.fetchJson(url.toString());
    if (!Array.isArray(rows)) return [];

    return rows
      .map((row) => {
        if (!row?.infoHash && !row?.magnet) return null;
        return this.toStreamObject({
          name: "YGG",
          title: row.title || row.name || "Unknown",
          infoHash: row.infoHash,
          magnet: row.magnet,
          seeds: row.seeders,
          size: row.size,
          quality: row.quality,
        });
      })
      .filter(Boolean)
      .slice(0, 25);
  }

  async health() {
    if (!this.enabled) return { ok: false, detail: "disabled" };
    if (!this.proxyUrl) {
      return { ok: false, detail: "MEDIA_YGG_PROXY_URL not configured" };
    }
    return { ok: true, detail: `proxy=${this.proxyUrl}` };
  }

  /** @private */
  buildQuery(request) {
    const parts = [];
    if (request.query) parts.push(request.query);
    if (request.season != null && request.episode != null) {
      parts.push(
        `S${String(request.season).padStart(2, "0")}E${String(request.episode).padStart(2, "0")}`,
      );
    }
    return parts.join(" ").trim();
  }

  /** @private */
  async fetchJson(url) {
    const res = await this.fetchImpl(url, {
      headers: {
        "User-Agent": "KaiMediaProvider/1.0 (+local)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`YGG proxy HTTP ${res.status}`);
    return res.json();
  }
}
