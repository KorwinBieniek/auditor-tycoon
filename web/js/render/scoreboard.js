// Scoreboard hanging above the room: five tiles with the numbers at the bank's volume (xK, said once in
// the top bar) and one plain line under each saying what it means. Fraud value comes first (a 5 EUR and a 5,000 EUR fraud are not
// the same), then the count with the big frauds on their own line.
import { el } from "../svg.js";
import { KIT } from "../ui/kit.js";
import { WALL } from "./geometry.js";
import { text, fitText } from "./screenKit.js";
import { money, count, percent } from "../ui/format.js";
import { BIG_FRAUD_PLN } from "../config.js";
import { liveValueShare } from "../sim/valueShare.js";

const TILES = 5;

export class Scoreboard {
  constructor(svg) {
    const { x, y, w, h } = WALL.scoreboard, g = el("g", { class: "scoreboard" }, svg);
    for (const cx of [x + 60, x + w - 60]) el("line", { x1: cx, y1: 0, x2: cx, y2: y, stroke: KIT.graphiteDark, "stroke-width": 2 }, g);
    el("rect", { x, y, width: w, height: h, rx: 14, fill: KIT.graphite }, g);
    const tw = (w - 32) / TILES;
    this.tiles = [...Array(TILES)].map((_, k) => this.#tile(g, x + 16 + k * tw, y, tw));
  }

  #tile(g, x, y, w) {
    return { w: w - 20, label: text(g, x + 10, y + 22, "", "board-label"), big: text(g, x + 10, y + 52, "", "board-big"),
      small: text(g, x + 10, y + 74, "", "board-small"), extra: text(g, x + 10, y + 92, "", "board-small board-extra"), tag: text(g, x + w - 12, y + 22, "", "board-tag", { "text-anchor": "end" }) };
  }

  /** v: valueOf(result); soFar: totalsSoFar; rnd: randomSoFar (random checks, same team); peak: best team; n: auditors. */
  set({ v, soFar, rnd, gap, peak, n, d, early = false }) {
    const K = d.volume, valueShare = liveValueShare(v.caughtAmount, soFar.fraudAmount);
    const randomShare = liveValueShare(rnd?.caughtAmount ?? 0, soFar.fraudAmount);
    // one number per tile, one line saying what it means, one line for the comparison that makes it mean something
    const rows = [
      ["Fraud money stopped", percent(valueShare), `random checks, same team: ${percent(randomShare)}`, ""],
      ["Frauds caught", count(v.caught * K), `big ones (${money(BIG_FRAUD_PLN)}+): ${count((v.bigCaught ?? 0) * K)} of ${count((soFar.bigFrauds ?? 0) * K)}`, ""],
      ["Net result", money(v.net), "stopped fraud minus pay and costs", ""],
      ["False alarms", count(v.falseAlarmsChecked * K), "fine payments checked", `small alerts sent as SMS: ${count(((v.autoLegit ?? 0) + (v.autoFrauds ?? 0)) * K)}`],
      // the gap needs a bit of the shift first: at minute 0 it would only show a loss nobody can act on yet
      ["Vs best team", early ? "..." : gap > 0.5 ? `-${money(gap)}` : "best", `best: ${peak} people, you: ${n}`, ""],
    ];
    rows.forEach(([label, big, small, extra], k) => {
      const t = this.tiles[k];
      fitText(t.label, label.toUpperCase(), t.w); fitText(t.big, big, t.w); fitText(t.small, small, t.w);
      t.tag.textContent = ""; fitText(t.extra, extra, t.w);
    });
  }
}
