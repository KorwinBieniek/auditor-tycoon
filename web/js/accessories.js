// Accessories: glasses, headphones, moustache, mug. Each is a small separate function.
import { el, shade } from "./svg.js";
import { INK } from "./palette.js";
import { faceLayout } from "./face.js";

function glasses(g, geo, p) {
  const color = p.glassesColor || INK;
  const { eyes, ear } = faceLayout(geo);
  const r = 5.8;
  const frame = { stroke: color, "stroke-width": 1.8, fill: "#FFFFFF", "fill-opacity": 0.18 };
  for (const [x, y] of eyes) el("circle", { cx: x, cy: y, r, ...frame }, g);
  const [a, b] = eyes;
  el("path", { d: `M ${a[0] + r} ${a[1] - 1} L ${b[0] - r} ${b[1] - 1}`, stroke: color, "stroke-width": 1.8 }, g);
  el("path", { d: `M ${a[0] - r} ${a[1] - 1} L ${ear[0] + 3} ${ear[1] - 4}`, stroke: color, "stroke-width": 1.8, "stroke-linecap": "round" }, g);
}

function headphones(g, geo, p) {
  const [ex, ey] = faceLayout(geo).ear;
  const top = geo.headCY - geo.R - 4;
  // the headband goes from the ear to the crown
  el("path", {
    d: `M ${ex} ${ey - 6} Q ${ex - 3} ${top + 6} ${ex + 7} ${top}`,
    stroke: "#3B4250", "stroke-width": 4.5, fill: "none", "stroke-linecap": "round",
  }, g);
  el("rect", { x: ex - 6.5, y: ey - 10, width: 13, height: 19, rx: 6, fill: "#3B4250" }, g);
  el("rect", { x: ex - 3.5, y: ey - 7, width: 7, height: 13, rx: 3.5, fill: p.headphonesColor || "#E86A5B" }, g);
}

function moustache(g, geo, p) {
  const [mx, my] = faceLayout(geo).mouth;
  el("path", {
    d: `M ${mx - 8} ${my - 2} Q ${mx - 4} ${my - 8} ${mx} ${my - 5} Q ${mx + 4} ${my - 8} ${mx + 8} ${my - 2} Q ${mx} ${my - 4} ${mx - 8} ${my - 2} Z`,
    fill: shade(p.hair.color, -0.4),
  }, g);
}

// Short full beard along the jaw, in the hair colour.
function beard(g, geo, p) {
  const [mx, my] = faceLayout(geo).mouth, R = geo.R, cy = geo.headCY;
  el("path", {
    d: `M ${-0.15 * R} ${cy + 0.15 * R} Q ${-0.05 * R} ${cy + 1.08 * R} ${mx + 2} ${cy + 1.02 * R} Q ${0.98 * R} ${cy + 0.85 * R} ${0.97 * R} ${cy + 0.2 * R}
      L ${mx + 10} ${my - 1} Q ${mx} ${my + 7} ${mx - 9} ${my - 1} Z`,
    fill: shade(p.hair.color, -0.15),
  }, g);
  el("path", { d: `M ${mx - 8} ${my - 3} Q ${mx} ${my - 8} ${mx + 9} ${my - 3}`, stroke: shade(p.hair.color, -0.3), "stroke-width": 3, fill: "none", "stroke-linecap": "round" }, g);
}

// Small round earring on the visible ear.
function earrings(g, geo, p) {
  const [ex, ey] = faceLayout(geo).ear;
  el("circle", { cx: ex + 1, cy: ey + 9, r: 2.6, fill: p.earringColor || "#E9C46A" }, g);
}

// Head accessories (drawn after the hair).
const HEAD_ACCESSORIES = { glasses, headphones, moustache, beard, earrings };

export function drawHeadAccessories(parent, p, geo) {
  const g = el("g", { class: "accessories" }, parent);
  for (const name of p.accessories) if (HEAD_ACCESSORIES[name]) HEAD_ACCESSORIES[name](g, geo, p);
  return g;
}

// Mug: (x, y) is the centre of the mug's bottom.
export function drawMug(parent, x, y, color = "#E86A5B") {
  const g = el("g", { class: "mug" }, parent);
  el("path", { d: `M ${x + 5} ${y - 9} q 6 0 6 4 q 0 4 -6 4`, stroke: shade(color, -0.2), "stroke-width": 2.2, fill: "none" }, g);
  el("rect", { x: x - 6, y: y - 13, width: 12, height: 13, rx: 2.5, fill: color }, g);
  el("rect", { x: x - 6, y: y - 13, width: 12, height: 2.5, rx: 1.2, fill: shade(color, 0.3) }, g);
  return g;
}
