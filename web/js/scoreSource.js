// One score source for the game, over a data file in the contract format (schema/auditor-data.v1.schema.json).
// Today a static data.json; later the same document from the Render API. The rest of the game does not change.
import { checkData } from "./dataContract.js";

/** Builds the source from a data document (works in the browser and in node). Throws DataError. */
export function createScoreSource(doc) {
  const problems = checkData(doc);
  if (problems.length) throw new DataError(problems);
  const { meta, models, transactions } = doc;
  const { scores, ...columns } = transactions;
  const byId = new Map(models.map((m) => [m.id, m]));
  return {
    meta,
    models,
    modelIds: models.map((m) => m.id),
    explanations: doc.explanations ?? null,
    columns,
    shifts: meta.game_day.shifts.map((s) => withRowRange(s, columns.time)),
    rowCount: columns.id.length,
    threshold: (model) => byId.get(model).threshold,
    scores: (model) => scores[model],
    score: (model, row) => scores[model][row],
  };
}

/** A data file the game cannot use; `problems` are readable sentences. */
export class DataError extends Error {
  constructor(problems) { super(`The data file is not valid:\n${problems.join("\n")}`); this.problems = problems; }
}

/** Loads the data file with fetch (browser). */
export async function fetchScoreSource(url = "data/data.json") {
  const response = await fetch(url);
  if (!response.ok) throw new DataError([`Could not load ${url}: ${response.status}`]);
  let doc;
  try { doc = await response.json(); } catch (e) { throw new DataError([`${url} is not valid JSON (${e.message})`]); }
  return createScoreSource(doc);
}

// Rows are sorted by time, so a shift is a contiguous range [first, last).
function withRowRange(shift, times) {
  const first = lowerBound(times, shift.start);
  const last = lowerBound(times, shift.end);
  return { ...shift, first, last };
}

function lowerBound(arr, value) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < value) lo = mid + 1; else hi = mid;
  }
  return lo;
}
