import { XMLParser } from "fast-xml-parser";
import { BaseProvider } from "./BaseProvider.js";
import { PROVIDER_IDS } from "../contracts.js";

const NYAA_RSS = "https://nyaa.si/?page=rss";

/**
 * Nyaa.si provider — Anime / English-translated category via public RSS.
 * Disabled by default; enable with MEDIA_PROVIDERS=fake,nyaa
 */
export class NyaaProvider extends BaseProvider {
  /**
   * @param {{ enabled?: boolean, fetchImpl?: typeof fetch, timeoutMs?: number }} [options]
   */
  constructor(options = {}) {
    super({
      id: PROVIDER_IDS.NYAA,
      name: "Nyaa.si",
      enabled: options.enabled === true,
      priority: 20,
    });
    this.fetchImpl = options.fetchImpl || fetch;
    this.timeoutMs = options.timeoutMs || 12_000;
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });
  }

  /**
   * @param {{ query: string, contentId?: string, episodeId?: string, season?: number, episode?: number }} request
   */
  async searchStreams(request) {
    if (!this.enabled) return [];

    const query = this.buildQuery(request);
    if (!query) return [];

    const url = new URL(NYAA_RSS);
    url.searchParams.set("q", query);
    // 1_2 = Anime - English-translated
    url.searchParams.set("c", "1_2");
    url.searchParams.set("f", "0");

    const xml = await this.fetchText(url.toString());
    const parsed = this.parser.parse(xml);
    const items = this.asArray(parsed?.rss?.channel?.item);

    return items
      .map((item) => this.mapItem(item))
      .filter(Boolean)
      .slice(0, 25);
  }

  async health() {
    if (!this.enabled) return { ok: false, detail: "disabled" };
    try {
      const res = await this.fetchImpl(NYAA_RSS + "&q=test&c=1_2", {
        method: "HEAD",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      return { ok: res.ok || res.status === 405, detail: `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, detail: err.message };
    }
  }

  /** @private */
  buildQuery(request) {
    const parts = [];
    if (request.query) parts.push(request.query);
    if (request.season != null && request.episode != null) {
      parts.push(
        `${String(request.season).padStart(2, "0")}x${String(request.episode).padStart(2, "0")}`,
      );
    }
    return parts.join(" ").trim();
  }

  /** @private */
  mapItem(item) {
    const title = item.title || "Unknown";
    const magnet = item.link?.startsWith("magnet:") ? item.link : null;
    const infoHash =
      item["nyaa:infoHash"] ||
      (magnet && magnet.match(/btih:([a-fA-F0-9]{40})/)?.[1]) ||
      null;

    if (!magnet && !infoHash) return null;

    return this.toStreamObject({
      name: "Nyaa",
      title,
      description: [
        item["nyaa:seeders"] != null ? `${item["nyaa:seeders"]} seeds` : null,
        item["nyaa:size"] || null,
        item["nyaa:trusted"] === "Yes" ? "trusted" : null,
      ]
        .filter(Boolean)
        .join(" · "),
      infoHash,
      magnet,
      seeds: Number(item["nyaa:seeders"]) || undefined,
      size: item["nyaa:size"],
      quality: extractQuality(title),
    });
  }

  /** @private */
  asArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  /** @private */
  async fetchText(url) {
    const res = await this.fetchImpl(url, {
      headers: {
        "User-Agent": "KaiMediaProvider/1.0 (+local; anime desktop reader)",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`Nyaa RSS HTTP ${res.status}`);
    }
    return res.text();
  }
}

function extractQuality(title) {
  const m = String(title).match(/\b(2160p|1080p|720p|480p|360p)\b/i);
  return m ? m[1] : null;
}
