// Hairstyles: each is a separate SVG group drawn on top of the head,
// so they can be swapped freely (the character's hair.style parameter).
// Every function gets: parent, head centre (cy), head radius (R) and colour.
import { el, shade } from "./svg.js";

// Shared "cap" of short hair: back of the head, crown and hairline.
function capPath(cy, r) {
  const fx = 0.883 * r, fy = cy - 0.469 * r; // point above the forehead (front, on the right)
  return [
    `M ${-r} ${cy + 0.56 * r}`,
    `L ${-r} ${cy}`,
    `A ${r} ${r} 0 0 1 ${fx} ${fy}`,
    `Q ${0.3 * r} ${cy - 0.25 * r} ${-0.2 * r} ${cy - 0.3 * r}`,
    `Q ${-0.42 * r} ${cy - 0.05 * r} ${-0.36 * r} ${cy + 0.3 * r}`,
    `Q ${-0.7 * r} ${cy + 0.62 * r} ${-r} ${cy + 0.56 * r}`,
    "Z",
  ].join(" ");
}

// Bun: a short cap and a ball of hair at the back of the crown.
function bun(g, cy, R, color) {
  const r = R + 2;
  el("circle", { cx: -0.42 * r, cy: cy - 0.92 * r, r: 0.4 * r, fill: color }, g);
  el("path", { d: capPath(cy, r), fill: color }, g);
  // hair tie
  el("path", {
    d: `M ${-0.62 * r} ${cy - 0.62 * r} Q ${-0.4 * r} ${cy - 0.52 * r} ${-0.18 * r} ${cy - 0.7 * r}`,
    stroke: shade(color, 0.35), "stroke-width": 3, fill: "none", "stroke-linecap": "round",
  }, g);
}

// Curls: a few circles around the head give volume.
function curls(g, cy, R, color) {
  const r = R + 1;
  el("path", { d: capPath(cy, r), fill: color }, g);
  const puff = 0.34 * r;
  for (let deg = 200; deg >= 45; deg -= 22) {
    const a = (deg * Math.PI) / 180;
    el("circle", { cx: r * Math.cos(a), cy: cy - r * Math.sin(a), r: puff, fill: color }, g);
  }
  // small curl strokes for texture
  for (let deg = 175; deg >= 60; deg -= 28) {
    const a = (deg * Math.PI) / 180;
    const x = 0.86 * r * Math.cos(a), y = cy - 0.86 * r * Math.sin(a);
    el("path", { d: `M ${x - 3} ${y} q 3 -4 6 0`, stroke: shade(color, 0.22), "stroke-width": 1.6, fill: "none", "stroke-linecap": "round" }, g);
  }
}

// Bob with a fringe: longer hair at the back covers the ear, fringe above the brows.
function bob(g, cy, R, color) {
  const r = R + 2.5;
  const d = [
    `M ${-0.26 * r} ${cy + 0.95 * r}`,
    `L ${-0.26 * r} ${cy - 0.05 * r}`,
    `Q ${0.35 * r} ${cy - 0.12 * r} ${0.97 * r} ${cy - 0.25 * r}`,
    `A ${r} ${r} 0 0 0 ${-r} ${cy}`,
    `L ${-1.03 * r} ${cy + 1.02 * r}`,
    `Q ${-0.65 * r} ${cy + 1.18 * r} ${-0.26 * r} ${cy + 0.95 * r}`,
    "Z",
  ].join(" ");
  el("path", { d, fill: color }, g);
  // strand on the fringe
  el("path", {
    d: `M ${0.05 * r} ${cy - 0.6 * r} Q ${0.4 * r} ${cy - 0.45 * r} ${0.6 * r} ${cy - 0.22 * r}`,
    stroke: shade(color, 0.18), "stroke-width": 2.2, fill: "none", "stroke-linecap": "round",
  }, g);
}

// Receding: hair only at the back and sides, bald crown (the boss's hairstyle).
function receding(g, cy, R, color) {
  const r = R + 1.5;
  const top = [-0.77 * r, cy - 0.64 * r]; // highest point of the hair (about 140 degrees)
  const d = [
    `M ${-r} ${cy + 0.56 * r}`,
    `L ${-r} ${cy}`,
    `A ${r} ${r} 0 0 1 ${top[0]} ${top[1]}`,
    `Q ${-0.5 * r} ${cy - 0.3 * r} ${-0.38 * r} ${cy + 0.28 * r}`,
    `Q ${-0.7 * r} ${cy + 0.62 * r} ${-r} ${cy + 0.56 * r}`,
    "Z",
  ].join(" ");
  el("path", { d, fill: color }, g);
  // combed-over strands on the bald crown
  for (const dx of [0, 7]) {
    el("path", { d: `M ${-0.62 * r + dx} ${cy - 0.74 * r} Q ${-0.25 * r + dx} ${cy - 0.93 * r} ${0.12 * r + dx} ${cy - 0.86 * r}`, stroke: color, "stroke-width": 1.6, fill: "none", "stroke-linecap": "round" }, g);
  }
}

// Short: a close cap of hair (a common men's cut).
function short(g, cy, R, color) {
  el("path", { d: capPath(cy, R + 1.5), fill: color }, g);
}

// Buzz cut: a thin cap, slightly lighter.
function buzz(g, cy, R, color) {
  el("path", { d: capPath(cy, R + 0.6), fill: shade(color, 0.15) }, g);
}

// Quiff: a short cap with hair swept up above the forehead.
function quiff(g, cy, R, color) {
  const r = R + 1.5;
  el("path", { d: capPath(cy, r), fill: color }, g);
  el("path", {
    d: `M ${-0.2 * r} ${cy - 0.92 * r} Q ${0.35 * r} ${cy - 1.32 * r} ${0.98 * r} ${cy - 0.62 * r} Q ${0.5 * r} ${cy - 0.78 * r} ${0.05 * r} ${cy - 0.72 * r} Z`,
    fill: color,
  }, g);
}

// Side part: a cap with a clear parting line and a fringe swept to the front.
function sidepart(g, cy, R, color) {
  const r = R + 1.8;
  el("path", { d: capPath(cy, r), fill: color }, g);
  el("path", { d: `M ${-0.1 * r} ${cy - 0.98 * r} Q ${0.5 * r} ${cy - 0.95 * r} ${0.95 * r} ${cy - 0.5 * r} L ${0.6 * r} ${cy - 0.5 * r} Q ${0.3 * r} ${cy - 0.7 * r} ${-0.1 * r} ${cy - 0.7 * r} Z`, fill: color }, g);
  el("path", { d: `M ${-0.15 * r} ${cy - 0.97 * r} Q ${0.1 * r} ${cy - 0.8 * r} ${0.05 * r} ${cy - 0.62 * r}`, stroke: shade(color, 0.3), "stroke-width": 1.6, fill: "none", "stroke-linecap": "round" }, g);
}

// Long: straight hair down to the shoulders at the back, with a fringe.
function long(g, cy, R, color) {
  const r = R + 2.5;
  const d = [
    `M ${-0.2 * r} ${cy + 1.55 * r}`,
    `L ${-0.2 * r} ${cy - 0.05 * r}`,
    `Q ${0.35 * r} ${cy - 0.15 * r} ${0.97 * r} ${cy - 0.3 * r}`,
    `A ${r} ${r} 0 0 0 ${-r} ${cy}`,
    `L ${-1.08 * r} ${cy + 1.6 * r}`,
    `Q ${-0.65 * r} ${cy + 1.75 * r} ${-0.2 * r} ${cy + 1.55 * r}`,
    "Z",
  ].join(" ");
  el("path", { d, fill: color }, g);
}

// Ponytail: a cap and a tail hanging at the back of the head.
function ponytail(g, cy, R, color) {
  const r = R + 2;
  el("path", { d: `M ${-0.85 * r} ${cy - 0.45 * r} Q ${-1.45 * r} ${cy + 0.2 * r} ${-1.15 * r} ${cy + 1.1 * r} Q ${-0.95 * r} ${cy + 0.4 * r} ${-0.6 * r} ${cy - 0.2 * r} Z`, fill: color }, g);
  el("path", { d: capPath(cy, r), fill: color }, g);
  el("circle", { cx: -0.82 * r, cy: cy - 0.38 * r, r: 0.12 * r, fill: shade(color, 0.35) }, g);
}

// Hairstyle dictionary: the key is hair.style in the character description.
export const HAIRSTYLES = {
  bun: { label: "Bun", draw: bun },
  curls: { label: "Curls", draw: curls },
  bob: { label: "Bob with fringe", draw: bob },
  receding: { label: "Receding", draw: receding },
  short: { label: "Short", draw: short },
  buzz: { label: "Buzz cut", draw: buzz },
  quiff: { label: "Quiff", draw: quiff },
  sidepart: { label: "Side part", draw: sidepart },
  long: { label: "Long", draw: long },
  ponytail: { label: "Ponytail", draw: ponytail },
};

// Draws the hairstyle as a separate <g class="hair"> group.
export function drawHair(parent, style, color, geo) {
  const g = el("g", { class: "hair", "data-style": style }, parent);
  HAIRSTYLES[style].draw(g, geo.headCY, geo.R, color);
  return g;
}
