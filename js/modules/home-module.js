class HomeModule {
  constructor() {
    this.$ = (sel) => document.querySelector(sel);
    this.root = null;
    this.projectsList = null;
    this.projectsYearEl = null;
    this.publicationsList = null;
    this.publicationsYearEl = null;

    this._renderToken = 0;

    // Delegation
    this._onLinkClick = (e) => {
      const el = e.target?.closest("[data-target-page]");
      if (!el) return;
      const target = el.getAttribute("data-target-page");
      if (target && window.router?.navigateTo) {
        e.preventDefault();
        window.router.navigateTo(target);
      }
    };
  }

  async init() {
  this._grabRefs();
  if (!this.root) return;
    const token = ++this._renderToken;

    try {
      const [projects, publications] = await Promise.all([
        this._loadJSON("./data/projects-data.json", "LISProjectsData"),
        this._loadJSON("./data/publications-data.json", "LISPublicationsData"),
      ]);
      if (token !== this._renderToken) return;

      this._renderProjects(projects);
      this._renderPublications(publications);
      this._wireLinks();
    } catch (err) {
      console.error("[HomeModule] highlights error:", err);
      this._placeholder(this.projectsList, "No fue posible cargar los proyectos destacados.");
      this._placeholder(this.publicationsList, "No fue posible cargar las publicaciones destacadas.");
    } finally {
      this.root?.setAttribute("aria-busy", "false");
      this.root?.querySelector(".home-latest-grid")?.setAttribute("aria-busy", "false");
    }
  }

  cleanup() {
    this.root?.removeEventListener("click", this._onLinkClick);
    this.root = null;
    this.projectsList = null;
    this.projectsYearEl = null;
    this.publicationsList = null;
    this.publicationsYearEl = null;
  }

  _grabRefs() {
    this.root = this.$("#home-highlight");
    this.projectsList = this.$("#home-projects-list");
    this.projectsYearEl = this.$("#home-projects-year");
    this.publicationsList = this.$("#home-publications-list");
    this.publicationsYearEl = this.$("#home-publications-year");
  }

  /* ---------------- Data ---------------- */

  async _loadJSON(url, globalName) {
    if (!window[globalName]) {
      if (window.LISDataCache?.get) {
        window[globalName] = await window.LISDataCache.get(url, { type: "json" });
      } else {
        const res = await fetch(url, { cache: "no-cache" });
        if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
        window[globalName] = await res.json();
      }
    }
    return window[globalName];
  }

  /* ---------------- Render ---------------- */

  _renderProjects(data) {
    if (!this.projectsList || !data) return;
    const year = this._latestYearKey(data);
    if (this.projectsYearEl) this.projectsYearEl.textContent = year ? `Año ${year}` : "Sin datos";

    const items = year ? data[year]?.proyectos ?? [] : [];
    if (!items.length) return this._placeholder(this.projectsList, "No se encontraron proyectos registrados.");

    const ul = this._ul();
    items.slice(0, 3).forEach((p) => {
      const a = (Array.isArray(p.links) && p.links[0])
        ? this._a("home-latest-item-meta home-latest-link", p.links[0], "Ver ficha del proyecto")
        : null;

      // If you have an SPA route (p.slug), navigate internally:
      if (p.slug) {
        const spa = this._a("home-latest-item-meta home-latest-link", "#", "Ver ficha del proyecto");
        spa.setAttribute("data-target-page", `/proyectos/${p.slug}`);
        // Avoid opening new tab for SPA:
        spa.removeAttribute("target"); spa.removeAttribute("rel"); spa.href = "#";
        ul.appendChild(this._li([
          this._span("home-latest-item-title", p.title),
          spa,
        ]));
      } else {
        ul.appendChild(this._li([
          this._span("home-latest-item-title", p.title),
          ...(a ? [a] : []),
        ]));
      }
    });
    this._replace(this.projectsList, ul);
  }

  _renderPublications(data) {
    if (!this.publicationsList || !data) return;
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const year = this._latestYearFromEntries(entries);
    if (this.publicationsYearEl) this.publicationsYearEl.textContent = year ? `Año ${year}` : "Sin datos";

    const recent = year ? entries.filter((e) => String(e.year) === year) : [];
    if (!recent.length) return this._placeholder(this.publicationsList, "No se encontraron publicaciones recientes.");

    const ul = this._ul();
    recent.slice(0, 3).forEach((pub) => {
      const venue = pub.venue ? `${pub.venue}` : "";
      const authors = Array.isArray(pub.authors) ? pub.authors.join(", ") : "";
      const meta = [venue, authors].filter(Boolean).join(" • ");

      const nodes = [
        this._span("home-latest-item-title", pub.title),
        this._span("home-latest-item-meta", meta),
      ];

      // Optional link to the publication
      if (pub.url) {
        const a = this._a("home-latest-item-meta", pub.url, "Acceso");
        nodes.push(a);
      }

      ul.appendChild(this._li(nodes));
    });
    this._replace(this.publicationsList, ul);
  }

  /* ---------------- Events ---------------- */

  _wireLinks() {
    // Delegation: single listener on root
    this.root?.removeEventListener("click", this._onLinkClick);
    this.root?.addEventListener("click", this._onLinkClick);
  }

  /* ---------------- DOM helpers ---------------- */

  _ul() { const ul = document.createElement("ul"); ul.className = "home-latest-list"; return ul; }
  _li(children = []) { const li = document.createElement("li"); children.forEach((c) => li.appendChild(c)); return li; }
  _span(cls, text) { const s = document.createElement("span"); s.className = cls; s.textContent = text ?? ""; return s; }
  _a(cls, href, text) {
    const a = document.createElement("a");
    a.className = cls;
    a.href = href ?? "#";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = text ?? href ?? "";
    return a;
  }
  _placeholder(container, msg) { if (!container) return; this._replace(container, this._p("home-latest-placeholder", msg)); }
  _p(cls, text) { const p = document.createElement("p"); p.className = cls; p.textContent = text ?? ""; return p; }
  _replace(container, el) { container?.replaceChildren(el); }

  /* ---------------- Year helpers ---------------- */

  _latestYearKey(map) {
    if (!map || typeof map !== "object") return null;
    const years = Object.keys(map).map((k) => k.trim()).filter((k) => /^\d{4}$/.test(k)).map(Number);
    return years.length ? String(Math.max(...years)) : null;
  }

  _latestYearFromEntries(entries) {
    const years = (entries || [])
      .map((e) => (typeof e.year === "string" ? e.year.trim() : String(e.year ?? "")))
      .filter((y) => /^\d{4}$/.test(y))
      .map(Number);
    return years.length ? String(Math.max(...years)) : null;
  }
}

window.HomeModule = HomeModule;
