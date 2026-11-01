// Face: eyes, brows, mouth, nose, ear and blush.
// An expression is just a set of parameters, so adding a new one is easy.
import { el, shade } from "./svg.js";
import { INK, MOUTH, TONGUE, BLUSH } from "./palette.js";

// browLift > 0 lowers the brows, browTilt > 0 raises their inner ends (worry),
// browTilt < 0 lowers them (focus).
export const EXPRESSIONS = {
  neutral: { label: "Neutral", eyes: "open", browLift: 0, browTilt: 0, mouth: "smile" },
  focused: { label: "Focused", eyes: "open", browLift: 1.2, browTilt: -0.8, mouth: "flat" },
  happy: { label: "Happy", eyes: "happy", browLift: -3, browTilt: 0.5, mouth: "open" },
  tired: { label: "Tired", eyes: "tired", browLift: 0.5, browTilt: 2.2, mouth: "meh" },
  panic: { label: "Panic", eyes: "wide", browLift: -4.5, browTilt: 3, mouth: "o" },
};

// Face element positions are computed from the head radius, so they work for any width.
export function faceLayout(geo) {
  const { R, eyeY } = geo;
  return {
    eyes: [[0.2 * R, eyeY], [0.64 * R, eyeY]],
    mouth: [0.44 * R, eyeY + 16],
    nose: [0.86 * R, eyeY + 4],
    ear: [-0.3 * R, eyeY + 4],
    blush: [[-0.04 * R, eyeY + 10], [0.84 * R, eyeY + 10]],
  };
}

function drawEye(g, [x, y], kind) {
  if (kind === "happy") {
    el("path", { d: `M ${x - 4} ${y + 1.5} Q ${x} ${y - 4.5} ${x + 4} ${y + 1.5}`, stroke: INK, "stroke-width": 2.4, fill: "none", "stroke-linecap": "round" }, g);
  } else if (kind === "tired") {
    // half-closed lids: only the lower half of the eye is visible
    el("path", { d: `M ${x - 4} ${y} Q ${x} ${y + 6} ${x + 4} ${y} Z`, fill: "#FFFFFF" }, g);
    el("path", { d: `M ${x - 1.4} ${y} Q ${x + 1} ${y + 4.4} ${x + 3.4} ${y} Z`, fill: INK }, g);
    el("path", { d: `M ${x - 4.6} ${y} L ${x + 4.6} ${y}`, stroke: INK, "stroke-width": 2.2, "stroke-linecap": "round" }, g);
  } else if (kind === "wide") {
    el("circle", { cx: x, cy: y, r: 5, fill: "#FFFFFF", stroke: INK, "stroke-width": 1.2 }, g);
    el("circle", { cx: x + 0.8, cy: y, r: 2.4, fill: INK }, g);
  } else {
    // open eye: white, pupil looking slightly right, and a highlight
    el("ellipse", { cx: x, cy: y, rx: 4, ry: 4.9, fill: "#FFFFFF" }, g);
    el("ellipse", { cx: x + 1, cy: y + 0.4, rx: 2.7, ry: 3.4, fill: INK }, g);
    el("circle", { cx: x + 1.9, cy: y - 1, r: 0.95, fill: "#FFFFFF" }, g);
  }
}

function drawBrow(g, [x, y], side, expr, color) {
  const base = y - 10 + expr.browLift;
  // side = -1 for the far eye (inner end on the right), +1 for the near eye
  const innerX = x - side * 4.2, outerX = x + side * 4.2;
  const innerY = base - expr.browTilt, outerY = base + expr.browTilt * 0.3;
  const d = `M ${outerX} ${outerY} Q ${x} ${base - 1.5} ${innerX} ${innerY}`;
  el("path", { d, stroke: color, "stroke-width": 2.6, fill: "none", "stroke-linecap": "round" }, g);
}

function drawMouth(g, [x, y], kind) {
  const line = { stroke: MOUTH, "stroke-width": 2.2, fill: "none", "stroke-linecap": "round" };
  if (kind === "smile") el("path", { d: `M ${x - 5} ${y} Q ${x} ${y + 4.5} ${x + 5} ${y}`, ...line }, g);
  if (kind === "flat") el("path", { d: `M ${x - 3.5} ${y + 1} L ${x + 4} ${y + 0.3}`, ...line }, g);
  if (kind === "meh") el("path", { d: `M ${x - 5} ${y + 2} Q ${x} ${y - 1.5} ${x + 5} ${y + 2.2}`, ...line }, g);
  if (kind === "o") el("ellipse", { cx: x, cy: y + 1, rx: 3.4, ry: 4.4, fill: MOUTH }, g);
  if (kind === "open") {
    el("path", { d: `M ${x - 7} ${y - 1} Q ${x} ${y + 0.5} ${x + 7} ${y - 1} Q ${x + 6} ${y + 9} ${x} ${y + 9} Q ${x - 6} ${y + 9} ${x - 7} ${y - 1} Z`, fill: MOUTH }, g);
    el("ellipse", { cx: x, cy: y + 6.6, rx: 3.6, ry: 2.1, fill: TONGUE }, g);
  }
}

// The ear is drawn separately (before the hair) so a bob can cover it.
export function drawEar(parent, skin, geo) {
  const [x, y] = faceLayout(geo).ear;
  const g = el("g", { class: "ear" }, parent);
  el("ellipse", { cx: x, cy: y, rx: 4.6, ry: 6.6, fill: shade(skin, -0.08) }, g);
  el("path", { d: `M ${x + 1.5} ${y - 3} Q ${x - 2} ${y} ${x + 1.5} ${y + 3}`, stroke: shade(skin, -0.25), "stroke-width": 1.4, fill: "none", "stroke-linecap": "round" }, g);
  return g;
}

// Draws the face and returns the eye group (needed for blinking).
export function drawFace(parent, expressionName, skin, browColor, geo) {
  const expr = EXPRESSIONS[expressionName];
  const layout = faceLayout(geo);
  const g = el("g", { class: "face" }, parent);
  for (const [bx, by] of layout.blush) el("circle", { cx: bx, cy: by, r: 4.2, fill: BLUSH, opacity: 0.3 }, g);
  const [nx, ny] = layout.nose;
  el("path", { d: `M ${nx} ${ny - 3} Q ${nx + 3.5} ${ny + 1} ${nx - 0.5} ${ny + 3}`, stroke: shade(skin, -0.28), "stroke-width": 1.8, fill: "none", "stroke-linecap": "round" }, g);
  drawMouth(g, layout.mouth, expr.mouth);
  const eyes = el("g", { class: "eyes" }, g);
  layout.eyes.forEach((pos, i) => drawEye(eyes, pos, expr.eyes));
  layout.eyes.forEach((pos, i) => drawBrow(g, pos, i === 0 ? -1 : 1, expr, browColor));
  // only open eyes can blink
  const canBlink = expr.eyes === "open" || expr.eyes === "wide";
  return { eyes, canBlink, eyeY: geo.eyeY };
}
