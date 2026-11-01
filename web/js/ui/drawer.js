// Side panel with three pages that never mix: Settings (shift, model, assumptions folded away), Results and
// About. One model button per model of the data file (my model first).
import { button, onData, setSegment } from "./dom.js";
import { AssumptionsPanel } from "./assumptionsPanel.js";
import { metricsHtml, aboutHtml, WHAT_I_TESTED, ABOUT_EXTRA } from "./texts.js";

const section = (title, body, cls = "", page = "settings") => `<section class="d-sec ${cls}" data-page="${page}"><h3>${title}</h3>${body}</section>`;
const TITLES = { settings: "Settings", results: "Results", about: "About this project" };

export class Drawer {
  constructor(root, { catalog, shifts, names = [], values, on }) {
    Object.assign(this, { root, catalog, on });
    const models = catalog.roles.map((r) => button(r.label, "seg", "", `data-model="${r.id}"`)).join("");
    root.className = "m-drawer"; root.hidden = true;
    root.innerHTML = `<div class="d-head"><h2 class="d-title">Settings</h2>${button("", "sq ghost", "close", 'data-close="1"')}</div>
      ${section("Shift", `<div class="seg-row">${shifts.map((s, k) => button(names[k] ?? `Shift ${k + 1}`, "seg", "", `data-shift="${k}"`)).join("")}</div>
        <div class="b-row2">${button("Restart shift", "", "", 'data-restart="1"')}${button("Skip to results", "", "", 'data-end="1"')}</div>`)}
      ${section("Model", `<div class="seg-row">${models}</div>`)}
      <details class="mx-more d-advanced" data-page="settings"><summary>Numbers behind the money</summary>
        <p class="d-note">Dots are real data points: tap or hover for the source, click to use it.</p><div class="d-sliders"></div>${button("Reset", "ghost small", "", 'data-reset="1"')}</details>
      <div class="b-row2 d-links" data-page="settings">${button("Results", "ghost small", "", 'data-goto="results"')}${button("About this project", "ghost small", "", 'data-goto="about"')}</div>
      ${section("", `<div class="d-metrics"></div>`, "d-metrics-sec", "results")}
      ${section("", `<div class="d-about"></div>`, "d-about-sec", "about")}`;
    this.shiftNames = shifts.map((s) => s.name);
    this.panel = new AssumptionsPanel(root.querySelector(".d-sliders"), { values, onChange: on.assumption });
    onData(root, "close", () => this.close());
    onData(root, "shift", (v) => on.shift(Number(v)));
    onData(root, "restart", () => on.restart());
    onData(root, "end", () => on.toEnd());
    onData(root, "model", (v) => on.model(v));
    onData(root, "reset", () => this.panel.reset());
    onData(root, "goto", (v) => this.open(v));
  }

  /** page: "settings" (default), "results" or "about"; only that page is shown. */
  open(page = "settings") {
    if (page === "metrics") page = "results";
    this.page = page; this.root.hidden = false; this.root.scrollTop = 0;
    this.root.querySelector(".d-title").textContent = TITLES[page];
    for (const el of this.root.querySelectorAll("[data-page]")) el.hidden = el.dataset.page !== page;
    this.on.opened?.();
  }
  close() { this.root.hidden = true; }
  toggle() { this.root.hidden || this.page !== "settings" ? this.open("settings") : this.close(); }
  get isOpen() { return !this.root.hidden; }

  /** Current state: segments, notes, live metrics. */
  set({ shiftIndex, model, volume, n, value, random, roi, best, names }) {
    setSegment(this.root, "shift", shiftIndex); setSegment(this.root, "model", model);
    this.#put(".d-metrics", metricsHtml(this.catalog, { volume, n, model, value, random, roi, best, names, tested: WHAT_I_TESTED }));
    this.#put(".d-about", aboutHtml(this.catalog, volume, ABOUT_EXTRA, value.rows));
  }

  // Only a changed text is written, so an opened "More" stays open while the game runs.
  #put(sel, html) {
    const el = this.root.querySelector(sel);
    if (el.lastHtml !== html) { el.innerHTML = html; el.lastHtml = html; }
  }
}
