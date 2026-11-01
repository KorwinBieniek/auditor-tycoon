// Seeded random number generator for animation only (mulberry32).
// Never used by the simulation or the economy.
export function createPrng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    pick: (weights) => pickWeighted(weights, next()),
  };
}

// weights: object {name: weight}; returns a name
function pickWeighted(weights, u) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let x = u * total;
  for (const [name, w] of entries) { x -= w; if (x <= 0) return name; }
  return entries[entries.length - 1][0];
}
