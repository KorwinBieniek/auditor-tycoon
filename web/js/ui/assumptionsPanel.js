// Assumptions panel: one slider per assumption from config.js. Changes are reported to the game,
// which remaps the money (instant) or restarts the shift (check time changes the simulation).
import { ASSUMPTION_RANGES, DEFAULT_ASSUMPTIONS, AMOUNT_THRESHOLD_PLN, SMS_COST_PLN } from "../config.js";
import { money } from "./format.js";

// the exchange rate changes the simulation too: the amount threshold is in PLN, the data in EUR
const SIM_KEYS = new Set(["minutesPerCheck", "plnPerEur"]);
const TAGGED = new Set(["falseAlarmCostPln"]);   // shown with an "assumption" tag

// The filled part of the styled track.
const pos = (v, r) => (100 * (Math.min(r.max, Math.max(r.min, v)) - r.min) / (r.max - r.min)).toFixed(1);

function paint(input, range) {
  input.style.setProperty("--fill", `${((100 * (input.value - range.min)) / (range.max - range.min)).toFixed(1)}%`);
}

export class AssumptionsPanel {
  constructor(root, { values, onChange }) {
    this.root = root; this.values = values; this.onChange = onChange; this.inputs = {};
    for (const [key, range] of Object.entries(ASSUMPTION_RANGES)) this.#row(key, range);
    this.#processRow();
  }

  // Fixed process rule, not a slider: one line, so every number the game uses is on this panel.
  #processRow() {
    const row = document.createElement("div");
    row.className = "slider-row fixed-row";
    row.innerHTML = `<label>Alerts under ${money(AMOUNT_THRESHOLD_PLN)}</label><output>SMS to the customer</output>
      <small>Cheaper than an auditor (${SMS_COST_PLN.toFixed(2)} PLN). A fraud that goes this way counts as lost.</small>`;
    this.root.append(row);
  }

  #row(key, range) {
    const row = document.createElement("div");
    row.className = "slider-row";
    const tag = TAGGED.has(key) ? ` <span class="tag">our guess</span>` : "";
    const dots = range.points.map((p, k) => `<button class="a-dot" data-k="${k}" style="left:${pos(p.v, range)}%" aria-label="${p.label}"></button>`).join("");
    row.innerHTML = `<label for="a-${key}">${range.label}${tag}</label><output id="o-${key}"></output>
      <div class="a-track"><input id="a-${key}" type="range" min="${range.min}" max="${range.max}" step="${range.step}">${dots}</div>
      <div class="a-tip" hidden></div><small>${range.note ?? ""}</small>`;
    this.root.append(row);
    const input = row.querySelector("input"), out = row.querySelector("output"), tip = row.querySelector(".a-tip");
    input.value = this.values[key];
    out.textContent = range.format(this.values[key]);
    paint(input, range);
    // dragging only moves the label; the game recomputes once, when the slider is let go (no stutter)
    input.oninput = () => { paint(input, range); out.textContent = range.format(Number(input.value)); };
    input.onchange = () => {
      this.values[key] = Number(input.value);
      this.onChange(key, SIM_KEYS.has(key));
    };
    // a dot is a real data point: hover shows what it is and where it comes from, a click moves the slider there
    for (const b of row.querySelectorAll(".a-dot")) {
      const p = range.points[Number(b.dataset.k)];
      b.onmouseenter = () => {
        tip.innerHTML = `${p.label}${p.url ? ` <a href="${p.url}" target="_blank" rel="noopener">source</a>` : ""}`;
        tip.hidden = false;
      };
      b.onclick = () => { input.value = p.v; input.oninput(); input.onchange(); };
    }
    row.onmouseleave = () => { tip.hidden = true; };
    this.inputs[key] = { input, out, range };
  }

  reset() {
    for (const [key, { input, out, range }] of Object.entries(this.inputs)) {
      this.values[key] = DEFAULT_ASSUMPTIONS[key];
      input.value = this.values[key]; out.textContent = range.format(this.values[key]); paint(input, range);
    }
    this.onChange("all", true);
  }
}
