// Plain ID badge on a lanyard (one colour for everybody), drawn on the torso under the arms.
import { el } from "../svg.js";
import { KIT } from "../ui/kit.js";

export function addBadge(character, look) {
  const upper = character.group.querySelector(".upper"), acc = upper.querySelector(".accessories");
  const { R, neckY } = character.geometry, g = el("g", { class: "badge" });
  const bx = R * 0.2, by = neckY + 26;
  el("path", { d: `M ${-R * 0.55} ${neckY - 4} L ${bx} ${by} L ${R * 0.75} ${neckY - 6}`, fill: "none", stroke: KIT.navy, "stroke-width": 3.2, "stroke-linejoin": "round" }, g);
  el("rect", { x: bx - 8, y: by, width: 16, height: 21, rx: 3, fill: "#FFFFFF", stroke: "#D9CFC2", "stroke-width": 1 }, g);
  el("rect", { x: bx - 8, y: by, width: 16, height: 6, rx: 2, fill: KIT.navy }, g);
  el("circle", { cx: bx, cy: by + 12, r: 3, fill: look.skin }, g);
  upper.insertBefore(g, acc.nextSibling);
}
