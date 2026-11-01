// Auditor Tycoon: the game page. Joins the simulation (sim/), the economy, the office
// picture (render/) and the HUD (ui/). URL parameters (for tests and recordings): shift, model,
// n, speed, seed, screen=office (skip the start screen), tutorial=0, test=1 (manual frames),
// data (another data file in the same format, for tests).
// Models come only from the data file: models[0] is my model, the others are comparisons.
import { fetchScoreSource, DataError } from "./scoreSource.js";
import { modelRoles, roleOf } from "./models.js";
import { ShiftSim } from "./sim/shiftSim.js";
import { FixedStepLoop } from "./sim/loop.js";
import { profitCurve, peakOf, gapToOptimum, valueOf, totalsSoFar, randomSoFar, auditorMax, runShift } from "./sim/economy.js";
import { SayBubble } from "./ui/sayBubble.js";
import { money, group } from "./ui/format.js";
import { derive, simOptions, MAX_DESKS, ASSUMPTION_RANGES, DEFAULT_ASSUMPTIONS, DEFAULT_AUDITORS, SIM_SECONDS_PER_REAL_SECOND, SHIFT_SECONDS, START_SPEED, AMOUNT_THRESHOLD_PLN, BIG_FRAUD_PLN, AUTHOR, AUTHOR_ROLE, setCrew } from "./config.js";
import { nameOf } from "./looks.js";
import { startCards } from "./ui/texts.js";
import { deskCount, teamOfDesk, teamDesks } from "./deskMap.js";
import { SCENE, WALL } from "./render/geometry.js";
import { OfficeView } from "./render/officeView.js";
import { KIT } from "./ui/kit.js";
import { TopBar } from "./ui/topBar.js";
import { Ticker } from "./ui/ticker.js";
import { BossTalk, line } from "./ui/bossTalk.js";
import { Drawer } from "./ui/drawer.js";
import { StartScreen } from "./ui/startScreen.js";
import { Story } from "./ui/story.js";
import { Sfx } from "./ui/sfx.js";
import { ShiftOver } from "./ui/shiftOver.js";
import { HoodPanel } from "./ui/hoodPanel.js";
import { plusMoney } from "./ui/format.js";
import { flaggedValueShare, shiftValueShare } from "./sim/valueShare.js";
import { randomCaption } from "./render/profitScreen.js";

const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const HUD_MS = 250;
const RESTART_DEBOUNCE_MS = 200;
const OPTIMUM_STEP_MS = 150;
const MAX_FRAME_SECONDS = 0.1;      // the animation never jumps more than this per frame
const STAGE = { w: SCENE.w, h: SCENE.h + 60 };

const DATA_URL = params.get("data") ?? "data/data.json";
const source = await loadSource(DATA_URL);
const roles = modelRoles(source.models), catalog = { meta: source.meta, roles };
// Fraud value above the threshold over the whole game day, per model (from data.json rows).
const valueShares = { ...Object.fromEntries(source.modelIds.map((id) => [id, flaggedValueShare(source, id)])), rows: source.columns.id.length };
const assumptions = { ...DEFAULT_ASSUMPTIONS };
await liveEuroRate();

// Today's EUR/PLN mid rate from the NBP public API (no key). Offline or slow: the default stays.
async function liveEuroRate() {
  try {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch("https://api.nbp.pl/api/exchangerates/rates/a/eur/?format=json", { signal: ctl.signal });
    clearTimeout(timer);
    const j = await r.json(), mid = j?.rates?.[0]?.mid, day = j?.rates?.[0]?.effectiveDate;
    if (!(mid > 3 && mid < 6)) return;
    const R = ASSUMPTION_RANGES.plnPerEur;
    assumptions.plnPerEur = Math.min(R.max, Math.max(R.min, Math.round(mid * 100) / 100));
    R.points = [{ v: mid, label: `NBP mid rate, ${day}: ${mid.toFixed(4)} (loaded live)`, url: "https://api.nbp.pl/" }];
  } catch { /* offline: keep the default */ }
}
const state = { shiftIndex: Number(params.get("shift") ?? 0), model: startModel(params.get("model")),
  n: Number(params.get("n") ?? DEFAULT_AUDITORS), speed: Number(params.get("speed") ?? 1), paused: false, overShown: false };
let d = derive(assumptions), sim, loop, curve, maxN, optimumTimer = null, restartTimer = null, lastHud = -Infinity, realTime = 0;

// Shift names from the hour of day the shift starts at (the data is assumed to start around midnight, see About).
const SHIFT_NAMES = source.shifts.map((s) => ({ 0: "Night shift", 8: "Day shift", 16: "Evening shift" })[Math.round((s.start % 86400) / 3600)] ?? "Shift");
const view = new OfficeView({ wall: $("wall"), canvas: $("floor"), source, seed: Number(params.get("seed") ?? 7), pixelRatio: pixelRatio() });
const sfx = new Sfx();
// sound is on from the start; the browser lets it play after the first click or key press
for (const ev of ["pointerdown", "keydown"]) window.addEventListener(ev, () => sfx.start(), { once: true, capture: true });
const top = new TopBar($("top"), { step: (k) => { stopOptimum(); setAuditors(state.n + k); }, optimum: findOptimum,
  pause: togglePause, speed: setSpeed, drawer: () => drawer.toggle(), sound: () => { top.setSound(sfx.toggle()); sfx.play("click"); } });
top.setSound(sfx.on);
const boss = new BossTalk($("bosssay"), () => view.locate("boss"));
const say = new SayBubble($("say"));
const ticker = new Ticker($("ticker"), (entry) => entry && openHood(entry));
const drawer = new Drawer($("drawer"), { catalog, shifts: source.shifts, names: SHIFT_NAMES.map((n) => n.replace(" shift", "")), values: assumptions, on: {
  assumption: onAssumption, shift: (k) => { state.shiftIndex = k; startShift(); }, restart: () => startShift(),
  toEnd: toEndOfShift, model: setModel, opened: () => hood.close() } });
// one panel at a time: the model view closes the side panel and the other way round
function openHood(entry) { drawer.close(); hood.open(entry); }
const over = new ShiftOver($("over"), { next: () => { state.shiftIndex += 1; startShift(); }, replay: () => startShift(),
  drawer: () => drawer.open("results") });
const hood = new HoodPanel($("hood"), { view, threshold: () => source.threshold(state.model), model: () => state.model,
  plnPerEur: () => d.plnPerEur, label: () => roleOf(roles, state.model).inText, hoodUrl: hoodUrl() });
const story = new Story($("story"), $("ring"), { locate: locateTarget, blocked: () => drawer.isOpen || hood.isOpen, onDone: endStory });

let curves = null, roi = null;
// Profit curves of every shift for the current assumptions (three curves: only on demand, then cached).
function curvesNow() { return (curves ??= source.shifts.map((_, k) => (k === state.shiftIndex && curve ? curve : profitCurve(source, k, d, maxN)))); }
function bestTeamsNow(model = state.model) { return curvesNow().map((c) => peakOf(c, model).n); }
// PLN of fraud stopped per 1 PLN spent (pay, false alarms, SMS), my model, each shift at its best team.
function roiNow() {
  if (roi === null) {
    let saved = 0, cost = 0;
    bestTeamsNow(source.modelIds[0]).forEach((b, k) => { const r = runShift(source, k, source.modelIds[0], b, d); saved += r.savedPln; cost += r.wagesPln + r.falseAlarmPln + r.smsPln; });
    roi = cost > 0 ? saved / cost : 0;
  }
  return roi;
}

// ---- data file --------------------------------------------------------------------------------

// A data file the game cannot read stops here with the reasons on screen (and nothing else starts).
async function loadSource(url) {
  try { return await fetchScoreSource(url); }
  catch (err) {
    const problems = err instanceof DataError ? err.problems : [err.message];
    const box = $("data-error");
    box.hidden = false;
    box.innerHTML = `<div class="e-card"><h2>The game cannot read its data file</h2><p>${url}</p>
      <ul>${problems.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
      <p class="d-note">Format: schema/auditor-data.v1.schema.json. Check a file with: python scripts/export_game_data.py --validate FILE</p></div>`;
    document.body.dataset.ready = "error";
    throw err;
  }
}

function escapeHtml(t) { return String(t).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]); }

// The URL may pick a model by id; anything else starts with my model (the first one).
function startModel(id) { return source.modelIds.includes(id) ? id : source.modelIds[0]; }

// The explanations file sits next to the data file (explanations.file), or there is none.
function hoodUrl() { return source.explanations ? new URL(source.explanations.file, new URL(DATA_URL, location.href)).href : null; }

// ---- shift and money ------------------------------------------------------------------------

// Share of this shift's fraud value a team of n catches, per model (for the profit screen).
function shiftValueAt(n) {
  return Object.fromEntries(source.modelIds.map((id) => [id, shiftValueShare(source, state.shiftIndex, id, n, d)]));
}

// Live numbers for the drawer (segments, Metrics, About).
function drawerState() {
  return { shiftIndex: state.shiftIndex, model: state.model, volume: d.volume, n: state.n,
    value: valueShares, random: `${randomCaption(curve)} (this shift)`,
    roi: roiNow(), best: bestTeamsNow(), names: SHIFT_NAMES };
}

function startShift() {
  d = derive(assumptions);
  // a new shift (or a replay after the crew went home) brings its crew in; decoration only
  if (state.crewShift !== state.shiftIndex || state.crewOut) {
    state.crewShift = state.shiftIndex; state.crewOut = false;
    view.newCrew(state.shiftIndex); sfx.play("door");
  }
  sim = new ShiftSim({ source, shiftIndex: state.shiftIndex, model: state.model, auditors: state.n,
    ...simOptions(d), onEvent });
  loop = new FixedStepLoop(sim, { speed: state.speed });
  state.overShown = false; over.hide(); ticker.clear(); view.envelopes.clear(); view.sms.clear();
  view.score.reset(source.shifts[state.shiftIndex], state.model, roleOf(roles, state.model).short);
  top.setShift(SHIFT_NAMES[state.shiftIndex]); top.setVolume(d.volume);
  refreshMoney();
}

// Everything that depends on the money assumptions: the curve, the peaks, the board.
function refreshMoney() {
  stopOptimum();                       // its target was the old curve's peak
  d = derive(assumptions);
  maxN = auditorMax(source, d);
  if (state.n > teamMax()) setAuditors(teamMax());
  curve = profitCurve(source, state.shiftIndex, d, maxN);
  curves = null; roi = null;           // the other shifts' curves are computed only when asked (curvesNow)
  view.profit.build(curve, { model: state.model, volume: d.volume, n: state.n, valueAt: shiftValueAt, roles });
  updateHud(true);
}

// The team controls stop at MAX_DESKS (100); the profit curve and its peaks still cover the full data range.
function teamMax() { return Math.min(maxN ?? MAX_DESKS, MAX_DESKS); }

function setAuditors(n) {
  state.n = Math.max(1, Math.min(teamMax(), Math.round(n)));
  sim?.setAuditors(state.n);
  view.setDesks(deskCount(state.n), isFast());
  top.setCount(state.n);
  if (curve) { view.profit.setTeam(state.n); updateHud(true); }
}

// x of the Find optimum button in office pixels (the bubble appears under it).
function optimumX() {
  const b = document.querySelector("[data-optimum]").getBoundingClientRect(), o = $("office").getBoundingClientRect();
  return (b.left + b.width / 2 - o.left) / fitScale();
}

// "Find optimum": step by step to the peak; people walk in or out meanwhile.
function findOptimum() {
  stopOptimum();
  const best = peakOf(curve, state.model).n, target = Math.min(best, teamMax());   // the office has teamMax() desks
  top.setOptimumBusy(true);
  const others = bestTeamsNow().map((b, k) => (k === state.shiftIndex ? null : `${SHIFT_NAMES[k].toLowerCase()} ${b}`)).filter(Boolean).join(", ");
  say.show(optimumX(), 70, `Best team for the ${SHIFT_NAMES[state.shiftIndex].toLowerCase()}: ${target} people${best > target ? ` (it would take ${best}, the office has ${teamMax()} desks)` : ""}. Each shift has its own: ${others}.`, null, "below");
  optimumTimer = setInterval(() => {
    const diff = target - state.n;
    if (!diff) return stopOptimum();
    const step = Math.max(1, Math.round(Math.abs(diff) / 4));
    setAuditors(state.n + Math.sign(diff) * Math.min(Math.abs(diff), step));
  }, OPTIMUM_STEP_MS);
}

function stopOptimum() { clearInterval(optimumTimer); optimumTimer = null; top.setOptimumBusy(false); }

function setModel(model) { if (model !== state.model) { state.model = model; hood.close(); startShift(); } }

function onAssumption(key, needsRestart) {
  if (!needsRestart) { refreshMoney(); return; }
  clearTimeout(restartTimer);
  restartTimer = setTimeout(startShift, RESTART_DEBOUNCE_MS);
}

// "To end of shift": the same simulation steps at once, without the pictures.
function toEndOfShift() {
  state.skipping = true; loop.runToEnd(); state.skipping = false;
  view.envelopes.clear(); updateHud();
}

function setSpeed(s) { state.speed = s; loop.setSpeed(s); top.setSpeed(s); view.setDesks(deskCount(state.n), isFast()); }
function togglePause() { state.paused = !state.paused; top.setPaused(state.paused); }
const isFast = () => state.speed >= 100 || reducedMotion || state.skipping;

// ---- simulation events -> pictures -----------------------------------------------------------

function onEvent(e) {
  const desks = e.desk === undefined ? [] : teamDesks(e.desk, state.n, d.volume).filter((id) => id < view.desks);
  if (e.type === "assign" && !isFast() && desks.length) { view.envelopes.send(e.item, desks, view.camera); sfx.play("envelope"); }
  if (e.type === "caught") onCaught(e, desks);
  if (e.type === "missed" && e.reason === "not flagged") view.score.flash("missed", e.item.score);
  if (e.type === "auto" && !isFast()) { view.sms.send(e.item.isFraud); sfx.play("sms"); }
  if (e.type === "missed" && e.big && !isFast()) { sfx.play("missedBig"); bossOnMiss(e); }
  else if (e.type === "missed" && e.reason === "not flagged" && !isFast() && e.item.amount * d.plnPerEur >= 300)
    boss.say(line("missNotFlagged", { amt: money(e.item.amount * d.plnPerEur), s: e.item.score.toFixed(1) }), 1);   // why he holds his head
  if (e.type === "caught" && e.item.amount * d.plnPerEur >= BIG_FRAUD_PLN && !isFast() && desks.length) {
    const desk = Math.min(...desks);
    boss.say(line("caughtBig", { name: view.nameAt(desk) ?? "team", amt: money(e.item.amount * d.plnPerEur) }), 1);
    view.bossVisit(desk);                // he walks over to that desk for a moment
  }
  if (e.type === "caught" || e.type === "cleared" || e.type === "missed") ticker.push(entryOf(e.item, e.type, e.reason, e.big));
  view.life.react(e, desks);
}

// Pan Marek says why he holds his head: which fraud, how much, and why nobody stopped it.
function bossOnMiss(e) {
  const amt = money(e.item.amount * d.plnPerEur), s = e.item.score.toFixed(1);
  if (e.reason === "out of time") return boss.say(line("missNoTime", { amt }), 2);
  boss.say(line("missNotFlagged", { amt, s }), 2);
}

// Every second or so: a long queue or a half idle team makes him say so, and it matches the best team.
function bossWatch() {
  if (!sim || story.active || state.paused || isFast() || !curve) return;
  const peak = peakOf(curve, state.model).n, q = group(sim.queueLength);
  if (sim.queueLength > Math.max(30, state.n)) boss.say(line(state.n < peak ? "queueHire" : "queueOk", { q }), 1);
  else if (state.n > peak * 1.4 && state.n - peak >= 5) boss.say(line("idleTeam", { peak }), 1);
}

function onCaught(e, desks) {
  view.score.flash("caught", e.item.score);
  sfx.play(e.item.amount * d.plnPerEur >= BIG_FRAUD_PLN ? "bigCaught" : "caught");
  if (!isFast() && desks.length) view.envelopes.float(Math.min(...desks), plusMoney(e.item.amount * d.plnPerEur), view.camera);
}

const entryOf = (item, kind, reason, big = false) => ({ id: item.id, row: item.row, t: item.time, amount: item.amount, score: item.score, kind, reason, big });

function entryOfRow(r, kind) {
  const c = source.columns;
  return { id: c.id[r], row: r, t: c.time[r], amount: c.amount[r], score: source.score(state.model, r), kind };
}

// Ticker padding: checks in progress, then the queue, then transactions just scored below the threshold.
function tickerFill() {
  const checking = [...Array(sim.teamCount).keys()].map((j) => sim.currentItem(j)).filter(Boolean).map((it) => entryOf(it, "checking"));
  const queued = sim.queuePreview(6).map((it) => entryOf(it, "queued"));
  const scored = [], thr = source.threshold(state.model), first = source.shifts[state.shiftIndex].first;
  for (let r = view.score.cursor - 1; r >= first && scored.length < 6; r--) if (source.score(state.model, r) <= thr) scored.push(entryOfRow(r, "scored"));
  return [...checking, ...queued, ...scored];
}

// ---- frame loop -------------------------------------------------------------------------------

function frame(dtMs) {
  realTime += dtMs / 1000;
  if (!state.paused) loop.frame(dtMs);
  const shift = source.shifts[state.shiftIndex];
  const rowsPerSecond = ((shift.last - shift.first) / SHIFT_SECONDS) * SIM_SECONDS_PER_REAL_SECOND * state.speed;
  // during the intro the score screen fills with the first minutes of the shift (a preview; the shift restarts after it)
  if (story.active) state.storyNow = Math.min((state.storyNow ?? 0) + (dtMs / 1000) * SIM_SECONDS_PER_REAL_SECOND * 3, (shift.end - shift.start) / 4);
  view.score.advance(story.active ? shift.start + state.storyNow : sim.now, rowsPerSecond);
  const busy = busyDesk;
  view.update(Math.min(dtMs / 1000, MAX_FRAME_SECONDS), { busy, now: sim.now });
  view.draw();
  story.update();
  boss.update(!story.active && !state.overShown && !drawer.isOpen && !hood.isOpen);
  if (Math.floor(realTime) !== Math.floor(realTime - dtMs / 1000)) {
    bossWatch();
    if (sim && !state.paused && !story.active && !state.overShown) sfx.ambience(sim.teamCount ? [...Array(sim.teamCount).keys()].filter((j) => sim.currentItem(j)).length / sim.teamCount : 0);
  }
  if (realTime * 1000 - lastHud > HUD_MS) { lastHud = realTime * 1000; updateHud(); }
}

function updateHud(force = false) {
  if (!sim || !curve) return;
  const r = sim.result(), v = valueOf(r, d), soFar = totalsSoFar(source, state.shiftIndex, r.now, d);
  const sh = source.shifts[state.shiftIndex];
  top.setClock(clockOf(r.now), clockOf(sh.end), (r.now - sh.start) / (sh.end - sh.start));
  const peak = peakOf(curve, state.model).n, gap = gapToOptimum(curve, state.model, state.n);
  const rnd = randomSoFar(source, state.shiftIndex, r.now, r.auditorSeconds, d);
  view.board.set({ v, soFar, rnd, gap, peak, n: state.n, d, early: r.now - sh.start < 3600 });
  ticker.render(tickerFill, d.plnPerEur);
  if (force || drawer.isOpen) drawer.set(drawerState());
  if (r.finished && !state.overShown) {
    state.overShown = true;
    over.show({ shiftIndex: state.shiftIndex, shiftCount: source.shifts.length, v, raw: r, peak, gap, n: state.n, volume: d.volume,
      names: SHIFT_NAMES, bestTeams: bestTeamsNow(), share: soFar.fraudAmount ? v.caughtAmount / soFar.fraudAmount : 0,
      randomShare: soFar.fraudAmount ? rnd.caughtAmount / soFar.fraudAmount : 0 });
    sfx.play("bell");
    view.crewOut(); state.crewOut = true;
  }
}

// ---- layout, tutorial target, start ---------------------------------------------------------

function pixelRatio() { return Math.max(1, (window.devicePixelRatio || 1) * fitScale()); }
// The visible window. innerWidth is not used: on phones the 1440 px stage widens the layout viewport,
// so innerWidth reports 1440 instead of the screen width.
function viewW() { return window.visualViewport?.width ?? document.documentElement.clientWidth; }
function viewH() { return window.visualViewport?.height ?? document.documentElement.clientHeight; }
function fitScale() { return Math.min(viewW() / STAGE.w, viewH() / STAGE.h); }

function fit() {
  const s = fitScale(), stage = $("stage");
  // a taller window gets a taller stage: more floor between the desks and the ticker, the ticker at the bottom
  const h = Math.max(STAGE.h, viewH() / s);
  stage.style.height = `${h.toFixed(0)}px`; $("office").style.height = `${(h - 60).toFixed(0)}px`;
  const ox = (viewW() - STAGE.w * s) / 2;
  stage.style.transform = `translate(${ox.toFixed(1)}px, 0) scale(${s})`;
  // a wider window: the page beside the stage continues the room (top bar, wall, floor, ticker) instead of black bars
  const y = (v) => `${(v * s).toFixed(1)}px`, css = getComputedStyle(document.documentElement);
  const c = (n) => css.getPropertyValue(n).trim();
  document.body.style.background = `linear-gradient(to bottom, ${c("--graphite")} 0 ${y(60)}, ${c("--wall")} ${y(60)} ${y(60 + SCENE.wallBottom)},
    ${KIT.floor} ${y(60 + SCENE.wallBottom)} ${y(h - 68)}, ${c("--graphite")} ${y(h - 68)})`;
  view.resize(s, window.devicePixelRatio || 1);
}

function locateTarget(target) {
  if (target === "controls") return null;   // the controls sit in the top bar; they glow instead (class "tour-on")
  return view.locate(target);
}

// ---- guided start: one real night shift story told with rows from the data ----------------------

// Three real transactions of this shift: the biggest fraud the model flags, a small flagged one
// (goes to SMS) and the biggest fraud the model misses. Read from data.json, nothing invented.
function storyRows() {
  const sh = source.shifts[state.shiftIndex], c = source.columns, thr = source.threshold(state.model), pln = d.plnPerEur;
  let caught = -1, small = -1, missed = -1;
  for (let r = sh.first; r <= sh.last; r++) {
    const flagged = source.score(state.model, r) > thr, a = c.amount[r];
    if (c.is_fraud[r] && flagged && (caught < 0 || a > c.amount[caught])) caught = r;
    if (c.is_fraud[r] && !flagged && (missed < 0 || a > c.amount[missed])) missed = r;
    if (flagged && a * pln < AMOUNT_THRESHOLD_PLN && small < 0) small = r;
  }
  return { caught, small, missed };
}

function storySteps() {
  const { caught, small, missed } = storyRows(), c = source.columns, pln = d.plnPerEur;
  const amt = (r) => money(c.amount[r] * pln);
  const item = (r) => ({ id: c.id[r], row: r, time: c.time[r], amount: c.amount[r], score: source.score(state.model, r), isFraud: !!c.is_fraud[r] });
  const name = nameOf(0), steps = [];
  steps.push({ target: "server", title: `${SHIFT_NAMES[state.shiftIndex]}, ${state.n} auditors`,
    text: "Card payments flow into the bank's server. All of them are real, from a public dataset.",
    act: () => view.poke("server") });
  steps.push({ target: "score", title: "My model scores every payment", long: true, low: true,
    text: `My model learned what normal payments look like. The stranger a payment, the further right it lands. Past the dashed alert line it becomes an alert.` });
  if (caught >= 0) steps.push({ target: "desk0", title: "An alert goes to an auditor", long: true,
    text: `${amt(caught)}, far past the alert line. ${name} checks it: fraud. The bank keeps the money.`,
    act: () => {
      view.envelopes.send(item(caught), [0], view.camera); sfx.play("envelope");
      setTimeout(() => { if (!story.active) return; view.life.react({ type: "caught" }, [0]); view.envelopes.float(0, plusMoney(c.amount[caught] * pln), view.camera); sfx.play("bigCaught"); }, 1400);
    } });
  if (small >= 0) steps.push({ target: "server", title: "Small alerts go to the customer",
    text: `Alerts under ${AMOUNT_THRESHOLD_PLN} PLN go straight to the customer as an SMS: "Was this you?" It's cheaper than an auditor's time.`,
    act: () => { for (let k = 0; k < 3; k++) setTimeout(() => { view.sms.send(k === 1); sfx.play("sms"); }, k * 350); } });
  if (missed >= 0) steps.push({ target: "boss", title: "Not everything gets caught", long: true,
    text: `${amt(missed)} of fraud looked normal to my model, so it stayed under the line. Nobody looked at it. Pan Marek is not happy.`,
    act: () => { view.life.react({ type: "missed", big: true }); sfx.play("missedBig");
      boss.say(`${amt(missed)} just went through. It looked normal, so nobody checked it.`, 2); } });
  steps.push({ target: "scoreboard", title: "The scoreboard keeps count",
    text: "Money stopped, frauds caught, the result after pay and costs, and how far you are from the best team." });
  steps.push({ target: "controls", title: "Your call: how many auditors?", last: true,
    text: `One check takes ${d.minutesPerCheck.toFixed(1)} min and an auditor costs ${money(d.costPerShiftPln)} a shift. Too few people and frauds wait in the queue. Too many and pay eats the savings.`,
    act: () => document.querySelector("[data-tour=controls]").classList.add("tour-on") });
  return steps;
}

function endStory() {
  document.querySelector("[data-tour=controls]").classList.remove("tour-on");
  view.envelopes.clear(); state.storyNow = 0;
  startShift();                         // the story was a preview; the shift starts from its beginning
  state.paused = false; top.setPaused(false);
}

// Start shift: the office behind the start screen was a preview; the shift starts from its beginning.
function beginShiftView(fresh = true) {
  if (fresh) startShift();
  if (params.get("tutorial") !== "0" && !state.storyDone) {
    state.storyDone = true; state.paused = true; top.setPaused(true);
    story.start(storySteps());
  } else { state.paused = false; top.setPaused(false); }
}

// Start shift on the start card: the shift runs at x10 unless the URL set a speed.
function startFromCard() {
  if (!params.has("speed")) setSpeed(START_SPEED);
  beginShiftView();
}

// Clickable office (decoration only: reads the state, never changes the simulation).
function bossTip() {
  if (!curve) return "Let's see how this shift goes.";
  const peak = peakOf(curve, state.model).n, gap = gapToOptimum(curve, state.model, state.n);
  if (gap <= 0.5) return `This is the best team for this shift: ${state.n} auditors. Keep it.`;
  if (peak > MAX_DESKS) return `We're ${money(gap)} below the best team, but that needs ${peak} auditors and we have ${MAX_DESKS} desks.`;
  return `We're ${money(gap)} below the best team. Try ${peak} auditors.`;
}

// A front-row auditor tells what their team is checking; clicking the bubble opens Under the hood.
function auditorSays(h) {
  const name = h.name ?? "Auditor", item = sim?.currentItem(teamOfDesk(h.id, state.n, d.volume));
  if (!item) return say.show(h.x, h.top, `${name}: waiting for the next envelope.`);
  say.show(h.x, h.top, `${name}: checking a ${money(item.amount * d.plnPerEur)} payment. Click to see why my model flagged it.`,
    () => openHood(entryOf(item, "checking")));
}

function busyDesk(id) { return !!sim?.currentItem(teamOfDesk(id, state.n, d.volume)); }

const COFFEE_SAYS = { walking: "Someone is already up. One at a time.", busy: "Every team is checking right now. Coffee later." };
function coffeeSays(h, result) { if (COFFEE_SAYS[result]) say.show(h.x, h.top, COFFEE_SAYS[result]); else say.hide(); }

// Things in the room say something small when clicked; each click shows the next line.
const FUN = {
  door: ["The door to the corridor. The next crew comes in here.", "Locked from the outside after 22:00. Badge only.", "Someone left an umbrella here in 2013."],
  plant: ["The only colleague who never asks for a raise.", "Watered every Monday. It is Monday somewhere.", "A ficus. It has seen a lot of fraud."],
  meeting: ["Meeting room. Booked all day for \"threshold review\".", "The chairs are more comfortable than the ones at the desks.", "Whiteboard says: PR AUC > ROC AUC. Do not erase."],
  window: ["The city never sleeps. Neither do card fraudsters.", "Lights out, lights on.", "Nice view. Nobody has time to look."],
  clock: [],
  server: [],
};
const funIndex = {};
function funLine(kind) { const list = FUN[kind]; const k = funIndex[kind] = ((funIndex[kind] ?? -1) + 1) % list.length; return list[k]; }

function clockOf(t) { const m = Math.floor((t % 86400) / 60); return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; }

function objectSays(h) {
  view.poke(h.kind);
  sfx.play(h.kind === "door" ? "door" : "pop");
  const sh = source.shifts[state.shiftIndex];
  if (h.kind === "server") {
    const seen = Math.max(0, Math.min(view.score.cursor, sh.last + 1) - sh.first);
    return say.show(h.x, h.top, `The bank's server. ${group(seen)} card payments came in this shift so far, and my model scored every one.`, null, "below");
  }
  if (h.kind === "clock") return say.show(h.x, h.top, `${clockOf(sim.now)}. The ${SHIFT_NAMES[state.shiftIndex].toLowerCase()} ends at ${clockOf(sh.end)}.`, null, "below");
  say.show(h.x, h.top, funLine(h.kind), null, h.top < 300 ? "below" : undefined);
}

let tipTimer = null;
// Hover (or a tap on touch screens): the wall charts read out the point under the mouse, the clock tells the time (decoration only).
function onHover(x, y) {
  const tip = $("tip"), clock = WALL.clock;
  let h = view.profit.hover(x, y) ?? view.score.hover(x, y);
  if (!h && Math.hypot(x - clock.cx, y - clock.cy) <= clock.r + 4 && sim) {
    const sh = source.shifts[state.shiftIndex];
    h = { x: clock.cx, y: clock.cy - clock.r, text: `${clockOf(sim.now)}, ${SHIFT_NAMES[state.shiftIndex].toLowerCase()} until ${clockOf(sh.end)}` };
  }
  clearTimeout(tipTimer);
  if (!h || story.active) { tip.hidden = true; return false; }
  tip.textContent = h.text; tip.hidden = false;
  tipTimer = setTimeout(() => { tip.hidden = true; }, 5000);   // a tap on a touch screen has no "mouse leaves"
  const w = tip.offsetWidth, W = tip.parentElement.clientWidth;
  tip.style.transform = `translate(${Math.max(6, Math.min(h.x - w / 2, W - w - 6)).toFixed(0)}px, ${(h.y - tip.offsetHeight - 8).toFixed(0)}px)`;
  return true;
}

function onOfficeClick(e) {
  if (story.active) return;
  if (view.profit.hover(e.offsetX, e.offsetY) || view.score.hover(e.offsetX, e.offsetY)) { onHover(e.offsetX, e.offsetY); return; }
  const h = view.hit(e.offsetX, e.offsetY);
  if (!h) return say.hide();
  if (h.kind === "boss") say.show(h.x, h.top, bossTip());
  else if (h.kind === "auditor") auditorSays(h);
  else if (h.kind === "coffee") { sfx.play("coffee"); coffeeSays(h, view.coffeeNow(busyDesk)); }
  else objectSays(h);
}

function boot() {
  const floor = $("floor");
  floor.addEventListener("click", onOfficeClick);
  floor.addEventListener("mousemove", (e) => { floor.classList.toggle("pointer", !!view.hit(e.offsetX, e.offsetY)); onHover(e.offsetX, e.offsetY); });
  floor.addEventListener("mouseleave", () => onHover(-1, -1));
  fit(); addEventListener("resize", fit); window.visualViewport?.addEventListener("resize", fit);
  maxN = auditorMax(source, d);
  setCrew(state.shiftIndex); state.crewShift = state.shiftIndex;   // the first crew is already seated
  view.setDesks(deskCount(Math.min(state.n, maxN)), true); // the first team is already seated
  setAuditors(state.n);
  startShift();
  top.setSpeed(state.speed); top.setPaused(false);
  drawer.set(drawerState());
  phoneGate();
  if (params.get("screen") === "office") { $("start").hidden = true; beginShiftView(false); }
  else new StartScreen($("start"), { catalog, extra: { value: valueShares, roi: roiNow() }, onStart: startFromCard, onAbout: () => drawer.open("about") });
  window.__app = { state, assumptions, roles, setAuditors, setSpeed, setModel, startShift, view, hood, ticker, story,
    get sim() { return sim; }, get curve() { return curve; }, get derived() { return d; } };
  document.body.dataset.ready = "1";
}

// A phone held upright cannot show the office readably: a short card with the main numbers, a note to
// open it on a computer and "Try anyway" (turning the phone sideways also works).
function phoneGate() {
  const gate = $("phone");
  const small = () => viewW() < 700 && viewH() > viewW();
  if (!small() || params.get("phone") === "0") return;
  const cards = startCards(catalog, { value: valueShares, roi: roiNow() });
  gate.innerHTML = `<div class="p-card"><p class="s-author">${AUTHOR} · ${AUTHOR_ROLE}</p><h1>Auditor Tycoon</h1>
    <p>A bank's fraud team, run on my fraud model and real card payments.</p>
    ${cards.map((c) => `<div class="p-num"><b>${c.big}</b><span>${c.label}</span></div>`).join("")}
    <p class="p-note">It's an office simulation, best on a computer or a tablet held sideways.</p>
    <button class="gbtn accent big" data-try="1">Try anyway</button></div>`;
  gate.hidden = false;
  gate.querySelector("[data-try]").addEventListener("click", () => { gate.hidden = true; });
}

function run() {
  let last = null;
  const tick = (ts) => { frame(Math.min(ts - (last ?? ts), 1000)); last = ts; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

boot();
if (params.get("test") === "1") window.__step = (ms = 1000 / 30, frames = 1) => { for (let k = 0; k < frames; k++) frame(ms); return view.floor.log; };
else run();
