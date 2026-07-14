import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BaseProvider } from "./BaseProvider.js";
import { PROVIDER_IDS } from "../contracts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA = path.resolve(__dirname, "../../data/fake-catalog.json");

/**
 * Offline / deterministic provider used to validate the player bridge.
 * Returns real public-domain open-movie magnets so playback can be tested
 * without depending on Stremio addons or live torrent indexers.
 */
export class FakeDataProvider extends BaseProvider {
  /**
   * @param {{ dataPath?: string, enabled?: boolean }} [options]
   */
  constructor(options = {}) {
    super({
      id: PROVIDER_IDS.FAKE,
      name: "Fake Data (test magnets)",
      enabled: options.enabled !== false,
      priority: 0,
    });
    this.dataPath = options.dataPath || DEFAULT_DATA;
    /** @type {any} */
    this.data = null;
  }

  async init() {
    const raw = await readFile(this.dataPath, "utf8");
    this.data = JSON.parse(raw);
    if (!this.data?.metas?.length) {
      throw new Error("FakeDataProvider: fake-catalog.json has no metas");
    }
    if (!this.data?.testPlayables?.bigBuckBunny) {
      throw new Error("FakeDataProvider: missing testPlayables.bigBuckBunny");
    }
  }

  /** @returns {any[]} */
  listCatalogs() {
    return this.data?.catalogs || [];
  }

  /**
   * @param {string} catalogId
   * @returns {import('../contracts.js').MetaPreview[]}
   */
  getCatalog(catalogId) {
    const metas = this.data?.metas || [];
    return metas
      .filter((m) => (m.catalogIds || []).includes(catalogId))
      .map((m) => this.toPreview(m));
  }

  /** @returns {import('../contracts.js').MetaPreview[]} */
  getAllPreviews() {
    return (this.data?.metas || []).map((m) => this.toPreview(m));
  }

  /**
   * @param {string} id
   * @returns {any|null}
   */
  getMeta(id) {
    const meta = (this.data?.metas || []).find((m) => m.id === id);
    return meta ? structuredClone(meta) : null;
  }

  /**
   * @param {string} query
   * @returns {import('../contracts.js').MetaPreview[]}
   */
  searchCatalog(query) {
    const q = String(query || "")
      .trim()
      .toLowerCase();
    if (!q) return this.getAllPreviews();
    return (this.data?.metas || [])
      .filter((m) => {
        const hay = [m.name, m.description, ...(m.genres || [])]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .map((m) => this.toPreview(m));
  }

  /**
   * Always emit 2–3 playable test streams so the video bridge can be verified.
   * Labels reference the anime title; magnets point at open movies (CC/PD).
   *
   * @param {{ query: string, contentId?: string, episodeId?: string, season?: number, episode?: number }} request
   */
  async searchStreams(request) {
    const playables = this.data.testPlayables;
    const meta = request.contentId ? this.getMeta(request.contentId) : null;
    const label = meta?.name || request.query || "Test";
    const ep =
      request.season != null && request.episode != null
        ? ` S${String(request.season).padStart(2, "0")}E${String(request.episode).padStart(2, "0")}`
        : "";

    const pack = [
      ["bigBuckBunny", "1080p · Fake / OpenMovie"],
      ["sintel", "1080p · Fake / OpenMovie"],
      ["tearsOfSteel", "1080p · Fake / OpenMovie"],
    ];

    return pack.map(([key, quality], idx) => {
      const p = playables[key];
      return this.toStreamObject({
        name: `Fake ${quality}`,
        title: `[TEST] ${label}${ep} · ${p.name}`,
        description: `Deterministic test magnet #${idx + 1} — public-domain open movie (not the anime encode).`,
        infoHash: p.infoHash,
        magnet: p.magnet,
        fileIdx: p.fileIdx ?? 0,
        quality,
        seeds: 999 - idx,
        size: "≈700MB",
      });
    });
  }

  /** @private */
  toPreview(meta) {
    return {
      id: meta.id,
      type: meta.type || "anime",
      name: meta.name,
      poster: meta.poster,
      background: meta.background,
      description: meta.description,
      releaseInfo: meta.releaseInfo,
      genres: meta.genres,
      imdbRating: meta.imdbRating,
    };
  }
}
