// Pan Marek, the boss: stands in the right aisle facing the team, every now and then walks up to
// look at the wall screens, nods (happy face and a small bob) when a fraud is caught and puts his
// hands on his head when one slips through unflagged. A missed big fraud (BIG_FRAUD_PLN or more)
// makes him hold his head longer and shake. Animation only.
import { BOSS_HOME, BOSS_LOOK, COFFEE, SCENE } from "../render/geometry.js";
import { speedAt } from "./paths.js";
import { ROWS } from "../render/layout.js";

const BOSS_HALF_UNITS = 58;    // half his width incl. raised arms and the name label, character units
const COFFEE_HALF_UNITS = 34;  // half the coffee machine (decor.drawCoffeeMachine)
const BOSS_GAP = 20;           // px between the coffee machine and Pan Marek
const BOSS_MARGIN = 8;         // px from the right edge of the screen

const VISIT_EVERY = [12, 20];  // seconds between visits to the screens (often enough to see at x1)
const LOOK_SECONDS = 3;
const VISIT_SECONDS = 2.5;      // standing by a desk after a big catch
const NOD_SECONDS = 1.2;
const GRAB_SECONDS = 2.2;
const ALARM_SECONDS = 4;
const SHAKE = { height: 2, speed: 28 };   // shake of the big-fraud reaction (character units, rad/s)
const NOD_BOB = 3;             // bob height in character units

export class BossLife {
  constructor(rng) {
    this.rng = rng;
    this.state = "home";       // home, going, looking, back
    this.u = 0;                // 0 = home, 1 = by the screens
    this.nextVisit = rng.range(...VISIT_EVERY);
    this.until = 0; this.reaction = null; this.reactionUntil = -1;
    this.view = "stand"; this.flip = true; this.lift = 0; this.stride = 0;
    this.target = BOSS_LOOK; this.free = false;   // where the current walk goes; free: may pass the coffee machine
  }

  /** Walks over to a desk (screen x on the front plane), looks for a moment and goes back. */
  visit(t, screenX) {
    if (this.state !== "home" || t < this.reactionUntil) return false;
    this.target = { x: screenX, y: BOSS_HOME.y }; this.free = true; this.state = "going"; this.lookSeconds = VISIT_SECONDS;
    return true;
  }

  nod(t) { if (this.reaction === "nod" || t > this.reactionUntil) this.#react("nod", t + NOD_SECONDS); }
  grab(t) { if (this.reaction !== "alarm" || t > this.reactionUntil) this.#react("grab", t + GRAB_SECONDS); }
  alarm(t) { this.#react("alarm", t + ALARM_SECONDS); }
  #react(kind, until) { this.reaction = kind; this.reactionUntil = until; }

  /** Moves him (screen points converted to the floor through the camera). */
  update(dt, t, camera) {
    const reacting = t < this.reactionUntil;
    if (!reacting) this.#plan(t);
    if (!reacting && (this.state === "going" || this.state === "back")) this.#step(dt, camera);
    this.#place(camera);
    this.#pose(t, reacting);
  }

  #plan(t) {
    if (this.state === "home" && t >= this.nextVisit) { this.state = "going"; this.target = BOSS_LOOK; this.free = false; this.lookSeconds = LOOK_SECONDS; }
    if (this.state === "going" && this.u >= 1) { this.state = "looking"; this.until = t + (this.lookSeconds ?? LOOK_SECONDS); }
    if (this.state === "looking" && t >= this.until) this.state = "back";
    if (this.state === "back" && this.u <= 0) { this.state = "home"; this.nextVisit = t + this.rng.range(...VISIT_EVERY); }
  }

  #step(dt, camera) {
    const a = this.#spot(BOSS_HOME, camera), b = this.#spot(this.target, camera, this.free), len = Math.max(1, Math.abs(b.x - a.x));
    const v = speedAt(this.y ?? a.y) * dt;
    this.u = Math.min(1, Math.max(0, this.u + (this.state === "going" ? v : -v) / len));
    this.stride += v;
  }

  #place(camera) {
    const a = this.#spot(BOSS_HOME, camera), b = this.#spot(this.target, camera, this.free);
    this.x = a.x + (b.x - a.x) * this.u; this.y = a.y + (this.free ? 14 * this.u : 0);   // a visit walks just in front of the desks
  }

  // Pan Marek belongs to the front plane (like the door and the coffee machine): he stands on the
  // front row's floor line at front-row scale and only moves sideways along it, never into the back rows.
  // His screen x is clamped: right of the coffee machine with a gap, and fully inside the screen (label included).
  #spot(p, camera, free = false) {
    const y = ROWS[0].floor, zoom = camera.toScreen({ x: 1, y }).x - camera.toScreen({ x: 0, y }).x;
    const half = BOSS_HALF_UNITS * ROWS[0].unit * zoom;
    const left = COFFEE.x + COFFEE_HALF_UNITS * COFFEE.unit + BOSS_GAP + half, right = SCENE.w - BOSS_MARGIN - half;
    const sx = Math.min(Math.max(p.x, free ? half + BOSS_MARGIN : left), right);
    return { x: camera.toWorld({ x: sx, y: p.y }).x, y };
  }

  #pose(t, reacting) {
    this.lift = 0;
    if (reacting && this.reaction === "grab") { this.view = "grab"; return; }
    if (reacting && this.reaction === "alarm") { this.view = "grab"; this.lift = SHAKE.height * Math.abs(Math.sin(t * SHAKE.speed)); return; }
    if (reacting) { this.view = "nod"; this.lift = NOD_BOB * Math.abs(Math.sin((this.reactionUntil - t) * 9)); return; }
    const walking = this.state === "going" || this.state === "back";
    this.view = walking ? (Math.floor(this.stride / 18) % 2 ? "walk1" : "walk2") : (this.state === "looking" && this.free ? "nod" : "stand");
    // he faces left on the way out and while looking; on the way back from a visit he faces home (right)
    this.flip = !(this.state === "back" && this.free);
  }
}
