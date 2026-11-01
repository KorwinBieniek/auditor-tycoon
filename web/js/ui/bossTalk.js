// Pan Marek says why he reacts: a short bubble over his head for the events that matter (a big fraud
// caught or missed, a long queue, an idle team) and now and then a small remark. At most one line every
// few seconds, the big events win. Decoration only: it reads the game, never changes the simulation.
const MIN_GAP_MS = 7000;      // between two lines
const SHOW_MS = 5200;
const IDLE_EVERY_MS = [30000, 50000];
// Short lines, the way a boss talks. {x} fields are filled in by say().
export const LINES = {
  caughtBig: ["Nice one, {name}! {amt} saved.", "{name}, that's {amt} back. Good job.", "{amt}. Well spotted, {name}."],
  missNotFlagged: ["{amt} just went through. The model didn't flag it.", "We lost {amt}. It looked too normal to flag.", "Ouch. {amt}, and it looked normal to the model."],
  missNoTime: ["{amt} waited too long in the queue. We need more hands.", "Too slow on that one. {amt} gone.", "{amt} lost. Nobody got to it in time."],
  queueHire: ["{q} alerts waiting. Get me more people.", "The queue's at {q}. We're short-staffed.", "{q} in the queue. Hire a few more?"],
  queueOk: ["{q} in the queue, but that's fine. More people would cost more than they save.", "Busy, but the numbers say this team is enough."],
  idleTeam: ["Half of them are bored. {peak} would do.", "Too many people for a shift this quiet. {peak} is enough.", "I'm paying people to watch screens. Try {peak}."],
  idle: ["Coffee's free. Fraud isn't.", "Quiet so far.", "We only check what the model flags. That's the trick.", "Every check takes a few minutes. They add up.",
    "Keep the queue short and we're fine.", "Who forgot to water the plant?", "Good shift so far."],
};
const used = {};
/** A line of a kind, never the same one twice in a row, with {fields} filled in. */
export function line(kind, fields = {}) {
  const list = LINES[kind], k = used[kind] = ((used[kind] ?? Math.floor(Math.random() * list.length)) + 1) % list.length;
  return list[k].replace(/\{(\w+)\}/g, (_, f) => fields[f] ?? "");
}

export class BossTalk {
  constructor(root, locate) {
    root.className = "m-say m-boss"; root.hidden = true;
    Object.assign(this, { root, locate, last: -Infinity, idleAt: performance.now() + IDLE_EVERY_MS[0], k: 0 });
  }

  /** priority 2: must say now (a big fraud), 1: normal, 0: idle remark. */
  say(text, priority = 1) {
    const now = performance.now();
    if (priority < 2 && now - this.last < MIN_GAP_MS) return;
    this.last = now; this.text = text; this.until = now + SHOW_MS;
    this.root.textContent = text; this.root.hidden = false;
    this.idleAt = now + IDLE_EVERY_MS[0] + Math.random() * (IDLE_EVERY_MS[1] - IDLE_EVERY_MS[0]);
  }

  hide() { this.root.hidden = true; this.until = 0; }

  /** Every frame: follows his head, hides after a while, an idle remark when nothing happened for long. */
  update(enabled) {
    const now = performance.now();
    if (enabled && now > this.idleAt) this.say(line("idle"), 0);
    if (this.root.hidden) return;
    if (now > this.until || !enabled) return this.hide();
    const b = this.locate();
    if (!b) return;
    const w = this.root.offsetWidth, h = this.root.offsetHeight, W = this.root.parentElement.clientWidth;
    const x = Math.max(8, Math.min(b.x + b.w / 2 - w + 30, W - w - 8));
    this.root.style.transform = `translate(${x.toFixed(0)}px, ${(b.y - h - 10).toFixed(0)}px)`;
  }
}
