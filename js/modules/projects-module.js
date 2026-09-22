/**
 * ProjectsModule (simplified) – LIS Projects Page
 * - Loads with LISDataCache
 * - Year navigation (URL ↔ state) without loops
 * - Idempotent render and minimal reflow
 * - Year select populated dynamically from JSON
 */
class ProjectsModule {
  constructor() {
    // State
    this.currentYear = null;
    this._lastSignature = "";

    // DOM
    this.yearSelect = null;
    this.projectsContent = null;
    this.heroTitle = null;
    this.heroDescription = null;
    this.pageTitle = null;

    // Handlers
    this._onYearChange = this._onYearChange.bind(this);
  }

  /* ---------------- Bootstrap ---------------- */

  async init(params = {}) {
    await this._ensureData();
    this._grabRefs();
    if (!this.projectsContent) return;

    // >>> NEW: populate the select with available years from JSON
    this._populateYearSelect();

    this._wireEvents();

    // Initial year from params or last available
    const initialYear = (params.year && this._isValidYear(params.year))
      ? String(params.year)
      : this._lastAvailableYear();

    if (initialYear) this._selectYear(initialYear, { fromNavigation: true });
    const grid = this.projectsContent.querySelector(".projects-grid");
    grid?.setAttribute("aria-busy", "false");
  }

  cleanup() {
    this.yearSelect?.removeEventListener("change", this._onYearChange);
    this.currentYear = null;
    this._lastSignature = "";
    this.yearSelect = this.projectsContent = null;
    this.heroTitle = this.heroDescription = this.pageTitle = null;
  }

  /* ---------------- Data ---------------- */

  async _ensureData() {
    if (!window.LISProjectsData) {
      window.LISProjectsData = await window.LISDataCache.get("./data/projects-data.json", { type: "json" });
    }
  }

  get _data() {
    return window.LISProjectsData || {};
  }

  /* ---------------- DOM / Events ---------------- */

  _grabRefs() {
    this.yearSelect = document.getElementById("year-select");
    this.projectsContent = document.getElementById("projects");
    this.heroTitle = document.querySelector(".hero-title");
    this.heroDescription = document.querySelector(".hero-subtitle");
    this.pageTitle = document.querySelector("title");
  }

  _wireEvents() {
    if (!this.yearSelect) return;
    this.yearSelect.removeEventListener("change", this._onYearChange);
    this.yearSelect.addEventListener("change", this._onYearChange);
  }

  _onYearChange(e) {
    const year = String(e.target.value || "");
    this._selectYear(year, { fromNavigation: false });
  }

  /* ---------------- Year / Navigation ---------------- */

  _isValidYear(year) {
    return !!(year && this._data && this._data[year]);
  }

  _availableYears() {
    // Only YYYY years present as keys
    return Object.keys(this._data).filter(y => /^\d{4}$/.test(y)).sort();
  }

  _lastAvailableYear() {
    const years = this._availableYears();
    return years.length ? years[years.length - 1] : null;
  }

  _populateYearSelect() {
    if (!this.yearSelect) return;
    const years = this._availableYears();
    if (!years.length) {
      this.yearSelect.innerHTML = `<option value="" disabled selected>Sin datos disponibles</option>`;
      return;
    }

    // If you prefer most recent first visually:
    // const ordered = years.slice().reverse();
    const ordered = years;     // ascending

    // Accessible placeholder
    const opts = [`<option value="" disabled selected>Seleccionar año</option>`]
      .concat(ordered.map(y => `<option value="${y}">${y}</option>`));

    this.yearSelect.innerHTML = opts.join("");
  }

  _selectYear(year, { fromNavigation }) {
    if (!this._isValidYear(year)) {
      return this._error(`No hay datos disponibles para el año ${year}`);
    }

    // Avoid identical renders
    const signature = `y:${year}`;
    if (signature === this._lastSignature) return;
    this._lastSignature = signature;

    this.currentYear = year;
    if (this.yearSelect) this.yearSelect.value = year;

    // Synchronize URL if change comes from dropdown (not router)
    if (!fromNavigation && window.router?.navigateTo) {
      window.router.navigateTo("proyectos", { year });
    }

    this._renderYear(year);
  }

  /* ---------------- Render ---------------- */

  _renderYear(year) {
    const data = this._data[year];
    if (!data) return this._error(`No se pudo cargar el año ${year}`);

    this._updateTitles(data);

    const container = this.projectsContent.querySelector(".container") || this.projectsContent;

    // Section title
    let titleEl = container.querySelector(".section-title");
    if (!titleEl) {
      titleEl = document.createElement("h2");
      titleEl.className = "section-title";
      container.prepend(titleEl);
    }
    titleEl.textContent = `Proyectos del año ${year}`;

    // Grid
    let grid = container.querySelector(".projects-grid");
    if (!grid) {
      grid = document.createElement("div");
      grid.className = "projects-grid";
      titleEl.insertAdjacentElement("afterend", grid);
    }

    grid.setAttribute("aria-busy", "true");
    grid.innerHTML = this._projectsHTML(data);
    grid.setAttribute("aria-busy", "false");
  }

  _updateTitles(data) {
    if (this.heroTitle) this.heroTitle.textContent = `Proyectos del año ${this.currentYear}`;
    if (this.heroDescription) this.heroDescription.textContent = data.description ?? "";
    if (this.pageTitle) this.pageTitle.textContent = `${data.title ?? `Proyectos ${this.currentYear}`} - LIS UTN-FRC`;
  }

  _projectsHTML(data) {
    const items = Array.isArray(data.proyectos) ? data.proyectos : [];
    if (!items.length) {
      return `<div class="loading-message"><p>No hay proyectos disponibles para este año.</p></div>`;
    }

    return items.map((p) => {
      const authors = Array.isArray(p.authors) && p.authors.length
        ? `<div class="project-authors">
             <h4 class="meta-label">Autores</h4>
             <ul class="authors-list">${p.authors.map(a => `<li>${a}</li>`).join("")}</ul>
           </div>` : "";

      const pubs = Array.isArray(p.publications) && p.publications.length
        ? `<div class="project-publications">
             <div class="publications-count">${p.publications.length} publicación${p.publications.length !== 1 ? "es" : ""}</div>
             <div class="publications-list">${p.publications.map(x => `<div class="publication-item">${x}</div>`).join("")}</div>
           </div>` : "";

      const objectives = Array.isArray(p.objectives) && p.objectives.length
        ? `<div class="project-objectives">
             <h4 class="meta-label">Objetivos</h4>
             <ul class="objectives-list">${p.objectives.map(o => `<li>${o}</li>`).join("")}</ul>
           </div>` : "";

      const features = Array.isArray(p.caracteristicas) && p.caracteristicas.length
        ? `<div class="project-caracteristicas">
             <h4 class="meta-label">Características</h4>
             <ul class="caracteristicas-list">${p.caracteristicas.map(c => `<li>${c}</li>`).join("")}</ul>
           </div>` : "";

      const links = Array.isArray(p.links) && p.links.length
        ? `<div class="project-links">
             <h4>Enlaces</h4>
             <ul>${
               p.links.map(l => {
                 if (typeof l === "string") {
                   return `<li><a href="${l}" target="_blank" rel="noopener noreferrer">${this._shortURL(l)}</a></li>`;
                 }
                 if (l?.url) {
                   const label = l.label || l.url;
                   return `<li><a href="${l.url}" target="_blank" rel="noopener noreferrer">${label}</a></li>`;
                 }
                 return "";
               }).join("")
             }</ul>
           </div>` : "";

      return `
        <div class="project-card">
          <div class="project-card-header">
            <h3 class="project-card-title">${p.title ?? ""}</h3>
          </div>
          <div class="project-card-content">
            ${p.abstract ? `<p class="project-abstract">${p.abstract}</p>` : ""}
            ${authors}
            ${pubs}
            ${objectives}
            ${features}
            ${links}
          </div>
        </div>`;
    }).join("");
  }

  /* ---------------- UI helpers ---------------- */

  _error(msg) {
    const container = this.projectsContent?.querySelector(".container") || this.projectsContent;
    if (!container) return;
    let grid = container.querySelector(".projects-grid");
    if (!grid) {
      grid = document.createElement("div");
      grid.className = "projects-grid";
      container.appendChild(grid);
    }
    grid.setAttribute("aria-busy", "false");
    grid.innerHTML = `
      <div class="error-message">
        <h3>Error</h3>
        <p>${msg}</p>
      </div>`;
  }

  _shortURL(url) {
    try {
      const u = new URL(url);
      let label = u.hostname.replace(/^www\./, "") + u.pathname;
      if (label.length > 40) label = label.slice(0, 37) + "…";
      return label || url;
    } catch {
      return url;
    }
  }

  /* ---------------- Optional public API ---------------- */

  getCurrentYear() { return this.currentYear; }
  getAvailableYears() { return this._availableYears(); }
  getLastAvailableYear() { return this._lastAvailableYear(); }
}

/* Expose globally */
window.ProjectsModule = ProjectsModule;
