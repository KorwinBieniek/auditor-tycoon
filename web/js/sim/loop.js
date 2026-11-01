// Fixed-step simulation loop. Rendering only supplies elapsed real time; the simulation
// always advances in SIM_STEP_SECONDS steps, so speed and FPS do not change the result.
import { SIM_SECONDS_PER_REAL_SECOND, SIM_STEP_SECONDS } from "../config.js";

export class FixedStepLoop {
  constructor(sim, { speed = 1 } = {}) {
    this.sim = sim;
    this.speed = speed;
    this.accumulator = 0; // pending shift seconds not yet simulated
    this.simTime = sim.now;
  }

  setSpeed(speed) { this.speed = speed; }

  /** Called every frame with the real time since the previous frame (ms). */
  frame(realDeltaMs) {
    this.accumulator += (realDeltaMs / 1000) * SIM_SECONDS_PER_REAL_SECOND * this.speed;
    const steps = Math.floor(this.accumulator / SIM_STEP_SECONDS);
    this.accumulator -= steps * SIM_STEP_SECONDS;
    for (let i = 0; i < steps && !this.sim.finished; i++) this.step();
    return steps;
  }

  step() {
    this.simTime += SIM_STEP_SECONDS;
    this.sim.advanceTo(this.simTime);
  }

  /** "To end of shift": the same steps, without waiting for frames. */
  runToEnd() {
    while (!this.sim.finished) this.step();
  }
}
