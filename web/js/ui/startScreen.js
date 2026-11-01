// Start screen over the working office: one sentence, three cards from the data file
// (my model = the first model), Start shift.
import { GITHUB_URL, AUTHOR, AUTHOR_ROLE } from "../config.js";
import { icon } from "./icons.js";
import { button, onData } from "./dom.js";
import { startCards } from "./texts.js";

// Every card: the big number, one line under it and a small note.
const cardHtml = (c) => `<div class="s-num ${c.lead ? "lead" : ""}"><b>${c.big}</b><span>${c.label}</span>${c.small ? `<small>${c.small}</small>` : ""}</div>`;

export class StartScreen {
  constructor(root, { catalog, extra, onStart, onAbout }) {
    root.className = "m-start";
    const cards = startCards(catalog, extra).map(cardHtml).join("");
    const github = GITHUB_URL ? `<a href="${GITHUB_URL}" target="_blank" rel="noopener">${icon("code", 14)}GitHub</a>` : "";
    root.innerHTML = `<div class="s-card"><p class="s-author">${AUTHOR} · ${AUTHOR_ROLE}</p><div class="s-logo"><span class="m-dot big"></span>Auditor Tycoon</div>
      <p class="s-line">I built a model that spots unusual card payments, so a bank checks 1% of them instead of all. Here you run that bank's fraud team: hire just enough people to stop the most money.</p>
      <div class="s-nums">${cards}</div>${button("Start shift", "accent big", "", 'data-start="1"')}</div>
      <div class="s-links"><a data-about="1">${icon("info", 14)}About</a>${github}</div>`;
    this.root = root;
    onData(root, "start", () => { this.hide(); onStart(); });
    onData(root, "about", () => onAbout());
  }
  hide() { this.root.hidden = true; }
}
