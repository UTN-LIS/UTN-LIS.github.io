/**
 * PublicationsModule (simplified) – LIS Publications Page
 * - Loads with LISDataCache
 * - Filters by type and year (dynamic)
 * - Normalizes types prioritizing e.type (journal|conference|book|...) then origin
 * - Idempotent render (signature) and minimal reflow
 */
class PublicationsModule {
  constructor() {
    // State
    this.currentType = "all";
    this.currentYear = "all";
    this._signature = "";

    // Normalized data and indexes
    this.data = null;             // Raw JSON
    this.entries = [];            // Normalized entries
    this.indexByYear = new Map(); // year -> entries[]

    // DOM
    this.listEl = null;           // #publications-content
    this.typeTabs = [];           // .filter-tab
    this.yearSelect = null;       // #pub-year-select

    // Handlers
    this._onTypeClick = this._onTypeClick.bind(this);
    this._onYearChange = this._onYearChange.bind(this);
  }

  /* ---------------- Bootstrap ---------------- */

  async init() {
    this._grabRefs();
    if (!this.listEl) return;

    await this._ensureData();
    this._normalize();

    this._renderFilters();   // builds tabs and years dynamically
    this._wireEvents();

    this._renderList();      // initial list
    this.listEl.setAttribute("aria-busy", "false");
  }

  cleanup() {
    this.typeTabs.forEach((t) => t.removeEventListener("click", this._onTypeClick));
    this.yearSelect?.removeEventListener("change", this._onYearChange);

    this.data = null;
    this.entries = [];
    this.indexByYear.clear();

    this.listEl = null;
    this.typeTabs = [];
    this.yearSelect = null;

    this.currentType = "all";
    this.currentYear = "all";
    this._signature = "";
  }

  /* ---------------- Data ---------------- */

  async _ensureData() {
    if (!this.data) {
      this.data = await window.LISDataCache.get("./data/publications-data.json", { type: "json" });
    }
  }

  _normalize() {
    const raw = Array.isArray(this.data?.entries) ? this.data.entries : [];

    // Normalize type and year:
    // 1) If e.type exists (journal|conference|book|paper|...), respect it.
    // 2) If not, infer from e.origin (paper / news-item / upcoming-event ...).
    // 3) Year from e.year or from YYYY prefix of e.date.
    this.entries = raw.map((e) => {
      let type = (e.type || "").trim().toLowerCase();
      if (!type) {
        const origin = (e.origin || "legacy").toLowerCase();
        if (origin === "paper" || origin === "project-publication") type = "paper";
        else if (origin === "news-item") type = "news";
        else if (origin === "upcoming-event") type = "event";
        else type = "legacy";
      }

      let year = e.year;
      if (!year && typeof e.date === "string" && /^\d{4}/.test(e.date)) year = e.date.slice(0, 4);
      if (!year) year = "N/A";

      return { ...e, type, year };
    });

    // Index by year (only YYYY)
    this.indexByYear.clear();
    for (const it of this.entries) {
      if (/^\d{4}$/.test(it.year)) {
        if (!this.indexByYear.has(it.year)) this.indexByYear.set(it.year, []);
        this.indexByYear.get(it.year).push(it);
      }
    }
  }

  /* ---------------- DOM / Events ---------------- */

  _grabRefs() {
    this.listEl = document.getElementById("publications-content");
    this.typeTabs = Array.from(document.querySelectorAll(".filter-tab"));
    this.yearSelect = document.getElementById("pub-year-select");
  }

  _wireEvents() {
    this.typeTabs.forEach((t) => {
      t.removeEventListener("click", this._onTypeClick);
      t.addEventListener("click", this._onTypeClick);
    });
    this.yearSelect?.removeEventListener("change", this._onYearChange);
    this.yearSelect?.addEventListener("change", this._onYearChange);
  }

  _onTypeClick(e) {
    const tab = e.currentTarget;
    const type = tab?.dataset?.filter || "all";
    if (type === this.currentType) return;

    this.typeTabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");

    this.currentType = type;
    this._renderList();
  }

  _onYearChange(e) {
    const year = String(e.target.value || "all");
    if (year === this.currentYear) return;
    this.currentYear = year;
    this._renderList();
  }

  /* ---------------- Render ---------------- */

  _renderFilters() {
    // Tabs: derived from types present in entries
    const tabsBox = document.querySelector(".filter-tabs");
    if (tabsBox) {
      const types = [...new Set(this.entries.map((e) => e.type))].sort();
      tabsBox.innerHTML = "";

      // "All"
      tabsBox.appendChild(this._typeTab("all", "Todas", true));

      // Types present in data (mapped to formal labels)
      for (const t of types) {
        tabsBox.appendChild(this._typeTab(t, this._typeLabel(t)));
      }

      this.typeTabs = Array.from(tabsBox.querySelectorAll(".filter-tab"));
    }

    // Year select: “Todos” + años detectados (desc)
    if (this.yearSelect) {
      const years = [...new Set(this.entries.map((e) => e.year))]
        .filter((y) => /^\d{4}$/.test(y))
        .sort((a, b) => parseInt(b) - parseInt(a));

      this.yearSelect.innerHTML =
        `<option value="all">Todos</option>${years.map((y) => `<option value="${y}">${y}</option>`).join("")}`;
      this.yearSelect.value = "all";
      this.currentYear = "all";
    }
  }

  _renderList() {
    if (!this.listEl) return;

    // Base by year with index when applicable
    let rows =
      this.currentYear !== "all" && this.indexByYear.has(this.currentYear)
        ? this.indexByYear.get(this.currentYear).slice()
        : this.entries.slice();

    // Filter by type
    if (this.currentType !== "all") {
      rows = rows.filter((r) => r.type === this.currentType);
    }

    // Order: year desc (numerical first), then title
    rows.sort((a, b) => {
      const ay = /^\d{4}$/.test(a.year) ? +a.year : -1;
      const by = /^\d{4}$/.test(b.year) ? +b.year : -1;
      if (ay !== by) return by - ay;
      return (a.title || "").localeCompare(b.title || "");
    });

    // Signature to avoid costly redundant renders
    const signature = `${this.currentType}|${this.currentYear}|${rows.length}|${rows[0]?.id ?? ""}`;
    if (signature === this._signature) return;
    this._signature = signature;

    this.listEl.innerHTML = rows.map((r) => this._card(r)).join("");
  }

  /* ---------------- Templates ---------------- */

  _typeTab(id, label, active = false) {
    const btn = document.createElement("button");
    btn.className = `filter-tab${active ? " active" : ""}`;
    btn.dataset.filter = id;
    btn.textContent = label;
    return btn;
  }

  _card(item) {
    const type = this._typeLabel(item.type);
    const year = item.year && item.year !== "N/A" ? item.year : "";

    const metaParts = [];
    if (item.project)  metaParts.push(`<strong>Proyecto:</strong> ${item.project}`);
    if (item.category) metaParts.push(`<strong>Categoría:</strong> ${item.category}`);
    if (item.location) metaParts.push(`<strong>Locación:</strong> ${item.location}`);
    const meta = metaParts.length ? `<p class="publication-meta">${metaParts.join(" · ")}</p>` : "";

    const body = item.body ? `<p class="publication-body">${item.body}</p>` : "";

    const imgs = Array.isArray(item.images) && item.images.length
      ? `<div class="publication-images">${item.images
          .map((src) => `<img src="${src}" alt="${item.title ?? ""}" loading="lazy">`).join("")}</div>`
      : "";

    const links = this._links(item);

    return `
      <div class="publication-item" data-type="${item.type}" data-year="${item.year}">
        <div class="publication-header">
          <span class="publication-type type-${item.type}">${type}</span>
          ${year ? `<span class="publication-year">${year}</span>` : ""}
        </div>
        <h3>${item.title ?? ""}</h3>
        ${meta}
        ${body}
        ${imgs}
        ${links}
       </div>
      </br>
    `;
  }

  _links(item) {
    const pieces = [];

    // Generic array of links
    if (Array.isArray(item.links)) {
      for (const l of item.links) {
        if (typeof l === "string") {
          pieces.push(this._a(l, "🔗 Enlace"));
        } else if (l?.url) {
          pieces.push(this._a(l.url, `🔗 ${l.label || "Enlace"}`));
        }
      }
    }

    // Specific fields (compatibility)
    if (item.links?.doi) pieces.push(this._a(item.links.doi, "🔗 DOI"));
    if (item.links?.pdf) pieces.push(this._a(item.links.pdf, "📄 PDF"));

    return pieces.length ? `<div class="publication-links">${pieces.join("")}</div>` : "";
  }

  _a(href, label) {
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="pub-link">${label}</a>`;
  }

  /* ---------------- Labels & Utils ---------------- */

  _typeLabel(t) {
    const map = {
      journal: "Revista",
      conference: "Conferencia",
      book: "Libro",
      paper: "Paper",   
      project: "Proyecto",
      news: "Noticia",
      event: "Evento",
      legacy: "Entrada",
    };
    return map[t] || t;
  }
}

/* Expose globally */
window.PublicationsModule = PublicationsModule;
