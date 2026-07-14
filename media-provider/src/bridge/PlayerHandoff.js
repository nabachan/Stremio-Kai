/**
 * Player handoff bridge.
 *
 * The Stremio Community / Kai desktop shell ultimately opens torrents via
 * infoHash + sources (magnet) or url, then MPV receives the resolved media.
 * SVP / Anime4K / track-selector are driven afterwards by mpv-bridge.js
 * script-messages — they do NOT depend on how the stream URL was obtained.
 *
 * This module packages streams into that same logical envelope so Phase 3 can
 * wire MediaProviderManager → existing player without touching Lua / SVP.
 */

/**
 * @param {import('../contracts.js').PlayerHandoffPayload} handoff
 */
export function buildPlayerHandoffEnvelope(handoff) {
  const { kind, uri, stream, contentId, episodeId, playbackHints } = handoff;

  // Shape expected by a Stremio-compatible player transport layer.
  const stremioCompatibleStream = {
    name: stream.name,
    title: stream.title,
    description: stream.description,
    behaviorHints: stream.behaviorHints || { notWebReady: kind !== "http" },
  };

  if (stream.url) stremioCompatibleStream.url = stream.url;
  if (stream.infoHash) stremioCompatibleStream.infoHash = stream.infoHash;
  if (typeof stream.fileIdx === "number") {
    stremioCompatibleStream.fileIdx = stream.fileIdx;
  }
  if (Array.isArray(stream.sources)) {
    stremioCompatibleStream.sources = stream.sources;
  }

  return {
    version: 1,
    // Primary fields for Kai / Phase 3 integrator
    kind,
    uri,
    contentId,
    episodeId: episodeId || null,
    playbackHints: playbackHints || { is_anime: true },
    // Drop-in stream object for the legacy shell
    stream: stremioCompatibleStream,
    // Explicit mpv loadfile hint (local / resolved HTTP only — magnets stay as uri)
    mpv: {
      // For magnets the native torrent engine must resolve first; do not pass
      // magnet: directly to mpv loadfile (same constraint as stock Stremio-Kai).
      loadfile: kind === "http" || kind === "file" ? uri : null,
      keepOpen: true,
      // EngineFS progressive URL template used by player-handoff-bridge.js
      // (port may be 11470–11474). fileIdx -1 = server-guessed video file.
      streamingServerTemplate:
        kind === "magnet" || kind === "torrent"
          ? "http://127.0.0.1:{port}/{infoHash}/{fileIdx}"
          : null,
      scriptMessages: [
        {
          target: "profile_manager",
          name: "anime-metadata",
          payload: {
            is_anime: playbackHints?.is_anime !== false,
            detection_reason:
              playbackHints?.detection_reason || "kai-media-provider",
            imdb_id: contentId,
            content_type: "series",
          },
        },
      ],
    },
    createdAt: new Date().toISOString(),
  };
}

/**
 * Serialize the WebView2 postMessage payload used by mpv-bridge.js today.
 * Kept here so Phase 3 can reuse the identical transport framing.
 *
 * @param {string} command
 * @param {any[]} args
 */
export function buildWebViewMpvCommand(command, args) {
  return {
    type: 6,
    object: "transport",
    method: "handleInboundJSON",
    args: ["mpv-command", [command, ...args]],
  };
}
