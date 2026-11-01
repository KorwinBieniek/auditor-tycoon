// Small phone icons that leave the server rack: one per alert below the amount threshold, sent to the
// customer as an automatic SMS or push confirmation instead of an auditor. Pure decoration: the
// simulation has already counted the alert, and the drift path depends only on a counter (no randomness).
import { el } from "../svg.js";
import { KIT } from "../ui/kit.js";
import { WALL } from "./geometry.js";

const POOL = 10;                 // icons on screen at most (extra alerts in a burst are not drawn)
const LIFE_SECONDS = 1.8;
const RISE = 90;                 // how far an icon drifts up, in scene points
const DRIFT = [-34, -14, -54];   // sideways drift by counter, so a burst fans out
const PHONE = { w: 11, h: 18, r: 2.5 };

function phone(g) {
  el("rect", { x: -PHONE.w / 2, y: -PHONE.h / 2, width: PHONE.w, height: PHONE.h, rx: PHONE.r, fill: KIT.graphite }, g);
  const screen = el("rect", { x: -PHONE.w / 2 + 1.6, y: -PHONE.h / 2 + 2.4, width: PHONE.w - 3.2, height: PHONE.h - 6, rx: 1, fill: KIT.teal }, g);
  el("path", { d: "M-2.5 -2.5h5M-2.5 0h3.5", stroke: KIT.wall, "stroke-width": 1.1, "stroke-linecap": "round" }, g);
  return screen;
}

export class SmsIcons {
  constructor(svg) {
    this.g = el("g", { class: "sms-icons", "pointer-events": "none" }, svg);
    this.icons = [...Array(POOL)].map(() => {
      const g = el("g", { opacity: 0 }, this.g);
      return { g, screen: phone(g), age: Infinity, dx: 0 };
    });
    this.count = 0;
  }

  /** One automatic confirmation leaves the rack; a fraud on that path shows a red screen. */
  send(isFraud) {
    const icon = this.icons.find((i) => i.age >= LIFE_SECONDS);
    if (!icon) return;
    icon.age = 0; icon.dx = DRIFT[this.count++ % DRIFT.length];
    icon.screen.setAttribute("fill", isFraud ? KIT.fraud : KIT.teal);
  }

  update(dt) {
    const { x, y } = WALL.server;
    for (const i of this.icons) {
      if (i.age >= LIFE_SECONDS) continue;
      i.age += dt;
      const u = Math.min(1, i.age / LIFE_SECONDS);
      i.g.setAttribute("transform", `translate(${(x + 6 + i.dx * u).toFixed(1)} ${(y + 10 - RISE * u).toFixed(1)})`);
      i.g.setAttribute("opacity", (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85).toFixed(2));
    }
  }

  clear() { for (const i of this.icons) { i.age = Infinity; i.g.setAttribute("opacity", 0); } }
}
