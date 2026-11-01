// Guided start ("martini glass": first a short story told by the author, then free play). The shift
// waits while it runs. Each step shows one sentence in a fixed card, puts a ring around one thing in the
// office and plays one small scene (an envelope, a catch, an SMS, a missed fraud). The scenes are
// decoration only: the simulation of the shift has not started yet, so nothing is counted twice.
import { button, onData } from "./dom.js";

const READ_MS = { short: 6500, long: 9000 };   // auto-advance after this long (Next skips ahead)
const RING_PAD = 8;

export class Story {
  /** locate(target) -> {x, y, w, h} in office pixels or null; blocked() -> true while a panel covers the office. */
  constructor(card, ring, { locate, blocked, onDone }) {
    Object.assign(this, { card, ring, locate, blocked, onDone, active: false });
    card.className = "m-story"; card.hidden = true;
    ring.className = "m-ring"; ring.hidden = true;
    // the rest of the office dims around the ring (a full-office layer with a hole; huge shadows are unreliable)
    this.dim = document.createElement("div"); this.dim.className = "m-dim"; this.dim.hidden = true;
    ring.before(this.dim);
    onData(card, "skip", () => this.finish());
    onData(card, "next", () => this.#go(this.k + 1));
  }

  /** steps: [{ target, title, text, act?(), long?, last?, low? }] (low: the card sits at the bottom left) */
  start(steps) { this.steps = steps; this.active = true; this.#go(0); }

  finish() {
    if (!this.active) return;
    this.active = false; clearTimeout(this.timer);
    this.card.hidden = true; this.ring.hidden = true; this.dim.hidden = true;
    this.onDone?.();
  }

  #go(k) {
    clearTimeout(this.timer);
    if (k >= this.steps.length) return this.finish();
    this.k = k;
    const s = this.steps[k], last = k === this.steps.length - 1;
    const dots = this.steps.map((_, i) => `<i class="${i === k ? "on" : ""}"></i>`).join("");
    this.card.innerHTML = `<div class="st-dots">${dots}</div><h3>${s.title}</h3><p>${s.text}</p>${last ? "" : `<p class="st-note">Intro: a preview with real payments. Nothing is counted until the shift starts.</p>`}
      <div class="b-row">${last ? "" : button("Skip intro", "ghost", "", 'data-skip="1"')}${button(last ? "Start the shift" : "Next", "accent", "", 'data-next="1"')}</div>`;
    this.card.hidden = false; this.card.classList.toggle("low", !!s.low);
    s.act?.();
    if (!last) this.timer = setTimeout(() => this.#go(k + 1), s.long ? READ_MS.long : READ_MS.short);
  }

  /** Every frame: the ring follows its target; the story hides under an open panel. */
  update() {
    if (!this.active) return;
    const hide = this.blocked();
    this.card.hidden = hide;
    const r = !hide && this.locate(this.steps[this.k].target);
    this.ring.hidden = !r; this.dim.hidden = hide;
    const W = this.dim.parentElement.clientWidth, H = this.dim.parentElement.clientHeight;
    const hole = r ? ` M${(r.x - RING_PAD).toFixed(0)} ${(r.y - RING_PAD).toFixed(0)}h${(r.w + 2 * RING_PAD).toFixed(0)}v${(r.h + 2 * RING_PAD).toFixed(0)}h${(-r.w - 2 * RING_PAD).toFixed(0)}Z` : "";
    this.dim.style.clipPath = `path(evenodd, "M0 0H${W}V${H}H0Z${hole}")`;
    if (r) Object.assign(this.ring.style, { transform: `translate(${(r.x - RING_PAD).toFixed(0)}px, ${(r.y - RING_PAD).toFixed(0)}px)`,
      width: `${(r.w + 2 * RING_PAD).toFixed(0)}px`, height: `${(r.h + 2 * RING_PAD).toFixed(0)}px` });
  }
}
