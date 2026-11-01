// Explicit game assumptions. The only numbers in the game that do not come from data.json.
// They are not tuned for effect: each one has a source or a stated reason below.
// The player can move the cost assumptions with sliders (Assumptions panel); the economy
// is a pure function of data.json, the auditor count and these assumptions.

// Currency: the dataset does not state its currency. We assume EUR (European cardholders,
// September 2013) and convert to PLN at a fixed rate, without inflation adjustment.
import { FRAMING, MAX_DESKS as FRAMING_MAX_DESKS } from "./framing.js";

export const DATASET_CURRENCY = "EUR";
export const CURRENCY = "PLN";

// Employer cost on top of gross salary (Polish employment contract): pension 9.76%
// + disability 6.5% + accident 1.67% + Labour Fund 2.45% + FGSP 0.10% = 20.48%.
export const EMPLOYER_COST_RATE = 0.2048;

// About 21 working days per month, one 8 h shift per day per auditor.
export const SHIFTS_PER_MONTH = 21;

// Seconds in one shift (an 8 h window of the data).
export const SHIFT_SECONDS = 8 * 3600;

// Productive time: 75% of 8 h (breaks, meetings, documentation), i.e. 360 min.
// An assumption: breaks, meetings and notes take a quarter of the shift.
export const PRODUCTIVE_SHARE = 0.75;

// Traffic volume (what-if): each dataset transaction represents K transactions. The game runs at
// x20 only (DEFAULT_ASSUMPTIONS.volume, no switch in the UI); the other values stay for the
// determinism test and the analysis scripts.
export const VOLUMES = [1, 10, 20, 40];

/**
 * Small alerts skip the auditors (business process, the same for every model and for random checks):
 * - AMOUNT_THRESHOLD_PLN: alerts below it go to automatic customer confirmation (SMS or push "was this
 *   you?"); auditors see only alerts at or above it. 100 PLN was the best of the limits compared in
 *   scripts/analysis_amount_threshold (about +3% net with the VAE).
 * - SMS_COST_PLN: ASSUMPTION, 0.10 PLN per automatic confirmation of a legit alert (one SMS or push).
 * A fraud on the automatic path counts as a full loss (the game assumes the fraudster confirms).
 */
export const AMOUNT_THRESHOLD_PLN = 100;
// ...unless the score is at least this many times the model's threshold: then an auditor checks it anyway.
export const HIGH_RISK_FACTOR = 10;
export const SMS_COST_PLN = 0.1;
// Scoreboard: a fraud at or above this amount is a "big fraud" (its own line and a reaction when missed).
export const BIG_FRAUD_PLN = 1000;

/**
 * Default assumptions. Every field is a slider; the dots on a slider are real data points (checked
 * 1 Nov 2026, see ASSUMPTION_RANGES[...].points), the default sits among them.
 * - monthlyGrossPln: 8,500 PLN gross, between job offers for fraud and AML/KYC analysts (6,200 to 9,000)
 *   and the compliance junior band (7,500 to 10,500). It never changes the best team, only the money.
 * - minutesPerCheck: 5.6 min per manual review (MRC Global Fraud Survey via Ravelin); CyberSource:
 *   4 min at large merchants, 10 min at small ones. Range 2 to 11.
 * - falseAlarmCostPln: ASSUMPTION, 15 PLN per checked legit alert (a temporary block and sometimes a
 *   call). A call-centre contact in Poland is estimated at 22 to 35 PLN; many false alarms never reach
 *   a call. Analyst time is in wages. Range 0 to 35.
 * - plnPerEur: the NBP mid rate, fetched live when the page opens (fallback 4.40).
 * - volume: x20, a WHAT-IF bank size: every dataset transaction stands for 20. Chosen so that the best
 *   team stays within the 100 desks for every slider position (tests/models.test.mjs checks it).
 */
export const DEFAULT_ASSUMPTIONS = Object.freeze({
  monthlyGrossPln: 8500,
  minutesPerCheck: 5.6,
  falseAlarmCostPln: 15,
  plnPerEur: 4.40,
  volume: 20,
});

const spaced = (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");

/** Slider ranges; points are sourced data shown as dots on the slider (hover shows the source). */
export const ASSUMPTION_RANGES = {
  monthlyGrossPln: { min: 6000, max: 20000, step: 100, label: "Analyst pay", unit: "PLN gross / month",
    note: "The employer pays 20.48% on top (ZUS). Pay changes the money, not the best team.",
    format: (v) => `${spaced(v)} PLN`,
    points: [
      { v: 7000, label: "AML/KYC analyst offer, Warsaw: 6 500 to 7 500 PLN", url: "https://rocketjobs.pl/oferta/harvey-nash-technology-aml-kyc-analyst-warszawa-finanse-bpo-ssc" },
      { v: 7600, label: "Fraud prevention consultant offer, Kraków: 6 200 to 9 000 PLN", url: "https://rocketjobs.pl/oferta/teleperformance-polska-fraud-prevention-consultant---english-speaking-24-7-krakow-praca-biurowa-przetwarzanie-danych" },
      { v: 7900, label: "Median pay in Poland, GUS, Dec 2025: 7 907 PLN", url: "https://www.podatki.biz/artykuly/gus-mediana-wynagrodzen-w-grudniu-2025-r-to-790720-zl_16_62337.htm" },
      { v: 9000, label: "Junior compliance specialist: 7 500 to 10 500 PLN", url: "https://freenance.io/zarobki/zarobki-w-finansach-2026" },
      { v: 17000, label: "Compliance specialist, 5+ years: 14 000 to 20 000 PLN", url: "https://freenance.io/zarobki/zarobki-w-finansach-2026" },
    ] },
  minutesPerCheck: { min: 2, max: 11, step: 0.1, label: "Time per check", unit: "minutes",
    note: "An auditor works 6 of the 8 hours (breaks, notes). Changing it restarts the shift.",
    format: (v) => `${v.toFixed(1)} min`,
    points: [
      { v: 4, label: "Large merchants: 4 min per review (CyberSource benchmark)", url: "https://www.fraudpractice.com/post/how-manual-review-metrics-vary-across-small-and-large-merchants" },
      { v: 5.6, label: "Average: 5.6 min per review (MRC Global Fraud Survey)", url: "https://ravelin.com/blog/are-you-spending-too-much-time-on-manual-review" },
      { v: 10, label: "Small merchants: 10 min per review (CyberSource benchmark)", url: "https://www.fraudpractice.com/post/how-manual-review-metrics-vary-across-small-and-large-merchants" },
    ] },
  falseAlarmCostPln: { min: 0, max: 35, step: 1, label: "Cost of a false alarm", unit: "PLN per fine payment checked",
    note: "Our guess: a short card block, sometimes a call. The auditor's time is already in pay.",
    format: (v) => `${v} PLN`,
    points: [
      { v: 0, label: "The customer never notices", url: "" },
      { v: 28, label: "One call-centre contact in Poland: about 22 to 35 PLN (estimate)", url: "https://ainora.lt/blog/european-call-center-statistics-2026" },
    ] },
  plnPerEur: { min: 4.2, max: 4.6, step: 0.01, label: "EUR to PLN", unit: "",
    note: "The data has no currency; amounts are read as euro.",
    format: (v) => v.toFixed(2),
    points: [] },
};

/** Numbers derived from the assumptions (pure). */
export function derive(a = DEFAULT_ASSUMPTIONS) {
  const checksPerShift = Math.floor((SHIFT_SECONDS / 60) * PRODUCTIVE_SHARE / a.minutesPerCheck);
  return {
    ...a,
    costPerShiftPln: (a.monthlyGrossPln * (1 + EMPLOYER_COST_RATE)) / SHIFTS_PER_MONTH,
    checksPerShift,
    secondsPerCheck: SHIFT_SECONDS / checksPerShift, // one check, in shift seconds
    // the process limits are set in PLN; the data is in EUR, so they move with the exchange rate
    autoBelowEur: AMOUNT_THRESHOLD_PLN / a.plnPerEur,
    bigFraudEur: BIG_FRAUD_PLN / a.plnPerEur,
  };
}

/** Everything the shift simulation needs from the assumptions (ShiftSim options). */
export function simOptions(d) {
  return { secondsPerCheck: d.secondsPerCheck, volume: d.volume, autoBelow: d.autoBelowEur, bigFrom: d.bigFraudEur, highRiskFactor: HIGH_RISK_FACTOR };
}

// Office layout
export const MAX_DESKS = FRAMING_MAX_DESKS; // 100, framing.js
export const ROW_CAPACITY = FRAMING.capacity; // sum 100 (js/framing.js)
// Speed x1: one shift minute per real second, a whole shift lasts 8 min.
export const SIM_SECONDS_PER_REAL_SECOND = 60;
export const SPEEDS = [1, 3, 10];   // "Skip to results" in Settings replaces a very fast speed
export const START_SPEED = 3;    // speed after Start shift: a shift lasts about 2 min 40 s, slow enough to follow (a URL speed wins)
// Fixed simulation step in shift seconds (independent of the frame rate).
export const SIM_STEP_SECONDS = 1;
// Auditor range: at least the number of desks, and at least 1.5x the staff needed to check
// every alert of the busiest shift, so the optimum is always reachable (see economy.auditorMax).
export const AUDITOR_RANGE_MARGIN = 1.5;

// Starting staff on the first shift: one full team at the default x20 volume.
export const DEFAULT_AUDITORS = 20;

/**
 * NBP card fraud report, quoted verbatim (checked in the primary PDF). The dataset share of
 * frauds (0.17% of transactions) is compared with the NBP share of the NUMBER of card transactions,
 * so the comparison is count to count.
 */
export const NBP_SOURCE = Object.freeze({
  text: "NBP, Informacja o transakcjach oszukańczych 2025 Q3: 79,803 fraudulent card transactions reported by issuers, "
    + "0.003% of the number and 0.006% of the value of all card transactions",
  cases: 79803,
  shareOfCount: 0.00003,
  shareOfValue: 0.00006,
});

// Public repository link for the start screen. Unknown yet: null shows a disabled link.
export const GITHUB_URL = null;

// About card: the author, and the source of the check-budget mechanic (URL checked Nov 2026).
export const AUTHOR = "Jan Król";
export const AUTHOR_ROLE = "junior ML engineer";
export const HANDBOOK = {
  title: "Fraud Detection Handbook",
  authors: "Le Borgne et al., Machine Learning Group, ULB",
  url: "https://fraud-detection-handbook.github.io/fraud-detection-handbook/Chapter_4_PerformanceMetrics/TopKBased.html",
};

// Polish first names for the crews. Every shift brings a new crew: names and looks are drawn per shift
// (decoration only, looks.js). FRONT_NAMES keeps the number of named front-row desks.
export const NAMES_F = ["Ola", "Zosia", "Ewa", "Kasia", "Magda", "Ania", "Agnieszka", "Monika", "Joanna", "Natalia",
  "Karolina", "Ewelina", "Justyna", "Dominika", "Weronika", "Iza", "Marta", "Basia", "Gosia", "Paulina"];
export const NAMES_M = ["Kuba", "Bartek", "Tomek", "Piotr", "Michał", "Paweł", "Marcin", "Krzysztof", "Łukasz", "Wojtek",
  "Grzesiek", "Adam", "Mateusz", "Szymon", "Kamil", "Rafał", "Filip", "Darek", "Jacek", "Maciek"];
export const FRONT_NAMES = ["", "", "", "", "", ""];   // six named front-row desks (names come from the crew)
let crewIndex = 0;
/** The crew on the floor (one per shift); changes names and looks only. */
export function setCrew(k) { crewIndex = k; }
export function getCrew() { return crewIndex; }
