/**
 * TeamModule (simplified) – LIS Team Page
 * - Loads with LISDataCache
 * - Initial year from params or last available
 * - Idempotent render by signature (avoids redundant work)
 * - Sort by hierarchy + defensive against missing data
 */

class TeamModule {
  constructor() {
    // State
    this.currentYear = null;
    this._signature = "";

    // DOM
    this.yearSelect = null;
    this.teamContent = null;

    // Handlers
    this._onYearChange = this._onYearChange.bind(this);
  }

  /* ---------------- Bootstrap ---------------- */

  async init(params = {}) {
    await this._ensureData();
    this._grabRefs();
    if (!this.teamContent) return;

    // Populate select with available years from data
    this._populateYearSelect();

    this._wireEvents();

    // Initial year: valid params.year or last available
    const initialYear =
      (params.year && this._isValidYear(String(params.year))) ? String(params.year) : this._lastAvailableYear();

    if (initialYear) this._selectYear(initialYear, { fromNavigation: true });
  }

  cleanup() {
    this.yearSelect?.removeEventListener("change", this._onYearChange);
    this.currentYear = null;
    this._signature = "";
    this.yearSelect = null;
    this.teamContent = null;
  }

  /* ---------------- Data ---------------- */

  async _ensureData() {
    if (!window.LISTeamData) {
      window.LISTeamData = await window.LISDataCache.get("./data/staff-data.json", { type: "json" });
    }
  }

  get _data() {
    return window.LISTeamData || {};
  }

  /* ---------------- DOM / Events ---------------- */

  _grabRefs() {
    this.yearSelect = document.getElementById("year-select");
    this.teamContent = document.getElementById("team-content");
  }

  _wireEvents() {
    if (!this.yearSelect) return;
    this.yearSelect.removeEventListener("change", this._onYearChange);
    this.yearSelect.addEventListener("change", this._onYearChange);
  }

  _onYearChange(e) {
    const y = String(e.target.value || "");
    this._selectYear(y, { fromNavigation: false });
  }

  /* ---------------- Year / Navigation ---------------- */

  _populateYearSelect() {
    if (!this.yearSelect) return;
    const years = this._availableYears();
    if (!years.length) {
      this.yearSelect.innerHTML = `<option value="" disabled selected>Sin datos</option>`;
      return;
    }
    // If you prefer most recent first: years.slice().reverse()
    this.yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("");
  }

  _availableYears() {
    return Object.keys(this._data).filter((y) => /^\d{4}$/.test(y)).sort();
  }

  _lastAvailableYear() {
    const years = this._availableYears();
    return years.length ? years[years.length - 1] : null;
  }

  _isValidYear(year) {
    return !!(year && this._data && this._data[year]);
  }

  _selectYear(year, { fromNavigation }) {
    if (!this._isValidYear(year)) {
      return this._error(`Año no válido o sin datos: ${year}`);
    }

    // Signature to avoid redundant renders
    const signature = `y:${year}`;
    if (signature === this._signature) return;
    this._signature = signature;

    this.currentYear = year;
    if (this.yearSelect) this.yearSelect.value = year;

    // Synchronize URL if change comes from user
    if (!fromNavigation && window.router?.navigateTo) {
      window.router.navigateTo("equipo", { year });
    }

    this._renderYear(year);
  }

  /* ---------------- Render ---------------- */

  _renderYear(year) {
    const data = this._data[year];
    if (!data || !Array.isArray(data.personal)) {
      return this._error(`No hay miembros del equipo para ${year}.`);
    }

    const members = this._sortedByHierarchy(data.personal.slice());
    this.teamContent.innerHTML = this._teamGridHTML(members);
  }

  _teamGridHTML(members) {
    if (!members.length) {
      return `<div class="loading-message"><p>No hay miembros del equipo disponibles para este año.</p></div>`;
    }

    const cards = members
      .map((m) => {
        const role = m.role || "Personal";
        const cls = this._hierarchyClass(role);
        const label = this._hierarchyLabel(role);
        const photo = this._photoSrc(m.photo);

        return `
          <div class="staff-card ${cls}">
            <div class="staff-photo">
              <img src="${photo}" alt="${m.name ?? ""}" loading="lazy"
                   onerror="this.onerror=null;this.src='img/avatar-default.svg'">
            </div>
            <div class="staff-info">
              <h3>${m.name ?? ""}</h3>
              <p class="staff-role">${role}</p>
              <span class="staff-hierarchy">${label}</span>
            </div>
          </div>`;
      })
      .join("");

    return `
      <div class="staff-section">
        <h2>Equipo del Laboratorio</h2>
        <div class="staff-grid">${cards}</div>
      </div>`;
  }

  /* ---------------- Hierarchy & Utils ---------------- */

  _sortedByHierarchy(members) {
    return members.sort((a, b) => {
      const ha = this._rank(a.role || "");
      const hb = this._rank(b.role || "");
      if (ha !== hb) return ha - hb;
      return (a.name || "").localeCompare(b.name || "");
    });
  }

  _rank(role) {
    const r = (role || "").toLowerCase();
    // Orden: Secretario (1) > Jefe/Director (2) > Investigador/Personal (3) > Becario/Pasante/Estudiante (4) > otros (99)
    if (r.includes("secretario")) return 1;
    if (r.includes("jefe") || r.includes("director")) return 2;
    if (r.includes("investigador") || r.includes("personal")) return 3;
    if (r.includes("becario") || r.includes("pasante") || r.includes("estudiante")) return 4;
    return 99;
  }

  _hierarchyClass(role) {
    const r = (role || "").toLowerCase();
    if (r.includes("secretario")) return "hierarchy-secretary";
    if (r.includes("jefe") || r.includes("director")) return "hierarchy-chief";
    if (r.includes("investigador")) return "hierarchy-staff";
    if (r.includes("becario") || r.includes("pasante") || r.includes("estudiante")) return "hierarchy-scholarship";
    return "hierarchy-staff";
  }

  _hierarchyLabel(role) {
    const r = (role || "").toLowerCase();
    if (r.includes("secretario")) return "Secretario";
    if (r.includes("jefe") || r.includes("director")) return "Jefe";
    if (r.includes("investigador")) return "Investigador";
    if (r.includes("becario") || r.includes("pasante") || r.includes("estudiante")) return "Becario";
    return "Personal";
  }

  _photoSrc(src) {
    if (!src || /placeholder-person\.jpg$/i.test(src)) return "img/avatar-default.svg";
    return src;
  }

  _error(msg) {
    if (!this.teamContent) return;
    this.teamContent.innerHTML = `
      <div class="error-message">
        <h3>Error</h3>
        <p>${msg}</p>
      </div>`;
  }

  /* ---------------- Optional public API ---------------- */

  getCurrentYear() { return this.currentYear; }
  getAvailableYears() { return this._availableYears(); }
}

/* Expose globally */
window.TeamModule = TeamModule;
