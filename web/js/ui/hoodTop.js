// Under the hood, first view: the 5 features with the biggest error as bars. Per feature, the input
// and what the model rebuilt share one zero line (scaled per row, since features have different
// units), then the error bar and its share of the whole error.
const LAYOUT = { w: 520, row: 34, head: 16, name: 44, pair: 230, gap: 14, share: 44 };
const BAR = { h: 9, gap: 3, min: 1 };

export function topFeaturesSvg(top) {
  const L = LAYOUT, h = L.head + top.length * L.row, errX = L.name + L.pair + L.gap, errW = L.w - errX - L.share;
  const maxErr = Math.max(...top.map((f) => f.err));
  const rows = top.map((f, k) => rowSvg(f, L.head + k * L.row, { errX, errW, maxErr })).join("");
  return `<svg class="h-topbars" viewBox="0 0 ${L.w} ${h}">
    <text x="${L.name}" y="10" class="t-head">input <tspan class="t-in">&#9632;</tspan> and rebuilt <tspan class="t-rec">&#9632;</tspan></text>
    <text x="${errX}" y="10" class="t-head">error</text><text x="${L.w}" y="10" class="t-head" text-anchor="end">share</text>${rows}</svg>`;
}

function rowSvg(f, y, { errX, errW, maxErr }) {
  const L = LAYOUT, mid = L.name + L.pair / 2, scale = Math.max(Math.abs(f.x), Math.abs(f.rec), 1e-9);
  const ew = Math.max(BAR.min, (f.err / maxErr) * errW), cy = y + L.row / 2;
  return `<text x="0" y="${cy + 4}" class="t-name">${f.name}</text>
    <line x1="${mid}" x2="${mid}" y1="${y + 4}" y2="${y + L.row - 4}" class="t-zero"/>
    ${pairBar(f.x, scale, mid, cy - BAR.h - BAR.gap / 2, "t-in")}${pairBar(f.rec, scale, mid, cy + BAR.gap / 2, "t-rec")}
    <text x="${mid - L.pair / 2 + 2}" y="${cy - 3}" class="t-val">${fmt(f.x)}</text>
    <text x="${mid - L.pair / 2 + 2}" y="${cy + 10}" class="t-val">${fmt(f.rec)}</text>
    <rect x="${errX}" y="${cy - BAR.h / 2}" width="${ew.toFixed(1)}" height="${BAR.h}" rx="2" class="t-err"/>
    <text x="${L.w}" y="${cy + 4}" class="t-share" text-anchor="end">${(100 * f.share).toFixed(0)}%</text>`;
}

// A bar from the zero line to the value; values are scaled per row (half the pair width = |max|).
function pairBar(v, scale, mid, y, cls) {
  const half = LAYOUT.pair / 2 - 36, w = Math.max(BAR.min, (Math.abs(v) / scale) * half), x = v >= 0 ? mid : mid - w;
  return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${BAR.h}" rx="2" class="${cls}"/>`;
}

/** One plain-English sentence about the biggest error, computed from the numbers. */
export function topSentence(top) {
  const f = top[0], all = top.reduce((s, t) => s + t.share, 0);
  return `The model expected ${f.name} to be about ${fmt(f.rec)}, but it was ${fmt(f.x)}. That one feature gives
    ${(100 * f.share).toFixed(0)}% of the error, and these ${top.length} features give ${(100 * all).toFixed(0)}%. The bigger
    the gap between input and rebuilt, the less this transaction looks like the normal ones the model learned.`;
}

export const fmt = (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2));
