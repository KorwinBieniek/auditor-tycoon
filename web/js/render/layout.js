// Open-space geometry in scene pixels (render/geometry.js): rows one behind the other.
// The first row is large and low, each further row smaller, higher and more in the haze
// (aerial perspective). Side view: everyone faces right, towards their monitor.
import { ROW_CAPACITY } from "../config.js";
import { FRAMING } from "../framing.js";
import { SCENE, ROW_FLOOR, BACK_FLOOR, FRONT_UNIT, LANE_SHARE } from "./geometry.js";

export const ROWS = ROW_CAPACITY.map((capacity, r) => ({
  r,
  capacity,
  scale: FRAMING.scale[r],
  floorY: ROW_FLOOR[r] / SCENE.h, // kept for the layout sketch page
  floor: ROW_FLOOR[r],
  fog: FRAMING.fog[r], // how much haze colour mixes into the row (aerial perspective)
  span: r === 0 ? FRAMING.span.front : FRAMING.span.other, // x range of the row
}));

// Workstation in character units (chair back to desk end, floor to monitor top).
export const WORKSTATION = { left: -50, right: 190, height: 235 };
const WS_WIDTH = WORKSTATION.right - WORKSTATION.left;
const WS_CENTRE = (WORKSTATION.left + WORKSTATION.right) / 2;

/** Pixels per character unit in row r (limited by the row's perspective scale and seat width). */
export function unitOf(r) {
  const row = ROWS[r], slot = ((row.span[1] - row.span[0]) / row.capacity) * SCENE.w;
  return Math.min(FRONT_UNIT * row.scale, (slot * FRAMING.seatShare) / WS_WIDTH);
}
ROWS.forEach((row) => { row.unit = unitOf(row.r); });

// Seat order in a row: from the middle outwards.
function centerOutOrder(capacity) {
  const mid = (capacity - 1) / 2;
  return [...Array(capacity).keys()].sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b);
}
const ORDERS = ROWS.map((row) => centerOutOrder(row.capacity));

/** Seat of desk number i (0 = Ola, 1 = Kuba, then the next hires). x is the workstation centre (share). */
export function seatOf(i) {
  let r = 0, k = i;
  while (r < ROWS.length - 1 && k >= ROWS[r].capacity) { k -= ROWS[r].capacity; r += 1; }
  const row = ROWS[r];
  const col = r === 0 ? frontCol(i) : ORDERS[r][k];
  return { row: r, col, x: colX(row, col) };
}

export function colX(row, col) {
  const [a, b] = row.span;
  return a + ((col + 0.5) / row.capacity) * (b - a);
}

// First row: Ola (2) and Kuba (3) in the middle, the next ones to the sides.
function frontCol(i) { return [2, 3, 1, 4, 0, 5][i]; }

/** Pixel x of the figure (character origin) for a workstation centred at share x. */
export function figureX(x, unit, width = SCENE.w) { return x * width - WS_CENTRE * unit; }

/** Desk i in scene pixels: figure origin x, floor y, unit, row and column. */
export function stationOf(i) {
  const s = seatOf(i), unit = ROWS[s.row].unit;
  return { ...s, unit, floor: ROWS[s.row].floor, px: figureX(s.x, unit) };
}

/** Desk of a row and column (also free desks). */
export function stationAt(r, col) {
  const row = ROWS[r];
  return { row: r, col, unit: row.unit, floor: row.floor, px: figureX(colX(row, col), row.unit) };
}

/** Number of rows that hold at least one of `desks` desks. */
export function occupiedRows(desks) {
  let r = 0, left = desks;
  while (left > 0 && r < ROWS.length) { left -= ROWS[r].capacity; r += 1; }
  return r;
}

/** Depth gap behind row r (to the next row or to the wall). */
const gapBehind = (r) => (r + 1 < ROWS.length ? ROWS[r].floor - ROWS[r + 1].floor : ROWS[r].floor - BACK_FLOOR);

/** Walking lane behind row r: "in" for people arriving, "out" for people leaving. */
export function laneY(r, kind) { return ROWS[r].floor - gapBehind(r) * LANE_SHARE[kind]; }

/** Character unit at floor depth y: the row units joined by straight lines (walkers, Pan Marek). */
export function unitAtDepth(y) {
  const last = ROWS.length - 1;
  if (y >= ROWS[0].floor) return ROWS[0].unit;
  for (let r = 0; r < last; r++) {
    const a = ROWS[r], b = ROWS[r + 1];
    if (y >= b.floor) return b.unit + ((y - b.floor) / (a.floor - b.floor)) * (a.unit - b.unit);
  }
  return ROWS[last].unit;
}

/** Haze at floor depth y, the same way. */
export function fogAtDepth(y) {
  if (y >= ROWS[0].floor) return 0;
  for (let r = 0; r < ROWS.length - 1; r++) {
    const a = ROWS[r], b = ROWS[r + 1];
    if (y >= b.floor) return b.fog + ((y - b.floor) / (a.floor - b.floor)) * (a.fog - b.fog);
  }
  return ROWS[ROWS.length - 1].fog;
}

/** Colour mixed with the haze colour (aerial perspective). */
export function fogColor(rgb, haze, fog) {
  const mix = rgb.map((c, j) => Math.round(c + (haze[j] - c) * fog));
  return `rgb(${mix.join(",")})`;
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
