/**
 * @name Kai Media Provider Client
 * @description Thin browser client for the local MediaProviderManager HTTP API.
 * @version 1.0.0
 *
 * Phase 1: exposes window.KaiMediaProvider for manual / smoke testing from DevTools.
 * Phase 2/3: UI catalog + player handoff will consume this client.
 *
 * Default base: http://127.0.0.1:8765
 * Override: localStorage.setItem('kai-media-provider-url', 'http://127.0.0.1:8765')
 */
(function () {
  "use strict";

  if (window.KaiMediaProvider?.initialized) return;

  const DEFAULT_BASE = "http://127.0.0.1:8765";

  function getBase() {
    try {
      return (
        localStorage.getItem("kai-media-provider-url") ||
        window.KAI_MEDIA_PROVIDER_URL ||
        DEFAULT_BASE
      );
    } catch {
      return DEFAULT_BASE;
    }
  }

  async function request(path) {
    const base = getBase().replace(/\/$/, "");
    const res = await fetch(`${base}${path}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`KaiMediaProvider ${res.status}: ${body || res.statusText}`);
    }
    return res.json();
  }

  const api = {
    initialized: true,
    getBase,
    health: () => request("/health"),
    manifest: () => request("/manifest.json"),
    catalog: (catalogId = "anime-featured") =>
      request(`/catalog/anime/${encodeURIComponent(catalogId)}.json`),
    search: (q) =>
      request(`/search?q=${encodeURIComponent(q || "")}`),
    meta: (id) =>
      request(`/meta/anime/${encodeURIComponent(id)}.json`),
    streams: (id) =>
      request(`/stream/anime/${encodeURIComponent(id)}.json`),
    /**
     * Returns the Phase-1 player handoff envelope (magnet → shell contract).
     * Does NOT mutate MPV yet — Phase 3 wires this into the transport.
     */
    play: (contentId, { episodeId, index = 0 } = {}) => {
      const params = new URLSearchParams();
      if (episodeId) params.set("episodeId", episodeId);
      params.set("index", String(index));
      const qs = params.toString();
      return request(`/play/${encodeURIComponent(contentId)}${qs ? `?${qs}` : ""}`);
    },
  };

  window.KaiMediaProvider = api;
  console.log(
    "%c[KaiMediaProvider] client ready → " + getBase(),
    "color: #e85d04; font-weight: bold",
  );
})();
