// Camera over the floor: a zoom around the bottom centre of the scene. The wall is not zoomed.
// It frames the occupied rows plus one free row (room for the next hires); the zoom is limited
// so the top of that row stays below the wall and every OCCUPIED row stays between the two aisles
// (the free row may be cut at the sides). With the approved row widths this only zooms in while
// the front row is the only occupied row.
import { CAMERA as C } from "./geometry.js";
import { ROWS, WORKSTATION, occupiedRows } from "./layout.js";
import { SCENE } from "./geometry.js";

/** Rows drawn for a number of desks: occupied rows plus one free row (at most all rows). */
export function visibleRows(desks) { return Math.min(ROWS.length, occupiedRows(desks) + 1); }

/** Rows whose top (monitor height) stays below the wall screens at the current zoom. */
export function rowsBelowWall(camera) {
  let n = 0;
  while (n < ROWS.length && camera.toScreen({ x: C.anchorX, y: ROWS[n].floor - WORKSTATION.height * ROWS[n].unit }).y >= C.screenTop) n++;
  return n;
}

/** Target zoom for `desks` desks. */
export function targetZoom(desks) {
  const v = visibleRows(desks), top = ROWS[v - 1].floor - WORKSTATION.height * ROWS[v - 1].unit;
  const byHeight = (C.anchorY - C.screenTop) / (C.anchorY - top);
  const rows = ROWS.slice(0, Math.max(1, v - 1)); // the free row may be cut at the sides
  const left = Math.min(...rows.map((r) => r.span[0] * SCENE.w)), right = Math.max(...rows.map((r) => r.span[1] * SCENE.w));
  const byWidth = Math.min((C.anchorX - C.minX) / (C.anchorX - left), (C.maxX - C.anchorX) / (right - C.anchorX));
  const z = Math.min(C.maxZoom, byHeight, byWidth);
  return z < C.snap ? 1 : z; // no blur from a zoom that would not show
}

export class Camera {
  constructor() { this.zoom = 1; this.target = 1; }

  /** Sets the target for `desks` desks; instant = jump there (start, fast mode). */
  frame(desks, instant = false) {
    this.target = targetZoom(desks);
    if (instant) this.zoom = this.target;
  }

  /** Smooth approach to the target zoom. */
  update(dt) { this.zoom += (this.target - this.zoom) * (1 - Math.exp(-C.rate * dt)); }

  toScreen(p) { return { x: C.anchorX + (p.x - C.anchorX) * this.zoom, y: C.anchorY + (p.y - C.anchorY) * this.zoom }; }
  toWorld(p) { return { x: C.anchorX + (p.x - C.anchorX) / this.zoom, y: C.anchorY + (p.y - C.anchorY) / this.zoom }; }

  /** Canvas transform (scene pixels -> screen pixels) for a 2D context already scaled to the scene. */
  apply(g) { g.translate(C.anchorX, C.anchorY); g.scale(this.zoom, this.zoom); g.translate(-C.anchorX, -C.anchorY); }
}
