// Card at the end of a shift: the result at the volume and in the dataset, then the next step.
import { money, count } from "./format.js";
import { button, onData } from "./dom.js";

// "Missed" split by why: a big single number read like a weak model, while most of it is the SMS process.
const MISSED_ROWS = [["Missed: the model didn't flag them", "missedNotFlagged"],
  ["Small frauds sent as SMS", "autoFrauds"], ["Missed: no time to check", "missedNoTime"]];

function missedRows(raw, K) {
  return MISSED_ROWS.filter(([, key]) => key !== "missedNoTime" || raw[key] > 0)
    .map(([label, key]) => `<span>${label}</span><b>${count((raw[key] ?? 0) * K)}</b>`).join("");
}

export class ShiftOver {
  constructor(root, on) {
    root.className = "m-over"; root.hidden = true; this.root = root;
    onData(root, "next", () => on.next());
    onData(root, "replay", () => on.replay());
    onData(root, "drawer", () => on.drawer());
  }

  /** names: shift names; bestTeams: best team per shift; share/randomShare: fraud money stopped vs random checks. */
  show({ shiftIndex, shiftCount, v, raw, peak, gap, n, volume, names = [], bestTeams = [], share = 0, randomShare = 0 }) {
    const K = volume, next = shiftIndex + 1 < shiftCount, name = names[shiftIndex] ?? `Shift ${shiftIndex + 1}`;
    const plan = bestTeams.map((b, k) => `${(names[k] ?? `Shift ${k + 1}`).replace(" shift", "")} ${b}`).join(" · ");
    const verdict = gap > 0.5 ? `${peak} people would have made ${money(gap)} more.` : `${n} people was the best team. Well done.`;
    this.root.innerHTML = `<div class="o-card"><h2>${name} over</h2>
      <div class="o-big"><b>${money(v.net)}</b><span>net result of the shift</span></div>
      <p class="o-lead">${verdict} Fraud money stopped: ${Math.round(100 * share)}% (random checks with the same team: ${Math.round(100 * randomShare)}%).</p>
      <div class="d-grid"><span>Frauds caught</span><b>${count(raw.caught * K)}</b>
        ${missedRows(raw, K)}
        <span>False alarms checked</span><b>${count(raw.falseAlarmsChecked * K)}</b></div>
      ${plan ? `<p class="o-plan">Best team per shift: ${plan}. The day has the most payments, so the most alerts.</p>` : ""}
      <p class="o-note">${next ? `The crew goes home. The ${(names[shiftIndex + 1] ?? "next shift").toLowerCase()} brings a new one.` : "That was the whole day of data."}</p>
      <div class="b-row">${button("Replay", "", "", 'data-replay="1"')}${button("Results", "ghost", "", 'data-drawer="1"')}
        ${next ? button(`Start the ${(names[shiftIndex + 1] ?? `shift ${shiftIndex + 2}`).toLowerCase()}`, "accent", "", 'data-next="1"') : ""}</div></div>`;
    this.root.hidden = false;
  }
  hide() { this.root.hidden = true; }
}
