// The bank on the back wall: wall, floor, night window, door, sign, clock, glass meeting room,
// server rack and coffee machine. Static except the clock hands and the window's time of day.
import { el, shade } from "../svg.js";
import { drawCoffeeMachine, drawDoor, drawServer, drawPlant } from "./officeObjects.js";
import { drawDesk, drawChair } from "../furniture.js";
import { KIT } from "../ui/kit.js";
import { SCENE, WALL, COFFEE, MEETING_UNIT } from "./geometry.js";

export const BANK = { name: "Outlier & Sons", unit: "Fraud Operations Center" };

export function drawRoom(svg) {
  const g = el("g", { class: "room" }, svg);
  el("rect", { x: 0, y: 0, width: SCENE.w, height: SCENE.wallBottom, fill: KIT.wall }, g);
  el("rect", { x: 0, y: 0, width: SCENE.w, height: 8, fill: shade(KIT.wall, -0.08) }, g); // ceiling edge
  el("rect", { x: 0, y: SCENE.wallBottom, width: SCENE.w, height: SCENE.h - SCENE.wallBottom, fill: KIT.floor }, g);
  el("rect", { x: 0, y: SCENE.wallBottom - 6, width: SCENE.w, height: 6, fill: shade(KIT.wall, -0.18) }, g); // skirting
  floorBoards(g);
  return g;
}

// Faint perspective lines on the floor towards a vanishing point above the room.
function floorBoards(g) {
  const vx = SCENE.w / 2, vy = -600, y0 = SCENE.wallBottom, y1 = SCENE.tickerTop;
  for (let k = -8; k <= 8; k++) {
    const xb = vx + k * 150, t = (y0 - vy) / (y1 - vy);
    el("line", { x1: vx + (xb - vx) * t, y1: y0, x2: xb, y2: y1, stroke: shade(KIT.floor, -0.06), "stroke-width": 1 }, g);
  }
}

// Time of day in the window follows the dataset clock. ASSUMPTION: the dataset starts around midnight
// (volume drops in hours 0-8 of both days), so hour = seconds since the first transaction / 3600, mod 24.
// Keyframes (hour): sky colour, two building shades, share of lit windows' opacity, sun (0..1) vs moon.
const SKY_KEYS = [
  { h: 0, sky: "#1E2A44", b1: "#2A3550", b2: "#323E5C", lights: 0.85, sun: 0 },
  { h: 5, sky: "#1E2A44", b1: "#2A3550", b2: "#323E5C", lights: 0.85, sun: 0 },
  { h: 7, sky: "#E3A07E", b1: "#5A5F7A", b2: "#646A86", lights: 0.45, sun: 0.7 },
  { h: 9, sky: "#9CC7E0", b1: "#71819B", b2: "#7D8DA6", lights: 0.06, sun: 1 },
  { h: 17, sky: "#9CC7E0", b1: "#71819B", b2: "#7D8DA6", lights: 0.06, sun: 1 },
  { h: 19, sky: "#D9825B", b1: "#4F536E", b2: "#595E7A", lights: 0.55, sun: 0.7 },
  { h: 21, sky: "#1E2A44", b1: "#2A3550", b2: "#323E5C", lights: 0.85, sun: 0 },
  { h: 24, sky: "#1E2A44", b1: "#2A3550", b2: "#323E5C", lights: 0.85, sun: 0 },
];
const SUN_HOURS = [6, 20];       // the sun crosses the window between these hours
const SKY_STEP_SECONDS = 60;     // redraw the window at most once per dataset minute

const mixHex = (a, b, u) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - u)
  + parseInt(b.slice(i, i + 2), 16) * u).toString(16).padStart(2, "0")).join("");

function skyAt(hour) {
  const k = SKY_KEYS.findIndex((key) => key.h > hour), a = SKY_KEYS[k - 1], b = SKY_KEYS[k];
  const u = (hour - a.h) / (b.h - a.h);
  return { sky: mixHex(a.sky, b.sky, u), b1: mixHex(a.b1, b.b1, u), b2: mixHex(a.b2, b.b2, u),
    lights: a.lights + (b.lights - a.lights) * u, sun: a.sun + (b.sun - a.sun) * u };
}

/** Panoramic window onto a city; sky, sun or moon and lit windows follow the dataset hour. Returns set(seconds). */
export function drawCityWindow(svg) {
  const { x, y, w, h } = WALL.window;
  const g = el("g", { class: "city" }, svg);
  el("rect", { x: x - 6, y: y - 6, width: w + 12, height: h + 12, rx: 8, fill: KIT.graphite }, g);
  const sky = el("rect", { x, y, width: w, height: h, fill: "#1E2A44" }, g);
  const moon = el("circle", { cx: x + w * 0.8, cy: y + h * 0.18, r: 11, fill: "#F4EBDD" }, g);
  const sun = el("circle", { cx: x, cy: y, r: 13, fill: "#F6D27A", opacity: 0 }, g);
  const { buildings, lights } = skyline(g, x, y, w, h);
  for (const k of [1, 2]) el("rect", { x: x + (w * k) / 3 - 2, y, width: 4, height: h, fill: KIT.graphite }, g);
  el("rect", { x: x - 10, y: y + h + 4, width: w + 20, height: 7, rx: 3, fill: shade(KIT.wall, -0.15) }, g); // sill
  let last = null;
  return {
    /** Click on the window: the city lights flicker for a moment (decoration). */
    flicker() { lights.classList.remove("flicker"); void lights.getBBox(); lights.classList.add("flicker"); setTimeout(() => lights.classList.remove("flicker"), 2600); },
    set(seconds) {
      const step = Math.floor(seconds / SKY_STEP_SECONDS);
      if (step === last) return;
      last = step;
      const hour = ((seconds / 3600) % 24 + 24) % 24, c = skyAt(hour);
      sky.setAttribute("fill", c.sky);
      buildings.forEach((b, k) => b.setAttribute("fill", k % 2 ? c.b1 : c.b2));
      lights.setAttribute("opacity", c.lights.toFixed(3));
      // never both at once: the moon fades out before the sun fades in (and the other way round at dusk)
      moon.setAttribute("opacity", Math.max(0, 1 - c.sun / 0.35).toFixed(3));
      const u = Math.min(1, Math.max(0, (hour - SUN_HOURS[0]) / (SUN_HOURS[1] - SUN_HOURS[0])));
      sun.setAttribute("cx", x + w * (0.1 + 0.8 * u)); sun.setAttribute("cy", y + h * (0.5 - 0.38 * Math.sin(Math.PI * u)));
      sun.setAttribute("opacity", Math.min(1, Math.max(0, (c.sun - 0.35) / 0.35)).toFixed(3));
    },
  };
}

function skyline(g, x, y, w, h) {
  const buildings = [], lights = el("g", { class: "city-lights" });
  let bx = x, k = 0;
  while (bx < x + w) {
    const bw = 22 + ((k * 13) % 20), bh = h * (0.3 + ((k * 37) % 50) / 100);
    buildings.push(el("rect", { x: bx, y: y + h - bh, width: bw - 3, height: bh, fill: k % 2 ? "#2A3550" : "#323E5C" }, g));
    litWindows(lights, bx, y + h - bh, bw - 3, bh, k);
    bx += bw; k += 1;
  }
  g.appendChild(lights);
  return { buildings, lights };
}

function litWindows(g, x, y, w, h, k) {
  for (let r = 0; y + 8 + r * 9 < y + h - 4; r++) {
    for (let c = 0; x + 4 + c * 7 < x + w - 4; c++) {
      if ((r * 7 + c * 3 + k * 5) % 4 === 0) el("rect", { x: x + 4 + c * 7, y: y + 8 + r * 9, width: 3.5, height: 4, fill: "#F6D27A" }, g);
    }
  }
}

/** Bank logo: a rounded tile with a ring (the "O") and a mustard dot. */
export function drawLogo(parent, cx, cy, size) {
  const g = el("g", { class: "logo" }, parent);
  el("rect", { x: cx - size / 2, y: cy - size / 2, width: size, height: size, rx: size * 0.28, fill: KIT.navy }, g);
  el("circle", { cx, cy, r: size * 0.26, fill: "none", stroke: KIT.cream, "stroke-width": size * 0.12 }, g);
  el("circle", { cx: cx + size * 0.2, cy: cy - size * 0.2, r: size * 0.09, fill: KIT.mustard }, g);
  return g;
}

const SIGN_GAP = 18;   // between the bank name and the unit name

/** The bank sign; the unit name follows the bank name, whatever its length (measured after fonts load). */
export function drawSign(svg, name = BANK.name) {
  const { x, y, w, h } = WALL.sign;
  const g = el("g", { class: "sign" }, svg);
  el("rect", { x, y, width: w, height: h, rx: 10, fill: KIT.graphite }, g);
  drawLogo(g, x + 22, y + h / 2, 26);
  const bank = text(g, x + 44, y + 26, name, "sign-bank");
  const unit = text(g, x + 190, y + 26, BANK.unit.toUpperCase(), "sign-unit");
  const place = () => { if (bank.getComputedTextLength) unit.setAttribute("x", x + 44 + bank.getComputedTextLength() + SIGN_GAP); };
  place(); document.fonts?.ready.then(place);
}

/** Wall clock with the dataset hour (seconds since the first transaction, assumed to start at midnight). Returns set(seconds). */
export function drawClock(svg, seconds = 0) {
  const { cx, cy, r } = WALL.clock;
  const g = el("g", { class: "clock" }, svg);
  el("circle", { cx, cy, r: r + 4, fill: KIT.graphite }, g);
  el("circle", { cx, cy, r, fill: KIT.cream }, g);
  for (let k = 0; k < 12; k++) tick(g, cx, cy, r, k);
  const hours = hand(g, cx, cy, r * 0.5, 3.5), minutes = hand(g, cx, cy, r * 0.78, 2.2);
  el("circle", { cx, cy, r: 2.6, fill: KIT.fraud }, g);
  const set = (t) => {
    const s = t % 86400;
    hours.setAttribute("transform", `rotate(${((s / 3600) % 12) * 30} ${cx} ${cy})`);
    minutes.setAttribute("transform", `rotate(${((s % 3600) / 60) * 6} ${cx} ${cy})`);
  };
  set(seconds);
  return { group: g, set };
}

function tick(g, cx, cy, r, k) {
  const a = (k * Math.PI) / 6;
  el("line", { x1: cx + Math.sin(a) * r * 0.82, y1: cy - Math.cos(a) * r * 0.82, x2: cx + Math.sin(a) * r * 0.94,
    y2: cy - Math.cos(a) * r * 0.94, stroke: KIT.ink, "stroke-width": k % 3 ? 1.2 : 2.2, "stroke-linecap": "round" }, g);
}

// A hand pointing at 12 o'clock; set() rotates it.
function hand(g, cx, cy, len, width) {
  return el("line", { x1: cx, y1: cy, x2: cx, y2: cy - len, stroke: KIT.ink, "stroke-width": width, "stroke-linecap": "round" }, g);
}

/** Glass wall of the meeting room: frosted band, mullions, a table and chairs behind the glass. */
export function drawMeetingRoom(svg) {
  const { x, y, w, h } = WALL.glass;
  const g = el("g", { class: "meeting" }, svg);
  el("rect", { x, y, width: w, height: h, fill: shade(KIT.wall, -0.06) }, g);
  meetingFurniture(g, x, w, y + h, MEETING_UNIT);
  el("rect", { x, y, width: w, height: h, fill: "#CFE6EE", opacity: 0.35 }, g); // glass tint
  el("rect", { x, y: y + h * 0.42, width: w, height: 16, fill: "#FFFFFF", opacity: 0.55 }, g); // frosted band
  text(g, x + 14, y + h * 0.42 + 12, "MEETING ROOM", "glass-label");
  for (let k = 0; k <= 4; k++) el("rect", { x: x + (w * k) / 4 - 2, y, width: 4, height: h, fill: KIT.graphite }, g);
  el("rect", { x, y, width: w, height: 5, fill: KIT.graphite }, g);
  for (const [px, py, pw] of [[x + 20, y + 30, 40], [x + 100, y + 60, 26]]) {
    el("line", { x1: px, y1: py + pw, x2: px + pw, y2: py, stroke: "#FFFFFF", "stroke-width": 3, opacity: 0.5 }, g); // glints
  }
}

// Table, chairs and a plant behind the glass, placed by share of the room width and drawn at `unit`.
const MEETING = { table: 0.38, plant: 0.9, plantScale: 1.43 };
function meetingFurniture(g, x, w, floor, unit) {
  const t = el("g", { transform: `translate(${x + w * MEETING.table} ${floor}) scale(${unit})` }, g);
  el("rect", { x: -40, y: -92, width: 330, height: 10, rx: 4, fill: "#C9844F" }, t);
  for (const lx of [-20, 260]) el("rect", { x: lx, y: -82, width: 8, height: 82, fill: "#A96A3C" }, t);
  for (const cx of [10, 110, 210]) drawChair(el("g", { transform: `translate(${cx} 0)` }, t));
  const p = el("g", { transform: `translate(${x + w * MEETING.plant} ${floor}) scale(${unit * MEETING.plantScale})` }, g);
  drawPlant(el("g", { class: "m-plant" }, p));
}

const FEED_LABEL = ["Card payments", "feed"];   // what the rack stands for (the dataset)

export function drawServerRack(svg) {
  const { x, y, w, h } = WALL.server;
  FEED_LABEL.forEach((line, k) => text(svg, x + w / 2, y - 21 + k * 12, line, "rack-label", { "text-anchor": "middle" }));
  return drawServer(el("g", { class: "m-rack" }, svg), x, y, w, h);
}

export function drawDoorAndCoffee(svg) {
  const { x, y, w, h } = WALL.door;
  drawDoor(svg, x, y, w, h);
  const c = el("g", { transform: `translate(${COFFEE.x} ${COFFEE.floor}) scale(${COFFEE.unit})` }, svg);
  drawCoffeeMachine(c);
}

export function text(parent, x, y, content, cls, attrs = {}) {
  const t = el("text", { x, y, class: cls, ...attrs }, parent);
  t.textContent = content;
  return t;
}

export { drawDesk, drawChair };
