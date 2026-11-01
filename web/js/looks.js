// Looks of the auditors: varied skin, hair and clothes, built from the character palette. Every shift
// brings a new crew (config.setCrew): who sits at desk i, their look and their Polish first name come from
// a shuffle of the look pool per crew. Decoration only. A fixed pool of looks keeps the sprite cache small
// (each look is rendered once per pose).
import { SKIN_TONES, HAIR } from "./palette.js";
import { CAST } from "./cast.js";
import { getCrew, NAMES_F, NAMES_M } from "./config.js";

export const LOOK_COUNT = 60;   // per gender: 120 looks, more than the 100 desks, so nobody in a crew shares a look
const TOPS = ["#E9A23B", "#8CC3D3", "#D8645A", "#7BAE7F", "#B48ACB", "#F1E6D6", "#5E8CC0", "#E7B9A4", "#A7B8C9", "#C9B48A",
  "#2F6F73", "#9C4F6B", "#F2D16B", "#6C5A8E", "#E58F5B", "#5B7F4F", "#C24E4E", "#3F5A8A", "#D9A5C8", "#7A6A58"];
export const SWEATERS = { lilac: TOPS[4], sky: TOPS[6] };   // also model colours in the UI kit
const PANTS = ["#3E4A6B", "#5A4A3E", "#4B5568", "#6B5B4B", "#2F3A4A", "#7A6E5E", "#2E4A3E"];
const SHOES = ["#6B4232", "#2B2B2E", "#4A3A30", "#8A2E2E", "#F1E6D6"];
const TIES = ["#2F4A7A", "#8A2E2E", "#2E4A3E", "#C9A23B"];
const ACCENTS = ["#E86A5B", "#5FA8A0", "#E9A23B", "#5E8CC0", "#B48ACB", "#3B4250"];
const SKINS = SKIN_TONES;
const HAIR_F = [HAIR.brown, HAIR.blond, HAIR.darkBrown, HAIR.lightBrown, HAIR.black, HAIR.red, HAIR.ash, HAIR.brown, "#7A2E4A", "#C9C2B8", HAIR.blond, "#D98A3A"];
const HAIR_M = [HAIR.darkBrown, HAIR.brown, HAIR.black, HAIR.lightBrown, HAIR.ash, HAIR.blond, HAIR.grey, HAIR.darkBrown, HAIR.red, "#8A8580"];
const STYLES_F = ["long", "bob", "bun", "ponytail", "curls", "short", "long", "bob"];
const STYLES_M = ["short", "quiff", "sidepart", "buzz", "receding", "curls", "short", "sidepart"];

// each attribute uses its own hash of (k, attribute), so two looks rarely share more than one or two traits
function h(k, salt) {
  let x = Math.imul(k + 1, 0x9E3779B1) ^ Math.imul(salt + 11, 0x85EBCA77);
  x = Math.imul(x ^ (x >>> 16), 0x7FEB352D); x = Math.imul(x ^ (x >>> 15), 0x846CA68B); return (x ^ (x >>> 16)) >>> 0;
}
const pick = (list, k, salt) => list[h(k, salt) % list.length];
const chance = (k, salt, p) => (h(k, salt) % 1000) / 1000 < p;

/** Generated look number k of a gender ("f" or "m"). */
export function generatedLook(k, gender = "f") {
  const f = gender === "f", g = f ? 0 : 100;
  const type = pick(["shirt", "sweater", "sweater", "shirt", "suit"], k, g + 1);
  const style = pick(f ? STYLES_F : STYLES_M, k, g + 2);
  const main = pick(TOPS, k, g + 3);
  const extras = [];
  if (chance(k, g + 4, 0.3)) extras.push("glasses");
  if (chance(k, g + 5, 0.15)) extras.push("headphones");
  if (!f && chance(k, g + 6, 0.3)) extras.push("beard");
  else if (!f && chance(k, g + 7, 0.15)) extras.push("moustache");
  if (f && chance(k, g + 8, 0.35)) extras.push("earrings");
  if (chance(k, g + 9, 0.12)) extras.push("mug");
  return {
    id: `look-${gender}${k}`,
    gender,
    skin: pick(SKINS, k, g + 10),
    hair: { style, color: style === "receding" ? pick([HAIR.grey, "#8A8580", HAIR.ash], k, g + 11) : pick(f ? HAIR_F : HAIR_M, k, g + 11) },
    outfit: { type, main, collar: "#FFF8EE", shirt: "#FFF8EE", pants: pick(PANTS, k, g + 12), shoes: pick(SHOES, k, g + 13),
      ...(type === "suit" || (!f && type === "shirt" && chance(k, g + 14, 0.35)) ? { tie: pick(TIES, k, g + 15) } : {}),
      ...(type === "sweater" && chance(k, g + 16, 0.3) ? { stripes: pick(TOPS, k, g + 17) } : {}) },
    accessories: extras,
    glassesColor: pick(["#3B4250", "#7A4E2E", "#8A2E2E", "#2F4A7A"], k, g + 18),
    headphonesColor: pick(ACCENTS, k, g + 19),
    earringColor: pick(["#E9C46A", "#C9C2B8", "#E86A5B"], k, g + 20),
    mugColor: pick(ACCENTS, k, g + 21),
    bodyWidth: (f ? 54 : 60) + (h(k, g + 22) % 5) * 3,
    bodyHeight: (f ? 134 : 144) + (h(k, g + 23) % 6) * 4,
  };
}

const POOL = { f: [...Array(LOOK_COUNT).keys()].map((k) => generatedLook(k, "f")), m: [...Array(LOOK_COUNT).keys()].map((k) => generatedLook(k, "m")) };
export const ALL_LOOKS = [...POOL.f, ...POOL.m];

// Every crew is a shuffle of all 120 looks (seeded by the crew number), so within one crew no two people
// look the same; first names are dealt per gender in a shuffled order as well.
const rosters = new Map();
function roster(c) {
  if (rosters.has(c)) return rosters.get(c);
  let seed = Math.imul(c + 1, 0x2C1B3C6D) >>> 0;
  const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const looks = shuffle([...ALL_LOOKS]), names = { f: shuffle([...NAMES_F]), m: shuffle([...NAMES_M]) }, used = { f: 0, m: 0 };
  const r = looks.map((look) => ({ look, name: names[look.gender][used[look.gender]++ % names[look.gender].length] }));
  rosters.set(c, r);
  return r;
}

/** Look of the auditor at desk i in the current crew. */
export function lookOf(i) { const r = roster(getCrew()); return r[i % r.length].look; }

/** Polish first name of the auditor at desk i in the current crew (matches the look's gender). */
export function nameOf(i) { const r = roster(getCrew()); return r[i % r.length].name; }

export const BOSS = CAST[2];
