// The whole office picture: the wall (SVG decor, live screens, scoreboard, clock) and the floor
// (one canvas: rows, people, Pan Marek, envelopes). Animation only; it reads the simulation and
// never changes it.
import { SCENE, WALL, COFFEE, COFFEE_SPOT } from "./geometry.js";
import { drawRoom, drawCityWindow, drawSign, drawClock, drawMeetingRoom, drawServerRack, drawDoorAndCoffee } from "./decor.js";
import { ScoreScreen } from "./scoreScreen.js";
import { ProfitScreen } from "./profitScreen.js";
import { Scoreboard } from "./scoreboard.js";
import { HoodScreen } from "./hoodScreen.js";
import { Camera, visibleRows, rowsBelowWall } from "./camera.js";
import { FloorCanvas } from "./floor.js";
import { SpriteCache, SEATED_VIEWS } from "./sprites.js";
import { Envelopes } from "./envelopes.js";
import { SmsIcons } from "./smsIcons.js";
import { hexToRgb, unitAtDepth, seatOf, stationAt } from "./layout.js";
import { setCrew } from "../config.js";
import { OfficeLife } from "../life/officeLife.js";
import { lookOf, BOSS } from "../looks.js";
import { MAX_DESKS } from "../config.js";
import { FRONT_DESKS } from "../framing.js";

const HIT = { half: 50, height: 270, coffeeHalf: 30, coffeeHeight: 150 };   // person box in character units; coffee machine in px
const inBox = (x, y, bx, by, w, h) => x >= bx && x <= bx + w && y >= by && y <= by + h;
const RACK_LABEL_PX = 30;   // the 'Card payments feed' label above the rack (decor.drawServerRack)
// Clickable things on the wall (office pixels): reactions are decoration only.
const OBJECTS = {
  server: { ...WALL.server, y: WALL.server.y - RACK_LABEL_PX, h: WALL.server.h + RACK_LABEL_PX },
  door: WALL.door,
  plant: { x: WALL.glass.x + WALL.glass.w * 0.82, y: WALL.glass.y + WALL.glass.h * 0.35, w: WALL.glass.w * 0.18, h: WALL.glass.h * 0.65 },
  meeting: WALL.glass,
  window: WALL.window,
  clock: { x: WALL.clock.cx - WALL.clock.r, y: WALL.clock.cy - WALL.clock.r, w: 2 * WALL.clock.r, h: 2 * WALL.clock.r },
};
import { KIT } from "../ui/kit.js";

const WARM_VIEWS = [...SEATED_VIEWS, "stand", "walk1", "walk2"];

export class OfficeView {
  constructor({ wall, canvas, source, seed, pixelRatio }) {
    this.svg = wall;
    wall.setAttribute("viewBox", `0 0 ${SCENE.w} ${SCENE.h}`);
    this.#decor();
    this.score = new ScoreScreen(wall, source);
    this.profit = new ProfitScreen(wall);
    this.board = new Scoreboard(wall);
    this.hood = new HoodScreen(wall, this.score.box);
    this.sms = new SmsIcons(wall);
    this.camera = new Camera();
    this.life = new OfficeLife({ seed });
    this.envelopes = new Envelopes();
    // every crew can sit in the front row, so every look is drawn sharp
    this.sprites = new SpriteCache({ dpr: pixelRatio, haze: hexToRgb(KIT.wall), sharp: { has: () => true } });
    this.sprites.warm([...[...Array(FRONT_DESKS).keys()].map((id) => lookOf(id)), BOSS], WARM_VIEWS);
    this.floor = new FloorCanvas(canvas, this.sprites);
    this.desks = 0;
  }

  #decor() {
    const svg = this.svg;
    drawRoom(svg); this.sky = drawCityWindow(svg); drawDoorAndCoffee(svg); drawMeetingRoom(svg); drawServerRack(svg); drawSign(svg);
    this.clock = drawClock(svg, 0);
  }

  resize(scale, dpr) { this.floor.resize(scale, dpr); }

  /** Desks wanted on the floor; instant = no walking (fast mode, start). */
  setDesks(desks, instant = false) {
    this.desks = Math.min(desks, MAX_DESKS);
    this.camera.frame(this.desks, instant);
    this.life.syncCount(this.desks, this.camera, instant);
  }

  /** One animation frame (real seconds). busy(id): the team of desk id is checking. */
  update(dt, { busy, now }) {
    this.camera.update(dt);
    this.envelopes.update(dt);
    this.sms.update(dt);
    this.life.update(dt, { camera: this.camera, busy, waiting: (id) => this.envelopes.waiting(id) });
    this.score.update(dt); this.profit.update(dt); this.hood.update(dt);
    this.clock.set(now); this.sky.set(now);
  }

  draw() {
    const highest = this.life.list.reduce((m, p) => Math.max(m, p.id + 1), 0);
    const visible = visibleRows(Math.max(this.desks, highest));
    // every free row that fits below the wall screens is drawn too, so no empty floor shows behind the team
    const drawn = Math.max(visible, rowsBelowWall(this.camera));
    this.floor.draw({ camera: this.camera, life: this.life, desks: this.desks, visible: drawn, firstFree: visible - 1, envelopes: this.envelopes });
  }

  /** What is under office point (x, y) for a click: {kind, x, top, ...} or null. Decoration only. */
  hit(x, y) {
    const z = this.camera.zoom, b = this.life.boss, s = this.camera.toScreen({ x: b.x, y: b.y }), u = unitAtDepth(b.y) * z;
    if (inBox(x, y, s.x - HIT.half * u, s.y - HIT.height * u, 2 * HIT.half * u, HIT.height * u)) return { kind: "boss", x: s.x, top: s.y - HIT.height * u };
    // seated auditors in any row; the front rows are drawn on top, so they win
    const seated = this.life.list.filter((p) => !p.retired && p.state === "seated").map((p) => ({ p, seat: seatOf(p.id) }))
      .sort((a, b2) => a.seat.row - b2.seat.row);
    for (const { p, seat } of seated) {
      const st = stationAt(seat.row, seat.col), sc = this.camera.toScreen({ x: st.px, y: st.floor }), su = st.unit * z;
      if (inBox(x, y, sc.x - HIT.half * su, sc.y - HIT.height * su, 2 * HIT.half * su, HIT.height * su)) return { kind: "auditor", id: p.id, name: p.name, x: sc.x, top: sc.y - HIT.height * su };
    }
    if (inBox(x, y, COFFEE.x - HIT.coffeeHalf, COFFEE.floor - HIT.coffeeHeight, 2 * HIT.coffeeHalf, HIT.coffeeHeight)) return { kind: "coffee", x: COFFEE.x, top: COFFEE.floor - HIT.coffeeHeight };
    for (const [kind, box] of Object.entries(OBJECTS)) {
      if (inBox(x, y, box.x, box.y, box.w, box.h)) return { kind, x: box.x + box.w / 2, top: box.y };
    }
    return null;
  }

  /** Small reactions of the room to a click (decoration only). */
  poke(kind) {
    const cls = { plant: ".m-plant", server: ".m-rack" }[kind];
    if (cls) { const el = this.svg.querySelector(cls); el?.classList.remove("poke"); void el?.getBBox(); el?.classList.add("poke"); }
    if (kind === "window") this.sky.flicker();
  }

  /** Pan Marek walks over to desk id (to stand just right of it) and comes back. Decoration only. */
  bossVisit(id) {
    const seat = seatOf(id), st = stationAt(seat.row, seat.col);
    this.life.boss.visit(this.life.t, this.camera.toScreen({ x: st.px + 215 * st.unit, y: st.floor }).x);
  }

  /** First name of whoever sits at desk id now (or null). */
  nameAt(id) { const p = this.life.list.find((q) => q.id === id && !q.retired); return p?.name ?? null; }

  /** A new shift brings a new crew: the old one walks out, the new one walks in (decoration only). */
  newCrew(k) {
    setCrew(k);
    this.life.retire(this.camera);
    // the new crew is already at the desks when the shift starts (no empty desks while the numbers run)
    this.life.syncCount(this.desks, this.camera, true);
  }

  /** End of a shift: the crew goes home while the summary is on screen. */
  crewOut() { this.life.retire(this.camera); }

  /** Click on the coffee machine: someone nearby goes for coffee (see OfficeLife.coffeeNow). */
  coffeeNow(busy) { return this.life.coffeeNow(busy, (id) => this.envelopes.waiting(id), COFFEE_SPOT); }

  locate(target) {
    if (target === "envelope") { const e = this.envelopes.latest(); return e && { x: e.x - 16, y: e.y - 14, w: 32, h: 28 }; }
    if (target === "desk0") {
      const st = stationAt(0, seatOf(0).col), a = this.camera.toScreen({ x: st.px - 50 * st.unit, y: st.floor - 240 * st.unit }), b = this.camera.toScreen({ x: st.px + 190 * st.unit, y: st.floor });
      return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
    }
    if (target === "boss") {
      const bb = this.life.boss, s = this.camera.toScreen({ x: bb.x, y: bb.y }), u = unitAtDepth(bb.y) * this.camera.zoom;
      return { x: s.x - HIT.half * u, y: s.y - HIT.height * u, w: 2 * HIT.half * u, h: HIT.height * u };
    }
    if (target === "server") return { ...WALL.server, y: WALL.server.y - RACK_LABEL_PX, h: WALL.server.h + RACK_LABEL_PX }; // incl. its label
    const box = { scoreboard: WALL.scoreboard, profit: WALL.profitScreen, score: WALL.scoreScreen }[target];
    return box ? { x: box.x, y: box.y, w: box.w, h: box.h } : null;
  }
}
