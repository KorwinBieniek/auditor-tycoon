// Sounds and music: all CC0 (web/audio/CREDITS.md). On by default, but browsers only allow audio after the
// first click or key press, so start() waits for it. One speaker button turns the music and the effects off. Effects are short and rate-limited so they never pile up.
const FILES = ["envelope", "caught", "bigCaught", "sms", "missedBig", "bell", "click", "door", "coffee", "pop", "typing1", "typing2", "typing3"];
const GAP_MS = { caught: 300, bigCaught: 500, missedBig: 1500, sms: 2500, envelope: 900, bell: 1000, click: 80, door: 600, coffee: 600, pop: 120, typing: 700 };
const VOLUME = { envelope: 0.18, caught: 0.45, bigCaught: 0.7, sms: 0.2, missedBig: 0.5, bell: 0.6, click: 0.35, door: 0.5, coffee: 0.5, pop: 0.35, typing: 0.3 };
const MUSIC = ["audio/music1.mp3", "audio/music2.mp3"];
const MUSIC_VOLUME = 0.14;
const MASTER = 0.6;   // everything a bit quieter: it plays from the start

export class Sfx {
  constructor() { this.on = true; this.started = false; this.last = {}; this.buffers = {}; this.track = 0; }

  /** The first click or key press of the page: audio may start now. */
  start() {
    if (this.started) return;
    this.started = true;
    if (this.on) this.#resume();
  }

  toggle() {
    this.on = !this.on; this.started = true;
    if (this.on) this.#resume();
    else { this.ctx?.suspend(); this.music?.pause(); }
    return this.on;
  }

  #resume() {
    if (!this.ctx) this.#init();
    this.ctx.resume(); this.music.play().catch(() => {});
  }

  #init() {
    this.ctx = new AudioContext();
    this.out = this.ctx.createGain(); this.out.gain.value = MASTER; this.out.connect(this.ctx.destination);
    for (const name of FILES) {
      fetch(`audio/${name}.mp3`).then((r) => r.arrayBuffer()).then((b) => this.ctx.decodeAudioData(b))
        .then((buf) => { this.buffers[name] = buf; }).catch(() => {});
    }
    // the two loops take turns, each played to the end
    this.music = new Audio(MUSIC[0]);
    this.music.volume = MUSIC_VOLUME * MASTER;
    this.music.addEventListener("ended", () => { this.track = (this.track + 1) % MUSIC.length; this.music.src = MUSIC[this.track]; this.music.play().catch(() => {}); });
  }

  /** The room at work: soft keyboard bursts while teams are busy (busy: share of the room typing, 0..1). */
  ambience(busy) {
    if (!this.on || busy <= 0 || Math.random() > 0.35 + 0.5 * busy) return;
    this.play("typing", `typing${1 + Math.floor(Math.random() * 3)}`);
  }

  play(name, file = name) {
    if (!this.on || !this.started || !this.buffers[file]) return;
    const now = performance.now();
    if (now - (this.last[name] ?? -Infinity) < (GAP_MS[name] ?? 200)) return;
    this.last[name] = now;
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
    src.buffer = this.buffers[file]; g.gain.value = VOLUME[name] ?? 0.5;
    src.playbackRate.value = 0.94 + Math.random() * 0.12;   // a little variation, so repeats don't sound mechanical
    src.connect(g).connect(this.out); src.start();
  }
}
