/**
 * Router.js (simplified) – Light SPA for static LIS site
 * Focus: hash-based routing, optional cache, generic module loading.
 * Optional dependencies: window.LISConfig, window.LISDataCache
 */

class Router {
  constructor(config = {}) {
    // Default config + external override
    const SPA_CFG = (window.LISConfig && window.LISConfig.CONFIG && window.LISConfig.CONFIG.SPA) || {};
    this.config = {
      LOADING_TIMEOUT: 10_000,
      CACHE_ENABLED: true,
      CACHE_DURATION: 300_000,
      ...SPA_CFG,
      ...config,
    };

    // Root elements
    this.contentContainer = document.getElementById("content-container");
    this.loadingElement = document.getElementById("loading");

    // State
    this.currentPage = null;
    this.currentParams = {};
    this.cache = new Map(); // { url: { html, ts } }
    this._renderToken = null;

    // Valid routes
    this.VALID_PAGES = new Set([
      "home",
      "investigacion",
      "proyectos",
      "publicaciones",
      "contactos",
    ]);

    if (!this._checkCompatibility()) {
      this._fallbackToStatic();
      return;
    }

    this._init();
  }

  /* ---------- Bootstrap ---------- */

  _checkCompatibility() {
    try {
      return (
        typeof fetch !== "undefined" &&
        typeof Promise !== "undefined" &&
        typeof Map !== "undefined" &&
        !!document.documentElement.classList &&
        typeof document.querySelector !== "undefined"
      );
    } catch {
      return false;
    }
  }

  _fallbackToStatic() {
    const routes = (window.LISConfig && window.LISConfig.CONFIG && window.LISConfig.CONFIG.ROUTES) || {};
    const hash = location.hash.slice(1);
    if (hash && routes[hash]?.static) location.href = routes[hash].static;
    else location.href = "./index.html";
  }

  _init() {
    // Click delegation for .nav-link
    document.addEventListener("click", (e) => {
      const link = e.target.closest(".nav-link");
      if (!link) return;
      e.preventDefault();
      const page = link.getAttribute("data-page") || "home";
      const year = link.getAttribute("data-year");
      const params = year ? { year } : {};
      this.navigateTo(page, params);
    });

    // Hashchange with micro-debounce (queueMicrotask, not rAF: rAF never
    // fires while the tab is hidden/backgrounded, which would freeze routing)
    let scheduled = false;
    window.addEventListener("hashchange", () => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        this._handleRouteFromHash();
      });
    });

    // First load
    this._handleRouteFromHash();
  }

  /* ---------- Routing ---------- */

  navigateTo(page, params = {}) {
    const targetHash = this._buildHash(page, params);
    if (location.hash === targetHash) {
      // If already on that hash, process directly
      this._handleRouteFromHash();
    } else {
      location.hash = targetHash;
    }
  }

  _handleRouteFromHash() {
    const { page, params } = this._parseHash();
    if (!this.VALID_PAGES.has(page)) {
      this._showError("PÃ¡gina no encontrada");
      return this.navigateTo("home");
    }
    // Avoid work if no substantive changes
    if (page === this.currentPage && this._shallowEqual(params, this.currentParams)) return;

    this.currentPage = page;
    this.currentParams = params;

    this._updateActiveNav(page);
    this._updatePageTitle(page);
    this._loadAndRender(page, params);
  }

  _parseHash() {
    const raw = location.hash.slice(1); // sin #
    const [pageRaw = "home", qs = ""] = raw.split("?");
    const params = Object.fromEntries(new URLSearchParams(qs));
    return { page: pageRaw || "home", params };
  }

  _buildHash(page, params = {}) {
    const qs = new URLSearchParams(
      Object.entries(params).sort(([a], [b]) => a.localeCompare(b))
    ).toString();
    return `#${page}${qs ? `?${qs}` : ""}`;
  }

  /* ---------- Carga de contenido ---------- */

  async _loadAndRender(page, params) {
    this._showLoading(true);
    const url = this._contentUrlFor(page, params);

    // CachÃ© en memoria (y opcionalmente global)
    const now = Date.now();
    if (this.config.CACHE_ENABLED) {
      const entry = this.cache.get(url);
      if (entry && now - entry.ts < this.config.CACHE_DURATION) {
        return this._render(entry.html, page, params);
      }
      if (window.LISDataCache?.get) {
        const globalHtml = await window.LISDataCache.get(url, { type: "html" });
        if (globalHtml) return this._render(globalHtml, page, params);
      }
    }

    // Fetch con timeout y cache-buster si cachÃ© deshabilitada
    const controller = new AbortController();
    const toId = setTimeout(() => controller.abort(), this.config.LOADING_TIMEOUT);
    const fetchUrl = this.config.CACHE_ENABLED ? url : `${url}?t=${Date.now()}`;

    try {
      const resp = await fetch(fetchUrl, {
        signal: controller.signal,
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      clearTimeout(toId);
      if (!resp.ok) {
        const err = new Error("FetchError");
        err.status = resp.status;
        err.statusText = resp.statusText;
        throw err;
      }
      const html = await resp.text();

      // Cachear
      if (this.config.CACHE_ENABLED) {
        this.cache.set(url, { html, ts: now });
        window.LISDataCache?.set?.(url, html);
      }

      this._render(html, page, params);
    } catch (error) {
      clearTimeout(toId);
      this._handleLoadError(error);
    } finally {
      this._showLoading(false);
    }
  }

  _contentUrlFor(page /*, params */) {
    const map = {
      home: "./content/home.html",
      investigacion: "./content/investigacion.html",
      proyectos: "./content/proyectos.html",
      publicaciones: "./content/publicaciones.html",
      contactos: "./content/contactos.html",
    };
    return map[page] || "./content/home.html";
  }

  _render(html, page, params) {
    if (!this.contentContainer) return;
    this.contentContainer.innerHTML = html;

    const token = (this._renderToken = Symbol());
    // Defer to allow content DOM mounting
    setTimeout(() => {
      if (this._renderToken !== token) return; // another render occurred
      this._executePageScripts(page, params);
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.dispatchEvent(new CustomEvent("pageLoaded", { detail: { page, params } }));
    }, 0);
  }

  /* ---------- UI ---------- */

  _updateActiveNav(page) {
    document.querySelectorAll(".nav-link.active").forEach((el) => el.classList.remove("active"));
    const active = document.querySelector(`[data-page="${page}"]`);
    active?.classList.add("active");
  }

  _updatePageTitle(page) {
    const cfg = (window.LISConfig && window.LISConfig.CONFIG) || {};
    const route = (cfg.ROUTES && cfg.ROUTES[page]) || null;
    if (route) {
      document.title = route.title || document.title;
      const meta = document.querySelector('meta[name="description"]');
      if (meta && route.description) meta.setAttribute("content", route.description);
    } else {
      document.title = (cfg.SEO && cfg.SEO.DEFAULT_TITLE) || "LIS Â· UTN-FRC";
    }
  }

  _showLoading(show) {
    if (this.loadingElement) this.loadingElement.style.display = show ? "block" : "none";
    // Don't touch content opacity to avoid 'blurry' effect
    if (this.contentContainer && !show) this.contentContainer.style.removeProperty("opacity");
  }

  _showError(message) {
    if (!this.contentContainer) return;
    this.contentContainer.innerHTML = `
      <div class="error-message">
        <h2>âš ï¸ Error</h2>
        <p>${message}</p>
        <button class="btn-primary" onclick="location.reload()">Recargar PÃ¡gina</button>
      </div>`;
  }

  _handleLoadError(error) {
    if (error?.name === "AbortError") return this._showError("Tiempo de carga agotado. Verifica tu conexiÃ³n.");
    if (typeof error?.status === "number") {
      if (error.status === 404) {
        this._showError("PÃ¡gina no encontrada. Redirigiendo al inicio...");
        return setTimeout(() => this.navigateTo("home"), 1200);
      }
      if (error.status >= 500) return this._showError("Error del servidor. Intenta recargar la pÃ¡gina.");
    }
    this._showError("Error al cargar el contenido. Intenta recargar la pÃ¡gina.");
  }

  /* ---------- MÃ³dulos por pÃ¡gina ---------- */

  _executePageScripts(page, params) {
    const handlers = {
      home: () => this._initHome(),
      proyectos: () => this._initModule("ProjectsModule", "projects-module.js", (inst) => inst.init(params)),
      publicaciones: () => this._initModule("PublicationsModule", "publications-module.js", (inst) => inst.init(params)),
      investigacion: () => this._initModule("ResearchModule", "research-module.js", (inst) => inst.init(params)),
      contactos: () => {/* implement if applicable */},
    };
    (handlers[page] || (() => {}))();
  }

  _initHome() {
    if (!window.HomeModule) return console.warn("[Router] HomeModule no disponible.");
    try {
      this._homeInst?.cleanup?.();
      this._homeInst = new window.HomeModule();
      Promise.resolve(this._homeInst.init()).catch((e) => console.error("[Router] Home init error:", e));
    } catch (e) {
      console.error("[Router] Home init error:", e);
    }
  }

  _initModule(globalName, fileName, initFn) {
    // Reuse previous instance if same module exists
    const key = `__${globalName}Inst`;
    const ScriptURL = `js/modules/${fileName}`;

    const useInstance = () => {
      try {
        this[key]?.cleanup?.();
        this[key] = new window[globalName]();
        Promise.resolve(initFn(this[key])).catch(() => {});
      } catch {
        /* noop */
      }
    };

    if (window[globalName]) return useInstance();

    // Script already loading
    const exists = document.querySelector(`script[src="${ScriptURL}"]`);
    if (exists) return this._waitForGlobal(globalName, useInstance);

    // Insert script
    const s = document.createElement("script");
    s.src = ScriptURL;
    s.onload = useInstance;
    s.onerror = () => console.error(`[Router] Error cargando ${fileName}`);
    document.head.appendChild(s);
  }

  _waitForGlobal(name, cb, tries = 50) {
    const tick = () => (window[name] ? cb() : tries-- > 0 && setTimeout(tick, 100));
    tick();
  }

  /* ---------- Utils ---------- */

  _shallowEqual(a = {}, b = {}) {
    const ak = Object.keys(a);
    if (ak.length !== Object.keys(b).length) return false;
    for (const k of ak) if (a[k] !== b[k]) return false;
    return true;
  }

  // Public API
  goTo(page, params) { this.navigateTo(page, params); }
  clearCache() { this.cache.clear(); }
  getState() { return { currentPage: this.currentPage, currentParams: this.currentParams, cacheSize: this.cache.size }; }
}

// Bootstrap (singleton simple)
document.addEventListener("DOMContentLoaded", () => {
  if (window.router) return;
  try { window.LISConfig?.autoFallback?.(); } catch {}
  window.router = new Router();
  window.router.__singleton = true;
});