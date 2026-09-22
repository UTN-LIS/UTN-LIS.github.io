/**
 * ResearchModule (simplified) – LIS Research Page
 * - Loads with LISDataCache
 * - Filters (areas and projects) with idempotent render by signature
 * - Compact templates and minimal reflow
 */

class ResearchModule {
  constructor() {
    // State / signatures to avoid redundant renders (null = not yet rendered,
    // so the initial render with filter "all" isn't skipped as a dupe)
    this._areaSignature = null;
    this._projSignature = null;

    // Data
    this.data = null;

    // DOM
    this.areasEl = null;        // #research-areas-content
    this.methodEl = null;       // #methodology-content
    this.projectsEl = null;     // #projects-content
    this.pubsEl = null;         // #recent-publications-content
    this.areaTabs = [];         // .area-filter
    this.projectTabs = [];      // .project-filter

    // Handlers
    this._onAreaClick = this._onAreaClick.bind(this);
    this._onProjectClick = this._onProjectClick.bind(this);
  }

  /* ---------------- Bootstrap ---------------- */

  async init() {
    this._grabRefs();
    if (!this.areasEl) return;

    this._wireEvents();

    await this._ensureData();
    this._renderHero();
    this.renderResearchAreas("all");
    this.renderMethodology();
    this.renderCurrentProjects("all");
    this.renderRecentPublications();
  }

  cleanup() {
    this.areaTabs.forEach((t) => t.removeEventListener("click", this._onAreaClick));
    this.projectTabs.forEach((t) => t.removeEventListener("click", this._onProjectClick));

    this.data = null;
    this.areasEl = this.methodEl = this.projectsEl = this.pubsEl = null;
    this.areaTabs = this.projectTabs = [];
    this._areaSignature = null;
    this._projSignature = null;
  }

  /* ---------------- Data ---------------- */

  async _ensureData() {
    if (!this.data) {
      this.data = await window.LISDataCache.get("./data/research-data.json", { type: "json" });
    }
  }

  /* ---------------- DOM / Events ---------------- */

  _grabRefs() {
    this.areasEl = document.getElementById("research-areas-content");
    this.methodEl = document.getElementById("methodology-content");
    this.projectsEl = document.getElementById("projects-content");
    this.pubsEl = document.getElementById("recent-publications-content");
    this.areaTabs = Array.from(document.querySelectorAll(".area-filter"));
    this.projectTabs = Array.from(document.querySelectorAll(".project-filter"));
  }

  _wireEvents() {
    this.areaTabs.forEach((t) => {
      t.removeEventListener("click", this._onAreaClick);
      t.addEventListener("click", this._onAreaClick);
    });
    this.projectTabs.forEach((t) => {
      t.removeEventListener("click", this._onProjectClick);
      t.addEventListener("click", this._onProjectClick);
    });
  }

  _onAreaClick(e) {
    const tab = e.currentTarget;
    const filter = tab?.dataset?.filter || "all";
    if (filter === this._areaSignature) return;

    this.areaTabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    this.renderResearchAreas(filter);
  }

  _onProjectClick(e) {
    const tab = e.currentTarget;
    const filter = tab?.dataset?.filter || "all";
    if (filter === this._projSignature) return;

    this.projectTabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    this.renderCurrentProjects(filter);
  }

  /* ---------------- Render ---------------- */

  _renderHero() {
    const hero = this.data?.hero || {};
    const t = document.getElementById("research-title");
    const d = document.getElementById("research-description");
    if (t && hero.title) t.textContent = hero.title;
    if (d && hero.description) d.textContent = hero.description;
  }

  renderResearchAreas(filter = "all") {
    if (!this.areasEl || !Array.isArray(this.data?.researchAreas)) return;

    // Avoid redundant render
    if (filter === this._areaSignature) return;
    this._areaSignature = filter;

    let rows = this.data.researchAreas.slice();
    if (filter === "featured") rows = rows.filter((a) => a.featured);
    else if (filter !== "all") rows = rows.filter((a) => a.id === filter);

    this.areasEl.innerHTML = rows.map((a) => this._areaCard(a)).join("");
  }

  renderMethodology() {
    if (!this.methodEl || !this.data?.methodology) return;
    const m = this.data.methodology;
    const approaches = Array.isArray(m.approaches) ? m.approaches : [];

    this.methodEl.innerHTML = `
      <div class="methodology-content">
        <div class="methodology-text">
          <h3>${m.title ?? ""}</h3>
          <p>${m.description ?? ""}</p>
          <div class="methodology-approaches">
            ${approaches
              .map(
                (ap) => `
              <div class="approach-item">
                <div class="approach-icon">${ap.icon ?? ""}</div>
                <h4>${ap.title ?? ""}</h4>
                <p>${ap.description ?? ""}</p>
              </div>`
              )
              .join("")}
          </div>
        </div>
        <div class="methodology-image">
          ${m.image ? `<img src="${m.image}" alt="Metodología de investigación" loading="lazy">` : ""}
        </div>
      </div>`;
  }

  renderCurrentProjects(filter = "all") {
    if (!this.projectsEl || !Array.isArray(this.data?.currentProjects)) return;

    // Avoid redundant render
    if (filter === this._projSignature) return;
    this._projSignature = filter;

    let rows = this.data.currentProjects.slice();
    if (filter !== "all") rows = rows.filter((p) => p.status === filter);

    this.projectsEl.innerHTML = rows.length
      ? rows.map((p) => this._projectCard(p)).join("")
      : `<p class="empty-state">No hay proyectos para este filtro.</p>`;
  }

  renderRecentPublications() {
    if (!this.pubsEl || !Array.isArray(this.data?.recentPublications)) return;

    this.pubsEl.innerHTML = this.data.recentPublications.length
      ? this.data.recentPublications.map((pub) => this._pubCard(pub)).join("")
      : `<p class="empty-state">Próximamente vamos a sumar publicaciones recientes acá.</p>`;
  }

  /* ---------------- Templates ---------------- */

  _areaCard(area) {
    const topics = Array.isArray(area.topics) ? area.topics : [];
    return `
      <div class="research-area-card" data-area="${area.id ?? ""}">
        <div class="research-area-header">
          <div class="research-icon">${area.icon ?? ""}</div>
          <h3>${area.title ?? ""}</h3>
        </div>
        <p class="research-description">${area.description ?? ""}</p>
        <div class="research-topics">
          ${topics.map((t) => `<span class="topic-badge">${t}</span>`).join("")}
        </div>
      </div>`;
  }

  _projectCard(p) {
    const statusClass = `status-${p.status ?? "unknown"}`;
    const STATUS_LABELS = { active: "En desarrollo", planning: "En planificación", completed: "Finalizado" };
    const statusText = STATUS_LABELS[p.status] ?? (p.status ?? "");
    const techs = Array.isArray(p.technologies) ? p.technologies : [];
    const partners = Array.isArray(p.partners) ? p.partners : [];

    return `
      <div class="project-card" data-status="${p.status ?? ""}">
        <div class="project-header">
          <h3>${p.title ?? ""}</h3>
          <span class="project-status ${statusClass}">${statusText}</span>
        </div>
        <p class="project-description">${p.description ?? ""}</p>
        <div class="project-technologies">
          ${techs.map((t) => `<span class="tech-badge">${t}</span>`).join("")}
        </div>
        <div class="project-meta">
          ${partners.length ? `<span class="project-partners">Autores: ${partners.join(", ")}</span>` : ""}
          ${p.startDate ? `<span class="project-timeline">Inicio: ${this._formatMonth(p.startDate)}</span>` : ""}
        </div>
      </div>`;
  }

  _pubCard(pub) {
    const typeLabel = pub.type === "journal" ? "Revista" : "Conferencia";
    const authors = Array.isArray(pub.authors) ? pub.authors.join(", ") : (pub.authors ?? "");
    const year = pub.year ? `, ${pub.year}` : "";
    const venue = pub.venue ? `${pub.venue}${year} (${typeLabel})` : `${year} (${typeLabel})`;

    return `
      <div class="publication-preview-item">
        <h4>${pub.title ?? ""}</h4>
        <p class="publication-authors">${authors}</p>
        <p class="publication-venue">${venue}</p>
        ${pub.doi ? `<a href="https://doi.org/${pub.doi}" class="publication-link" target="_blank" rel="noopener noreferrer">Ver publicación</a>` : ""}
      </div>`;
  }

  /* ---------------- Utils ---------------- */

  _formatMonth(s) {
    const d = new Date(s);
    if (isNaN(d)) return s || "";
    return d.toLocaleDateString("es-ES", { year: "numeric", month: "short" });
  }
}

/* Expose globally */
window.ResearchModule = ResearchModule;
