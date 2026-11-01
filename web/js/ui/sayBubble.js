// A short speech bubble over the office (Pan Marek's tip, what an auditor is checking). Decoration only:
// it reads the game state and never changes the simulation.
const WIDTH = 240;
const GAP = 10;          // between the bubble and the head it points at
const SHOW_MS = 7000;    // real time before it hides

export class SayBubble {
  constructor(root) {
    root.className = "m-say"; root.hidden = true; this.root = root;
    root.addEventListener("click", () => { const f = this.onClick; this.hide(); f?.(); });
  }

  /** text near office point (x, top); onClick: what clicking the bubble does (or nothing). */
  /** place "below": under the point (for things high on the wall). */
  show(x, top, text, onClick = null, place = "above") {
    clearTimeout(this.timer);
    this.onClick = onClick;
    this.root.textContent = text;
    this.root.classList.toggle("clickable", !!onClick);
    this.root.hidden = false;
    const h = this.root.offsetHeight, w = this.root.parentElement.clientWidth;
    const left = Math.max(GAP, Math.min(x - WIDTH / 2, w - WIDTH - GAP));
    this.root.style.transform = `translate(${left.toFixed(0)}px, ${(place === "below" ? top + GAP + 40 : Math.max(GAP, top - h - GAP)).toFixed(0)}px)`;
    this.timer = setTimeout(() => this.hide(), SHOW_MS);
  }
  hide() { clearTimeout(this.timer); this.root.hidden = true; this.onClick = null; }
}
