// Shift economy in PLN: money saved minus wages minus the cost of checked false alarms.
// Pure functions of (data, auditors, assumptions); no randomness.
import { ShiftSim } from "./shiftSim.js";
import { SHIFT_SECONDS, MAX_DESKS, AUDITOR_RANGE_MARGIN, SMS_COST_PLN, derive, simOptions } from "../config.js";

/** Full shift with a fixed number of auditors. Raw result: counts in dataset units, amounts in EUR. */
export function simulateShift(source, shiftIndex, model, auditors, d = derive()) {
  const sim = new ShiftSim({ source, shiftIndex, model, auditors, ...simOptions(d) });
  sim.advanceTo(Infinity);
  return sim.result();
}

/** Wages in PLN for the paid auditor seconds. */
export function wagesFor(auditorSeconds, d) {
  return (auditorSeconds / SHIFT_SECONDS) * d.costPerShiftPln;
}

/**
 * Money view of a raw result at volume K: every dataset transaction stands for K transactions,
 * so caught money, false alarms and SMS confirmations scale by K; wages are paid per auditor and do not.
 */
export function valueOf(raw, d) {
  const K = d.volume;
  const savedPln = raw.caughtAmount * d.plnPerEur * K;
  const wagesPln = wagesFor(raw.auditorSeconds, d);
  const falseAlarmPln = raw.falseAlarmsChecked * K * d.falseAlarmCostPln;
  const smsPln = (raw.autoLegit ?? 0) * K * SMS_COST_PLN;
  return { ...raw, savedPln, wagesPln, falseAlarmPln, smsPln, net: savedPln - wagesPln - falseAlarmPln - smsPln };
}

/** Raw result plus money, one call (used by tests and scripts). */
export function runShift(source, shiftIndex, model, auditors, d = derive()) {
  return valueOf(simulateShift(source, shiftIndex, model, auditors, d), d);
}

/**
 * Shift totals: all transactions (for the shares) and the ones auditors may check, i.e. at or above
 * the amount threshold (`checkable`, for random checking). Below it the bank confirms automatically.
 */
export function shiftTotals(source, shiftIndex, d = derive()) {
  const { first, last } = source.shifts[shiftIndex];
  return { ...sumRows(source, first, last, 0), checkable: sumRows(source, first, last, d.autoBelowEur) };
}

function sumRows(source, first, last, minAmount) {
  const c = source.columns;
  let transactions = 0, frauds = 0, fraudAmount = 0;
  for (let r = first; r < last; r++) {
    if (c.amount[r] < minAmount) continue;
    transactions += 1;
    if (c.is_fraud[r]) { frauds += 1; fraudAmount += c.amount[r]; }
  }
  return { transactions, frauds, fraudAmount };
}

/**
 * Random checking as an expected value (no sampling). n auditors check n * checksPerShift real
 * transactions, i.e. that divided by K dataset transactions; k of N gives on average k/N of frauds.
 * Same process as the models: auditors pick only among transactions at or above the amount
 * threshold. Random checking raises no alerts, so it sends no SMS.
 */
export function randomRaw(totals, auditors, d) {
  const pool = totals.checkable ?? totals;
  if (!pool.transactions) return { checked: 0, caught: 0, caughtAmount: 0, falseAlarmsChecked: 0, auditorSeconds: auditors * SHIFT_SECONDS };
  const k = Math.min((auditors * d.checksPerShift) / d.volume, pool.transactions);
  const share = k / pool.transactions;
  const caught = pool.frauds * share;
  return { checked: k, caught, caughtAmount: pool.fraudAmount * share,
    falseAlarmsChecked: k - caught, auditorSeconds: auditors * SHIFT_SECONDS };
}

export function randomBaseline(totals, auditors, d = derive()) {
  return valueOf(randomRaw(totals, auditors, d), d);
}

// Simulation results do not depend on salary, false alarm cost or the rate, only on the check
// time and the volume. Cache raw results by that key so cost sliders remap instantly.
const rawCache = new WeakMap();
export function cachedRaw(source, shiftIndex, model, n, d) {
  if (!rawCache.has(source)) rawCache.set(source, new Map());
  const key = `${shiftIndex}|${model}|${d.secondsPerCheck}|${d.volume}|${d.autoBelowEur}|${d.bigFraudEur}|${n}`;
  const cache = rawCache.get(source);
  if (!cache.has(key)) cache.set(key, simulateShift(source, shiftIndex, model, n, d));
  return cache.get(key);
}

/** Net value of one point for a model id or "random". */
export function netAt(source, shiftIndex, key, n, d) {
  if (key === "random") return valueOf(randomRaw(shiftTotals(source, shiftIndex, d), n, d), d).net;
  return valueOf(cachedRaw(source, shiftIndex, key, n, d), d).net;
}

/** Profit curve 1..maxN for every model of the data file and random checking: points[n - 1][id]. */
export function profitCurve(source, shiftIndex, d, maxN) {
  const points = [];
  for (let n = 1; n <= maxN; n++) {
    const p = { n, random: netAt(source, shiftIndex, "random", n, d) };
    for (const id of source.modelIds) p[id] = netAt(source, shiftIndex, id, n, d);
    points.push(p);
  }
  return points;
}

/** Curve peak: the smallest n with the largest value (ties go to the cheaper team). */
export function peakOf(points, key) {
  return points.reduce((best, p) => (p[key] > best[key] ? p : best), points[0]);
}

/** Gap to optimum: what the player loses against the best auditor count. Never negative. */
export function gapToOptimum(points, key, n) {
  const peak = peakOf(points, key);
  const current = points[Math.min(n, points.length) - 1][key];
  return peak[key] - current;
}

/** Most alerts for auditors (at or above the amount threshold) in any shift for any model (dataset units). */
export function maxFlagged(source, minAmount = 0) {
  let most = 0;
  for (let s = 0; s < source.shifts.length; s++) {
    for (const model of source.modelIds) most = Math.max(most, countFlagged(source, s, model, minAmount));
  }
  return most;
}

function countFlagged(source, s, model, minAmount) {
  const { first, last } = source.shifts[s], th = source.threshold(model), amount = source.columns.amount;
  let k = 0;
  for (let r = first; r < last; r++) if (source.score(model, r) > th && amount[r] >= minAmount) k++;
  return k;
}

/**
 * Upper end of the auditor control: enough staff to check every alert of the busiest shift
 * with a margin, and never fewer than the desks in the office. Rounded up to a multiple of 10.
 */
export function auditorMax(source, d) {
  const needed = (maxFlagged(source, d.autoBelowEur) * d.volume) / d.checksPerShift;
  const withMargin = Math.ceil((needed * AUDITOR_RANGE_MARGIN) / 10) * 10;
  return Math.max(MAX_DESKS, withMargin);
}

// Running sums up to `now`, computed once per shift and process limits: all frauds and their amount,
// the transactions, frauds and fraud amount auditors may check (at or above the amount threshold),
// and the big frauds.
const prefixCache = new WeakMap();
const SUMS = ["frauds", "amount", "cTx", "cFrauds", "cAmount", "big"];
function prefixes(source, shiftIndex, d) {
  if (!prefixCache.has(source)) prefixCache.set(source, new Map());
  const cache = prefixCache.get(source), key = `${shiftIndex}|${d.autoBelowEur}|${d.bigFraudEur}`;
  if (!cache.has(key)) cache.set(key, buildPrefixes(source, source.shifts[shiftIndex], d));
  return cache.get(key);
}

function buildPrefixes(source, { first, last }, d) {
  const c = source.columns, p = { first, last };
  for (const k of SUMS) p[k] = [0];
  for (let r = first; r < last; r++) {
    const fraud = c.is_fraud[r], amt = c.amount[r], checkable = amt >= d.autoBelowEur;
    const add = { frauds: fraud, amount: fraud ? amt : 0, cTx: checkable ? 1 : 0, cFrauds: checkable ? fraud : 0,
      cAmount: checkable && fraud ? amt : 0, big: fraud && amt >= d.bigFraudEur ? 1 : 0 };
    for (const k of SUMS) p[k].push(p[k].at(-1) + add[k]);
  }
  return p;
}

/**
 * Transactions, frauds, fraud amount and big frauds in the shift up to and including `now`,
 * plus the part auditors may check (`checkable`).
 */
export function totalsSoFar(source, shiftIndex, now, d = derive()) {
  const p = prefixes(source, shiftIndex, d), times = source.columns.time;
  let lo = p.first, hi = p.last;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (times[mid] <= now) lo = mid + 1; else hi = mid; }
  const k = lo - p.first;
  return { transactions: k, frauds: p.frauds[k], fraudAmount: p.amount[k], bigFrauds: p.big[k],
    checkable: { transactions: p.cTx[k], frauds: p.cFrauds[k], fraudAmount: p.cAmount[k] } };
}

/** Random checking so far: as many checks as the same auditors would have done by now (same process). */
export function randomSoFar(source, shiftIndex, now, auditorSeconds, d) {
  const totals = totalsSoFar(source, shiftIndex, now, d), pool = totals.checkable;
  if (!pool.transactions) return { checked: 0, caught: 0, caughtAmount: 0, totals };
  const k = Math.min(auditorSeconds / (d.secondsPerCheck * d.volume), pool.transactions);
  const share = k / pool.transactions;
  return { checked: k, caught: pool.frauds * share, caughtAmount: pool.fraudAmount * share, totals };
}
