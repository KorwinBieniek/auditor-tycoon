// Office life: what every person does, for animation only. Its own random generator, never used by
// the simulation, so it cannot change any result. Seated people type fast while their team checks an
// alert; between alerts they work slowly at the monitor, rest, and now and then one of them walks to
// the coffee machine and back (one at a time, only when nobody else is walking). Hires walk in from the door along the
// aisle and the lane behind their row; leavers walk out the same way on separate lanes. Door times
// keep a gap, so walkers on the same path never catch up with each other.
import { createPrng } from "./prng.js";
import { pathIn, pathOut, pathCoffee, pointAt, lengthOf, speedAt, travelTime, doorSlot, WALK } from "./paths.js";
import { stationOf, unitAtDepth } from "../render/layout.js";
import { BossLife } from "./boss.js";
import { lookOf, nameOf } from "../looks.js";

const IDLE = { work: 10, look: 2.5, sit: 1.5, stretch: 0.4, phone: 0.4 };   // between alerts they mostly watch the monitor; a mug only after a real coffee trip
const WORK_PERIOD = 0.42;    // slow typing between alerts (s per frame change)
const IDLE_SECONDS = [2, 6];
const TYPE_PERIOD = 0.16;    // typing frame change (s)
const JOY_SECONDS = 1.6;
const MAX_WALKERS = 12;      // more hires at once fade in at their desks
const STEP_UNITS = 34;       // walking frame change, in character units travelled
const COFFEE = { every: [25, 45], seconds: 6, mugSeconds: 6, onDesk: 50 };  // gap between trips, drinking at the machine, mug in hand after, mug left on the desk

export class OfficeLife {
  constructor({ seed = 7 } = {}) {
    this.rng = createPrng(seed);
    this.people = new Map();   // desk id -> person
    this.t = 0;
    this.doorTimes = [];
    this.boss = new BossLife(createPrng(seed + 1));
    this.coffeeRng = createPrng(seed + 2);   // own stream: coffee trips do not shift other idle picks
    this.nextCoffee = this.coffeeRng.range(...COFFEE.every);
  }

  /** People on the floor, seated or walking (for drawing and the checks). */
  get list() { return [...this.people.values()]; }

  /** Desks now wanted: hires walk in, leavers walk out (instant = no walking). */
  syncCount(desks, camera, instant = false) {
    for (const p of this.list) if (!p.retired && p.id >= desks && p.goal !== "out") this.#send(p, "out", camera, instant);
    for (let id = 0; id < desks; id++) {
      const p = this.people.get(id);
      if (!p) this.#hire(id, camera, instant);
      else if (p.goal === "out") this.#send(p, "in", camera, instant);
    }
  }

  /** End of a shift: the whole crew goes home (walking out, the rest fading). Their desks are free at once,
   * so the next crew can walk in while they leave. Decoration only. */
  retire(camera) {
    for (const p of this.list) {
      if (p.retired) continue;
      this.people.delete(p.key ?? p.id);
      p.retired = true; p.key = `r${p.id}-${this.t.toFixed(3)}`;
      this.people.set(p.key, p);
      this.#send(p, "out", camera, false);
    }
  }

  #hire(id, camera, instant) {
    const p = { id, key: id, look: lookOf(id), name: nameOf(id), goal: "in", state: "walking", path: "in", dir: 1, s: 0, alpha: 0, view: "stand", flip: false,
      activity: "sit", activityUntil: 0, joyUntil: -1, phase: this.rng.next() };
    this.people.set(id, p);
    if (instant || this.#walkers() >= MAX_WALKERS) return this.#fade(p, "in");
    p.startAt = doorSlot(this.doorTimes, this.t, WALK.doorGap);
    this.doorTimes.push(p.startAt);
  }

  // Turn a person towards the seat ("in") or the door ("out").
  #send(p, goal, camera, instant) {
    p.goal = goal;
    if (p.path === "coffee") { p.leaving = goal === "out"; return; }   // fades where it stands, or comes back
    if (instant) return this.#fade(p, goal);
    if (p.state === "walking") return this.#turn(p);
    if (p.state === "fading") { p.fadeDir = goal === "in" ? 1 : -1; return; }
    if (this.#walkers() >= MAX_WALKERS) return this.#fade(p, goal);
    const pts = pathOut(p.id, camera), travel = WALK.standUp + travelTime(pts);
    const door = doorSlot(this.doorTimes, this.t + travel, WALK.doorGap);
    this.doorTimes.push(door);
    Object.assign(p, { state: "walking", path: "out", dir: 1, s: 0, startAt: door - travel + WALK.standUp, view: "stand" });
  }

  // A walker who has not set off yet just stays (or never comes); one on the way turns round.
  #turn(p) {
    if (this.t < p.startAt && p.path === "in") { this.people.delete(p.key ?? p.id); return; }
    if (this.t < p.startAt) { Object.assign(p, { state: "seated", activityUntil: this.t }); return; }
    p.dir = -p.dir;
  }

  #fade(p, goal) {
    Object.assign(p, { state: "fading", fadeDir: goal === "in" ? 1 : -1, alpha: goal === "in" ? 0 : (p.alpha ?? 1) });
  }

  #walkers() { return this.list.filter((p) => p.state === "walking").length; }

  /** Reaction to a simulation event (desks: the desks of the team, already mapped). */
  react(e, desks = []) {
    if (e.type === "caught") {
      // Only the auditor who caught it cheers, plus at most two working neighbours (closest desk ids), not the whole room.
      if (desks.length) {
        const who = desks[0];
        const near = desks.slice(1).sort((a, b) => Math.abs(a - who) - Math.abs(b - who) || a - b).slice(0, 2);
        for (const id of [who, ...near]) this.#joy(id);
      }
      this.boss.nod(this.t);
    }
    if (e.type === "missed" && e.big) this.boss.alarm(this.t);
    else if (e.type === "missed" && e.reason === "not flagged") this.boss.grab(this.t);
  }

  #joy(id) { const p = this.people.get(id); if (p) p.joyUntil = this.t + JOY_SECONDS; }

  /**
   * Advances the animation clock. busy(id): the desk's team is checking; waiting(id): its envelope
   * is still on the way.
   */
  update(dt, { camera, busy, waiting }) {
    this.t += dt;
    for (const p of this.list) {
      // a coffee trip is always finished: the team's result is computed by the simulation anyway, and a
      // trip cut short (no drink, no mug) looked like a bug

      if (p.state === "walking") this.#walk(p, dt, camera);
      else if (p.state === "fading") this.#fadeStep(p, dt);
      if (p.state === "seated" || p.state === "fading") this.#sit(p, busy(p.id) && !waiting(p.id));
      if (p.state !== "walking") placeAtSeat(p);
    }
    this.doorTimes = this.doorTimes.filter((d) => d > this.t - WALK.doorGap);
    this.#coffeeTrip(busy, waiting);
    this.boss.update(dt, this.t, camera);
  }

  #walk(p, dt, camera) {
    if (p.path === "coffee") return this.#coffeeWalk(p, dt, camera);
    if (this.t < p.startAt) return this.#wait(p);
    const pts = p.path === "in" ? pathIn(p.id, camera) : pathOut(p.id, camera), L = lengthOf(pts);
    const v = speedAt(pointAt(pts, p.s).y);
    p.s = Math.min(L, Math.max(0, p.s + p.dir * v * dt));
    const at = pointAt(pts, p.s);
    Object.assign(p, { x: at.x, y: at.y, flip: p.dir * at.dx < 0 });
    p.stride = (p.stride ?? 0) + v * dt / unitScale(at.y);
    p.view = Math.floor(p.stride / STEP_UNITS) % 2 ? "walk1" : "walk2";
    p.alpha = Math.min(1, (p.path === "in" ? p.s : L - p.s) / FADE_PX);
    this.#arrive(p, L);
  }

  // Before setting off: a hire is still outside; a leaver sits on, then stands up.
  #wait(p) {
    const seat = stationOf(p.id);
    if (p.path === "in") { p.alpha = 0; return; }
    Object.assign(p, { x: seat.px, y: seat.floor, alpha: 1 });
    if (this.t < p.startAt - WALK.standUp) this.#sit(p, false); else p.view = "stand";
  }

  // End of the path: sit down at the seat end, leave the office at the door end.
  #arrive(p, L) {
    const seatEnd = p.path === "in" ? p.s >= L : p.s <= 0, doorEnd = p.path === "in" ? p.s <= 0 : p.s >= L;
    if (seatEnd && this.#towardsSeat(p)) Object.assign(p, { state: "seated", alpha: 1, activityUntil: this.t });
    else if (doorEnd && !this.#towardsSeat(p)) this.people.delete(p.key ?? p.id);
  }

  #towardsSeat(p) { return (p.path === "in") === (p.dir > 0); }

  #fadeStep(p, dt) {
    p.alpha += (p.fadeDir * dt) / WALK.fade;
    // the direction decides the end: a hire at alpha 0 has only just started to appear
    if (p.fadeDir > 0 && p.alpha >= 1) Object.assign(p, { alpha: 1, state: "seated", activityUntil: this.t });
    if (p.fadeDir < 0 && p.alpha <= 0) this.people.delete(p.key ?? p.id);
  }

  // Every few seconds one idle person goes for coffee, only while nobody else is walking.
  #coffeeTrip(busy, waiting) {
    if (this.t < this.nextCoffee) return;
    this.nextCoffee = this.t + this.coffeeRng.range(...COFFEE.every);
    if (this.#walkers() > 0) return;
    // prefer someone whose team is free; with one big team (busy most of the time at x1) anyone
    // seated may take a short break: the team's check result is computed by the simulation anyway
    const seated = this.list.filter((p) => !p.retired && p.state === "seated" && p.goal === "in" && !waiting(p.id) && this.t >= p.joyUntil);
    const idle = seated.filter((p) => !busy(p.id)), pool = idle.length ? idle : seated;
    if (!pool.length) return;
    const p = pool[Math.floor(this.coffeeRng.next() * pool.length)];
    Object.assign(p, { state: "walking", path: "coffee", dir: 1, s: 0, view: "stand", mug: false, pauseUntil: -1, leaving: false,
      callable: idle.length > 0 });
  }

  /** Click on the coffee machine: the nearest seated person whose team is free goes for coffee (no random
   * draw, so the coffee stream is not shifted). Returns "walking" (someone is already up), "busy" or "ok". Decoration only. */
  coffeeNow(busy, waiting, spot) {
    if (this.#walkers() > 0) return "walking";
    const free = this.list.filter((p) => !p.retired && p.state === "seated" && p.goal === "in" && !waiting(p.id) && !busy(p.id) && this.t >= p.joyUntil);
    if (!free.length) return "busy";
    const dist = (p) => { const s = stationOf(p.id); return Math.hypot(s.px - spot.x, s.floor - spot.y); };
    const p = free.reduce((a, b) => (dist(b) < dist(a) ? b : a));
    Object.assign(p, { state: "walking", path: "coffee", dir: 1, s: 0, view: "stand", mug: false, pauseUntil: -1, leaving: false, callable: true });
    return "ok";
  }

  // Out to the machine, a short stop, back to the seat with a mug. A busy team calls them back early;
  // someone fired on the way fades out where they are.
  #coffeeWalk(p, dt, camera) {
    if (p.leaving) { p.alpha -= dt / WALK.fade; if (p.alpha <= 0) this.people.delete(p.key ?? p.id); return; }
    p.alpha = Math.min(1, p.alpha + dt / WALK.fade);
    const pts = pathCoffee(p.id, camera), L = lengthOf(pts);
    if (this.t < p.pauseUntil) return this.#atMachine(p, pts, L);
    if (p.dir > 0 && p.s >= L) {
      // pours a coffee and drinks it at the machine, then walks back holding the mug
      p.pauseUntil = this.t + COFFEE.seconds; p.dir = -1; p.gotCoffee = true;
      p.plainLook = p.look; if (p.look) p.look = withMug(p.look);
      return this.#atMachine(p, pts, L);
    }
    if (p.dir < 0 && p.s <= 0) {
      if (p.plainLook) p.look = p.plainLook;
      // only someone who got to the machine has a mug; called back on the way, they come back empty-handed
      if (p.gotCoffee) Object.assign(p, { activity: "mug", activityUntil: this.t + COFFEE.mugSeconds, coffeeUntil: this.t + COFFEE.onDesk });
      Object.assign(p, { state: "seated", path: "in", gotCoffee: false, plainLook: null });
      return;
    }
    const v = speedAt(pointAt(pts, p.s).y);
    p.s = Math.min(L, Math.max(0, p.s + p.dir * v * dt));
    const at = pointAt(pts, p.s);
    Object.assign(p, { x: at.x, y: at.y, flip: p.dir * at.dx < 0 });
    p.stride = (p.stride ?? 0) + v * dt / unitScale(at.y);
    p.view = Math.floor(p.stride / STEP_UNITS) % 2 ? "walk1" : "walk2";
  }

  #atMachine(p, pts, L) {
    const at = pointAt(pts, L);
    Object.assign(p, { x: at.x, y: at.y, view: "stand", flip: true });
  }

  /** The team of desk id needs it: a coffee walker on the way out turns back, one at the machine leaves now. */
  callBack(id) {
    const p = this.people.get(id);
    if (!p || p.path !== "coffee" || p.leaving) return;
    if (p.dir > 0) return void (p.dir = -1);            // turns back before the machine: no coffee this time
    p.pauseUntil = -1;
  }

  #sit(p, typing) {
    if (this.t < p.joyUntil) { p.view = "joy"; return; }
    const coffee = this.t < (p.coffeeUntil ?? -1);       // the mug stays on the desk for a while
    if (typing) { p.view = Math.floor(this.t / TYPE_PERIOD + p.phase * 2) % 2 ? "type1" : "type2"; p.mug = coffee; return; }
    if (this.t >= p.activityUntil) {
      p.activity = this.rng.pick(IDLE);
      p.activityUntil = this.t + this.rng.range(...IDLE_SECONDS);
    }
    p.mug = p.activity === "mug" || coffee;
    if (p.activity === "work") { p.view = Math.floor(this.t / WORK_PERIOD + p.phase * 2) % 2 ? "type1" : "type2"; return; }
    p.view = p.mug ? "sit" : p.activity;
  }
}

// Walkers fade in and out over this distance at the door.
const FADE_PX = WALK.fade * WALK.speed * 0.5;
// Floor pixels per character unit at depth y (walking frames follow the distance in units).
const unitScale = (y) => unitAtDepth(y);

// The same look holding a mug (its own sprite id, so the cache keeps both).
const mugLooks = new Map();
function withMug(look) {
  if (look.accessories?.includes("mug")) return look;
  if (!mugLooks.has(look.id)) mugLooks.set(look.id, { ...look, id: `${look.id}-mug`, accessories: [...(look.accessories ?? []), "mug"] });
  return mugLooks.get(look.id);
}

function placeAtSeat(p) { const s = stationOf(p.id); p.x = s.px; p.y = s.floor; p.flip = false; }
