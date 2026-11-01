// Wall screen 2: net profit per shift against team size, one line per model of the data file (my model
// first, in mustard; random checking is described in words: it would flatten the Y axis). The dot is the current team; it
// glides when the team changes. Captions are computed live from the curves.
import { el } from "../svg.js";
import { KIT } from "../ui/kit.js";
import { WALL } from "./geometry.js";
import { screenFrame, legend, text, fitText } from "./screenKit.js";
import { peakOf } from "../sim/economy.js";
import { compact, money, percent } from "../ui/format.js";

const CROP = { min: 30, factor: 1.6, round: 10 };  // X axis: up to 1.6x the larger peak or the team
const NEAR_PEAK = 0.1;                              // share of the axis: the peak label joins "you"
const GLIDE_SECONDS = 0.4;
const LEFT = 30;                                    // room for the Y labels
const AXIS_ROOM = 14;                               // room under the plot for the X tick labels
const LEGEND_ITEM = 62;                             // legend width per model
const PEAK_TAG = { first: 28, step: 14 };           // peak labels under the peak dots, one line per model

/** X axis end: every model's peak and the current team fit, rounded up. */
export function curveEnd(points, n, ids) {
  const most = Math.max(...ids.map((id) => peakOf(points, id).n), n);
  return Math.min(points.length, Math.max(CROP.min, Math.ceil((CROP.factor * most) / CROP.round) * CROP.round));
}

/** One sentence when my model peaks with a smaller team AND a higher profit than every comparison, else "". */
export function smallerTeamCaption(points, roles) {
  const [mine, ...others] = roles, v = peakOf(points, mine.id);
  if (!others.length) return "";
  const beats = others.every((o) => { const p = peakOf(points, o.id); return v.n < p.n && v[mine.id] > p[o.id]; });
  const names = others.map((o) => o.short).join(" and ");
  return beats ? `${mine.tag}: more profit with a smaller team than the ${names.toLowerCase()}` : "";
}

/** Random checking in words. */
export function randomCaption(points) {
  const best = peakOf(points, "random");
  return best.random < 0 ? "Random checks: loss at every team size" : `Random checks: best ${money(best.random)} at ${best.n}`;
}

export class ProfitScreen {
  constructor(svg) {
    this.p = screenFrame(svg, WALL.profitScreen, "");
    this.chart = el("g", {}, this.p.g);
    this.dot = el("g", {}, this.p.g);
    el("circle", { r: 9, fill: KIT.cream, opacity: 0.25 }, this.dot);
    el("circle", { r: 5.5, fill: KIT.cream, stroke: KIT.ink, "stroke-width": 1.5 }, this.dot);
    this.info = text(this.p.g, this.p.x + this.p.w, this.p.y - 14, "", "screen-note", { "text-anchor": "end", style: `fill: ${KIT.mustard}` });
    this.caption = text(this.p.g, this.p.x, this.p.y + 1, "", "screen-note", { style: `fill: ${KIT.caught}` });
    this.glide = null; this.t = 0;
  }

  /** New curve (shift, model, assumptions or volume changed). roles: modelRoles() of the data file.
   *  valueAt(n) gives { [id]: share }: the share of the shift's fraud value a team of n catches. */
  build(points, { model, volume, n, valueAt, roles }) {
    const ids = roles.map((r) => r.id);
    Object.assign(this, { points, model, n, valueAt, roles, end: curveEnd(points, n, ids) });
    fitText(this.p.title, "Profit per shift by team size", this.p.w - 90);
    this.chart.replaceChildren();
    const shown = points.slice(0, this.end), vals = shown.flatMap((q) => ids.map((id) => q[id]));
    const yMax = Math.max(...vals), yMin = Math.min(0, ...vals), p = this.p, top = p.y + 12;
    this.X = (k) => p.x + LEFT + ((k - 1) / (this.end - 1)) * (p.w - LEFT);
    this.Y = (v) => top + ((yMax - v) / (yMax - yMin)) * (p.y + p.h - AXIS_ROOM - top);
    this.#axes(yMax);
    for (const r of [...roles].reverse()) this.#line(shown, r.id, r.colour, r.width);   // my model on top
    this.peaks = Object.fromEntries(ids.map((id) => [id, peakOf(points, id)]));
    this.peakLabels = {};
    this.#peakTags();
    this.value = text(this.chart, p.x, p.y + p.h + 18, "", "screen-note");
    const items = roles.map((r) => [r.mine ? "Mine" : r.short.replace(" model", ""), r.colour]);   // short: the legend sits beside the money line
    legend(this.chart, p.x + p.w - LEGEND_ITEM * items.length, p.y + p.h + 18, items);
    // one caption slot: the smaller-team sentence when it holds, else random checking (also in Metrics)
    fitText(this.caption, smallerTeamCaption(points, roles) || randomCaption(points), this.p.w);
    this.glide = null;
    this.setTeam(n, true);
  }

  #axes(yMax) {
    const g = this.chart, p = this.p, ticks = niceTicks(this.end);
    el("line", { x1: this.X(1), x2: this.X(this.end), y1: this.Y(0), y2: this.Y(0), stroke: "#5B6B85", "stroke-width": 1 }, g);
    for (const v of [yMax, 0]) text(g, p.x + LEFT - 6, this.Y(v) + 4, compact(v), "screen-tick", { "text-anchor": "end" });
    for (const k of ticks) text(g, this.X(k), this.Y(0) + 13, k, "screen-tick", { "text-anchor": "middle" });
  }

  #line(shown, key, colour, width) {
    const pts = shown.map((q) => `${this.X(q.n).toFixed(1)},${this.Y(q[key]).toFixed(1)}`).join(" ");
    el("polyline", { points: pts, fill: "none", stroke: colour, "stroke-width": width, "stroke-linejoin": "round" }, this.chart);
  }

  #peakTags() {
    this.roles.forEach((r, k) => {
      const pk = this.peaks[r.id];
      if (pk.n > this.end) return;
      el("circle", { cx: this.X(pk.n), cy: this.Y(pk[r.id]), r: 3.5, fill: r.colour }, this.chart);
      this.peakLabels[r.id] = text(this.chart, this.X(pk.n) + 4, this.Y(pk[r.id]) + PEAK_TAG.first + k * PEAK_TAG.step, `${r.short}: best ${pk.n}`, "screen-note");
    });
  }

  /** Hover (scene point): a guide line at that team size and the numbers for it, or null outside the plot. */
  hover(x, y) {
    const p = this.p;
    if (!this.points || x < p.x + LEFT || x > p.x + p.w || y < p.y || y > p.y + p.h) { this.guide?.setAttribute("opacity", 0); return null; }
    const n = Math.max(1, Math.min(this.end, Math.round(1 + ((x - p.x - LEFT) / (p.w - LEFT)) * (this.end - 1))));
    const q = this.points[n - 1];
    this.guide ??= el("line", { stroke: KIT.cream, "stroke-width": 1, "stroke-dasharray": "3 3" }, this.p.g);
    this.guide.setAttribute("x1", this.X(n)); this.guide.setAttribute("x2", this.X(n));
    this.guide.setAttribute("y1", p.y + 8); this.guide.setAttribute("y2", p.y + p.h - AXIS_ROOM); this.guide.setAttribute("opacity", 0.7);
    const lines = this.roles.map((r) => `${r.short}: ${money(q[r.id])}`).join(" · ");
    return { x: this.X(n), y: p.y + 10, text: `${n} people: ${lines} per shift` };
  }

  /** Current team size; the dot glides there. */
  setTeam(n, instant = false) {
    this.n = Math.min(n, this.points.length);
    const to = this.#point(this.n), from = instant || !this.at ? to : this.at;
    this.glide = { from, to, start: this.t };
    const peak = this.peaks[this.model], near = Math.abs(peak.n - n) < NEAR_PEAK * this.end;
    fitText(this.info, `you: ${n}` + (near ? `, best: ${peak.n}` : ""), 110);
    const share = this.valueAt(n);
    fitText(this.value, `Money stopped: ${this.roles.map((r) => `${r.mine ? "mine" : r.short.replace(" model", "").toLowerCase()} ${percent(share[r.id])}`).join(", ")}`, this.p.w - LEGEND_ITEM * this.roles.length - 10);
    const label = this.peakLabels?.[this.model];
    if (label) label.style.display = near ? "none" : "";
  }

  #point(n) {
    const q = this.points[n - 1], k = Math.min(n, this.end);
    return { x: this.X(k), y: Math.max(this.p.y, Math.min(this.p.y + this.p.h, this.Y(q[this.model]))) };
  }

  update(dt) {
    this.t += dt;
    if (!this.glide) return;
    const u = Math.min(1, (this.t - this.glide.start) / GLIDE_SECONDS), e = u * u * (3 - 2 * u), g = this.glide;
    this.at = { x: g.from.x + (g.to.x - g.from.x) * e, y: g.from.y + (g.to.y - g.from.y) * e };
    this.dot.setAttribute("transform", `translate(${this.at.x.toFixed(1)} ${this.at.y.toFixed(1)})`);
  }
}

// About four round ticks from 1 to the axis end.
function niceTicks(end) {
  const raw = end / 4, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const ticks = [1];
  for (let k = step; k <= end; k += step) ticks.push(k);
  return ticks;
}
