// Core simulation of one shift. Pure logic, no randomness and no drawing.
// The result depends only on the data (score, threshold, time, amount, is_fraud),
// the number of auditors, the time per check and the traffic volume K.
//
// Traffic volume K: each dataset transaction stands for K real transactions. One dataset
// transaction is therefore checked by a team of K auditors in one check time, so capacity per
// auditor is (checks per shift) / K dataset transactions. With n auditors there are floor(n / K)
// full teams plus one partial team of (n mod K) auditors that works proportionally slower.
// For K = 1 every team is a single auditor (one auditor per team).
//
// Small alerts: an alert below `autoBelow` (EUR, from AMOUNT_THRESHOLD_PLN) never reaches the
// queue. It goes to automatic customer confirmation (SMS or push): a legit one costs an SMS, a fraud is
// a full loss. Exception: an alert the model finds extremely unusual (score at least HIGH_RISK_FACTOR times
// the model's threshold) always goes to an auditor, whatever the amount; tiny payments with very strange
// patterns are typical card testing, and a bank blocks those instead of asking the customer.
import { Heap } from "./heap.js";

// Check order: highest score first; ties go to the earlier time, then the lower id.
function higherPriority(a, b) {
  if (a.score !== b.score) return a.score > b.score;
  if (a.time !== b.time) return a.time < b.time;
  return a.id < b.id;
}

/** Transactions flagged by the model in a shift: score > threshold (as in the notebook). */
export function flaggedRows(source, shift, model) {
  const rows = [];
  const threshold = source.threshold(model);
  for (let r = shift.first; r < shift.last; r++) {
    if (source.score(model, r) > threshold) rows.push(r);
  }
  return rows;
}

// Frauds the model did not flag: missed at the moment they happen.
function unflaggedFrauds(source, shift, model) {
  const rows = [];
  const threshold = source.threshold(model);
  for (let r = shift.first; r < shift.last; r++) {
    if (source.columns.is_fraud[r] && !(source.score(model, r) > threshold)) rows.push(r);
  }
  return rows;
}

function makeItem(source, model, row) {
  const c = source.columns;
  return { row, id: c.id[row], time: c.time[row], amount: c.amount[row],
    isFraud: c.is_fraud[row] === 1, score: source.score(model, row) };
}

// Alert and silent-fraud lists depend only on (data, shift, model): build them once.
// Items are never mutated by the simulation, so sharing them between runs is safe.
const listCache = new WeakMap();
function itemLists(source, shiftIndex, model) {
  if (!listCache.has(source)) listCache.set(source, new Map());
  const cache = listCache.get(source), key = `${shiftIndex}|${model}`;
  if (!cache.has(key)) {
    const shift = source.shifts[shiftIndex];
    cache.set(key, Object.freeze({
      arrivals: flaggedRows(source, shift, model).map((r) => makeItem(source, model, r)),
      silentFrauds: unflaggedFrauds(source, shift, model).map((r) => makeItem(source, model, r)),
    }));
  }
  return cache.get(key);
}

function emptyTotals() {
  return { flagged: 0, flaggedLegit: 0, checked: 0, caught: 0, caughtAmount: 0,
    falseAlarmsChecked: 0, missed: 0, missedAmount: 0, auditorSeconds: 0,
    autoLegit: 0, autoFrauds: 0, autoFraudAmount: 0, bigFrauds: 0, bigCaught: 0, bigMissed: 0,
    missedNotFlagged: 0, missedNoTime: 0 };   // split of `missed` (the rest are autoFrauds); display only
}

/** Check time of each team (desk) for n auditors at volume K. */
export function teamServiceTimes(n, volume, secondsPerCheck) {
  const full = Math.floor(n / volume), rest = n % volume;
  const times = Array(full).fill(secondsPerCheck); // a full team needs one check time
  if (rest) times.push((secondsPerCheck * volume) / rest); // a partial team is slower
  return times;
}

export class ShiftSim {
  /**
   * @param source score source (scoreSource.js)
   * @param shiftIndex shift number
   * @param model a model id of the data file
   * @param auditors starting number of auditors
   * @param secondsPerCheck time of one check (config.derive)
   * @param volume traffic volume K (1 = dataset)
   * @param autoBelow alerts below this amount (EUR) go to automatic confirmation (0 = none)
   * @param bigFrom frauds at or above this amount (EUR) are counted as big frauds (Infinity = none)
   * @param onEvent optional event callback for animation (does not affect the result)
   */
  constructor({ source, shiftIndex, model, auditors, secondsPerCheck, volume = 1, autoBelow = 0, bigFrom = Infinity, highRiskFactor = Infinity, onEvent = () => {} }) {
    this.autoBelow = autoBelow;
    this.highRisk = source.threshold(model) * highRiskFactor;
    this.bigFrom = bigFrom;
    this.source = source;
    this.model = model;
    this.shift = source.shifts[shiftIndex];
    this.secondsPerCheck = secondsPerCheck;
    this.volume = volume;
    this.onEvent = onEvent;
    this.now = this.shift.start;
    const lists = itemLists(source, shiftIndex, model);
    this.arrivals = lists.arrivals;
    this.silentFrauds = lists.silentFrauds;
    this.nextArrival = 0;
    this.nextSilent = 0;
    this.queue = new Heap(higherPriority);
    this.desks = [];
    this.auditors = 0;
    this.totals = emptyTotals();
    this.finished = false;
    this.setAuditors(auditors);
  }

  get auditorCount() { return this.auditors; }
  get teamCount() { return this.desks.length; }
  get queueLength() { return this.queue.size; }

  /** Change the number of auditors during the shift. The most recently hired leave first. */
  setAuditors(n) {
    this.auditors = n;
    const times = teamServiceTimes(n, this.volume, this.secondsPerCheck);
    while (this.desks.length > times.length) {
      const desk = this.desks.pop();
      if (desk.item) this.queue.push(desk.item); // an unfinished check goes back to the queue
    }
    // a team that changes size keeps its current check; the new pace applies to the next one
    this.desks.forEach((desk, i) => { desk.service = times[i]; });
    while (this.desks.length < times.length) this.desks.push({ busyUntil: -1, item: null, service: times[this.desks.length] });
    this.#assignFree();
  }

  /** Move shift time to `t`, processing events in time order. */
  advanceTo(t) {
    const target = Math.min(t, this.shift.end);
    for (;;) {
      const next = this.#nextEventTime();
      if (next > target) break;
      this.#accrueWages(next);
      this.now = next;
      this.#processEventsAt(next);
    }
    this.#accrueWages(target);
    this.now = target;
    if (target >= this.shift.end && !this.finished) this.#finish();
  }

  /** Result so far (plain numbers, no references to the state). */
  result() {
    return { ...this.totals, now: this.now, finished: this.finished,
      queueLength: this.queue.size, auditors: this.auditors, teams: this.desks.length };
  }

  /** What team `i` is checking now (for clicking a person). */
  currentItem(i) { return this.desks[i]?.item ?? null; }

  /** The queue sorted in check order (for the queue panel). */
  queuePreview(limit = 10) { return this.queue.toArray().sort((a, b) => (higherPriority(a, b) ? -1 : 1)).slice(0, limit); }

  #nextEventTime() {
    let t = Infinity;
    if (this.nextArrival < this.arrivals.length) t = this.arrivals[this.nextArrival].time;
    if (this.nextSilent < this.silentFrauds.length) t = Math.min(t, this.silentFrauds[this.nextSilent].time);
    for (const d of this.desks) if (d.item && d.busyUntil < t) t = d.busyUntil;
    return t;
  }

  // Order within the same moment: finished checks first, then new alerts, then assignment.
  #processEventsAt(t) {
    this.desks.forEach((desk, i) => { if (desk.item && desk.busyUntil === t) this.#completeCheck(desk, i); });
    while (this.nextArrival < this.arrivals.length && this.arrivals[this.nextArrival].time === t) {
      this.#arrive(this.arrivals[this.nextArrival++]);
    }
    while (this.nextSilent < this.silentFrauds.length && this.silentFrauds[this.nextSilent].time === t) {
      const item = this.silentFrauds[this.nextSilent++];
      this.#countBig(item);
      this.#miss(item, "not flagged");
    }
    this.#assignFree();
  }

  #arrive(item) {
    this.totals.flagged += 1;
    if (!item.isFraud) this.totals.flaggedLegit += 1;
    this.#countBig(item);
    if (item.amount < this.autoBelow && item.score < this.highRisk) { this.#autoConfirm(item); return; }
    this.queue.push(item);
    this.onEvent({ type: "alarm", item, t: this.now });
  }

  // Small alert: SMS or push "was this you?" instead of an auditor. A fraudster confirms, so a fraud is lost.
  #autoConfirm(item) {
    const t = this.totals;
    this.onEvent({ type: "auto", item, t: this.now });
    if (!item.isFraud) { t.autoLegit += 1; return; }
    t.autoFrauds += 1; t.autoFraudAmount += item.amount;
    this.#miss(item, "auto-confirmed");
  }

  #countBig(item) { if (item.isFraud && item.amount >= this.bigFrom) this.totals.bigFrauds += 1; }
  #isBig(item) { return item.isFraud && item.amount >= this.bigFrom; }

  // Free desks take work in order from the lowest number (deterministic).
  #assignFree() {
    for (let i = 0; i < this.desks.length && this.queue.size; i++) {
      const desk = this.desks[i];
      if (desk.item) continue;
      desk.item = this.queue.pop();
      desk.busyUntil = this.now + desk.service;
      this.onEvent({ type: "assign", desk: i, item: desk.item, t: this.now });
    }
  }

  #completeCheck(desk, i) {
    const item = desk.item;
    const t = this.totals;
    t.checked += 1;
    if (item.isFraud) { t.caught += 1; t.caughtAmount += item.amount; if (this.#isBig(item)) t.bigCaught += 1; }
    else t.falseAlarmsChecked += 1;
    desk.item = null;
    this.onEvent({ type: item.isFraud ? "caught" : "cleared", desk: i, item, t: this.now });
  }

  #miss(item, reason) {
    this.totals.missed += 1;
    this.totals.missedAmount += item.amount;
    const big = this.#isBig(item);
    if (big) this.totals.bigMissed += 1;
    if (reason === "not flagged") this.totals.missedNotFlagged += 1;
    if (reason === "out of time") this.totals.missedNoTime += 1;
    this.onEvent({ type: "missed", item, reason, big, t: this.now });
  }

  // Wages are paid per auditor (not per team).
  #accrueWages(t) {
    this.totals.auditorSeconds += this.auditors * Math.max(0, t - this.now);
  }

  // End of shift: unchecked frauds in the queue and on desks are missed.
  #finish() {
    this.finished = true;
    for (const desk of this.desks) {
      if (desk.item?.isFraud) this.#miss(desk.item, "out of time");
      desk.item = null;
    }
    while (this.queue.size) {
      const item = this.queue.pop();
      if (item.isFraud) this.#miss(item, "out of time");
    }
  }
}
