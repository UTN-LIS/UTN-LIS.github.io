/**
 * NewsModule (simplified) – LIS News Page
 * - Data loading with LISDataCache
 * - Idempotent render (render signature)
 * - Filters with minimal DOM manipulation
 */

class NewsModule {
  constructor() {
    // State
    this.currentFilter = "all";
    this.lastSignature = "";
    this.newsData = null;

    // DOM
    this.newsContent = null;
    this.featuredContent = null;
    this.upcomingEventsContent = null;
    this.filterTabs = [];

    // Handlers
    this._onFilterClick = this._onFilterClick.bind(this);
  }

  /* ---------------- Bootstrap ---------------- */

  async init() {
    this._grabRefs();
    if (!this.newsContent) return;

    this._wireEvents();

    try {
      await this._ensureData();
      this._renderAll();
    } catch (e) {
      console.error("[NewsModule] Error cargando datos:", e);
      this._placeholder(this.featuredContent, "No hay noticias destacadas disponibles.");
      this._placeholder(this.newsContent, "No hay noticias para mostrar.");
      this._placeholder(this.upcomingEventsContent, "Sin eventos próximos.");
    }
  }

  cleanup() {
    this.filterTabs.forEach((tab) => tab.removeEventListener("click", this._onFilterClick));
    this.newsData = null;
    this.newsContent = this.featuredContent = this.upcomingEventsContent = null;
    this.filterTabs = [];
    this.lastSignature = "";
  }

  /* ---------------- Data ---------------- */

  async _ensureData() {
    if (!this.newsData) {
      this.newsData = await window.LISDataCache.get("./data/news-data.json", { type: "json" });
    }
  }

  /* ---------------- DOM / Events ---------------- */

  _grabRefs() {
    this.newsContent = document.getElementById("news-content");
    this.featuredContent = document.getElementById("featured-content");
    this.upcomingEventsContent = document.getElementById("upcoming-events-content");
    this.filterTabs = Array.from(document.querySelectorAll(".filter-tab"));
  }

  _wireEvents() {
    this.filterTabs.forEach((tab) => {
      tab.removeEventListener("click", this._onFilterClick);
      tab.addEventListener("click", this._onFilterClick);
    });
  }

  _onFilterClick(e) {
    const tab = e.currentTarget;
    const filter = tab?.dataset?.filter || "all";

    if (filter === this.currentFilter) return;

    // Active UI
    this.filterTabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");

    // Apply filter and re-render grid
    this.currentFilter = filter;
    this._renderNewsGrid();
  }

  /* ---------------- Render ---------------- */

  _renderAll() {
    if (!this.newsData) return;
    this._renderFeatured();
    this._renderNewsGrid();
    this._renderUpcoming();
  }

  _renderFeatured() {
    if (!this.featuredContent) return;

    const featured = this._pickFeatured(this.newsData);
    if (!featured) {
      this._placeholder(this.featuredContent, "No hay noticias destacadas disponibles.");
      return;
    }

    const img = this._imageBlock(featured, true);
    const content = this._contentHtml(featured);
    const links = this._linksHtml(featured);
    const date = this._formatDate(featured.date);

    this.featuredContent.innerHTML = `
      <div class="featured-item">
        ${img}
        <div class="featured-content">
          <h3>${featured.title ?? ""}</h3>
          <p class="featured-date">${date}</p>
          ${featured.excerpt ? `<p class="featured-excerpt">${featured.excerpt}</p>` : ""}
          ${content}
          ${links}
        </div>
      </div>
    `;
  }

  _renderNewsGrid() {
    if (!this.newsContent || !Array.isArray(this.newsData?.news)) return;

    const base = this.newsData.news.slice();
    const data =
      this.currentFilter === "all" ? base : base.filter((n) => n.category === this.currentFilter);

    // Sort by date desc
    data.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Signature to avoid identical renders
    const signature = `${this.currentFilter}|${data.length}|${data[0]?.id ?? ""}`;
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;

    this.newsContent.innerHTML = data.length
      ? data.map((item) => this._newsCard(item)).join("")
      : `<p class="no-news">No hay noticias disponibles para este filtro.</p>`;
  }

  _renderUpcoming() {
    if (!this.upcomingEventsContent || !Array.isArray(this.newsData?.upcomingEvents)) return;

    const events = this.newsData.upcomingEvents.slice().sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    this.upcomingEventsContent.innerHTML = events
      .map((ev) => this._eventCard(ev))
      .join("");
  }

  /* ---------------- Templates ---------------- */

  _newsCard(item) {
    const date = this._formatDate(item.date);
    const img = this._imageBlock(item, false);
    const content = this._contentHtml(item);
    const links = this._linksHtml(item);

    return `
      <div class="news-item" data-category="${item.category ?? ""}">
        ${img}
        <div class="news-content">
          <h3>${item.title ?? ""}</h3>
          <p class="news-date">${date}</p>
          ${item.excerpt ? `<p class="news-excerpt">${item.excerpt}</p>` : ""}
          ${content}
          ${links}
        </div>
      </div>
    `;
  }

  _eventCard(ev) {
    const d = new Date(ev.date);
    const day = isNaN(d) ? "" : d.getDate();
    const month = isNaN(d) ? "" : d.toLocaleDateString("es-ES", { month: "short" }).toUpperCase();

    return `
      <div class="event-item">
        <div class="event-date">
          <span class="event-day">${day}</span>
          <span class="event-month">${month}</span>
        </div>
        <div class="event-info">
          <h4>${ev.title ?? ""}</h4>
          <p class="event-location">${ev.location ?? ""}</p>
          <p class="event-description">${ev.description ?? ""}</p>
        </div>
      </div>
    `;
  }

  _imageBlock(item, isFeatured) {
    if (!item?.image) return "";
    const container = isFeatured ? "featured-image" : "news-image";
    const badge = isFeatured
      ? "featured-badge"
      : `news-category category-${item.category ?? "misc"}`;

    return `
      <div class="${container}">
        <img src="${item.image}" alt="${item.title ?? ""}" loading="lazy">
        <span class="${badge}">${this._categoryLabel(item.category)}</span>
      </div>
    `;
  }

  _contentHtml(item) {
    if (!Array.isArray(item?.content) || item.content.length === 0) return "";
    return `<div class="news-full-content">${item.content.map((t) => `<p>${t}</p>`).join("")}</div>`;
    // Note: if content could come from third parties, sanitize here.
  }

  _linksHtml(item) {
    if (!Array.isArray(item?.links) || !item.links.length) return "";
    const list = item.links
      .map(
        (l) =>
          `<li><a href="${l.url}" target="_blank" rel="noopener noreferrer">${l.label}</a></li>`
      )
      .join("");
    return `<div class="news-links"><h4>Enlaces relacionados</h4><ul>${list}</ul></div>`;
  }

  /* ---------------- Helpers ---------------- */

  _pickFeatured(data) {
    if (data.featured) return data.featured;
    if (data.featuredId && Array.isArray(data.news)) {
      const m = data.news.find((x) => x.id === data.featuredId);
      if (m) return m;
    }
    if (Array.isArray(data.news) && data.news.length) {
      return data.news.slice().sort((a, b) => new Date(b.date) - new Date(a.date))[0] || null;
    }
    return null;
  }

  _categoryLabel(cat) {
    const labels = {
      research: "Investigación",
      events: "Eventos",
      publications: "Publicaciones",
      awards: "Premios",
    };
    return labels[cat] || (cat ?? "misceláneo");
  }

  _formatDate(s) {
    if (!s) return "";
    const d = new Date(s);
    if (isNaN(d)) return s;
    return d.toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });
  }

  _placeholder(container, msg) {
    if (!container) return;
    container.innerHTML = `<p class="placeholder">${msg}</p>`;
  }
}

/* Expose globally */
window.NewsModule = NewsModule;
