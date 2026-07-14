/**
 * Kai Anime Catalog — Phase 2 home overlay
 * Cinematic poster grid fed by MediaProviderManager (Phase 1).
 * Hides native Stremio board rows; reuses poster class names for Theme / nav / hover.
 */
(function () {
  "use strict";

  if (window.KaiAnimeCatalog?.initialized) return;
  window.KaiAnimeCatalog = { initialized: true, version: "1.0.0" };

  const CATALOGS = [
    { id: "anime-featured", label: "Featured" },
    { id: "anime-action", label: "Action" },
    { id: "anime-deep", label: "Deep intrigue" },
  ];

  const state = {
    root: null,
    detail: null,
    busy: false,
    observer: null,
    catalogCache: new Map(),
    activeCatalog: "anime-featured",
    searchQuery: "",
    selectedId: null,
  };

  function isBoardHome() {
    const h = window.location.hash;
    return h === "#/" || h === "" || h === "#";
  }

  function api() {
    return window.KaiMediaProvider;
  }

  async function waitForClient(timeoutMs = 8000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (api()?.catalog) return true;
      await sleep(100);
    }
    return false;
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function findParent() {
    return document.querySelector(".nav-content-container-zl9hQ");
  }

  function ensureStyles() {
    if (document.getElementById("kai-anime-catalog-css")) return;
    // CSS is shipped as Theme/AnimeCatalog.css when the shell loads theme files.
    // Fallback inline link if a relative theme load is available via webmods folder.
    const link = document.createElement("link");
    link.id = "kai-anime-catalog-css";
    link.rel = "stylesheet";
    // Prefer already-injected Theme path; if missing, styles still apply via Main import.
    link.href = "webmods/Theme/AnimeCatalog.css";
    document.head.appendChild(link);
  }

  function createRoot() {
    const el = document.createElement("div");
    el.className = "kai-anime-catalog";
    el.dataset.kaiRoot = "1";
    el.innerHTML = `
      <section class="kai-cat-hero" aria-label="Featured anime">
        <div class="kai-cat-hero-bg" data-role="hero-bg"></div>
        <div class="kai-cat-hero-veil"></div>
        <div class="kai-cat-hero-copy">
          <p class="kai-cat-brand">KAI</p>
          <h1 class="kai-cat-headline" data-role="hero-title">Anime Catalog</h1>
          <p class="kai-cat-lede" data-role="hero-lede">Intense worlds. One grid. Zero Stremio addons.</p>
          <div class="kai-cat-cta">
            <button type="button" class="kai-cat-btn kai-cat-btn-primary" data-action="open-featured">Open featured</button>
            <button type="button" class="kai-cat-btn kai-cat-btn-ghost" data-action="retry">Refresh</button>
          </div>
        </div>
      </section>
      <section class="kai-cat-toolbar" aria-label="Catalog filters">
        <div class="kai-cat-tabs" data-role="tabs"></div>
        <label class="kai-cat-search">
          <span class="kai-cat-sr">Search</span>
          <input type="search" placeholder="Search anime…" data-role="search" autocomplete="off" />
        </label>
      </section>
      <section class="kai-cat-grid-wrap">
        <div class="kai-cat-status" data-role="status">Loading catalog…</div>
        <div class="meta-items-container-n8vNz kai-cat-grid" data-role="grid" hidden></div>
      </section>
      <aside class="kai-cat-detail" data-role="detail" hidden aria-hidden="true"></aside>
    `;
    return el;
  }

  function mount() {
    if (!isBoardHome()) {
      unmount();
      return;
    }
    const parent = findParent();
    if (!parent) return;

    document.body.classList.add("kai-anime-home");
    ensureStyles();

    if (!state.root || !parent.contains(state.root)) {
      state.root = createRoot();
      // Place under hero if present, else prepend
      const hero = parent.querySelector(".hero-container");
      if (hero && hero.nextSibling) parent.insertBefore(state.root, hero.nextSibling);
      else if (hero) parent.appendChild(state.root);
      else parent.prepend(state.root);
      bindRoot(state.root);
    }

    // Hide / neutralize legacy hero banner on anime-only home
    document.body.classList.remove("hero-active");
    parent.querySelectorAll(".hero-container").forEach((n) => {
      n.style.display = "none";
    });

    if (!state.busy) loadAndRender();
  }

  function unmount() {
    document.body.classList.remove("kai-anime-home");
    if (state.root) {
      state.root.remove();
      state.root = null;
    }
  }

  function bindRoot(root) {
    root.querySelector('[data-action="retry"]')?.addEventListener("click", () => {
      state.catalogCache.clear();
      loadAndRender(true);
    });
    root.querySelector('[data-action="open-featured"]')?.addEventListener("click", () => {
      const first = root.querySelector(".kai-cat-poster");
      first?.click();
    });
    root.querySelector('[data-role="search"]')?.addEventListener("input", (e) => {
      state.searchQuery = e.target.value || "";
      debounceSearch();
    });
  }

  let searchTimer = null;
  function debounceSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadAndRender(true), 220);
  }

  function setStatus(msg, isError = false) {
    const el = state.root?.querySelector('[data-role="status"]');
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || "";
    el.classList.toggle("is-error", !!isError);
  }

  async function fetchCatalog(id) {
    if (state.catalogCache.has(id)) return state.catalogCache.get(id);
    const client = api();
    if (!client) throw new Error("KaiMediaProvider client missing");
    const data = await client.catalog(id);
    const metas = data?.metas || [];
    state.catalogCache.set(id, metas);
    return metas;
  }

  async function loadAndRender(force = false) {
    if (!state.root) return;
    state.busy = true;
    const grid = state.root.querySelector('[data-role="grid"]');
    const tabs = state.root.querySelector('[data-role="tabs"]');

    renderTabs(tabs);

    try {
      const ready = await waitForClient();
      if (!ready) throw new Error("Media provider client not loaded");

      // Quick health (non-fatal if CORS/offline message clearer)
      try {
        const h = await api().health();
        if (!h?.ok) throw new Error("MediaProviderManager offline");
      } catch (e) {
        throw new Error(
          "MediaProviderManager offline — lance start-media-provider.bat (port 8765).",
        );
      }

      let metas;
      const q = state.searchQuery.trim();
      if (q) {
        const res = await api().search(q);
        metas = res?.metas || [];
      } else {
        metas = await fetchCatalog(state.activeCatalog);
      }

      renderHero(metas[0] || null);
      renderGrid(grid, metas);
      setStatus(metas.length ? "" : "Aucun titre dans ce catalogue.");
      grid.hidden = metas.length === 0;
    } catch (err) {
      console.error("[KaiAnimeCatalog]", err);
      setStatus(String(err.message || err), true);
      if (grid) {
        grid.hidden = true;
        grid.innerHTML = "";
      }
    } finally {
      state.busy = false;
    }
  }

  function renderTabs(tabsEl) {
    if (!tabsEl) return;
    tabsEl.innerHTML = CATALOGS.map(
      (c) => `
      <button type="button"
        class="kai-cat-tab${c.id === state.activeCatalog ? " is-active" : ""}"
        data-catalog="${c.id}">${c.label}</button>`,
    ).join("");
    tabsEl.querySelectorAll("[data-catalog]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeCatalog = btn.getAttribute("data-catalog");
        state.searchQuery = "";
        const input = state.root.querySelector('[data-role="search"]');
        if (input) input.value = "";
        loadAndRender(true);
      });
    });
  }

  function renderHero(meta) {
    if (!state.root) return;
    const bg = state.root.querySelector('[data-role="hero-bg"]');
    const title = state.root.querySelector('[data-role="hero-title"]');
    const lede = state.root.querySelector('[data-role="hero-lede"]');
    if (!meta) {
      if (title) title.textContent = "Anime Catalog";
      if (lede) lede.textContent = "Intense worlds. One grid. Zero Stremio addons.";
      if (bg) bg.style.backgroundImage = "";
      return;
    }
    if (title) title.textContent = meta.name;
    if (lede)
      lede.textContent =
        meta.description?.slice(0, 140) +
        (meta.description?.length > 140 ? "…" : "");
    if (bg) {
      const url = meta.background || meta.poster;
      bg.style.backgroundImage = url ? `url("${url}")` : "";
    }
    state.root.querySelector('[data-action="open-featured"]').onclick = () =>
      openDetail(meta.id);
  }

  function renderGrid(grid, metas) {
    if (!grid) return;
    grid.innerHTML = "";
    metas.forEach((meta, index) => {
      const a = document.createElement("a");
      a.href = `#kai-meta/${encodeURIComponent(meta.id)}`;
      a.className = "meta-item-container-Tj0Ib kai-cat-poster";
      a.tabIndex = 0;
      a.dataset.id = meta.id;
      a.style.setProperty("--kai-stagger", `${Math.min(index, 12) * 40}ms`);
      a.innerHTML = `
        <div class="poster-container-qkw48">
          <div class="poster-image-layer-KimPZ">
            <img class="poster-image-NiV7O" src="${escapeAttr(meta.poster || "")}" alt="${escapeAttr(meta.name)}" loading="lazy" />
          </div>
          <div class="kai-cat-poster-meta">
            <span class="kai-cat-poster-title">${escapeHtml(meta.name)}</span>
            <span class="kai-cat-poster-sub">${escapeHtml(
              [meta.releaseInfo, meta.imdbRating ? `★ ${meta.imdbRating}` : null]
                .filter(Boolean)
                .join(" · "),
            )}</span>
          </div>
        </div>
      `;
      a.addEventListener("click", (e) => {
        e.preventDefault();
        openDetail(meta.id);
      });
      a.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDetail(meta.id);
        }
      });
      grid.appendChild(a);
    });
  }

  async function openDetail(id) {
    state.selectedId = id;
    const panel = state.root?.querySelector('[data-role="detail"]');
    if (!panel) return;
    panel.hidden = false;
    panel.setAttribute("aria-hidden", "false");
    panel.classList.add("is-open");
    panel.innerHTML = `<div class="kai-cat-detail-card"><p class="kai-cat-detail-loading">Loading…</p></div>`;

    try {
      const { meta } = await api().meta(id);
      const streamsPack = await api().streams(id);
      const streams = streamsPack?.streams || [];
      panel.innerHTML = buildDetailHtml(meta, streams);
      panel.querySelector("[data-close]")?.addEventListener("click", closeDetail);
      panel.querySelector("[data-backdrop]")?.addEventListener("click", closeDetail);
      panel.querySelectorAll("[data-play]").forEach((btn) => {
        btn.addEventListener("click", () =>
          handlePlay(id, Number(btn.getAttribute("data-play") || 0)),
        );
      });
    } catch (err) {
      panel.innerHTML = `<div class="kai-cat-detail-card"><p class="is-error">${escapeHtml(err.message)}</p><button type="button" data-close class="kai-cat-btn">Close</button></div>`;
      panel.querySelector("[data-close]")?.addEventListener("click", closeDetail);
    }
  }

  function closeDetail() {
    const panel = state.root?.querySelector('[data-role="detail"]');
    if (!panel) return;
    panel.classList.remove("is-open");
    panel.hidden = true;
    panel.setAttribute("aria-hidden", "true");
    panel.innerHTML = "";
    state.selectedId = null;
  }

  function buildDetailHtml(meta, streams) {
    const eps = (meta.episodes || [])
      .slice(0, 8)
      .map(
        (ep) =>
          `<li><strong>S${ep.season}E${ep.episode}</strong> ${escapeHtml(ep.title || "")}</li>`,
      )
      .join("");

    const streamRows = streams
      .map(
        (s, i) => `
      <li class="kai-cat-stream">
        <div>
          <strong>${escapeHtml(s.name || s.provider || "Stream")}</strong>
          <span>${escapeHtml(s.title || "")}</span>
        </div>
        <button type="button" class="kai-cat-btn kai-cat-btn-primary" data-play="${i}">Play</button>
      </li>`,
      )
      .join("");

    return `
      <div class="kai-cat-detail-backdrop" data-backdrop></div>
      <div class="kai-cat-detail-card" role="dialog" aria-modal="true" aria-label="${escapeAttr(meta.name)}">
        <button type="button" class="kai-cat-detail-close" data-close aria-label="Close">×</button>
        <div class="kai-cat-detail-layout">
          <img class="kai-cat-detail-poster" src="${escapeAttr(meta.poster || "")}" alt="" />
          <div class="kai-cat-detail-body">
            <p class="kai-cat-brand">KAI</p>
            <h2>${escapeHtml(meta.name)}</h2>
            <p class="kai-cat-detail-meta">${escapeHtml(
              [meta.releaseInfo, (meta.genres || []).join(" · "), meta.imdbRating && `★ ${meta.imdbRating}`]
                .filter(Boolean)
                .join("  ·  "),
            )}</p>
            <p class="kai-cat-detail-desc">${escapeHtml(meta.description || "")}</p>
            ${eps ? `<ul class="kai-cat-episodes">${eps}</ul>` : ""}
            <h3 class="kai-cat-streams-title">Streams</h3>
            <ul class="kai-cat-streams">${streamRows || "<li>No streams</li>"}</ul>
            <pre class="kai-cat-handoff" data-role="handoff" hidden></pre>
          </div>
        </div>
      </div>`;
  }

  async function handlePlay(contentId, index) {
    const handoffEl = state.root?.querySelector('[data-role="handoff"]');
    try {
      const handoff = await api().play(contentId, { index });
      if (handoffEl) {
        handoffEl.hidden = false;
        handoffEl.textContent = JSON.stringify(
          {
            kind: handoff.kind,
            uri: handoff.uri,
            infoHash: handoff.stream?.infoHash,
            note: "Phase 2 preview — Phase 3 wires this into the MPV/SVP transport",
          },
          null,
          2,
        );
      }
      // Soft bridge preview: expose for Phase 3
      window.dispatchEvent(
        new CustomEvent("kai-player-handoff", { detail: handoff }),
      );
      console.log("[KaiAnimeCatalog] handoff", handoff);
    } catch (err) {
      if (handoffEl) {
        handoffEl.hidden = false;
        handoffEl.textContent = String(err.message || err);
      }
    }
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  function onRoute() {
    if (isBoardHome()) mount();
    else unmount();
  }

  function startObserver() {
    if (state.observer) return;
    let t = null;
    state.observer = new MutationObserver((mutations) => {
      const relevant = mutations.some((m) => {
        const n = m.target;
        if (!(n instanceof HTMLElement)) return false;
        const c = n.className || "";
        return (
          typeof c === "string" &&
          (c.includes("board") || c.includes("nav-content"))
        );
      });
      if (!relevant) return;
      clearTimeout(t);
      t = setTimeout(onRoute, 160);
    });
    state.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function init() {
    window.addEventListener("hashchange", onRoute);
    window.addEventListener("popstate", onRoute);
    startObserver();
    onRoute();
    console.log(
      "%c[KaiAnimeCatalog] Phase 2 ready",
      "color: #ff4d2e; font-weight: bold",
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
