// Mapping between auditors, simulation teams and drawn desks. Drawing only.
// The office has at most MAX_DESKS desks. Up to that, one desk is one auditor; with more auditors
// auditor a sits at desk floor(a * desks / n), so a desk stands for a small group ("1 desk = up to
// N analysts") and nobody already seated changes desk when the staff crosses MAX_DESKS.
// The simulation groups auditors into teams of K (traffic volume): team j = auditors jK .. jK+K-1.
import { MAX_DESKS } from "./config.js";

/** Most analysts behind one drawn desk. */
export function analystsPerDesk(n) { return Math.max(1, Math.ceil(n / MAX_DESKS)); }

/** Number of drawn desks for n auditors. */
export function deskCount(n) { return Math.min(n, MAX_DESKS); }

/** Drawn desk of auditor a. */
export function deskOfAuditor(a, n) { return Math.floor((a * deskCount(n)) / n); }

/** Simulation team of drawn desk `v` (the team of its first auditor). */
export function teamOfDesk(v, n, volume) { return Math.floor(Math.ceil((v * n) / deskCount(n)) / volume); }

/** Auditors of simulation team `j` (the last team may be partial). */
export function teamAuditors(j, n, volume) {
  const first = j * volume, last = Math.min(n, first + volume);
  return Array.from({ length: Math.max(0, last - first) }, (_, k) => first + k);
}

/**
 * Desks that receive the small envelopes when team j takes an alert: one per auditor of the team,
 * merged when several auditors share a desk. Pure function of (j, n, volume).
 */
export function teamDesks(j, n, volume) {
  return [...new Set(teamAuditors(j, n, volume).map((a) => deskOfAuditor(a, n)))];
}

/** Drawn desk of simulation team `j` (the desk of its first auditor). */
export function deskOfTeam(j, n, volume) { return deskOfAuditor(Math.min(n - 1, j * volume), n); }
