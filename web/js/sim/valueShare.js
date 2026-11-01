// Fraud value caught: the share of the fraud amount (EUR) that a model flags, computed from the
// rows of data.json (amount, is_fraud, score). Counts treat a 5 EUR and a 5,000 EUR fraud the same;
// this share weighs each fraud by its amount.
import { cachedRaw, shiftTotals } from "./economy.js";

/** Flagged fraud value over rows [first, last) at the model's threshold (all alerts checked). */
export function flaggedValueShare(source, model, first = 0, last = source.columns.id.length) {
  const c = source.columns, thr = source.threshold(model);
  let total = 0, caught = 0, frauds = 0, flagged = 0;
  for (let r = first; r < last; r++) {
    if (!c.is_fraud[r]) continue;
    frauds += 1; total += c.amount[r];
    if (source.score(model, r) > thr) { flagged += 1; caught += c.amount[r]; }
  }
  return { frauds, flagged, total, caught, share: total ? caught / total : 0 };
}

/** Share of the fraud value so far that was caught (0 when no fraud value has arrived yet). */
export const liveValueShare = (caughtAmount, fraudAmountSoFar) => (fraudAmountSoFar > 0 ? caughtAmount / fraudAmountSoFar : 0);

/** Share of the shift's fraud amount a team of n catches by the end of the shift (simulated, cached). */
export function shiftValueShare(source, shiftIndex, model, n, d) {
  const total = shiftTotals(source, shiftIndex).fraudAmount;
  return total > 0 ? cachedRaw(source, shiftIndex, model, n, d).caughtAmount / total : 0;
}
