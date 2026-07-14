# Kai — restart from official Stremio base

## What went wrong before
The previous branches (`media-provider-manager`, anime-catalog overlay) patched **allecsc/Stremio-Kai portable_config only** — an overlay of configs/webmods, **not** the real Stremio client. That could never become “100% similar to Stremio Kai” as a full program.

## Correct base (this branch)
Official source from [github.com/Stremio](https://github.com/Stremio):

| Component | Path | Upstream |
|-----------|------|----------|
| **UI client** | `stremio-web/` | [Stremio/stremio-web](https://github.com/Stremio/stremio-web) (`development`) |
| **Local anime engine** | `media-provider/` | Stremio-compatible addon protocol on `:8765` |
| **MPV / SVP profiles** | `portable_config/` | Kept for desktop shell (Kai/CE) — player path intact |

## Phase 1 (this commit) — on real stremio-web
- No Intro / Stremio login (always local anonymous)
- Addons UI + Calendar removed from nav
- Cloud sync (`PullAddonsFromAPI`, user, library) disabled
- `KaiBootstrap` installs **only** `http://127.0.0.1:8765/manifest.json` and uninstalls other addons
- Catalog/meta/stream types = `series` (Solo Leveling, AoT, …) so Board / MetaDetails / Player stay stock

**Player (`Player.js`, `usePlayer`, `stremio-video`) is not modified.**

## One-click run (Windows)

```bat
start-kai-web.bat
```

Or manually:

```bat
cd media-provider && npm install && npm start
cd stremio-web && pnpm install && pnpm start
```

Open the webpack URL, Board should list Kai anime catalogs from `:8765`.

## Next (Phase 2–3 on this base)
- Anime-first Board/Discover styling inside `stremio-web` components
- Desktop shell: [stremio-shell-ng](https://github.com/Stremio/stremio-shell-ng) (WebView2+MPV) + `portable_config` SVP
- Magnet → EngineFS `:11470` → stock player path

## License
`stremio-web` remains GPLv2 (Smart Code). This fork must keep license notices.
