/**
 * @name Kai Player Handoff Bridge
 * @description Phase 3 — wires MediaProviderManager handoffs into the existing
 *              Stremio-Kai → streaming-server → MPV path without touching SVP Lua.
 * @version 1.0.0
 *
 * Flow (identical to stock Stremio stream click once resolved):
 *   handoff.stream { infoHash, sources, fileIdx, url }
 *     → EngineFS create on :11470 (magnets)
 *     → HTTP progressive URL
 *     → chrome.webview postMessage mpv-command loadfile
 *     → synthetic #/player/... route
 *     → anime-metadata script-message (profile_manager / SVP unchanged)
 *
 * Preview / no-shell mode: resolves URL when possible, never loadfiles magnets,
 * exposes window.KaiPlayerHandoff.last for debugging.
 */
(function () {
  "use strict";

  if (window.KaiPlayerHandoff?.initialized) return;

  const STREAM_PORTS = [11470, 11471, 11472, 11473, 11474];
  const CREATE_TIMEOUT_MS = 12_000;

  const api = {
    initialized: true,
    version: "1.0.0",
    last: null,
    lastError: null,
    /** @type {string|null} */
    streamingServerBase: null,

    /**
     * Resolve a playable HTTP/file URL from a Phase-1 handoff envelope.
     * Magnets are never returned for direct mpv loadfile.
     * @param {object} handoff
     * @returns {Promise<{ playableUrl: string|null, mode: string, detail?: string }>}
     */
    async resolvePlayableUrl(handoff) {
      if (!handoff || typeof handoff !== "object") {
        throw new Error("resolvePlayableUrl: handoff required");
      }

      if (handoff.kind === "http" || handoff.kind === "file") {
        const url = handoff.mpv?.loadfile || handoff.uri || handoff.stream?.url;
        if (!url) throw new Error("http/file handoff missing loadfile uri");
        return { playableUrl: url, mode: handoff.kind };
      }

      const stream = handoff.stream || {};
      const infoHash = (stream.infoHash || extractInfoHash(handoff.uri) || "")
        .toLowerCase();
      if (!infoHash) {
        throw new Error("magnet handoff missing infoHash");
      }

      const base = await detectStreamingServer();
      if (!base) {
        return {
          playableUrl: null,
          mode: "magnet-unresolved",
          detail:
            "Streaming server (:11470) offline — lance Stremio-Kai / stremio.exe pour EngineFS.",
        };
      }
      api.streamingServerBase = base;

      await createTorrentSession(base, infoHash, stream, handoff.uri);
      const fileIdx =
        typeof stream.fileIdx === "number" ? stream.fileIdx : -1;
      const playableUrl = `${base}/${infoHash}/${fileIdx}`;
      return { playableUrl, mode: "streaming-server", detail: base };
    },

    /**
     * Full Phase-3 play: resolve → loadfile → wake player route → SVP metadata.
     * @param {object} handoff
     */
    async play(handoff) {
      api.lastError = null;
      try {
        const resolved = await api.resolvePlayableUrl(handoff);
        const record = {
          ...handoff,
          resolved,
          playedAt: new Date().toISOString(),
        };
        api.last = record;

        if (!resolved.playableUrl) {
          api.lastError = resolved.detail || "no playable url";
          console.warn("[KaiPlayerHandoff]", api.lastError);
          window.dispatchEvent(
            new CustomEvent("kai-player-handoff-status", {
              detail: { ok: false, ...record },
            }),
          );
          return record;
        }

        // 1) Same transport framing as mpv-bridge.js / navigation.js
        const loaded = sendMpvCommand("loadfile", [
          resolved.playableUrl,
          "replace",
        ]);

        // 2) Wake RouteDetector / mpv-bridge listeners with a PLAYER hash
        navigateToSyntheticPlayer(handoff);

        // 3) Feed profile_manager the same anime-metadata payload shape
        //    (SVP / Anime4K Lua unchanged — they only listen for this message)
        setTimeout(() => {
          sendAnimeMetadata(handoff);
        }, 250);

        window.dispatchEvent(
          new CustomEvent("kai-player-handoff-status", {
            detail: {
              ok: true,
              loaded,
              playableUrl: resolved.playableUrl,
              mode: resolved.mode,
              webview: !!window.chrome?.webview,
              ...record,
            },
          }),
        );

        console.log(
          `%c[KaiPlayerHandoff] loadfile ${resolved.mode} → ${resolved.playableUrl}`,
          "color: #2dd4a8; font-weight: bold",
        );
        return record;
      } catch (err) {
        api.lastError = err.message || String(err);
        console.error("[KaiPlayerHandoff]", err);
        window.dispatchEvent(
          new CustomEvent("kai-player-handoff-status", {
            detail: { ok: false, error: api.lastError, handoff },
          }),
        );
        throw err;
      }
    },
  };

  function extractInfoHash(uri) {
    if (!uri) return null;
    const m = String(uri).match(/btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
    return m ? m[1] : null;
  }

  function sendMpvCommand(command, args) {
    if (!window.chrome?.webview?.postMessage) {
      console.warn(
        "[KaiPlayerHandoff] chrome.webview unavailable (preview mode) — skipped loadfile",
      );
      return false;
    }
    const payload = {
      type: 6,
      object: "transport",
      method: "handleInboundJSON",
      args: ["mpv-command", [command, ...args]],
    };
    window.chrome.webview.postMessage(JSON.stringify(payload));
    return true;
  }

  function sendAnimeMetadata(handoff) {
    const hints = handoff.playbackHints || {};
    const meta = {
      is_anime: hints.is_anime !== false,
      detection_reason: hints.detection_reason || "kai-media-provider",
      imdb_id: handoff.contentId || hints.imdb_id || null,
      content_type: "series",
      // Prefer live Kai settings so SVP / Anime4K match user prefs
      hdr_passthrough:
        window.MpvSettings?.getHdrPassthrough?.() ||
        localStorage.getItem("kai-hdr-passthrough") === "true",
      shader_preset:
        window.MpvSettings?.getAnime4kPreset?.() ||
        localStorage.getItem("kai-anime4k-preset") ||
        "optimized",
      svp_enabled:
        window.MpvSettings?.getSvpEnabled?.() ??
        localStorage.getItem("kai-svp-enabled") !== "false",
      color_profile:
        window.MpvSettings?.getColorProfile?.() ||
        localStorage.getItem("kai-color-profile") ||
        "kai",
      icc_profile: localStorage.getItem("kai-icc-profile") === "true",
      target_peak: localStorage.getItem("kai-hdr-target-peak") || "auto",
      osd_profile_messages:
        localStorage.getItem("kai-osd-profile-messages") !== "false",
      vulkan_mode: localStorage.getItem("kai-vulkan-api") === "true",
      ultrawide_zoom: localStorage.getItem("kai-ultrawide-zoom") === "true",
      audio_preset: localStorage.getItem("kai-audio-preset") || "off",
    };

    sendMpvCommand("script-message-to", [
      "profile_manager",
      "anime-metadata",
      JSON.stringify(meta),
    ]);

    sendMpvCommand("script-message-to", [
      "notify_skip",
      "content-metadata",
      JSON.stringify({
        content_type: "series",
        imdb_id: handoff.contentId,
      }),
    ]);
  }

  function navigateToSyntheticPlayer(handoff) {
    const id = handoff.contentId || "kai:unknown";
    // Keep a PLAYER route so mpv-bridge + RouteDetector wake up.
    // kai: ids are recognized by the Phase-3 RouteDetector patch.
    const hash = `#/player/series/${encodeURIComponent(id)}/${encodeURIComponent(id)}`;
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    } else {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  }

  async function detectStreamingServer() {
    if (api.streamingServerBase) {
      if (await probeServer(api.streamingServerBase)) return api.streamingServerBase;
      api.streamingServerBase = null;
    }
    for (const port of STREAM_PORTS) {
      const base = `http://127.0.0.1:${port}`;
      if (await probeServer(base)) return base;
    }
    return null;
  }

  async function probeServer(base) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1500);
      const res = await fetch(`${base}/stats.json`, {
        method: "GET",
        signal: ctrl.signal,
      }).catch(() => null);
      clearTimeout(t);
      // Some builds 404 stats at root but still answer create — treat network OK
      if (res) return true;
      // Try a cheap HEAD/GET to base
      const res2 = await fetch(base + "/", {
        method: "GET",
        signal: AbortSignal.timeout(1500),
      }).catch(() => null);
      return !!(res2 && (res2.ok || res2.status === 404 || res2.status === 405));
    } catch {
      return false;
    }
  }

  async function createTorrentSession(base, infoHash, stream, magnetUri) {
    const sources = Array.isArray(stream.sources) && stream.sources.length
      ? stream.sources
      : magnetUri
        ? [magnetUri]
        : [`magnet:?xt=urn:btih:${infoHash}`];

    const announce = extractTrackers(sources[0]);
    const body = {
      peerSearch: { sources },
    };
    if (announce.length) body.announce = announce;

    const url = `${base}/${infoHash}/create`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CREATE_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      // 200/404 variants still often create; non-network failure is OK to proceed
      if (!res.ok && res.status >= 500) {
        throw new Error(`streaming-server create HTTP ${res.status}`);
      }
      return res.json().catch(() => ({}));
    } finally {
      clearTimeout(timer);
    }
  }

  function extractTrackers(magnet) {
    if (!magnet || !magnet.includes("tr=")) return [];
    try {
      const out = [];
      const re = /[?&]tr=([^&]+)/g;
      let m;
      while ((m = re.exec(magnet))) {
        out.push(decodeURIComponent(m[1].replace(/\+/g, " ")));
      }
      return out;
    } catch {
      return [];
    }
  }

  // Auto-wire Phase 2 catalog Play events
  window.addEventListener("kai-player-handoff", (ev) => {
    const handoff = ev.detail;
    if (!handoff) return;
    api.play(handoff).catch(() => {});
  });

  window.KaiPlayerHandoff = api;
  console.log(
    "%c[KaiPlayerHandoff] Phase 3 bridge ready",
    "color: #2dd4a8; font-weight: bold",
  );
})();
