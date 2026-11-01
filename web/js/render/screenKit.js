// Shared pieces of the wall screens: bezel and glass, title, legend, SVG text.
import { el } from "../svg.js";
import { KIT } from "../ui/kit.js";

export const PAD = { l: 14, r: 14, t: 34, b: 26 };

export function text(parent, x, y, content, cls, attrs = {}) {
  const t = el("text", { x, y, class: cls, ...attrs }, parent);
  t.textContent = content;
  return t;
}

/** Bezel, dark glass and title. Returns the group, the title element and the inner plot box. */
export function screenFrame(svg, box, title) {
  const g = el("g", { class: "wall-screen" }, svg);
  el("rect", { x: box.x - 6, y: box.y - 6, width: box.w + 12, height: box.h + 12, rx: 12, fill: KIT.graphiteDark }, g);
  el("rect", { x: box.x, y: box.y, width: box.w, height: box.h, rx: 8, fill: KIT.screen }, g);
  const titleEl = text(g, box.x + PAD.l, box.y + 20, title, "screen-title");
  return { g, title: titleEl, x: box.x + PAD.l, y: box.y + PAD.t, w: box.w - PAD.l - PAD.r, h: box.h - PAD.t - PAD.b };
}

export function legend(g, x, y, items) {
  let cx = x;
  for (const [label, colour] of items) {
    el("circle", { cx: cx + 4, cy: y - 4, r: 4, fill: colour }, g);
    text(g, cx + 12, y, label, "screen-note");
    cx += 18 + label.length * 6.4;
  }
}

/** Sets the text and shrinks its font (never grows it) until it fits maxWidth; the box decides, not the copy. */
export function fitText(t, content, maxWidth) {
  if (t.textContent === content && t.dataset.fit === String(maxWidth)) return;   // already fitted
  t.textContent = content; t.dataset.fit = String(maxWidth);
  t.style.fontSize = "";
  if (!content || !t.isConnected) return;
  const len = t.getComputedTextLength();
  if (len > maxWidth) {
    const base = parseFloat(getComputedStyle(t).fontSize);
    t.style.fontSize = `${Math.max(7, Math.floor(base * maxWidth / len * 10) / 10)}px`;
  }
}
