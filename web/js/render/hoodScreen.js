// Under the hood on the big wall screen: the 29 inputs flow into the 8 latent numbers, the model
// rebuilds the 29 features from them, and the error per feature lights up (top 3 named).
// Plays on the score screen while the Under the hood panel is open.
import { el } from "../svg.js";
import { KIT } from "../ui/kit.js";
import { fitText, text } from "./screenKit.js";

const STAGES = [0.7, 0.6, 0.7, 0.8];   // seconds: inputs, squeeze, rebuild, error
const LAYOUT = { input: [0, 0.4], latent: [0.45, 0.57], output: [0.62, 1] };  // shares of the width
const ERROR_ROOM = 0.32;               // share of the height under the output bars for errors
const WALL_LABELS = 3;                 // the wall names only the 3 biggest errors (the panel shows 5)
const LABEL_STEP = 10;                 // top-3 names are stacked so neighbours do not overlap

export class HoodScreen {
  constructor(svg, box) {
    this.box = box;
    this.g = el("g", { class: "hood-screen" }, svg);
    this.g.style.display = "none";
  }

  /** d: hoodOf() result; label: name of the model. */
  play(d, id, label) {
    this.g.replaceChildren(); this.g.style.display = "";
    const b = this.box;
    text(this.g, b.x, b.y - 14, `Inside ${label}: payment #${id}`, "screen-title");
    this.parts = { input: this.#bars(d.x.map(signedRoot), "input", KIT.legit), latent: this.#bars(d.z, "latent", KIT.mustard),
      output: this.#bars(d.rec.map(signedRoot), "output", KIT.teal, ERROR_ROOM) };
    this.errors = this.#errors(d);
    this.links = this.#links();
    // plain words: the payment goes in, gets squeezed, comes back out; red is what didn't come back right
    for (const [k, label2] of [["input", `the payment (${d.x.length} numbers)`], ["latent", `squeezed to ${d.z.length}`], ["output", "rebuilt: red = didn't fit"]]) {
      const [a, c] = LAYOUT[k];
      fitText(text(this.g, b.x + ((a + c) / 2) * b.w, b.y + b.h + 17, "", "screen-note", { "text-anchor": "middle" }), label2, (c - a) * b.w + 20);
    }
    this.t = 0; this.playing = true;
  }

  stop() { this.playing = false; this.g.style.display = "none"; }

  // Bars around a middle line in one column band; values scaled to the largest in the band.
  #bars(values, band, colour, bottomShare = 0) {
    const b = this.box, [a, c] = LAYOUT[band], x0 = b.x + a * b.w, w = (c - a) * b.w / values.length;
    const h = b.h * (1 - bottomShare), mid = b.y + h / 2, max = Math.max(1e-9, ...values.map(Math.abs));
    return values.map((v, k) => {
      const full = (Math.abs(v) / max) * (h / 2 - 4);
      const r = el("rect", { x: (x0 + k * w + 0.6).toFixed(1), width: Math.max(1, w - 1.2).toFixed(1), rx: 1, fill: colour }, this.g);
      return { r, full, up: v >= 0, mid, cx: x0 + k * w + w / 2 };
    });
  }

  #errors(d) {
    const b = this.box, out = this.parts.output, max = Math.max(...d.err), named = d.top.slice(0, WALL_LABELS), top = new Set(named.map((f) => f.name));
    const base = b.y + b.h, room = b.h * ERROR_ROOM - 4, rank = new Map(named.map((f, k) => [f.name, k]));
    return d.err.map((e, k) => {
      const hot = top.has(d.features[k]), lift = hot ? 3 + LABEL_STEP * rank.get(d.features[k]) : 0, w = out[1] ? out[1].cx - out[0].cx : 4;
      const r = el("rect", { x: (out[k].cx - w / 2 + 0.6).toFixed(1), width: Math.max(1, w - 1.2).toFixed(1), y: base, height: 0, rx: 1,
        fill: hot ? KIT.fraud : "#8E9BB0" }, this.g);
      const label = hot ? text(this.g, out[k].cx, base - (e / max) * room - lift, d.features[k], "screen-tick", { "text-anchor": "middle", opacity: 0, style: `fill: ${KIT.cream}` }) : null;
      return { r, h: (e / max) * room, base, label };
    });
  }

  // Thin lines from the inputs to the latent band and from it to the outputs.
  #links() {
    const b = this.box, mid = b.y + b.h * (1 - ERROR_ROOM) / 2, g = el("g", { opacity: 0 }, this.g);
    const [i1, l0, l1, o0] = [LAYOUT.input[1], LAYOUT.latent[0], LAYOUT.latent[1], LAYOUT.output[0]].map((s) => b.x + s * b.w);
    for (const dy of [-30, -10, 10, 30]) {
      el("line", { x1: i1, y1: mid + dy * 1.6, x2: l0, y2: mid + dy * 0.5, stroke: KIT.mustard, "stroke-width": 1 }, g);
      el("line", { x1: l1, y1: mid + dy * 0.5, x2: o0, y2: mid + dy * 1.6, stroke: KIT.teal, "stroke-width": 1 }, g);
    }
    return g;
  }

  update(dt) {
    if (!this.playing) return;
    this.t += dt;
    const ends = STAGES.reduce((acc, s) => [...acc, (acc.at(-1) ?? 0) + s], []);
    const u = (k) => Math.min(1, Math.max(0, (this.t - (ends[k] - STAGES[k])) / STAGES[k]));
    grow(this.parts.input, u(0)); this.links.setAttribute("opacity", (0.6 * u(1)).toFixed(2));
    grow(this.parts.latent, u(1)); grow(this.parts.output, u(2));
    for (const e of this.errors) {
      const h = e.h * u(3);
      e.r.setAttribute("y", (e.base - h).toFixed(1)); e.r.setAttribute("height", h.toFixed(1));
      e.label?.setAttribute("opacity", u(3).toFixed(2));
    }
  }
}

function grow(bars, u) {
  const e = u * u * (3 - 2 * u);
  for (const b of bars) {
    const h = b.full * e;
    b.r.setAttribute("y", (b.up ? b.mid - h : b.mid).toFixed(1)); b.r.setAttribute("height", Math.max(0, h).toFixed(1));
  }
}

// Square root keeps Amount (hundreds of EUR) and V1..V28 (around 1) on one picture.
const signedRoot = (v) => Math.sign(v) * Math.sqrt(Math.abs(v));
