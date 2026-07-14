import { URL } from "node:url";

/**
 * Minimal zero-dependency HTTP router for MediaProviderManager.
 * @param {import('../MediaProviderManager.js').MediaProviderManager} manager
 */
export function createApiHandler(manager) {
  return async function handle(req, res) {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const { pathname } = url;

    setCors(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      if (req.method === "GET" && pathname === "/health") {
        return sendJson(res, 200, await manager.health());
      }

      if (req.method === "GET" && (pathname === "/" || pathname === "/manifest.json")) {
        return sendJson(res, 200, manager.getManifest());
      }

      // GET /catalog/:type/:id.json
      let m = pathname.match(/^\/catalog\/([^/]+)\/([^/]+)\.json$/);
      if (req.method === "GET" && m) {
        const catalogId = decodeURIComponent(m[2]);
        return sendJson(res, 200, manager.getCatalog(catalogId));
      }

      // GET /catalog/:type/search/:query.json  OR  /search?q=
      m = pathname.match(/^\/catalog\/([^/]+)\/search\/([^/]+)\.json$/);
      if (req.method === "GET" && m) {
        return sendJson(res, 200, manager.search(decodeURIComponent(m[2])));
      }
      if (req.method === "GET" && pathname === "/search") {
        return sendJson(res, 200, manager.search(url.searchParams.get("q") || ""));
      }

      // GET /meta/:type/:id.json
      m = pathname.match(/^\/meta\/([^/]+)\/([^/]+)\.json$/);
      if (req.method === "GET" && m) {
        const id = decodeURIComponent(m[2]);
        const result = manager.getMeta(id);
        if (!result) return sendJson(res, 404, { error: "meta not found", id });
        return sendJson(res, 200, result);
      }

      // GET /stream/:type/:id.json   id may be kai:solo-leveling or kai:solo-leveling:1:1
      m = pathname.match(/^\/stream\/([^/]+)\/(.+)\.json$/);
      if (req.method === "GET" && m) {
        const rawId = decodeURIComponent(m[2]);
        const { contentId, episodeId } = splitContentId(rawId);
        const result = await manager.getStreams({ contentId, episodeId, type: m[1] });
        return sendJson(res, 200, result);
      }

      // GET /play/:contentId  optional ?episodeId=&index=
      m = pathname.match(/^\/play\/(.+)$/);
      if (req.method === "GET" && m) {
        const contentId = decodeURIComponent(m[1]);
        const episodeId = url.searchParams.get("episodeId") || undefined;
        const streamIndex = Number(url.searchParams.get("index") || "0");
        const handoff = await manager.buildPlayerHandoff({
          contentId,
          episodeId,
          streamIndex,
        });
        return sendJson(res, 200, handoff);
      }

      if (req.method === "GET" && pathname === "/providers") {
        const health = await manager.health();
        return sendJson(res, 200, health.providers);
      }

      sendJson(res, 404, {
        error: "not_found",
        hint: "Try /manifest.json, /catalog/anime/anime-featured.json, /meta/anime/kai:solo-leveling.json, /stream/anime/kai:solo-leveling.json, /play/kai:solo-leveling",
      });
    } catch (err) {
      console.error("[API]", err);
      sendJson(res, 500, {
        error: "internal_error",
        message: err.message || String(err),
      });
    }
  };
}

function splitContentId(rawId) {
  // Episode ids look like kai:solo-leveling:1:1 (prefix:slug:season:episode)
  const parts = rawId.split(":");
  if (parts.length >= 4 && parts[0] === "kai") {
    const season = parts[parts.length - 2];
    const episode = parts[parts.length - 1];
    if (/^\d+$/.test(season) && /^\d+$/.test(episode)) {
      const contentId = parts.slice(0, -2).join(":");
      return { contentId, episodeId: rawId };
    }
  }
  return { contentId: rawId, episodeId: undefined };
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(payload);
}
