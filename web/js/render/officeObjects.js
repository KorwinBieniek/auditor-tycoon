// Office objects drawn from scratch in flat warm colours. All in character units:
// origin at the object's floor centre, y = 0 is the floor, negative y is up.
import { el, shade } from "../svg.js";

const C = {
  steel: "#8E99A6", dark: "#3B4250", cream: "#F4EBDD", red: "#D8645A", teal: "#5FA8A0",
  water: "#9FD3E6", wood: "#B9773F", paper: "#FFFFFF", leaf: "#6FA66A", pot: "#C8693E",
};

export function drawCoffeeMachine(parent) {
  const g = el("g", { class: "obj coffee" }, parent);
  el("rect", { x: -34, y: -96, width: 68, height: 96, rx: 6, fill: C.wood }, g); // cabinet
  el("rect", { x: -26, y: -196, width: 52, height: 100, rx: 8, fill: C.red }, g); // machine body
  el("rect", { x: -18, y: -186, width: 36, height: 18, rx: 3, fill: C.dark }, g); // display
  el("rect", { x: -12, y: -181, width: 14, height: 4, rx: 2, fill: "#7FD1B9" }, g);
  el("rect", { x: -16, y: -152, width: 32, height: 34, rx: 3, fill: shade(C.red, -0.35) }, g); // cup niche
  el("rect", { x: -4, y: -152, width: 8, height: 7, fill: C.steel }, g); // spout
  el("rect", { x: -7, y: -131, width: 14, height: 13, rx: 2, fill: C.cream }, g); // cup
  for (const x of [-12, 0, 12]) el("circle", { cx: x, cy: -105, r: 3.5, fill: C.cream }, g);
  return g;
}

export function drawWaterDispenser(parent) {
  const g = el("g", { class: "obj water" }, parent);
  el("rect", { x: -24, y: -128, width: 48, height: 128, rx: 6, fill: C.cream }, g);
  el("rect", { x: -24, y: -14, width: 48, height: 14, rx: 4, fill: shade(C.cream, -0.12) }, g);
  el("rect", { x: -9, y: -98, width: 6, height: 8, fill: C.teal }, g); // tap
  el("rect", { x: 3, y: -98, width: 6, height: 8, fill: C.red }, g);
  el("path", { d: "M -20 -128 L -20 -176 Q -20 -196 0 -196 Q 20 -196 20 -176 L 20 -128 Z", fill: C.water, opacity: 0.9 }, g);
  el("rect", { x: -7, y: -202, width: 14, height: 8, rx: 2, fill: shade(C.water, -0.2) }, g);
  el("rect", { x: -14, y: -170, width: 6, height: 34, rx: 3, fill: "#FFFFFF", opacity: 0.6 }, g); // highlight
  return g;
}

export function drawPrinter(parent) {
  const g = el("g", { class: "obj printer" }, parent);
  el("rect", { x: -44, y: -80, width: 88, height: 80, rx: 5, fill: C.wood }, g);
  el("rect", { x: -40, y: -128, width: 80, height: 48, rx: 6, fill: "#D9D4CB" }, g);
  el("rect", { x: -32, y: -120, width: 50, height: 6, rx: 3, fill: C.dark }, g); // paper slot
  el("rect", { x: -28, y: -140, width: 42, height: 20, fill: C.paper }, g); // printed page
  for (const y of [-136, -131, -126]) el("rect", { x: -24, y, width: 30, height: 2, fill: "#B8B2A8" }, g);
  el("circle", { cx: 28, cy: -100, r: 4, fill: "#7FD1B9", class: "blink" }, g);
  return g;
}

export function drawPlant(parent) {
  const g = el("g", { class: "obj plant" }, parent);
  for (const [dx, h] of [[-14, 70], [0, 92], [14, 76], [-6, 58], [8, 62]]) {
    el("ellipse", { cx: dx, cy: -40 - h / 2, rx: 9, ry: h / 2, fill: shade(C.leaf, dx / 140), transform: `rotate(${dx} ${dx} -40)` }, g);
  }
  el("path", { d: "M -20 -44 L 20 -44 L 15 0 L -15 0 Z", fill: C.pot }, g);
  return g;
}

/** Door in pixels on the wall layer. */
export function drawDoor(parent, x, y, w, h) {
  const g = el("g", { class: "door" }, parent);
  el("rect", { x: x - 4, y: y - 4, width: w + 8, height: h + 4, rx: 3, fill: "#C59A6B" }, g);
  el("rect", { x, y, width: w, height: h, rx: 2, fill: "#D9A86C" }, g);
  el("rect", { x: x + w * 0.15, y: y + h * 0.1, width: w * 0.7, height: h * 0.35, rx: 2, fill: shade("#D9A86C", 0.15) }, g);
  el("circle", { cx: x + w * 0.82, cy: y + h * 0.55, r: Math.max(2, w * 0.06), fill: "#7A4E2E" }, g);
  return g;
}

/** Server rack in pixels; returns the point where alerts start. LEDs blink by CSS. */
export function drawServer(parent, x, y, w, h) {
  const g = el("g", { class: "server" }, parent);
  el("rect", { x, y, width: w, height: h, rx: 4, fill: C.dark }, g);
  const units = 7, gap = h / (units + 1);
  for (let k = 0; k < units; k++) {
    const uy = y + gap * (k + 0.5);
    el("rect", { x: x + w * 0.1, y: uy, width: w * 0.8, height: gap * 0.7, rx: 2, fill: shade(C.dark, 0.12) }, g);
    for (let j = 0; j < 3; j++) {
      el("circle", { cx: x + w * (0.25 + j * 0.13), cy: uy + gap * 0.35, r: Math.max(1.2, w * 0.04),
        fill: j === 2 ? "#F2836B" : "#7FD1B9", class: `led led-${(k + j) % 4}` }, g);
    }
  }
  return { x: x + w / 2, y: y + gap };
}

/** Window with sky in pixels. */
export function drawWindow(parent, x, y, w, h) {
  const g = el("g", { class: "window" }, parent);
  el("rect", { x: x - 4, y: y - 4, width: w + 8, height: h + 8, rx: 4, fill: "#E8D2B3" }, g);
  el("rect", { x, y, width: w, height: h, fill: "#BFE3EE" }, g);
  el("ellipse", { cx: x + w * 0.3, cy: y + h * 0.35, rx: w * 0.16, ry: h * 0.08, fill: "#FFFFFF", opacity: 0.8 }, g);
  el("rect", { x: x + w / 2 - 2, y, width: 4, height: h, fill: "#E8D2B3" }, g);
  el("rect", { x, y: y + h / 2 - 2, width: w, height: 4, fill: "#E8D2B3" }, g);
  return g;
}
