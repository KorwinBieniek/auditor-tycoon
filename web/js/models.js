// Models come from the data file (models list), never from the code. models[0] is the author's model
// ("My model"); the others are comparisons. Colours are given by position from the style kit.
import { KIT } from "./ui/kit.js";

export const MODEL_COLOURS = [KIT.mustard, KIT.teal, KIT.lilac, KIT.sky];
const LINE_WIDTH = { mine: 3, other: 2.2 };

/** Display roles for the models list: labels for buttons, sentences, legends and colours. */
export function modelRoles(models) {
  return models.map((m, k) => {
    // plain names on screen ("My model", "Simple model"); the technical name stays in m.name for data people
    const mine = k === 0, tech = m.short_name ?? m.name, short = mine ? "My model" : k === 1 ? "Simple model" : tech;
    return { id: m.id, model: m, mine, short, colour: MODEL_COLOURS[k % MODEL_COLOURS.length],
      width: mine ? LINE_WIDTH.mine : LINE_WIDTH.other,
      tech,
      label: mine ? `My model (${tech})` : `${short} (${tech})`, // buttons
      inText: mine ? "my model" : `the ${short.toLowerCase()}`,   // inside a sentence
      tag: short };                                              // legends and peak tags
  });
}

/** Role by model id (throws for an unknown id, which the data check prevents). */
export function roleOf(roles, id) {
  const r = roles.find((q) => q.id === id);
  if (!r) throw new Error(`unknown model ${id}`);
  return r;
}
