// Under the hood data: the explanations file named in data.json (explanations.file, format
// schema/auditor-explanations.v1.schema.json). Original features and, per model, the latent numbers,
// the reconstruction and the per-feature error for every flagged transaction and every fraud of the
// game shifts. Loaded lazily the first time the panel opens.
let loading = null;
const TOP_FEATURES = 5;   // features with the biggest error, shown first in the panel

export function loadHood(url = "data/hood.json") {
  loading ??= fetch(url).then((r) => { if (!r.ok) throw new Error(`Could not load ${url}: ${r.status}`); return r.json(); })
    .then((h) => ({ ...h, index: new Map(h.ids.map((id, k) => [id, k])) }));
  return loading;
}

/** Details of transaction `id` for a model, or null when it is not in the file. */
export function hoodOf(hood, id, model) {
  const k = hood.index.get(id), m = hood.models[model];
  if (k === undefined || !m) return null;
  const err = m.error[k], rec = m.reconstruction[k];
  const total = err.reduce((s, e) => s + e, 0);
  const order = err.map((e, j) => j).sort((a, b) => err[b] - err[a]);
  return { features: hood.features, x: hood.x[k], z: m.latent[k], latentLabel: m.latent_label, rec, err,
    score: total / err.length, top: order.slice(0, TOP_FEATURES).map((j) => ({ name: hood.features[j], j, x: hood.x[k][j], rec: rec[j], err: err[j], share: err[j] / total })) };
}
