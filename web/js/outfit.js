// Outfits: drawn on the lower part of the single rounded shape (head + torso),
// clipped to its outline with a clipPath. Types: sweater, shirt, suit.
import { el, shade } from "./svg.js";

// The "front" centre of the outfit is shifted right because the figure faces right (3/4 view).
function frontX(geo) {
  return 0.36 * geo.R;
}

function drawCollar(g, cx, y, color) {
  el("path", { d: `M ${cx - 9} ${y} L ${cx - 1} ${y + 8} L ${cx - 1} ${y} Z`, fill: color }, g);
  el("path", { d: `M ${cx + 9} ${y} L ${cx + 1} ${y + 8} L ${cx + 1} ${y} Z`, fill: color }, g);
}

function drawTie(g, cx, y, color) {
  el("path", { d: `M ${cx - 3.2} ${y + 1} L ${cx + 3.2} ${y + 1} L ${cx + 2.2} ${y + 6} L ${cx - 2.2} ${y + 6} Z`, fill: shade(color, -0.12) }, g);
  el("path", { d: `M ${cx - 2.2} ${y + 6} L ${cx + 2.2} ${y + 6} L ${cx + 4.2} ${y + 33} L ${cx} ${y + 39} L ${cx - 4.2} ${y + 33} Z`, fill: color }, g);
}

function sweater(g, o, geo) {
  const cx = frontX(geo), y = geo.neckY;
  el("rect", { x: -geo.R, y, width: 2 * geo.R, height: -y, fill: o.main }, g);
  el("path", { d: `M ${cx - 8} ${y} L ${cx + 8} ${y} L ${cx} ${y + 11} Z`, fill: o.collar }, g);
  drawCollar(g, cx, y - 0.5, shade(o.collar, -0.06));
  // optional stripes across the sweater
  if (o.stripes) for (let by = y + 22; by < -16; by += 16) el("rect", { x: -geo.R, y: by, width: 2 * geo.R, height: 5, fill: o.stripes }, g);
  // ribbed hem of the sweater
  el("rect", { x: -geo.R, y: -11, width: 2 * geo.R, height: 11, fill: shade(o.main, -0.1) }, g);
}

function shirt(g, o, geo) {
  const cx = frontX(geo), y = geo.neckY;
  el("rect", { x: -geo.R, y, width: 2 * geo.R, height: -y, fill: o.main }, g);
  for (let by = y + 14; by < -14; by += 12) el("circle", { cx: cx, cy: by, r: 1.2, fill: shade(o.main, -0.3) }, g);
  drawCollar(g, cx, y - 0.5, shade(o.main, 0.25));
  if (o.tie) drawTie(g, cx, y, o.tie);
  // trouser waistband visible under the shirt
  el("rect", { x: -geo.R, y: -9, width: 2 * geo.R, height: 9, fill: o.pants }, g);
  el("rect", { x: -geo.R, y: -9, width: 2 * geo.R, height: 2.2, fill: shade(o.pants, -0.3) }, g);
}

function suit(g, o, geo) {
  const cx = frontX(geo), y = geo.neckY;
  el("rect", { x: -geo.R, y, width: 2 * geo.R, height: -y, fill: o.main }, g);
  el("path", { d: `M ${cx - 9} ${y} L ${cx + 10} ${y} L ${cx + 1} ${y + 30} Z`, fill: o.shirt }, g);
  drawTie(g, cx, y - 1, o.tie);
  // jacket lapels
  const lapel = shade(o.main, -0.18);
  el("path", { d: `M ${cx - 10} ${y} L ${cx - 4} ${y + 14} L ${cx + 1} ${y + 30} L ${cx - 6} ${y + 10} Z`, fill: lapel }, g);
  el("path", { d: `M ${cx + 11} ${y} L ${cx + 6} ${y + 14} L ${cx + 1} ${y + 30} L ${cx + 8} ${y + 10} Z`, fill: lapel }, g);
  el("circle", { cx: cx + 2, cy: y + 40, r: 1.8, fill: shade(o.main, -0.35) }, g);
  el("circle", { cx: cx + 2, cy: y + 52, r: 1.8, fill: shade(o.main, -0.35) }, g);
  // breast pocket with a pocket square
  el("rect", { x: -geo.R * 0.55, y: y + 18, width: 12, height: 2, fill: lapel }, g);
  el("path", { d: `M ${-geo.R * 0.55 + 2} ${y + 18} L ${-geo.R * 0.55 + 5} ${y + 14} L ${-geo.R * 0.55 + 8} ${y + 18} Z`, fill: o.tie }, g);
}

const OUTFITS = { sweater, shirt, suit };

// Sleeve colour depends on the outfit type.
export function sleeveColor(o) {
  return o.main;
}

// Cuff colour at the hand (e.g. a white shirt showing under the jacket).
export function cuffColor(o) {
  if (o.type === "suit") return o.shirt;
  if (o.type === "sweater") return shade(o.main, -0.1);
  return null;
}

export function drawOutfit(parent, outfit, geo, clipId) {
  const g = el("g", { class: "outfit", "clip-path": `url(#${clipId})` }, parent);
  OUTFITS[outfit.type](g, outfit, geo);
  return g;
}
