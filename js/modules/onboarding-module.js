/**
 * OnboardingModule
 * - Fetches content/onboarding.md and renders it client-side with `marked`
 * - Builds a sticky in-page table of contents (no hash changes, to avoid
 *   clashing with the SPA's hash-based router)
 * - Renders ```mermaid fenced code blocks as SVG diagrams via `mermaid`
 * - marked and mermaid are vendored locally (js/vendor/) and lazy-loaded,
 *   since the site's CSP only allows same-origin scripts
 */
class OnboardingModule {
  constructor() {
    this.$ = (sel) => document.querySelector(sel);
    this.articleEl = null;
    this.tocEl = null;

    this._onTocClick = (e) => {
      // Delegated globally: catches TOC links and in-article "Unidades" links.
      // Never let these touch location.hash (the SPA router treats any hash
      // change as a page navigation attempt).
      const link = e.target.closest("a[href^='#']");
      if (!link) return;
      e.preventDefault();
      const id = decodeURIComponent(link.getAttribute("href").slice(1));
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
  }

  async init() {
    this.articleEl = this.$("#onboarding-content");
    this.tocEl = this.$("#onboarding-toc-list");
    if (!this.articleEl) return;

    document.addEventListener("click", this._onTocClick);

    try {
      const [md] = await Promise.all([this._fetchMarkdown(), this._ensureMarked()]);
      const html = window.marked.parse(md, { mangle: false, headerIds: false });
      this.articleEl.innerHTML = html;
      this._assignHeadingIds();
      this._buildTOC();
      await this._renderMermaid();
    } catch (err) {
      console.error("[OnboardingModule] error:", err);
      this.articleEl.innerHTML = `
        <div class="error-message">
          <h2>Error</h2>
          <p>No fue posible cargar la guía de onboarding.</p>
        </div>`;
    } finally {
      this.articleEl.setAttribute("aria-busy", "false");
    }
  }

  cleanup() {
    document.removeEventListener("click", this._onTocClick);
    this.articleEl = null;
    this.tocEl = null;
  }

  /* ---------------- Data ---------------- */

  async _fetchMarkdown() {
    const res = await fetch("./content/onboarding.md", { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status} loading onboarding.md`);
    return res.text();
  }

  _ensureMarked() {
    if (window.marked) return Promise.resolve();
    return this._loadScript("./js/vendor/marked.min.js");
  }

  _ensureMermaid() {
    if (window.mermaid) return Promise.resolve();
    return this._loadScript("./js/vendor/mermaid.min.js");
  }

  _loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        if (existing.dataset.loaded) resolve();
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => { s.dataset.loaded = "1"; resolve(); };
      s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      document.head.appendChild(s);
    });
  }

  /* ---------------- Rendering ---------------- */

  _assignHeadingIds() {
    const headings = this.articleEl.querySelectorAll("h2, h3, h4");
    const used = new Set();
    headings.forEach((h) => {
      let id = this._slugify(h.textContent);
      let unique = id;
      let n = 2;
      while (used.has(unique)) unique = `${id}-${n++}`;
      used.add(unique);
      h.id = unique;
    });
  }

  _slugify(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[¿?¡!"'()]/g, "")
      .replace(/[^a-z0-9áéíóúñü]+/gi, "-")
      .replace(/^-+|-+$/g, "");
  }

  _buildTOC() {
    if (!this.tocEl) return;
    const headings = Array.from(this.articleEl.querySelectorAll("h2"));
    if (!headings.length) {
      this.tocEl.innerHTML = "";
      return;
    }
    this.tocEl.innerHTML = `<ul class="onboarding-toc__ul">${headings
      .map((h) => `<li><a href="#${h.id}">${h.textContent}</a></li>`)
      .join("")}</ul>`;
  }

  async _renderMermaid() {
    const blocks = Array.from(this.articleEl.querySelectorAll("code.language-mermaid"));
    if (!blocks.length) return;

    await this._ensureMermaid();
    window.mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "strict" });

    blocks.forEach((code) => {
      const pre = code.closest("pre");
      const div = document.createElement("div");
      div.className = "mermaid";
      div.textContent = code.textContent;
      pre?.replaceWith(div);
    });

    try {
      await window.mermaid.run({ querySelector: "#onboarding-content .mermaid" });
    } catch (err) {
      console.error("[OnboardingModule] mermaid render error:", err);
    }
  }
}

window.OnboardingModule = OnboardingModule;
