// Helpers for creating SVG elements.
// All game graphics are drawn from code, without image files.

const SVG_NS = "http://www.w3.org/2000/svg";

// Creates an SVG element with the given tag and attributes and (optionally) appends it to a parent.
export function el(tag, attrs = {}, parent = null) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, value);
  }
  if (parent) parent.appendChild(node);
  return node;
}

// Darkens (amount < 0) or lightens (amount > 0) a #RRGGBB colour.
export function shade(hex, amount) {
  const num = parseInt(hex.slice(1), 16);
  const channels = [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  const mixed = channels.map((c) => {
    const target = amount < 0 ? 0 : 255;
    return Math.round(c + (target - c) * Math.abs(amount));
  });
  return "#" + mixed.map((c) => c.toString(16).padStart(2, "0")).join("");
}

// Turns a list of points [[x, y], ...] into an SVG path of line segments.
export function polyline(points) {
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
}

// Unique id (needed e.g. for clipPath, because ids in a document must differ).
let counter = 0;
export function uniqueId(prefix) {
  counter += 1;
  return `${prefix}-${counter}`;
}
