// The office floor on one canvas: rows of desks, seated people, walkers and Pan Marek, drawn back to
// front by floor depth through the camera, then the envelopes and floats in screen pixels.
// Every drawn person is written to a draw log (screen box, depth, order) for the animation checks.
import { ROWS, stationAt, unitAtDepth, fogAtDepth, seatOf } from "./layout.js";
import { SCENE } from "./geometry.js";
import { drawSprite } from "./sprites.js";
import { BOSS } from "../looks.js";
import { lookOf } from "../looks.js";
import { FRONT_DESKS } from "../framing.js";
import { DESK } from "../furniture.js";
import { KIT } from "../ui/kit.js";
import { roundRect } from "./envelopes.js";

const FREE_ALPHA = 0.42;            // empty desks in a used row
const FREE_ROW_ALPHA = 0.5;         // the whole free row
const BODY = { left: -40, right: 46, seated: 205, standing: 255 };   // body box in character units
const BOSS_ID = "boss";

// desk id of every (row, column)
const DESK_AT = ROWS.map((row) => Array(row.capacity).fill(-1));
for (let i = 0; i < ROWS.reduce((s, r) => s + r.capacity, 0); i++) { const s = seatOf(i); DESK_AT[s.row][s.col] = i; }

export class FloorCanvas {
  constructor(canvas, sprites) { this.canvas = canvas; this.g = canvas.getContext("2d"); this.sprites = sprites; this.log = []; }

  /** Canvas size in device pixels for a scene drawn at `scale` CSS px per scene px. */
  resize(scale, dpr) {
    Object.assign(this, { scale, dpr });
    this.canvas.width = Math.round(SCENE.w * scale * dpr); this.canvas.height = Math.round(SCENE.h * scale * dpr);
  }

  draw({ camera, life, desks, visible, firstFree = visible - 1, envelopes }) {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.setTransform(this.scale * this.dpr, 0, 0, this.scale * this.dpr, 0, 0);
    this.log = []; this.camera = camera; this.t = life.t;
    g.save(); camera.apply(g);
    this.firstFree = firstFree;
    for (const item of this.#items(life, visible)) item.draw();
    g.restore();
    envelopes.draw(g, camera);
  }

  // Rows and walkers sorted by depth; at equal depth a walker goes first (behind the desks).
  #items(life, visible) {
    const people = new Map(life.list.filter((p) => !p.retired).map((p) => [p.id, p]));
    const rows = ROWS.slice(0, visible).map((row) => ({ depth: row.floor, rank: 1, draw: () => this.#row(row, people, visible) }));
    const walkers = life.list.filter((p) => p.state === "walking" && p.alpha > 0)
      .map((p) => ({ depth: p.y, rank: 0, draw: () => this.#walker(p) }));
    const boss = { depth: life.boss.y, rank: 0, draw: () => this.#boss(life.boss) };
    return [...rows, ...walkers, boss].sort((a, b) => a.depth - b.depth || a.rank - b.rank);
  }

  #row(row, people, visible) {
    const g = this.g, used = DESK_AT[row.r].some((id) => people.has(id));
    const rowAlpha = !used && row.r >= this.firstFree ? FREE_ROW_ALPHA : 1;
    for (let col = 0; col < row.capacity; col++) this.#station(row, col, people.get(DESK_AT[row.r][col]), rowAlpha);
    // No "Free desks" note: it overlapped people in the rows . The empty growth row speaks for itself.
    if (row.r === 0) this.#namePlates(people);
    g.globalAlpha = 1;
  }

  #station(row, col, p, rowAlpha) {
    const s = stationAt(row.r, col), seated = p && p.state !== "walking", onBreak = p?.path === "coffee";
    const alpha = rowAlpha * (seated || onBreak ? 1 : FREE_ALPHA), sp = this.sprites;
    this.#sprite(sp.furniture("chair", row.fog), s.px, s.floor, s.unit, { alpha });
    if (seated) this.#person(p, p.look ?? lookOf(p.id), s.px, s.floor, s.unit, row.fog, { alpha: rowAlpha * p.alpha, seated: true });
    const desk = !p ? "deskFree" : p.mug ? "deskMug" : "desk";
    this.#sprite(sp.furniture(desk, row.fog), s.px, s.floor, s.unit, { alpha });
    if (seated && p.view?.startsWith("type")) this.#screenWork(p, s, alpha);
  }

  // While someone types, their monitor shows the case they are working on: lines that grow and a
  // red or green mark that blinks (screen box from furniture.drawDesk: x 96, y top-74, 62 x 48 units).
  #screenWork(p, s, alpha) {
    const g = this.g, u = s.unit, x0 = s.px + 98 * u, y0 = s.floor + (DESK.top - 72) * u, w = 58 * u, t = this.t;
    g.save(); g.globalAlpha = alpha;
    g.fillStyle = "#20304A"; g.fillRect(x0, y0, w, 44 * u);
    for (let k = 0; k < 6; k++) {
      const len = 0.25 + 0.7 * Math.abs(Math.sin(t * (1.3 + k * 0.37) + p.id * 1.7 + k));
      g.fillStyle = k === 2 ? "#E9A23B" : "#7FD1B9";
      g.fillRect(x0 + 4 * u, y0 + (5 + k * 6.5) * u, (w - 8 * u) * len, 2.6 * u);
    }
    if (Math.floor(t * 2 + p.id) % 3 === 0) { g.fillStyle = p.id % 2 ? "#F2836B" : "#7FD1B9"; g.fillRect(x0 + w - 12 * u, y0 + 3 * u, 8 * u, 8 * u); }
    g.restore();
  }

  #walker(p) {
    const unit = unitAtDepth(p.y);
    this.#person(p, p.look ?? lookOf(p.id), p.x, p.y, unit, fogAtDepth(p.y), { alpha: p.alpha, flip: p.flip, seated: false });
  }

  #boss(b) {
    const unit = unitAtDepth(b.y);
    this.#person({ id: BOSS_ID, view: b.view }, BOSS, b.x, b.y, unit, fogAtDepth(b.y), { flip: b.flip, lift: b.lift * unit, seated: false });
    this.#label(b.x, b.y - 262 * unit, "Pan Marek", KIT.graphite, KIT.cream);
  }

  #person(p, look, x, floor, unit, fog, opts) {
    this.#sprite(this.sprites.person(look, p.view, fog), x, floor, unit, opts);
    this.#logPerson(p, x, floor, unit, opts);
  }

  #sprite(canvas, x, floor, unit, opts) { if (canvas) drawSprite(this.g, canvas, x, floor, unit, opts); }

  #logPerson(p, x, floor, unit, { flip, seated, alpha = 1 }) {
    const l = flip ? -BODY.right : BODY.left, r = flip ? -BODY.left : BODY.right;
    const a = this.camera.toScreen({ x: x + l * unit, y: floor - (seated ? BODY.seated : BODY.standing) * unit });
    const b = this.camera.toScreen({ x: x + r * unit, y: floor });
    this.log.push({ id: p.id, view: p.view, state: p.state ?? "boss", x0: a.x, x1: b.x, y0: a.y, y1: b.y, depth: b.y, alpha, order: this.log.length });
  }

  #namePlates(people) {
    for (let id = 0; id < FRONT_DESKS; id++) {
      const p = people.get(id);
      if (!p || p.state === "walking" || !p.name) continue;
      const s = stationAt(0, seatOf(id).col);
      this.#label(s.px + 110 * s.unit, s.floor - 70 * s.unit, p.name, KIT.cream, KIT.ink, KIT.brown);
    }
  }

  #rowNote(row) {
    const g = this.g;
    g.globalAlpha = 0.8; g.fillStyle = KIT.brown; g.font = "700 11px Nunito, sans-serif"; g.textAlign = "left";
    g.fillText("Free desks: room for the next hires", SCENE.w * row.span[0], row.floor - 26);
    g.globalAlpha = 1;
  }

  #label(cx, y, text, fill, ink, stroke) {
    const g = this.g;
    g.font = "800 11px Nunito, sans-serif"; g.textAlign = "center";
    const w = g.measureText(text).width + 14;
    g.fillStyle = fill; roundRect(g, cx - w / 2, y - 12, w, 18, 9); g.fill();
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); }
    g.fillStyle = ink; g.fillText(text, cx, y + 1.5);
  }

  /** Desk id under a screen point (scene pixels), or -1. */
  deskAt(point, desks) {
    const w = this.camera.toWorld(point);
    for (let id = 0; id < desks; id++) {
      const s = stationAt(seatOf(id).row, seatOf(id).col);
      if (w.x >= s.px - 50 * s.unit && w.x <= s.px + 190 * s.unit && w.y <= s.floor && w.y >= s.floor - 240 * s.unit) return id;
    }
    return -1;
  }
}
