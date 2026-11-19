/**
 * NewsModule – LIS News Page
 * - Loads with LISDataCache
 * - Category filter tabs built from the categories present in the data
 * - News sorted by date, most recent first
 */
class NewsModule {
  constructor() {
    // State
    this.currentCategory = "all";
    this.items = [];
    this.gallery = [];
    this.galleryIndex = 0;

    // DOM
    this.filtersEl = null;
    this.listEl = null;
    this.galleryEl = null;
    this.galleryGrid = null;
    this.lightbox = null;

    // Handlers
    this._onFilterClick = this._onFilterClick.bind(this);
    this._onGalleryClick = this._onGalleryClick.bind(this);
    this._onLightboxClick = this._onLightboxClick.bind(this);
    this._onLightboxKey = this._onLightboxKey.bind(this);
  }

  /* ---------------- Bootstrap ---------------- */

  async init() {
    this._grabRefs();
    if (!this.listEl) return;

    try {
      const data = await window.LISDataCache.get("./data/news-data.json", { type: "json" });
      this.items = (Array.isArray(data?.news) ? data.news : [])
        .slice()
        .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
      this.gallery = (Array.isArray(data?.gallery) ? data.gallery : []).filter((g) => g?.src);
    } catch (e) {
      console.error("[NewsModule] Error cargando noticias:", e);
      return this._message("No se pudieron cargar las noticias.");
    }

    this._renderFilters();
    this.filtersEl?.addEventListener("click", this._onFilterClick);
    this._render();

    this._renderGallery();
    this.galleryGrid?.addEventListener("click", this._onGalleryClick);
    this.lightbox?.addEventListener("click", this._onLightboxClick);
    this.lightbox?.addEventListener("keydown", this._onLightboxKey);
  }

  cleanup() {
    this.filtersEl?.removeEventListener("click", this._onFilterClick);
    this.galleryGrid?.removeEventListener("click", this._onGalleryClick);
    this.lightbox?.removeEventListener("click", this._onLightboxClick);
    this.lightbox?.removeEventListener("keydown", this._onLightboxKey);
    if (this.lightbox?.open) this.lightbox.close();
    this.filtersEl = this.listEl = this.galleryEl = this.galleryGrid = this.lightbox = null;
    this.currentCategory = "all";
    this.items = [];
    this.gallery = [];
  }

  /* ---------------- DOM / Events ---------------- */

  _grabRefs() {
    this.filtersEl = document.getElementById("news-filters");
    this.listEl = document.getElementById("news-content");
    this.galleryEl = document.getElementById("news-gallery");
    this.galleryGrid = document.getElementById("gallery-grid");
    this.lightbox = document.getElementById("gallery-lightbox");
  }

  _onFilterClick(e) {
    const btn = e.target.closest(".filter-tab");
    if (!btn) return;
    this.currentCategory = btn.dataset.filter || "all";
    this.filtersEl.querySelectorAll(".filter-tab").forEach((b) => {
      const active = b === btn;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    this._render();
  }

  /* ---------------- Render ---------------- */

  _renderFilters() {
    if (!this.filtersEl) return;
    const categories = [...new Set(this.items.map((n) => n.category).filter(Boolean))];

    // Hide the tabs when there is nothing to filter
    this.filtersEl.hidden = categories.length < 2;

    this.filtersEl.innerHTML = [`<button class="filter-tab active" data-filter="all" aria-pressed="true">Todas</button>`]
      .concat(categories.map((c) =>
        `<button class="filter-tab" data-filter="${this._escape(c)}" aria-pressed="false">${this._categoryLabel(c)}</button>`))
      .join("");
  }

  _render() {
    if (!this.listEl) return;
    const visible = this.currentCategory === "all"
      ? this.items
      : this.items.filter((n) => n.category === this.currentCategory);

    if (!visible.length) {
      return this._message(this.items.length
        ? "No hay noticias en esta categoría."
        : "Próximamente vas a encontrar aquí las novedades del laboratorio.");
    }

    this.listEl.innerHTML = visible.map((n) => this._cardHTML(n)).join("");
    this.listEl.setAttribute("aria-busy", "false");
  }

  _cardHTML(n) {
    const links = Array.isArray(n.links) && n.links.length
      ? `<ul class="news-card__links">${
          n.links
            .filter((l) => l?.url)
            .map((l) => `<li><a href="${l.url}" target="_blank" rel="noopener noreferrer">${l.label || l.url} →</a></li>`)
            .join("")
        }</ul>`
      : "";

    const image = n.image
      ? `<img class="news-card__image" src="${n.image}" alt="" loading="lazy">`
      : "";

    return `
      <article class="news-card${n.image ? " news-card--with-image" : ""}">
        ${image}
        <div class="news-card__body">
          <p class="news-card__meta">
            ${n.date ? `<time datetime="${n.date}">${this._formatDate(n.date)}</time>` : ""}
            ${n.category ? `<span class="news-card__category">${this._categoryLabel(n.category)}</span>` : ""}
          </p>
          <h2 class="news-card__title">${n.title ?? ""}</h2>
          ${n.excerpt ? `<p class="news-card__excerpt">${n.excerpt}</p>` : ""}
          ${links}
        </div>
      </article>`;
  }

  /* ---------------- Gallery ---------------- */

  _renderGallery() {
    if (!this.galleryEl || !this.galleryGrid) return;
    this.galleryEl.hidden = !this.gallery.length;

    this.galleryGrid.innerHTML = this.gallery.map((g, i) => `
      <figure class="gallery-item">
        <button type="button" class="gallery-item__button" data-index="${i}"
                aria-label="Ampliar imagen: ${this._escape(g.caption || g.alt || "")}">
          <img src="${encodeURI(g.src)}" alt="${this._escape(g.alt || "")}" loading="lazy">
        </button>
        ${g.caption ? `<figcaption>${this._escape(g.caption)}</figcaption>` : ""}
      </figure>`).join("");
  }

  _onGalleryClick(e) {
    const btn = e.target.closest(".gallery-item__button");
    if (!btn) return;
    this._showImage(Number(btn.dataset.index));
    if (!this.lightbox.open) this.lightbox.showModal();
  }

  _onLightboxClick(e) {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "close" || e.target === this.lightbox) return this.lightbox.close();
    if (action === "prev") this._showImage(this.galleryIndex - 1);
    if (action === "next") this._showImage(this.galleryIndex + 1);
  }

  _onLightboxKey(e) {
    if (e.key === "ArrowLeft") this._showImage(this.galleryIndex - 1);
    if (e.key === "ArrowRight") this._showImage(this.galleryIndex + 1);
  }

  _showImage(index) {
    const total = this.gallery.length;
    if (!total || !this.lightbox) return;
    this.galleryIndex = (index + total) % total; // wrap around
    const g = this.gallery[this.galleryIndex];
    const img = this.lightbox.querySelector(".lightbox__image");
    img.src = encodeURI(g.src);
    img.alt = g.alt || "";
    this.lightbox.querySelector(".lightbox__caption").textContent =
      `${g.caption || ""}${g.caption ? " · " : ""}${this.galleryIndex + 1} / ${total}`;
  }

  _message(text) {
    if (!this.listEl) return;
    this.listEl.setAttribute("aria-busy", "false");
    this.listEl.innerHTML = `<div class="loading-message news-empty"><p>${text}</p></div>`;
  }

  /* ---------------- Helpers ---------------- */

  _categoryLabel(category) {
    const labels = {
      research: "Investigación",
      events: "Eventos",
      publications: "Publicaciones",
      awards: "Reconocimientos",
    };
    return labels[category] || this._escape(category);
  }

  // "2026-10-04" -> "4 de octubre de 2026" (parsed as a local date to avoid timezone shifts)
  _formatDate(iso) {
    const [y, m, d] = String(iso).split("-").map(Number);
    if (!y || !m || !d) return this._escape(iso);
    return new Date(y, m - 1, d).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
  }

  _escape(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
}

/* Expose globally */
window.NewsModule = NewsModule;
