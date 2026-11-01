// One icon style: 20x20 box, 2px round stroke in currentColor, no fill. Drawn from code.
const PATHS = {
  minus: "M5 10h10",
  plus: "M5 10h10M10 5v10",
  target: "M10 3a7 7 0 1 0 0.01 0M10 7a3 3 0 1 0 0.01 0M10 1.5v3M10 15.5v3M1.5 10h3M15.5 10h3",
  pause: "M7.5 5v10M12.5 5v10",
  play: "M7 4.5l8 5.5-8 5.5z",
  sliders: "M4 6h7M14 6h2M4 14h2M9 14h7M12.5 4v4M7.5 12v4",
  envelope: "M3.5 5.5h13v9h-13zM3.5 5.5l6.5 5 6.5-5",
  code: "M7 6l-4 4 4 4M13 6l4 4-4 4",
  info: "M10 3a7 7 0 1 0 0.01 0M10 9v5M10 6.5v0.01",
  close: "M5 5l10 10M15 5L5 15",
  soundOn: "M3.5 8h3l4-3.5v11L6.5 12h-3zM13.5 7.5a3.5 3.5 0 0 1 0 5M15.5 5.5a6.5 6.5 0 0 1 0 9",
  soundOff: "M3.5 8h3l4-3.5v11L6.5 12h-3zM13.5 8l4 4M17.5 8l-4 4",
};

/** Inline SVG markup for an icon. */
export function icon(name, size = 18) {
  return `<svg class="icon" viewBox="0 0 20 20" width="${size}" height="${size}" aria-hidden="true">`
    + `<path d="${PATHS[name]}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
