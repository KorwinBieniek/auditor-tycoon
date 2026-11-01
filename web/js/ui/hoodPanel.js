// Under the hood panel: one transaction as the model sees it. The 29 inputs, what the model rebuilt
// from its 8 latent numbers, and the error per feature; the score is the mean of those errors.
import { icon } from "./icons.js";
import { money, datasetTime } from "./format.js";
import { loadHood, hoodOf } from "./hoodData.js";
import { topFeaturesSvg, topSentence, fmt } from "./hoodTop.js";

const STATUS = {
  caught: ["Caught fraud", "caught"], cleared: ["False alarm (checked, legit)", "cleared"],
  missed: ["Missed fraud", "missed"], checking: ["Being checked now", "checking"], queued: ["Waiting in the queue", "queued"],
  scored: ["Not flagged", "scored"],
  sms: ["Flagged, sent to the customer's SMS check (small amount; counted as a loss if fraud)", "sms"],
};

/** name: how a sentence names the model (modelRoles() inText). */
export function hoodHtml({ entry, details, name, threshold, plnPerEur }) {
  const [label, cls] = STATUS[entry.kind];
  const flagged = entry.score > threshold ? "above the threshold: flagged" : "below the threshold: not flagged";
  return `<div class="d-head"><h2>Under the hood</h2><button class="gbtn sq ghost" data-close>${icon("close")}</button></div>
    <p class="h-tx"><b>Transaction #${entry.id}</b>, ${datasetTime(entry.t)}, ${entry.amount.toFixed(2)} EUR (${money(entry.amount * plnPerEur)})
      <span class="chip c-${cls}">${label}${entry.reason ? ` (${entry.reason})` : ""}</span></p>
    <p class="h-score">Score from ${name}: <b>${entry.score.toFixed(3)}</b>, threshold ${threshold.toFixed(3)}, ${flagged}.</p>
    ${details ? detailsHtml(details) : missingHtml(name)}`;
}

function detailsHtml(d) {
  const latent = d.latentLabel ?? `${d.z.length} latent numbers`;
  return `<h3>${d.top.length} features with the biggest error</h3>${topFeaturesSvg(d.top)}
    <p class="h-plain">${topSentence(d.top)}</p>
    <p class="d-note">V1 to V28 are anonymised PCA components from the original dataset, so you can see which components
    don't fit normal transactions, but not what they mean.</p>
    <h3>${latent}</h3>${latentSvg(d.z)}
    <details class="h-all"><summary>Show all features</summary>${featureTable(d)}
    <p class="d-note">Reconstruction is shown in the original units (Amount in EUR). Errors are squared differences in the
    model's scaled units; the score is their mean (${d.score.toFixed(2)}, rounded export).</p></details>`;
}

function missingHtml(name) {
  return `<p class="d-note">No details for this transaction from ${name}: the explanations file keeps every transaction
    flagged by any model and every fraud of the game shifts, for the models that export explanations.</p>`;
}

// Eight bars around zero.
function latentSvg(z) {
  const w = 440, h = 56, bw = w / z.length, max = Math.max(1e-6, ...z.map(Math.abs));
  const bars = z.map((v, k) => {
    const bh = (Math.abs(v) / max) * (h / 2 - 6), y = v >= 0 ? h / 2 - bh : h / 2;
    return `<rect x="${(k * bw + 6).toFixed(1)}" y="${y.toFixed(1)}" width="${(bw - 12).toFixed(1)}" height="${bh.toFixed(1)}" rx="2" class="z-bar"/>
      <text x="${(k * bw + bw / 2).toFixed(1)}" y="${v >= 0 ? h / 2 + 11 : h / 2 - 4}" class="z-val">${v.toFixed(2)}</text>`;
  }).join("");
  return `<svg class="h-latent" viewBox="0 0 ${w} ${h}"><line x1="0" x2="${w}" y1="${h / 2}" y2="${h / 2}" class="z-axis"/>${bars}</svg>`;
}

function featureTable(d) {
  const top = new Set(d.top.map((f) => f.name)), max = Math.max(...d.err);
  const rows = d.features.map((name, j) => `<tr class="${top.has(name) ? "top" : ""}"><td>${name}</td><td>${fmt(d.x[j])}</td><td>${fmt(d.rec[j])}</td>
    <td class="e-num">${d.err[j].toPrecision(3)}</td><td class="e-cell"><span class="e-bar" style="width:${((100 * d.err[j]) / max).toFixed(1)}%"></span></td></tr>`).join("");
  return `<table class="h-table"><thead><tr><th>Feature</th><th>Input</th><th>Rebuilt</th><th>Error</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}


/** The panel: opens for a ticker entry, loads hood.json the first time, plays the wall animation. */
export class HoodPanel {
  constructor(root, ctx) {
    Object.assign(this, { root, ctx });
    root.className = "m-hood"; root.hidden = true;
    root.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) this.close(); });
  }

  async open(entry) {
    const c = this.ctx, model = c.model(), token = (this.token = {});
    this.root.hidden = false;
    this.root.innerHTML = `<div class="d-head"><h2>Under the hood</h2></div><p class="d-note">Loading the model details...</p>`;
    let details = null;
    try { details = c.hoodUrl ? hoodOf(await loadHood(c.hoodUrl), entry.id, model) : null; }
    catch (err) { this.root.innerHTML = `<div class="d-head"><h2>Under the hood</h2><button class="gbtn sq ghost" data-close>${icon("close")}</button></div><p class="d-note">${err.message}</p>`; return; }
    if (token !== this.token) return;
    this.root.innerHTML = hoodHtml({ entry, details, name: c.label(), threshold: c.threshold(), plnPerEur: c.plnPerEur() });
    this.entry = entry;
    if (details) { c.view.score.setVisible(false); c.view.hood.play(details, entry.id, c.label()); }
    else this.#wallOff();
  }

  close() { this.token = null; this.root.hidden = true; this.#wallOff(); }
  get isOpen() { return !this.root.hidden; }
  #wallOff() { this.ctx.view.hood.stop(); this.ctx.view.score.setVisible(true); }
}
