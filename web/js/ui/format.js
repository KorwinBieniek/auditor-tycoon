// Number and time formatting for the UI (English, amounts in PLN).
import { CURRENCY } from "../config.js";

/** Thousands grouped with a space, as written in Poland ("227 846"); a non-breaking space keeps a number on one line. */
export const group = (v) => String(Math.abs(Math.round(v))).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0").replace(/^/, v < 0 && Math.round(v) !== 0 ? "-" : "");
export const money = (v) => `${group(v)}\u00A0${CURRENCY}`;
export const count = (v) => group(v);

/** 1234567 -> "1.2 million PLN" for the annual line. */
export function bigMoney(v) {
  return Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)} million ${CURRENCY}` : money(v);
}

/** Dataset time is seconds since the first transaction, not a wall clock. */
export function datasetTime(t) {
  const day = Math.floor(t / 86400) + 1, s = t % 86400;
  const hh = String(Math.floor(s / 3600)).padStart(2, "0"), mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  return `day ${day}, ${hh}:${mm}`;
}

/** 12345 -> "12k", 1234567 -> "1.2M" (PLN). */
export function compact(v) {
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${Math.round(v / 1e3)}k`;
  return `${Math.round(v)}`;
}

/** 0.8096 -> "81%"; digits after the point optional. */
export const percent = (share, digits = 0) => `${(100 * share).toFixed(digits)}%`;

/** AUC with 2 decimals. */
export const auc = (v) => v.toFixed(2);

/** "+1,234 PLN" for the float above a desk. */
export const plusMoney = (v) => `+${money(v)}`;
