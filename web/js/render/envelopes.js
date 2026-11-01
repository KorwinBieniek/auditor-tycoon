// Envelopes, drawn in screen pixels over the floor. When a team takes an alert, one envelope leaves
// the server rack and flies to the team's first desk; the whole team then works on it (their monitors
// light up and they type). One envelope per alert keeps the room readable (stage 6: the earlier split
// into K small envelopes flooded the screen). Only a picture: the simulation counts the check.
import { RACK_OUT, SPLIT_Y, ENVELOPE_CLEAR_Y, ENVELOPE_TOP } from "./geometry.js";
import { stationOf } from "./layout.js";
import { KIT } from "../ui/kit.js";

const FLY = { big: 0.55, mini: 0.35 };              // seconds of one flight (rack to desk)
const FLOAT = { seconds: 1.6, rise: 46, top: 16 };  // top: label height above its baseline
const ENVELOPE_HALF = 13;                            // half width of a big envelope (draw log box)

export class Envelopes {
  constructor() { this.flights = []; this.minis = []; this.floats = []; this.arrival = new Map(); this.t = 0; this.log = []; }

  /** Team took an alert: one envelope from the rack to the team's first desk; every desk of the team waits for it. */
  send(item, desks, camera) {
    const lead = Math.min(...desks), start = this.t, end = start + FLY.big + FLY.mini;
    this.flights.push({ item, from: { ...RACK_OUT }, to: deskPoint(lead, camera), start, end });
    for (const id of desks) this.arrival.set(id, end);
  }

  /** "+N PLN" above a desk. */
  float(id, label, camera) {
    const s = stationOf(id), p = camera.toScreen({ x: s.px + 70 * s.unit, y: s.floor - 250 * s.unit });
    // a label over a back row starts low enough that it never rises into the wall screens
    const y = Math.max(p.y, ENVELOPE_CLEAR_Y + FLOAT.rise + FLOAT.top - ENVELOPE_TOP);
    this.floats.push({ x: p.x, y, label, start: this.t });
  }

  /** True while the envelope for this desk is still on its way. */
  waiting(id) { return (this.arrival.get(id) ?? -1) > this.t; }

  clear() { this.flights = []; this.minis = []; this.floats = []; this.arrival.clear(); }

  update(dt) {
    this.t += dt;
    this.flights = this.flights.filter((f) => f.end > this.t);
    this.minis = this.minis.filter((m) => m.end > this.t);
    this.floats = this.floats.filter((f) => f.start + FLOAT.seconds > this.t);
  }

  /** Newest big envelope in the air (the tutorial points at it). */
  latest() { const f = this.flights.at(-1); return f && { ...position(f.from, f.to, ease(this.#u(f))), item: f.item }; }

  #u(f) { return Math.min(1, Math.max(0, (this.t - f.start) / (f.end - f.start))); }

  /** Draws everything in the air; this.log keeps each drawn box (screen pixels) for the animation checks. */
  draw(g, camera) {
    this.log = [];
    for (const m of this.minis) {
      if (this.t < m.start) continue;
      const to = deskPoint(m.id, camera), p = position(m.from, to, ease(this.#u(m)));
      envelope(g, p.x, p.y, 0.5); this.#logBox("mini", p, 0.5);
    }
    for (const f of this.flights) {
      const p = position(f.from, f.to, ease(this.#u(f)));
      envelope(g, p.x, p.y, 1, f.item.score); this.#logBox("envelope", p, 1);
    }
    for (const f of this.floats) {
      const u = (this.t - f.start) / FLOAT.seconds; drawFloat(g, f, u);
      this.log.push({ kind: "float", x0: f.x - 40, x1: f.x + 40, y0: f.y - FLOAT.rise * u - FLOAT.top, y1: f.y - FLOAT.rise * u });
    }
  }

  #logBox(kind, p, scale) {
    this.log.push({ kind, x0: p.x - ENVELOPE_HALF * scale, x1: p.x + ENVELOPE_HALF * scale, y0: p.y - ENVELOPE_TOP * scale, y1: p.y + 9 * scale });
  }
}

// Top of the monitor of desk id, on the screen.
function deskPoint(id, camera) {
  const s = stationOf(id);
  return camera.toScreen({ x: s.px + 128 * s.unit, y: s.floor - 190 * s.unit });
}

const ease = (u) => u * u * (3 - 2 * u);

// A gentle arc: up a little first, then down to the target, never above ENVELOPE_CLEAR_Y (the
// wall screens are above that line).
const ARC = { max: 60, perPx: 0.15 };
function position(a, b, u) {
  const lift = Math.min(ARC.max, Math.abs(b.x - a.x) * ARC.perPx);
  const y = a.y + (b.y - a.y) * u - lift * Math.sin(Math.PI * u);
  return { x: a.x + (b.x - a.x) * u, y: Math.max(ENVELOPE_CLEAR_Y, y) };
}

function envelope(g, x, y, scale, score) {
  g.save(); g.translate(x, y); g.rotate(-0.14); g.scale(scale, scale);
  g.fillStyle = KIT.cream; g.strokeStyle = KIT.brown; g.lineWidth = 1.4;
  roundRect(g, -13, -9, 26, 18, 3); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-12, -8); g.lineTo(0, 1.5); g.lineTo(12, -8); g.stroke();
  if (score !== undefined) scorePill(g, score);
  g.restore();
}

function scorePill(g, score) {
  g.fillStyle = KIT.mustard; roundRect(g, 6, -17, 30, 13, 6.5); g.fill();
  g.fillStyle = KIT.ink; g.font = "800 9.5px Nunito, sans-serif"; g.textAlign = "center";
  g.fillText(score.toFixed(2), 21, -7.5);
}

function drawFloat(g, f, u) {
  const y = f.y - FLOAT.rise * u;
  g.globalAlpha = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
  g.font = "800 13px Nunito, sans-serif"; g.textAlign = "center";
  const w = g.measureText(f.label).width + 22;
  g.fillStyle = KIT.caught; g.strokeStyle = KIT.cream; g.lineWidth = 2;
  roundRect(g, f.x - w / 2, y - 16, w, 22, 11); g.fill(); g.stroke();
  g.fillStyle = KIT.ink; g.fillText(f.label, f.x, y);
  g.globalAlpha = 1;
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
