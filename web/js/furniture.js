// Workstation furniture: chair, desk, keyboard, monitor, mug.
// World coordinates: y = 0 is the floor, the figure sits at x = 0 facing right.
import { el, shade, uniqueId } from "./svg.js";
import { FURNITURE as F } from "./palette.js";
import { drawMug } from "./accessories.js";

export const DESK = { left: 34, right: 186, top: -98, thickness: 7 };

// The chair is drawn BEFORE the figure (it is behind it).
export function drawChair(parent) {
  const g = el("g", { class: "chair" }, parent);
  el("rect", { x: -47, y: -142, width: 10, height: 84, rx: 5, fill: F.chair }, g);
  el("rect", { x: -40, y: -70, width: 64, height: 9, rx: 4.5, fill: shade(F.chair, -0.12) }, g);
  el("rect", { x: -9, y: -61, width: 7, height: 47, fill: F.metal }, g);
  el("rect", { x: -30, y: -16, width: 47, height: 5, rx: 2.5, fill: F.metal }, g);
  for (const x of [-27, 14]) el("circle", { cx: x, cy: -6, r: 5, fill: shade(F.metal, -0.3) }, g);
  return g;
}

// Monitor screen with scrolling bars (the game adds scrolling score text on top).
function drawScreen(g, x, y, w, h) {
  const clipId = uniqueId("screen");
  el("rect", { x, y, width: w, height: h }, el("clipPath", { id: clipId }, el("defs", {}, g)));
  el("rect", { x, y, width: w, height: h, fill: F.screen }, g);
  const lines = el("g", { "clip-path": `url(#${clipId})` }, g);
  const scroll = el("g", {}, lines);
  const rowH = 7;
  for (let i = 0; i < 16; i++) {
    const width = 12 + ((i * 37) % 30);
    const color = i % 7 === 3 ? F.screenAlert : F.screenLine;
    el("rect", { x: x + 5, y: y + 4 + i * rowH, width, height: 3, rx: 1.5, fill: color, opacity: 0.85 }, scroll);
    el("rect", { x: x + w - 16, y: y + 4 + i * rowH, width: 10, height: 3, rx: 1.5, fill: color, opacity: 0.5 }, scroll);
  }
  return { scroll, period: 8 * rowH };
}

// Empty screen; the caller draws its own content (the game writes scrolling scores on it).
function blankScreen(g, x, y, w, h) {
  el("rect", { x, y, width: w, height: h, fill: F.screen }, g);
  return { scroll: el("g", {}, g), period: 1 };
}

// Desk with keyboard, monitor and (optionally) a mug. Returns update(t) for the screen.
export function drawDesk(parent, options = {}) {
  const g = el("g", { class: "desk" }, parent);
  const { left, right, top, thickness } = DESK;
  for (const x of [left + 30, right - 12]) el("rect", { x, y: top, width: 7, height: -top, fill: F.deskEdge }, g);
  el("rect", { x: left, y: top, width: right - left, height: thickness, rx: 2, fill: F.desk }, g);
  el("rect", { x: left, y: top + thickness - 2, width: right - left, height: 2, fill: F.deskEdge }, g);

  // keyboard
  el("rect", { x: 48, y: top - 4, width: 36, height: 4, rx: 1.5, fill: F.keyboard }, g);
  for (let k = 0; k < 6; k++) el("rect", { x: 51 + k * 5.4, y: top - 5.2, width: 3.6, height: 1.6, rx: 0.8, fill: shade(F.keyboard, -0.15) }, g);

  // monitor: foot, stand, bezel, screen
  el("rect", { x: 112, y: top - 4, width: 30, height: 4, rx: 2, fill: F.bezel }, g);
  el("rect", { x: 123, y: top - 22, width: 8, height: 19, fill: shade(F.bezel, 0.15) }, g);
  el("rect", { x: 92, y: top - 78, width: 70, height: 58, rx: 5, fill: F.bezel }, g);
  const screen = options.blankScreen ? blankScreen(g, 96, top - 74, 62, 48) : drawScreen(g, 96, top - 74, 62, 48);

  if (options.mug) drawMug(g, 172, top, options.mugColor);

  function update(t) {
    const offset = (t * 9) % screen.period;
    screen.scroll.setAttribute("transform", `translate(0 ${-offset})`);
  }
  return { group: g, update };
}
