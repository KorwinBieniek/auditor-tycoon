// Small DOM helpers shared by the HUD modules.
import { icon } from "./icons.js";

/** A styled game button (never the default HTML look). */
export const button = (label, cls = "", ic = "", attrs = "") =>
  `<button class="gbtn ${cls}" ${attrs}>${ic ? icon(ic) : ""}${label ? `<span>${label}</span>` : ""}</button>`;

export function html(parent, markup) {
  parent.innerHTML = markup;
  return parent;
}

/** Calls handler(value, element) for clicks on elements with data-<name> inside root. */
export function onData(root, name, handler) {
  root.addEventListener("click", (e) => {
    const t = e.target.closest(`[data-${name}]`);
    if (t && root.contains(t) && !t.disabled) handler(t.dataset[name], t, e);
  });
}

/** Marks the segment button whose data-<name> equals value. */
export function setSegment(root, name, value) {
  root.querySelectorAll(`[data-${name}]`).forEach((b) => b.classList.toggle("on", b.dataset[name] === String(value)));
}
