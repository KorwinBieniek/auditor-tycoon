// Wall screen 1: the score distribution of this shift so far, live. New transactions fall as dots
// into their bins (all alerts and frauds, a sample of the rest), the bars grow, the threshold line
// slides to its place when the model changes, and a bin flashes green for a caught fraud and red
// for one that slipped through unflagged. X: log10 score, bar heights: square root of counts.
import { el } from "../svg.js";
import { KIT } from "../ui/kit.js";
import { WALL } from "./geometry.js";
import { screenFrame, legend, text } from "./screenKit.js";
import { count } from "../ui/format.js";

const BINS = 30;
const DOTS = 24;               // dot pool
const DOT_SECONDS = 0.9;       // fall time
const DOTS_PER_SECOND = 6;     // sample rate of unflagged legit transactions (real seconds)
const FLASH_SECONDS = 1.2;
const SLIDE_SECONDS = 0.6;
const HEADROOM = 0.86;         // the tallest legit bar stops below the title and the threshold label
const FRAUD_HEIGHT = 0.55;     // fraud bars use this share of the height (they are few)

export class ScoreScreen {
  constructor(svg, source) {
    this.source = source;
    this.p = screenFrame(svg, WALL.scoreScreen, "");
    this.plot = el("g", {}, this.p.g);
    this.bars = [...Array(BINS)].map(() => ({ legit: this.#rect(KIT.legit, 0.85), fraud: this.#rect(KIT.fraud, 1) }));
    this.flashes = { caught: this.#flash(KIT.caught), missed: this.#flash(KIT.fraud) };
    this.line = el("line", { stroke: KIT.mustard, "stroke-width": 2, "stroke-dasharray": "5 4" }, this.plot);
    this.lineLabel = text(this.plot, 0, 0, "", "screen-note");
    this.dots = [...Array(DOTS)].map(() => ({ c: el("circle", { r: 4, stroke: KIT.cream, "stroke-width": 1.5, opacity: 0 }, this.plot), until: -1 }));
    legend(this.plot, this.p.x, this.p.y + this.p.h + 17, [["Fine", KIT.legit], ["Fraud", KIT.fraud], ["Caught", KIT.caught]]);
    this.lineX = null; this.t = 0;
  }

  #rect(fill, opacity) { return el("rect", { rx: 1.5, fill, opacity, height: 0, width: 0 }, this.plot); }
  #flash(stroke) { return el("rect", { rx: 3, fill: "none", stroke, "stroke-width": 2.5, opacity: 0 }, this.plot); }

  /** New shift or model: axis from the whole shift, bars from zero, the threshold slides over. */
  reset(shift, model, label = model) {
    const c = this.source.columns, scores = this.source.scores(model);
    const logs = []; for (let r = shift.first; r < shift.last; r++) logs.push(Math.log10(Math.max(scores[r], 1e-6)));
    this.lo = Math.min(...logs); this.hi = Math.max(...logs);
    Object.assign(this, { shift, model, scores, cursor: shift.first, sampleDebt: 0 });
    this.counts = Array.from({ length: BINS }, () => ({ legit: 0, fraud: 0 }));
    const full = Array.from({ length: BINS }, () => ({ legit: 0, fraud: 0 }));
    for (let r = shift.first; r < shift.last; r++) full[this.bin(scores[r])][c.is_fraud[r] ? "fraud" : "legit"] += 1;
    this.maxL = Math.max(1, ...full.map((b) => b.legit)); this.maxF = Math.max(1, ...full.map((b) => b.fraud));
    this.p.title.textContent = `How unusual each payment looks (${label.toLowerCase()})`;
    this.#slideThreshold();
    this.#drawBars();
  }

  bin(score) { return Math.min(BINS - 1, Math.max(0, Math.floor(((Math.log10(Math.max(score, 1e-6)) - this.lo) / (this.hi - this.lo)) * BINS))); }

  #slideThreshold() {
    const thr = this.source.threshold(this.model), p = this.p;
    const x = p.x + ((Math.log10(thr) - this.lo) / (this.hi - this.lo)) * p.w;
    this.slide = { from: this.lineX ?? x, to: x, start: this.t };
    this.lineLabel.textContent = "alert line";
  }

  /** Counts every transaction up to dataset time `now`; sampled ones start falling. */
  advance(now, realRowsPerSecond) {
    const c = this.source.columns, thr = this.source.threshold(this.model);
    const keepEvery = Math.max(1, Math.round(realRowsPerSecond / DOTS_PER_SECOND));
    let added = false;
    while (this.cursor < this.shift.last && c.time[this.cursor] <= now) {
      const r = this.cursor++, fraud = !!c.is_fraud[r], s = this.scores[r];
      this.counts[this.bin(s)][fraud ? "fraud" : "legit"] += 1; added = true;
      if (fraud || s > thr || ++this.sampleDebt % keepEvery === 0) this.#drop(s, fraud);
    }
    if (added) this.#drawBars();
  }

  #drop(score, fraud) {
    const dot = this.dots.find((d) => d.until < this.t);
    if (!dot) return;
    Object.assign(dot, { x: this.#binX(this.bin(score)) + this.#bw() / 2, start: this.t, until: this.t + DOT_SECONDS, bin: this.bin(score) });
    dot.c.setAttribute("fill", fraud ? KIT.fraud : KIT.legit);
  }

  /** Caught (green) or missed unflagged (red) fraud: its bin flashes. */
  flash(type, score) { return; /* calmer screen: the bars and the ticker already show it */ this.flashes[type].until = this.t + FLASH_SECONDS; this.flashes[type].bin = this.bin(score); }

  /** Hover (scene point): what is in the bar under the mouse so far this shift, or null. */
  hover(x, y) {
    const p = this.p;
    if (!this.counts || x < p.x || x > p.x + p.w || y < p.y - 20 || y > p.y + p.h) return null;
    const k = Math.min(BINS - 1, Math.floor((x - p.x) / this.#bw())), c = this.counts[k];
    const lo = 10 ** (this.lo + (k / BINS) * (this.hi - this.lo)), hi = 10 ** (this.lo + ((k + 1) / BINS) * (this.hi - this.lo));
    const thr = this.source.threshold(this.model), side = lo >= thr ? "alerts" : hi <= thr ? "not flagged" : "around the line";
    const f = (v) => (v < 10 ? v.toFixed(2) : v.toFixed(0));
    return { x: this.#binX(k) + this.#bw() / 2, y: p.y, text: `Score ${f(lo)} to ${f(hi)} (${side}): ${count(c.legit)} fine, ${count(c.fraud)} fraud so far` };
  }

  #bw() { return this.p.w / BINS; }
  #binX(k) { return this.p.x + k * this.#bw(); }
  #barTop(k) { const p = this.p; return p.y + p.h - p.h * HEADROOM * Math.sqrt(this.counts[k].legit / this.maxL); }

  #drawBars() {
    const p = this.p, bw = this.#bw(), bottom = p.y + p.h;
    this.counts.forEach((cnt, k) => {
      const hl = p.h * HEADROOM * Math.sqrt(cnt.legit / this.maxL), hf = p.h * FRAUD_HEIGHT * (cnt.fraud / this.maxF);
      setRect(this.bars[k].legit, this.#binX(k), bottom - hl, bw - 1.5, hl);
      setRect(this.bars[k].fraud, this.#binX(k) + bw * 0.22, bottom - hf, bw * 0.5, hf);
    });
  }

  /** Animation step (real seconds). */
  update(dt) {
    this.t += dt;
    this.#drawLine();
    this.#drawDots();
    this.#drawFlashes();
  }

  #drawLine() {
    const s = this.slide, u = Math.min(1, (this.t - s.start) / SLIDE_SECONDS), e = u * u * (3 - 2 * u);
    this.lineX = s.from + (s.to - s.from) * e;
    const p = this.p, x = this.lineX.toFixed(1);
    Object.entries({ x1: x, x2: x, y1: p.y - 8, y2: p.y + p.h }).forEach(([k, v]) => this.line.setAttribute(k, v));
    this.lineLabel.setAttribute("x", (this.lineX + 5).toFixed(1)); this.lineLabel.setAttribute("y", p.y + 10);
  }

  #drawDots() {
    for (const d of this.dots) {
      if (d.until < this.t) { d.c.setAttribute("opacity", 0); continue; }
      const u = (this.t - d.start) / DOT_SECONDS, y = this.p.y + 6 + (this.#barTop(d.bin) - 4 - this.p.y - 6) * u * u;
      d.c.setAttribute("cx", d.x.toFixed(1)); d.c.setAttribute("cy", y.toFixed(1)); d.c.setAttribute("opacity", 1);
    }
  }

  #drawFlashes() {
    const p = this.p, bw = this.#bw();
    for (const rect of Object.values(this.flashes)) {
      const left = (rect.until ?? -1) - this.t;
      rect.setAttribute("opacity", left > 0 ? Math.min(1, left * 2) : 0);
      if (left > 0) setRect(rect, this.#binX(rect.bin) - 2, p.y - 2, bw + 2.5, p.h + 4);
    }
  }

  /** Hides the histogram while the Under the hood animation plays on this screen. */
  setVisible(on) { for (const e of [this.plot, this.p.title]) e.style.display = on ? "" : "none"; }
  get box() { return this.p; }
}

function setRect(r, x, y, w, h) {
  r.setAttribute("x", x.toFixed(1)); r.setAttribute("y", y.toFixed(1));
  r.setAttribute("width", Math.max(0, w).toFixed(1)); r.setAttribute("height", Math.max(0, h).toFixed(1));
}
