// Text built from data (models and meta of the data file, NBP_SOURCE): start screen cards, Metrics and
// About. Nothing here names a model: models[0] is "my" model, the others are comparisons, and every
// number comes from data.json or config.js.
import { NBP_SOURCE, AUTHOR, HANDBOOK, AMOUNT_THRESHOLD_PLN, SMS_COST_PLN } from "../config.js";
import { count, percent, auc } from "./format.js";

/** "of frauds caught by reviewing 1.1% of transactions" (the big number is caught_share). */
export function businessLine(result) {
  return `of frauds caught by reviewing ${percent(result.flagged_share, 1)} of transactions`;
}

export const runsNote = (m) => (m.n_runs > 1 ? `median of ${m.n_runs} training runs` : "one training run");

const comparisonsNote = (others) => others.map((r) => `${r.model.name} ${auc(r.model.metrics.pr_auc.chosen)}`).join(", ");

/** The three start screen cards. The first two come from the test set (data.json models[0].test_result), the third
 *  from the game (roi = PLN stopped per 1 PLN spent on the team, each shift at its best team). Plain words first. */
export function startCards({ meta, roles }, { value, roi } = {}) {
  const [mine, ...others] = roles, m = mine.model, t = meta.test;
  const r = m.test_result, valueShare = r.value_caught_share;
  // lift: fraud money in the flagged payments vs what checking the same share of payments at random would find
  const lift = valueShare && r.flagged_share > 0 ? valueShare / r.flagged_share : 0;
  return [
    { big: percent(m.test_result.caught_share), label: `of frauds flagged, checking only ${percent(m.test_result.flagged_share, 1)} of payments`, small: `${count(t.rows)} real card payments, ${count(t.frauds)} frauds`, lead: true },
    lift ? { big: `${Math.round(lift)}x`, label: "more stolen money found than by random checks", small: `${percent(valueShare)} of it in those ${percent(r.flagged_share, 1)} of payments` }
      : { big: auc(m.metrics.pr_auc.chosen), label: `PR AUC of ${mine.inText}`, small: comparisonsNote(others) },
    { big: roi ? `${roi.toFixed(0)} PLN` : "", label: "stopped for every 1 PLN spent on the team", small: "in the game, pay and costs included" },
  ];
}

// One row of the Metrics grid: a label and one cell per model.
const gridRow = (label, roles, cell) => `<span>${label}</span>${roles.map((r) => `<b>${cell(r.model, r)}</b>`).join("")}`;

/** Metrics table: one column per model of the data file. */
export function metricsGrid(roles, value) {
  const head = roles.map((r) => `<b class="h" style="color:${r.colour}">${r.tech ?? r.short}</b>`).join("");
  return `<div class="d-gridn" style="grid-template-columns: 1fr repeat(${roles.length}, auto)"><span></span>${head}
      ${gridRow("PR AUC", roles, (m) => auc(m.metrics.pr_auc.chosen))}
      ${gridRow("ROC AUC", roles, (m) => auc(m.metrics.roc_auc.chosen))}
      ${gridRow("Threshold", roles, (m) => m.threshold.toFixed(3))}
      ${gridRow("Transactions flagged", roles, (m) => percent(m.test_result.flagged_share, 2))}
      ${gridRow("Frauds caught if all checked", roles, (m) => `${m.test_result.frauds_caught} (${percent(m.test_result.caught_share)})`)}
      ${gridRow("Fraud value caught if all checked", roles, (m) => percent(m.test_result.value_caught_share ?? value[m.id].share))}</div>`;
}

// Where a model's numbers come from: the chosen run and the spread for models trained several times.
function modelNote(r, meta) {
  const m = r.model, x = m.metrics;
  const runs = x.n_runs > 1 ? ` One score from run ${x.chosen_run} of ${x.n_runs} training runs (${x.selection}). Spread over the runs:
      PR AUC ${auc(x.pr_auc.min)} to ${auc(x.pr_auc.max)}, ROC AUC ${auc(x.roc_auc.min)} to ${auc(x.roc_auc.max)}.` : "";
  return `<p class="d-note">${r.tag}: ${m.score_rule ?? m.type}.${runs} Threshold: ${m.threshold_rule}.</p>`;
}

/** Results section: four plain cards, the data-science numbers behind one click. */
export function metricsHtml({ meta, roles }, { volume, n, model, value, random, roi, best, names, tested = "" }) {
  const mine = roles[0], m = mine.model, first = value[mine.id], t = meta.test, current = roles.find((r) => r.id === model);
  const card = (big, label) => `<div class="mx-card"><b>${big}</b><span>${label}</span></div>`;
  const more = (title, body) => `<details class="mx-more"><summary>${title}</summary><div>${body}</div></details>`;
  const teams = best ? best.map((b, k) => `${names[k].replace(" shift", "")} ${b}`).join(", ") : "";
  return `<div class="mx-cards">
      ${card(percent(m.test_result.caught_share), `of frauds flagged (${m.test_result.frauds_caught} of ${count(t.frauds)})`)}
      ${card(percent(m.test_result.flagged_share, 1), "of payments flagged as unusual")}
      ${card(roi ? `${roi.toFixed(0)} PLN` : "-", "stopped per 1 PLN spent on the team")}
      <div class="mx-card mx-small"><b>${teams || "-"}</b><span>best team per shift (people)</span></div>
    </div>
    ${more("For data people: PR AUC and all models", `<p class="d-note">Test set: ${count(t.rows)} payments, ${count(t.frauds)} frauds. PR AUC is the main metric because frauds are rare.</p>
      <p class="d-note">My VAE against the simple PCA model: clearly better PR AUC, almost the same ROC AUC (PCA is slightly higher)
      and a similar number of frauds at the threshold. The difference is at the top of the ranking: with my model the
      best team is smaller and earns more. A supervised model trained on the labelled frauds does better still (PR AUC 0.84,
      scripts/analysis_supervised); my model's strength is that it needs no labels.</p>`
      + metricsGrid(roles, value) + roles.map((r) => modelNote(r, meta)).join("") + `<p class="d-note">${random}.</p>`)}
    ${tested ? more("What I tested and left out", tested) : ""}`;
}

/** About: three short blocks; the details behind one click. */
export function aboutHtml({ meta, roles }, volume, extra = "", dayRows = 111957) {
  const t = meta.test, [mine, ...others] = roles;
  const comparisons = others.map((r) => `<p class="d-note">${r.model.description ?? `For comparison: ${r.model.name} (${r.model.type}).`}</p>`).join("");
  return `<p class="d-note"><b>What you see.</b> Every payment is real: two days of European card payments from 2013
    (${count(t.rows)} in the test set). My model learned what normal payments look like, without being told which ones
    were fraud. The strangest 1% raise an alert: larger ones go to an auditor, small ones to the customer as an SMS.</p>
    <p class="d-note"><b>How money is counted.</b> Stopped fraud minus the team's pay, false alarms and SMS. Pay, time per
    check come from job offers and surveys (the dots on the sliders); the cost of a false alarm is our guess.</p>
    <p class="d-note"><b>The bank.</b> Every payment in the data stands for ${volume}, about ${(dayRows * volume / 1e6).toFixed(1)} million card
    payments a day. That's under a tenth of all card payments in Poland. A what-if, not a forecast.</p>
    <details class="mx-more"><summary>More: the model, fraud, small alerts, scale</summary><div>
    <p class="d-note">${mine.model.description ?? mine.model.type}</p>${comparisons}
    <p class="d-note">A team can check only so many alerts per shift. This check budget is the setting of the
    <a href="${HANDBOOK.url}" target="_blank" rel="noopener">precision top-k</a> metric (${HANDBOOK.title}, ${HANDBOOK.authors}).</p>
    ${extra}
    <p class="d-note">Fraud share in the test set: ${percent(t.fraud_share, 2)} of payments. For comparison, ${NBP_SOURCE.text}.
    So this data has about ${Math.round(t.fraud_share / NBP_SOURCE.shareOfCount)} times more fraud than Polish card traffic, and the money here is far
    above what a Polish bank would lose.</p>
    <p class="d-note">Data: ${meta.dataset.description ?? meta.dataset.name}, amounts read as EUR.</p></div></details>
    <p class="d-note">Author: ${AUTHOR}.</p>`;
}

// Metrics: what I tested (scripts/analysis_value_triage/results.md).
export const WHAT_I_TESTED = `<p class="d-note">Checking the most expensive-looking alerts first (chance of fraud times amount)
    instead of the strangest ones: 5% worse at the best team size (95% CI -10.9% to -0.6%, measured with an earlier cost setup). With calibrated scores
    the two orders tie, so the game checks the strangest first.</p>`;

// About, behind "More": what a fraud is here, small alerts, time of day.
export const ABOUT_EXTRA = `<p class="d-note">A fraud here is a payment the bank later found unauthorised. The data has no
    fraud type, so the game never says what kind it was (a stolen card, a skimmer, a phished account...).</p>
    <p class="d-note">Alerts under ${AMOUNT_THRESHOLD_PLN} PLN go to the customer as an SMS or push "was this you?"
    (${SMS_COST_PLN.toFixed(2)} PLN each). A fraud that goes this way counts as lost. I tested several limits; ${AMOUNT_THRESHOLD_PLN} PLN
    raised the net result by about 3% (scripts/analysis_amount_threshold, earlier cost setup). Very unusual small alerts still go to an auditor: tiny strange payments are typical card testing.</p>
    <p class="d-note">The data has only seconds since the first payment. I assume it starts around midnight, because
    the traffic drops in hours 0 to 8 of both days. The window and the clock follow that hour.</p>`;
