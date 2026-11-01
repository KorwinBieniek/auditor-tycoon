// Office framing: rows of desks (depth planes) and where the room objects stand. Layout only: these
// values move desks and furniture, never results.
//
// A layout is built from a few choices (rowsFrom):
//   rows: number of desk rows; frontScale: perspective scale of the front row; lastShare: back row
//   scale as a share of the front row; frontFloor / backFloor: floor lines of the front and back rows
//   (row gaps shrink with the scale, like real perspective); seatShare: workstation width / seat slot
//   (above 1 the desks overlap, like a dense open space); span: x range of the front row and of the
//   others (share of the width); haze: aerial perspective of the back row (0 = none, 1 = wall colour).
// Desks per row follow the room: the front row keeps 6 for the named people, the other desks go to
// the rows in proportion to how many fit at their scale, so MAX_DESKS people always fit.
export const MAX_DESKS = 100;   // big enough for the best team of every shift (tests/models.test.mjs), small enough that people stay readable
export const FRONT_DESKS = 6;
const PERSON_UNIT = 0.6;      // pixels per character unit at scale 1 (geometry.FRONT_UNIT)
const WORKSTATION_UNITS = 240; // chair back to desk end (layout.WORKSTATION)
const SCENE_W = 1440;

function rowsFrom(c) {
  const q = c.lastShare ** (1 / (c.rows - 1));
  const scale = [...Array(c.rows)].map((_, r) => c.frontScale * q ** r);
  const total = scale.slice(0, -1).reduce((a, b) => a + b, 0);
  const rowFloor = [c.frontFloor];
  for (const s of scale.slice(0, -1)) rowFloor.push(rowFloor.at(-1) - ((c.frontFloor - c.backFloor) * s) / total);
  const width = (c.span.other[1] - c.span.other[0]) * SCENE_W;
  const fits = scale.slice(1).map((s) => (width * c.seatShare) / (WORKSTATION_UNITS * PERSON_UNIT * s));
  const capacity = [FRONT_DESKS, ...shareOut(MAX_DESKS - FRONT_DESKS, fits)];
  const fog = scale.map((_, r) => (c.haze * r) / (c.rows - 1));
  return { rowFloor: rowFloor.map(Math.round), scale, capacity, fog, span: c.span, seatShare: c.seatShare };
}

// Splits n desks in proportion to `weights` (largest remainder, so the sum is exactly n).
function shareOut(n, weights) {
  const sum = weights.reduce((a, b) => a + b, 0), raw = weights.map((w) => (n * w) / sum);
  const out = raw.map(Math.floor);
  const order = raw.map((v, k) => [v - Math.floor(v), k]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; out.reduce((a, b) => a + b, 0) < n; k++) out[order[k][1]] += 1;
  return out;
}

// Room objects in scene pixels (1440 x 840 below the top bar).
// Depth planes: front plane (door and coffee machine at front-row scale, at the sides), desk rows,
// back plane (meeting room at back-row scale against the wall); the wall screens stay large.
const DEPTH_ROOM = {
  wallBottom: 440,                          // the floor starts right behind the back row
  door: { x: 4, y: 562, w: 76, h: 206 },     // front left, first-row scale
  doorPoint: { x: 47, y: 772 },
  coffee: { x: 1282, floor: 768, unit: 0.69 },   // front right, first-row scale
  coffeeSpot: { x: 1322, y: 772 },
  coffeeAisleX: 1336,                       // walkers come down here (rows end at 1238, Pan Marek at 1392)
  glass: { x: 1112, y: 292, w: 236, h: 148 },    // meeting room at back-row scale
  meetingUnit: 0.36,
  server: { x: 1372, y: 328, w: 44, h: 112 },
  screenTop: 345,                           // the camera keeps the free row below the wall screens
};

const BASE = rowsFrom({ rows: 6, frontScale: 1.15, lastShare: 0.6, frontFloor: 768, backFloor: 452,
  seatShare: 2.5, span: { front: [0.08, 0.84], other: [0.1, 0.86] }, haze: 0.5 });

export const DEFAULT_FRAMING = { ...BASE, room: DEPTH_ROOM };

export const FRAMING = DEFAULT_FRAMING;
