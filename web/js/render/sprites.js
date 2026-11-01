// Bitmaps of people and furniture. Every (look, view) is drawn ONCE with the SVG character
// system, rasterised to a canvas and reused for every frame. Hazed copies (aerial perspective) are
// made once per haze step. Front-row looks and Pan Marek get a sharper bitmap.
import { el } from "../svg.js";
import { createCharacter } from "../characters.js";
import { drawChair, drawDesk } from "../furniture.js";
import { addBadge } from "./badge.js";
import { KIT } from "../ui/kit.js";
import { ROWS } from "./layout.js";
import { CAMERA } from "./geometry.js";

// Common frame of every sprite in character units (the figure origin is at 0, floor at 0).
export const SPRITE_BOX = { x: -60, y: -280, w: 260, h: 295 };
const FOG_STEP = 0.05;

// View name -> pose, animation time for the wanted frame, expression.
// Typing hands follow sin(15 t): t = 0.105 lifts the near hand, t = 0.314 the far hand.
const VIEWS = {
  sit: ["sit", 0], type1: ["typing", 0.105], type2: ["typing", 0.314], joy: ["joy", 0.36],
  look: ["look", 0], stretch: ["stretch", 0], phone: ["phone", 0],
  stand: ["standing", 0], walk1: ["walk1", 0], walk2: ["walk2", 0],
  grab: ["grab", 0, "panic"], nod: ["standing", 0, "happy"],
};
export const SEATED_VIEWS = ["sit", "type1", "type2", "look", "stretch", "phone", "joy"];

function svgRoot() {
  const b = SPRITE_BOX;
  return el("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: `${b.x} ${b.y} ${b.w} ${b.h}` });
}

function figureSvg(look, view) {
  const [pose, t, expression] = VIEWS[view];
  const svg = svgRoot(), c = createCharacter(look, pose, { phase: 0, expression });
  c.update(t);
  addBadge(c, look);
  svg.append(c.group);
  return svg;
}

const chairSvg = () => { const svg = svgRoot(); drawChair(svg); return svg; };
const deskSvg = (opts) => () => { const svg = svgRoot(); drawDesk(svg, opts); return svg; };
const FURNITURE = {
  chair: chairSvg, desk: deskSvg({}), deskMug: deskSvg({ mug: true, mugColor: KIT.teal }), deskFree: deskSvg({ blankScreen: true }),
};

/** Rasterises an SVG element into a canvas of the given pixel scale (async: image decode). */
async function rasterise(svg, pxPerUnit) {
  const text = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
  await img.decode();
  const c = makeCanvas(Math.ceil(SPRITE_BOX.w * pxPerUnit), Math.ceil(SPRITE_BOX.h * pxPerUnit));
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c;
}

export function makeCanvas(w, h) {
  const c = document.createElement("canvas"); c.width = Math.max(1, w); c.height = Math.max(1, h); return c;
}

// Scaled copy with haze: the sprite keeps its shape, its colours move towards the haze colour.
function hazed(base, scale, haze, fog) {
  const c = makeCanvas(Math.ceil(base.width * scale), Math.ceil(base.height * scale));
  const g = c.getContext("2d");
  g.drawImage(base, 0, 0, c.width, c.height);
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = `rgba(${haze.join(",")},${fog})`;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

// Largest unit at which a haze level is drawn (row units fall as the haze grows).
function unitForFog(fog) {
  const row = ROWS.find((r) => r.fog >= fog - 1e-9) ?? ROWS[ROWS.length - 1];
  const prev = ROWS[Math.max(0, row.r - 1)];
  return row.r === 0 ? row.unit : prev.unit;
}

export class SpriteCache {
  /** @param dpr device pixels per scene pixel; @param haze [r,g,b]; @param sharp ids of looks drawn large */
  constructor({ dpr, haze, sharp, onReady }) {
    Object.assign(this, { dpr, haze, sharp, onReady });
    this.base = new Map(); this.copies = new Map(); this.pending = new Set();
  }

  /** Sprite of a person (look, view) at a haze level, or null while it is being drawn. */
  person(look, view, fog) { return this.#get(`${look.id}|${view}`, fog, () => figureSvg(look, view), this.sharp.has(look.id)); }
  furniture(name, fog) { const sharp = fog === 0; return this.#get(sharp ? `${name}|front` : name, fog, FURNITURE[name], sharp); }

  /** Starts drawing sprites ahead of time. */
  warm(looks, views) { for (const l of looks) for (const v of views) this.person(l, v, 0.2); }

  /** True when nothing is still being drawn (for screenshots and tests). */
  get idle() { return this.pending.size === 0; }

  #get(key, fog, build, sharp) {
    const step = Math.round(fog / FOG_STEP), copyKey = `${key}|${step}`;
    const ready = this.copies.get(copyKey);
    if (ready) return ready;
    const base = this.base.get(key);
    if (!base) { this.#request(key, build, sharp); return null; }
    const want = unitForFog(step * FOG_STEP) * CAMERA.maxZoom * this.dpr;
    const canvas = step === 0 ? base.canvas : hazed(base.canvas, Math.min(1, want / base.px), this.haze, step * FOG_STEP);
    this.copies.set(copyKey, canvas);
    return canvas;
  }

  #request(key, build, sharp) {
    if (this.pending.has(key)) return;
    this.pending.add(key);
    const px = (sharp ? ROWS[0].unit : ROWS[1].unit) * CAMERA.maxZoom * this.dpr;
    rasterise(build(), px).then((canvas) => { this.base.set(key, { canvas, px }); this.pending.delete(key); this.onReady?.(); });
  }
}

/** Draws a sprite with its origin at (x, floor) in scene pixels; flip = facing left. */
export function drawSprite(g, canvas, x, floor, unit, { flip = false, alpha = 1, lift = 0 } = {}) {
  const b = SPRITE_BOX;
  g.globalAlpha = alpha;
  if (flip) { g.save(); g.translate(x, 0); g.scale(-1, 1); x = 0; }
  g.drawImage(canvas, x + b.x * unit, floor - lift + b.y * unit, b.w * unit, b.h * unit);
  if (flip) g.restore();
  g.globalAlpha = 1;
}
