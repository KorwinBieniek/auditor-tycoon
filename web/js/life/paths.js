// Walking paths of hires and leavers, in scene pixels. Aisle points are fixed on the SCREEN (they
// stay between the rows whatever the zoom), lanes and seats are on the FLOOR (they zoom with the
// rows), so a path is rebuilt from the camera every frame and stays continuous while it zooms.
import { AISLE, DOOR_POINT, COFFEE_SPOT } from "../render/geometry.js";
import { stationOf, laneY, unitAtDepth, ROWS } from "../render/layout.js";

// Walking speed in floor pixels per second at the front row; slower further back (perspective).
export const WALK = { speed: 230, standUp: 0.3, doorGap: 0.6, fade: 0.35 };

/** Floor points of the way in (door -> aisle -> lane behind the row -> seat) for desk id. */
export function pathIn(id, camera) { return wayPoints(id, camera, "in", AISLE.inX); }

/** Floor points of the way out (seat -> lane -> aisle -> door). */
export function pathOut(id, camera) { return wayPoints(id, camera, "out", AISLE.outX).reverse(); }

/** Floor points of a coffee trip: seat -> lane -> coffee aisle -> coffee machine (walked back in reverse). */
export function pathCoffee(id, camera) {
  const s = stationOf(id), lane = laneY(s.row, "out");
  const aisle = camera.toWorld({ x: AISLE.coffeeX, y: COFFEE_SPOT.y });
  return [{ x: s.px, y: s.floor }, { x: s.px, y: lane }, { x: aisle.x, y: lane }, aisle, camera.toWorld(COFFEE_SPOT)];
}

function wayPoints(id, camera, kind, aisleScreenX) {
  const s = stationOf(id), lane = laneY(s.row, kind);
  const door = camera.toWorld({ x: aisleScreenX, y: DOOR_POINT.y });
  const doorIn = camera.toWorld(DOOR_POINT);
  return [{ x: doorIn.x, y: doorIn.y }, door, { x: door.x, y: lane }, { x: s.px, y: lane }, { x: s.px, y: s.floor }];
}

/** Speed at floor depth y. */
export const speedAt = (y) => WALK.speed * Math.sqrt(unitAtDepth(y) / ROWS[0].unit);

/** Length of a polyline. */
export function lengthOf(points) {
  let L = 0;
  for (let k = 1; k < points.length; k++) L += Math.hypot(points[k].x - points[k - 1].x, points[k].y - points[k - 1].y);
  return L;
}

/** Point at distance s along the polyline, with the direction of travel (dx sign). */
export function pointAt(points, s) {
  let left = Math.max(0, s);
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1], b = points[k], len = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= len || k === points.length - 1) {
      const u = len ? Math.min(1, left / len) : 1;
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, dx: b.x - a.x };
    }
    left -= len;
  }
  return { ...points[0], dx: 0 };
}

/** Walking time along the whole polyline (numeric, speed depends on depth). */
export function travelTime(points) {
  const L = lengthOf(points), step = 4;
  let t = 0;
  for (let s = 0; s < L; s += step) t += Math.min(step, L - s) / speedAt(pointAt(points, s).y);
  return t;
}

/** Earliest door time >= earliest that keeps `gap` seconds from every booked door time. */
export function doorSlot(booked, earliest, gap) {
  let t = earliest;
  for (const b of [...booked].sort((p, q) => p - q)) if (Math.abs(b - t) < gap) t = b + gap;
  return t;
}
