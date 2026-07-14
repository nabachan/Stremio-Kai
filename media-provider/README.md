# Kai Media Provider (Phase 1)

Standalone backend that **replaces Stremio login + remote addons** for catalog / meta / stream resolution.

The MPV / SVP / Anime4K stack in `portable_config/` is **untouched**. This layer only supplies JSON catalogs and magnet streams, plus a player-handoff envelope that Phase 3 will wire into the existing transport.

## One-click run

```bash
cd media-provider
./scripts/start.sh          # Linux / macOS
# or: scripts\start.bat     # Windows
```

Server listens on `http://127.0.0.1:8765`.

## Smoke test (no network scrapers needed)

```bash
cd media-provider
npm install
npm test
```

## API

| Endpoint | Purpose |
|----------|---------|
| `GET /manifest.json` | Local “addon” manifest (anime only) |
| `GET /catalog/anime/anime-featured.json` | Featured grid (Solo Leveling, AoT, …) |
| `GET /meta/anime/kai:solo-leveling.json` | Full meta + episodes |
| `GET /stream/anime/kai:solo-leveling.json` | Aggregated magnet streams |
| `GET /stream/anime/kai:solo-leveling:1:1.json` | Episode-scoped streams |
| `GET /play/kai:solo-leveling` | Player handoff envelope (magnet → shell contract) |
| `GET /health` | Provider health |

## Providers

| ID | Default | Notes |
|----|---------|-------|
| `fake` | **on** (required) | Deterministic public-domain open-movie magnets for bridge tests |
| `nyaa` | off | Nyaa.si RSS (`c=1_2`) |
| `piratebay` | off | apibay.org JSON |
| `ygg` | off | Requires `MEDIA_YGG_PROXY_URL` (no embedded scraper) |

```bash
MEDIA_PROVIDERS=fake,nyaa,piratebay npm start
```

## Player handoff contract

`GET /play/:contentId` returns:

- `kind`: `magnet` | `http` | `file` | `torrent`
- `uri`: raw URI for the torrent engine (magnets are **not** passed to `mpv loadfile` — same as stock Stremio-Kai)
- `stream`: Stremio-compatible `{ infoHash, sources, fileIdx, … }`
- `mpv.scriptMessages`: same `profile_manager` / `anime-metadata` shape used by `mpv-bridge.js`

Fake streams use **Big Buck Bunny / Sintel / Tears of Steel** magnets so you can validate the bridge with legal open movies while catalog posters show intense anime titles for UI calibration.
