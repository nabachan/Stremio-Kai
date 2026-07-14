import { BaseProvider } from "./BaseProvider.js";
import { PROVIDER_IDS } from "../contracts.js";

const API_BAY = "https://apibay.org/q.php";

/**
 * The Pirate Bay provider via the public apibay.org JSON API.
 * Disabled by default; enable with MEDIA_PROVIDERS=fake,piratebay
 */
export class PirateBayProvider extends BaseProvider {
  /**
   * @param {{ enabled?: boolean, fetchImpl?: typeof fetch, timeoutMs?: number }} [options]
   */
  constructor(options = {}) {
    super({
      id: PROVIDER_IDS.PIRATEBAY,
      name: "The Pirate Bay",
      enabled: options.enabled === true,
      priority: 40,
    });
    this.fetchImpl = options.fetchImpl || fetch;
    this.timeoutMs = options.timeoutMs || 12_000;
  }

  /**
   * @param {{ query: string, contentId?: string, episodeId?: string, season?: number, episode?: number }} request
   */
  async searchStreams(request) {
    if (!this.enabled) return [];
    const q = this.buildQuery(request);
    if (!q) return [];

    const url = new URL(API_BAY);
    url.searchParams.set("q", q);
    // 200 = Video category (tpb), 205 = TV shows often used; keep video-wide
    url.searchParams.set("cat", "200");

    const rows = await this.fetchJson(url.toString());
    if (!Array.isArray(rows) || rows.length === 0) return [];
    if (rows.length === 1 && rows[0]?.id === "0") return [];

    return rows
      .map((row) => this.mapRow(row))
      .filter(Boolean)
      .slice(0, 25);
  }

  async health() {
    if (!this.enabled) return { ok: false, detail: "disabled" };
    try {
      const url = `${API_BAY}?q=ubuntu&cat=200`;
      const res = await this.fetchImpl(url, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      return { ok: res.ok, detail: `HTTP ${res.status}` };
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
        `S${String(request.season).padStart(2, "0")}E${String(request.episode).padStart(2, "0")}`,
      );
    }
    return parts.join(" ").trim();
  }

  /** @private */
  mapRow(row) {
    const infoHash = row.info_hash;
    if (!infoHash || infoHash === "0000000000000000000000000000000000000000") {
      return null;
    }
    const title = row.name || "Unknown";
    const magnet = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(title)}`;

    return this.toStreamObject({
      name: "TPB",
      title,
      infoHash,
      magnet,
      seeds: Number(row.seeders) || undefined,
      size: formatBytes(Number(row.size) || 0),
      quality: extractQuality(title),
    });
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
    if (!res.ok) throw new Error(`PirateBay API HTTP ${res.status}`);
    return res.json();
  }
}

function formatBytes(n) {
  if (!n) return null;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function extractQuality(title) {
  const m = String(title).match(/\b(2160p|1080p|720p|480p|360p)\b/i);
  return m ? m[1] : null;
}
