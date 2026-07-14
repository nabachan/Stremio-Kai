/**
 * Abstract torrent / catalog provider.
 * All concrete providers must implement searchStreams + optional catalog hooks.
 */
export class BaseProvider {
  /**
   * @param {{ id: string, name: string, enabled?: boolean, priority?: number }} options
   */
  constructor(options) {
    if (new.target === BaseProvider) {
      throw new Error("BaseProvider is abstract");
    }
    this.id = options.id;
    this.name = options.name;
    this.enabled = options.enabled !== false;
    this.priority = options.priority ?? 100;
  }

  /** @returns {Promise<void>} */
  async init() {}

  /**
   * Search streams for a title / episode query.
   * @param {{ query: string, contentId?: string, episodeId?: string, season?: number, episode?: number }} _request
   * @returns {Promise<import('./contracts.js').StreamObject[]>}
   */
  async searchStreams(_request) {
    throw new Error(`${this.id}: searchStreams() not implemented`);
  }

  /**
   * Optional health probe.
   * @returns {Promise<{ ok: boolean, detail?: string }>}
   */
  async health() {
    return { ok: this.enabled, detail: this.enabled ? "enabled" : "disabled" };
  }

  /**
   * Normalize provider-specific rows into Stremio-compatible StreamObjects.
   * @protected
   */
  toStreamObject({
    title,
    name,
    description,
    infoHash,
    magnet,
    url,
    fileIdx,
    seeds,
    size,
    quality,
  }) {
    const stream = {
      provider: this.id,
      name: name || this.name,
      title: title || name || "Unknown",
      description:
        description ||
        [quality, size, seeds != null ? `${seeds} seeds` : null]
          .filter(Boolean)
          .join(" · "),
    };

    if (url) stream.url = url;
    if (infoHash) stream.infoHash = String(infoHash).toLowerCase();
    if (typeof fileIdx === "number") stream.fileIdx = fileIdx;
    if (magnet) {
      stream.sources = [magnet];
    } else if (stream.infoHash) {
      stream.sources = [`magnet:?xt=urn:btih:${stream.infoHash}`];
    }

    stream.behaviorHints = {
      bingeGroup: `kai-${this.id}`,
      notWebReady: !url,
    };

    return stream;
  }
}
