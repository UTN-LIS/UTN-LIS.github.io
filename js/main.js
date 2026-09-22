// main.js - General functionalities for the site 

/* ---------------- Mobile navigation with scroll hide ---------------- */
function initNavigation() {
  const toggleButton = document.getElementById("mobile-menu-toggle");
  const navWrapper = document.getElementById("primary-navigation");
  const navMenu = navWrapper?.querySelector(".nav-menu");
  const header = document.querySelector(".header");
  const body = document.body;

  if (!toggleButton || !navWrapper || !navMenu) return;

  let lastScrollTop = 0;
  let headerHeight = header ? header.offsetHeight : 0;
  let isHeaderHidden = false;

  const closeMenu = () => {
    navWrapper.classList.remove("is-open");
    toggleButton.classList.remove("active");
    toggleButton.setAttribute("aria-expanded", "false");
    body.classList.remove("menu-open");
  };

  toggleButton.addEventListener("click", () => {
    const willOpen = !navWrapper.classList.contains("is-open");
    navWrapper.classList.toggle("is-open", willOpen);
    toggleButton.classList.toggle("active", willOpen);
    toggleButton.setAttribute("aria-expanded", String(willOpen));
    body.classList.toggle("menu-open", willOpen);

    if (willOpen && header) {
      header.classList.remove("header-hidden");
      isHeaderHidden = false;
    }
  });

  // Close when clicking outside the menu
  document.addEventListener("click", (e) => {
    if (
      body.classList.contains("menu-open") &&
      !e.target.closest(".nav-menu-wrapper") &&
      !e.target.closest("#mobile-menu-toggle")
    ) {
      closeMenu();
    }
  });

  // Reset if width > breakpoint
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) closeMenu();
    if (header) headerHeight = header.offsetHeight;
  });

  // Hide header on scroll down, show on scroll up
  window.addEventListener(
    "scroll",
    () => {
      if (!header || navWrapper.classList.contains("is-open")) return;

      const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
      if (currentScroll <= 10) {
        header.classList.remove("header-hidden", "scrolled");
        isHeaderHidden = false;
        return;
      }

      header.classList.add("scrolled");

      const isScrollingUp = currentScroll < lastScrollTop;
      if (!isScrollingUp && !isHeaderHidden && currentScroll > headerHeight) {
        header.classList.add("header-hidden");
        isHeaderHidden = true;
      } else if (isScrollingUp && isHeaderHidden) {
        header.classList.remove("header-hidden");
        isHeaderHidden = false;
      }

      lastScrollTop = currentScroll;
    },
    { passive: true }
  );

  window.addEventListener("pageLoaded", closeMenu);
}

/* ---------------- Light global cache ---------------- */
window.LISDataCache = {
  _store: new Map(),
  _pending: new Map(),
  _config: { htmlTTL: 10 * 60 * 1000, jsonTTL: 5 * 60 * 1000 },

  async get(url, { type } = {}) {
    type = type || this._guessType(url);
    const ttl = type === "html" ? this._config.htmlTTL : this._config.jsonTTL;

    if (this._pending.has(url)) return this._pending.get(url);

    const cached = this._store.get(url);
    if (cached && Date.now() < cached.expiry) return Promise.resolve(cached.data);

    const fetchPromise = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return type === "json" ? r.json() : r.text();
      })
      .then((data) => {
        this._store.set(url, { data, expiry: Date.now() + ttl });
        this._pending.delete(url);
        return data;
      })
      .catch((err) => {
        this._pending.delete(url);
        throw err;
      });

    this._pending.set(url, fetchPromise);
    return fetchPromise;
  },

  purge(url) {
    url ? this._store.delete(url) : this._store.clear();
  },

  getStats() {
    return {
      size: this._store.size,
      pending: this._pending.size,
      keys: Array.from(this._store.keys()),
    };
  },

  _guessType(url) {
    if (url.endsWith(".json")) return "json";
    if (url.includes("/content/") || url.endsWith(".html")) return "html";
    return "json";
  },
};

/* ---------------- Global initialization ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
});
