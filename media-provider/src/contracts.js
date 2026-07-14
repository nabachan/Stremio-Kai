/**
 * Shared contracts for MediaProviderManager.
 * Stream objects mirror the Stremio stream object shape so the existing
 * desktop shell → MPV handoff stays byte-compatible (SVP / hardware path unchanged).
 */

/**
 * @typedef {Object} MetaPreview
 * @property {string} id
 * @property {"anime"|"movie"|"series"} type
 * @property {string} name
 * @property {string} [poster]
 * @property {string} [background]
 * @property {string} [description]
 * @property {string} [releaseInfo]
 * @property {string[]} [genres]
 * @property {string} [imdbRating]
 */

/**
 * @typedef {Object} StreamObject
 * @property {string} [url]            HTTP progressive / local file path
 * @property {string} [ytId]
 * @property {string} [infoHash]       Torrent info-hash (preferred for magnets)
 * @property {number} [fileIdx]
 * @property {string[]} [sources]      magnet / tracker sources
 * @property {string} [title]
 * @property {string} [name]
 * @property {string} [description]
 * @property {Object} [behaviorHints]
 * @property {string} [provider]       Kai extension: which provider produced this
 */

/**
 * @typedef {Object} PlayerHandoffPayload
 * @property {"magnet"|"torrent"|"http"|"file"} kind
 * @property {string} uri                 Raw URI passed to the player engine
 * @property {StreamObject} stream        Original stream object
 * @property {string} contentId
 * @property {string} [episodeId]
 * @property {Object} [playbackHints]     Anime / SVP hints for mpv-bridge
 */

export const PROVIDER_IDS = Object.freeze({
  FAKE: "fake",
  NYAA: "nyaa",
  PIRATEBAY: "piratebay",
  YGG: "ygg",
});

export const DEFAULT_PORT = 8765;

/**
 * Normalize a magnet / torrent / http / file into the player handoff contract
 * used by the legacy Stremio→MPV path.
 *
 * @param {StreamObject} stream
 * @param {{ contentId: string, episodeId?: string, playbackHints?: object }} ctx
 * @returns {PlayerHandoffPayload}
 */
export function toPlayerHandoff(stream, ctx) {
  if (!stream || typeof stream !== "object") {
    throw new Error("toPlayerHandoff: stream is required");
  }
  if (!ctx?.contentId) {
    throw new Error("toPlayerHandoff: contentId is required");
  }

  let kind = "http";
  let uri = stream.url || "";

  if (Array.isArray(stream.sources) && stream.sources.length > 0) {
    const magnet = stream.sources.find((s) => String(s).startsWith("magnet:"));
    if (magnet) {
      kind = "magnet";
      uri = magnet;
    }
  }

  if (!uri && stream.infoHash) {
    kind = "magnet";
    uri = `magnet:?xt=urn:btih:${stream.infoHash}`;
    if (stream.name || stream.title) {
      uri += `&dn=${encodeURIComponent(stream.name || stream.title)}`;
    }
  }

  if (uri.startsWith("magnet:")) kind = "magnet";
  else if (uri.startsWith("file:") || /^[A-Za-z]:\\/.test(uri) || uri.startsWith("/"))
    kind = "file";
  else if (uri.endsWith(".torrent") || stream.infoHash) kind = "torrent";

  if (!uri) {
    throw new Error("toPlayerHandoff: stream has no playable uri/infoHash/sources");
  }

  return {
    kind,
    uri,
    stream: { ...stream },
    contentId: ctx.contentId,
    episodeId: ctx.episodeId,
    playbackHints: {
      is_anime: true,
      ...(ctx.playbackHints || {}),
    },
  };
}

/**
 * Lightweight runtime validation for stream objects before handoff.
 * @param {StreamObject} stream
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateStream(stream) {
  const errors = [];
  if (!stream) errors.push("stream is null");
  else {
    const hasLocator =
      !!stream.url ||
      !!stream.infoHash ||
      (Array.isArray(stream.sources) && stream.sources.length > 0);
    if (!hasLocator) errors.push("missing url/infoHash/sources");
  }
  return { ok: errors.length === 0, errors };
}
