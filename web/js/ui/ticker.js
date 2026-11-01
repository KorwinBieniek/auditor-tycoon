// "Recently checked": newest results first, then transactions being checked now and waiting in the queue.
// Transactions scored below the threshold never show (nobody checked them). Rows open Under the hood.
import { icon } from "./icons.js";
import { money, datasetTime } from "./format.js";

export const TICKER_SIZE = 5;   // as many as fit next to the History button at 1440 px
const REASON = { "out of time": "no time", "auto-confirmed": "SMS" };   // short chip text, the card is narrow
const HISTORY = 400;          // results kept for the History list
const MIN_UPDATE_MS = 1200;  // at most one new row about every second, so the eye can follow it
const MOVE_MS = 450;        // rows glide to their new place
const BIG_CHIP = "big miss";   // a missed fraud over 1,000 PLN (short: the card is narrow)

const CHIP = { caught: "caught fraud", cleared: "false alarm", missed: "missed", checking: "checking now",
  queued: "in queue", scored: "not flagged", sms: "SMS check" };

// Alerts below the amount threshold go to the customer's SMS/push confirmation. They are still settled as a
// loss if fraud (economy.js), but the chip is neutral: the model did flag them, so "missed" would look like a model error.
const kindOf = (e) => (e.kind === "missed" && e.reason === "auto-confirmed" ? "sms" : e.kind);
// The creditcard dataset repeats some transactions under different row ids (same time, amount and features);
// one transaction = one row in the ticker.
const keyOf = (e) => `${e.t}|${e.amount}|${e.score}`;

export class Ticker {
  constructor(root, onOpen) {
    root.className = "m-ticker";
    root.innerHTML = `<div class="t-head">Recently checked<small>click a row to see why</small></div><ul></ul>
      <button class="gbtn small t-histbtn" data-history="1">History</button><div class="t-history" hidden><div class="th-head"><b>Checked this shift</b>
      <button class="gbtn sq ghost" data-hclose="1">${icon("close")}</button></div><div class="th-tabs"></div><ol></ol></div>`;
    this.list = root.querySelector("ul"); this.hist = root.querySelector(".t-history");
    this.clear();
    this.list.addEventListener("click", (e) => {
      const li = e.target.closest("li[data-k]");
      if (li) onOpen(this.shown[Number(li.dataset.k)]);
    });
    // hovering freezes the strip, so the row under the cursor is the row you click
    this.list.addEventListener("mouseenter", () => { this.hover = true; });
    this.list.addEventListener("mouseleave", () => { this.hover = false; });
    root.querySelector("[data-history]").addEventListener("click", () => this.#toggleHistory());
    root.querySelector("[data-hclose]").addEventListener("click", () => this.#toggleHistory(false));
    this.filter = "all";
    this.hist.addEventListener("click", (e) => {
      const tab = e.target.closest("[data-f]");
      if (tab) { this.filter = tab.dataset.f; this.#fillHistory(); return; }
      const li = e.target.closest("li[data-h]");
      if (li) onOpen(this.results[Number(li.dataset.h)]);
    });
  }

  clear() {
    this.results = []; this.pending = []; this.shown = []; this.seen = new Set(); this.lastMs = -Infinity; this.key = null;
    if (this.hist) this.#toggleHistory(false);
  }

  /** A finished check (caught, false alarm, missed). Duplicated dataset rows count once. */
  push(entry) {
    const k = keyOf(entry);
    if (this.seen.has(k)) return;
    this.seen.add(k);
    const e = { ...entry, kind: kindOf(entry) };
    this.results.unshift(e);
    if (this.results.length > HISTORY) this.results.length = HISTORY;
    this.pending.push(e);
  }

  /** One new row at most per MIN_UPDATE_MS enters on the left; the rest slide right. Nothing reorders. */
  render(_fill, plnPerEur) {
    if (this.plnPerEur !== plnPerEur) { this.plnPerEur = plnPerEur; this.key = null; }
    if (!this.hist.hidden && this.histDirty) this.#fillHistory();
    const now = performance.now();
    if (this.hover || now - this.lastMs < MIN_UPDATE_MS) return;
    if (this.pending.length) {
      // a busy shift gives more results than the eye can follow: show the most telling one, drop the rest from the strip
      const pick = this.pending.find((e) => e.kind === "caught" || e.big) ?? this.pending.at(-1);
      this.pending = [];
      this.shown = [pick, ...this.shown].slice(0, TICKER_SIZE);
      this.lastMs = now; this.histDirty = true;
    }
    const key = this.shown.map((r) => r.id).join("|") + plnPerEur;
    if (key === this.key) return;
    this.key = key;
    const before = new Map([...this.list.children].map((li) => [li.dataset.id, li.getBoundingClientRect().left]));
    this.list.innerHTML = this.shown.length ? this.shown.map((r, k) => row(r, k, plnPerEur)).join("")
      : `<li class="t-wait" data-id="wait">Waiting for the first alert. Payments the model does not flag go straight through.</li>`;
    for (const li of this.list.children) {
      const was = before.get(li.dataset.id), x = li.getBoundingClientRect().left;
      if (was === undefined) li.animate([{ opacity: 0, transform: "translateX(-28px)" }, { opacity: 1, transform: "none" }], { duration: MOVE_MS, easing: "ease-out" });
      else if (Math.abs(was - x) > 1) li.animate([{ transform: `translateX(${was - x}px)` }, { transform: "none" }], { duration: MOVE_MS, easing: "ease-out" });
    }
  }

  #toggleHistory(open = this.hist.hidden) {
    this.hist.hidden = !open;
    if (open) this.#fillHistory();
  }

  // One calm list: a coloured dot, time, amount and the verdict in words; tabs filter by verdict.
  #fillHistory() {
    this.histDirty = false;
    const p = this.plnPerEur ?? 4.4, groupOf = (r) => (r.kind === "caught" ? "caught" : r.kind === "missed" ? "missed" : r.kind === "cleared" ? "fine" : "sms");
    const tabs = [["all", "All"], ["caught", "Caught"], ["missed", "Missed"], ["fine", "False alarms"], ["sms", "SMS"]];
    const n = (f) => (f === "all" ? this.results.length : this.results.filter((r) => groupOf(r) === f).length);
    this.hist.querySelector(".th-tabs").innerHTML = tabs.map(([f, label]) => `<button class="th-tab${this.filter === f ? " on" : ""}" data-f="${f}">${label} <span>${n(f)}</span></button>`).join("");
    const rows = this.results.map((r, k) => [r, k]).filter(([r]) => this.filter === "all" || groupOf(r) === this.filter);
    this.hist.querySelector("ol").innerHTML = rows.length
      ? rows.map(([r, k]) => `<li data-h="${k}" class="th-row th-${groupOf(r)}${r.big ? " th-big" : ""}"><i></i><span class="th-time">${datasetTime(r.t).slice(7)}</span>
        <b>${money(r.amount * p)}</b><span class="th-verdict">${chipText(r)}</span><span class="th-score" title="How unusual my model found it; alerts start at the alert line">risk ${r.score.toFixed(1)}</span></li>`).join("")
      : `<li class="th-empty">Nothing here yet.</li>`;
  }
}

const chipText = (r) => (r.big ? BIG_CHIP : CHIP[r.kind]) + (r.kind === "missed" && r.reason ? ` (${REASON[r.reason] ?? r.reason})` : "");

function row(r, k, plnPerEur) {
  return `<li class="t-${r.kind}${r.big ? " t-big" : ""}" data-k="${k}" data-id="${r.id}" title="Open Under the hood"><span class="t-env">${icon("envelope", 16)}</span>
    <span class="t-time">${datasetTime(r.t).slice(7)}</span><span class="t-amt">${money(r.amount * plnPerEur)}</span>
    <span class="t-score">risk ${r.score.toFixed(1)}</span><span class="chip">${chipText(r)}</span></li>`;
}
