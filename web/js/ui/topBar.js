// Top controls: hire and fire, Find optimum, pause and speed, and the Settings and data drawer.
import { SPEEDS } from "../config.js";
import { icon } from "./icons.js";
import { group } from "./format.js";
import { button, onData, setSegment } from "./dom.js";

const STEPS = [-1, 1];
const HOLD = { delay: 400, every: 90 };   // holding -1 / +1 repeats it (replaces separate -10 / +10 buttons)

export class TopBar {
  constructor(root, on) {
    root.className = "m-top";
    const steps = STEPS.map((s) => button(String(Math.abs(s)), "sq", s < 0 ? "minus" : "plus", `data-step="${s}" title="${s < 0 ? "Fire" : "Hire"} one (hold for more)"`));
    root.innerHTML = `<div class="m-brand"><span class="m-dot"></span>Auditor Tycoon
        <span class="m-shift"><b class="s-name"></b><span class="s-time"></span><i class="s-bar"><i></i></i><span class="s-soon">ends soon</span></span>
</div>
      <div class="m-group" data-tour="controls">${steps[0]}
        <div class="m-count"><b>0</b><small>auditors</small></div>${steps[1]}
        ${button("Find optimum", "accent", "target", 'data-optimum="1"')}</div>
      <div class="m-group">${button("", "sq", "pause", 'data-pause="1" title="Pause"')}
        ${SPEEDS.map((s) => button(`x${s}`, "seg", "", `data-speed="${s}"`)).join("")}</div>
      ${button("", "sq ghost sound", "soundOff", 'data-sound="1" title="Music and sounds on"')}
      ${button("Settings", "drawer-btn", "sliders", 'data-drawer="1"')}`;
    this.root = root;
    // a click steps once; holding the button keeps stepping
    for (const b of root.querySelectorAll("[data-step]")) {
      const k = Number(b.dataset.step);
      const stop = () => { clearTimeout(this.holdT); clearInterval(this.holdI); };
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault(); stop(); on.step(k);
        this.holdT = setTimeout(() => { this.holdI = setInterval(() => on.step(k), HOLD.every); }, HOLD.delay);
      });
      for (const ev of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ev, stop);
    }
    onData(root, "optimum", () => on.optimum());
    onData(root, "pause", () => on.pause());
    onData(root, "speed", (v) => on.speed(Number(v)));
    onData(root, "drawer", () => on.drawer());
    onData(root, "sound", () => on.sound?.());
  }

  setCount(n) { this.root.querySelector(".m-count b").textContent = group(n); }
  /** name: "Night shift"; hh:mm now and at the end; share of the shift done (0..1). */
  setShift(name) { this.root.querySelector(".s-name").textContent = name; }
  setClock(now, end, done) {
    const sh = this.root.querySelector(".m-shift");
    sh.querySelector(".s-time").textContent = `${now} / ${end}`;
    sh.querySelector(".s-bar i").style.width = `${(100 * Math.min(1, done)).toFixed(1)}%`;
    sh.classList.toggle("ending", done >= 0.9 && done < 1);
  }
  setVolume(k) { this.root.querySelector(".m-shift").title = `Traffic x${k}: every payment in the data stands for ${k} real ones (a what-if, see About)`; }
  setSound(on) {
    const b = this.root.querySelector("[data-sound]");
    b.innerHTML = icon(on ? "soundOn" : "soundOff"); b.title = on ? "Music and sounds off" : "Music and sounds on"; b.classList.toggle("on", on);
  }
  setSpeed(s) { setSegment(this.root, "speed", s); }

  setPaused(paused) {
    const b = this.root.querySelector("[data-pause]");
    b.innerHTML = icon(paused ? "play" : "pause");
    b.title = paused ? "Resume" : "Pause";
    b.classList.toggle("on", paused);
  }

  setOptimumBusy(busy) { this.root.querySelector("[data-optimum]").classList.toggle("busy", busy); }
}
