// The game side of the data contract (schema/auditor-data.v1.schema.json). The Python validator
// (auditor_model/contract.py) is the full check; this one guards what the game relies on, so a wrong
// file stops with a readable message on screen instead of a broken office.
export const DATA_FORMAT = "auditor-data";
export const SUPPORTED_VERSIONS = [1];
const RESERVED_IDS = ["random"];           // the random-checks curve uses this key
const COLUMNS = ["id", "time", "amount", "is_fraud"];

export function checkData(doc) {
  if (!doc || typeof doc !== "object") return ["the data file is not a JSON object"];
  if (doc.format !== DATA_FORMAT) return [`format is ${JSON.stringify(doc.format)}, expected "${DATA_FORMAT}"`];
  if (!SUPPORTED_VERSIONS.includes(doc.schema_version)) {
    return [`unknown schema version ${JSON.stringify(doc.schema_version)}: this game reads version ${SUPPORTED_VERSIONS.join(", ")}`];
  }
  const problems = [];
  const tx = doc.transactions, models = doc.models;
  if (!Array.isArray(models) || !models.length) return ["models list is missing or empty (the first model is 'My model')"];
  if (!tx || !tx.scores) return ["transactions or transactions.scores is missing"];
  const rows = tx.id?.length ?? 0;
  for (const key of COLUMNS) if (!Array.isArray(tx[key]) || tx[key].length !== rows) problems.push(`transactions.${key} is missing or has the wrong length`);
  models.forEach((m, k) => {
    const col = tx.scores[m.id];
    if (RESERVED_IDS.includes(m.id)) problems.push(`model id "${m.id}" is reserved`);
    if (!col) problems.push(`${k === 0 ? "first model" : "model"} "${m.id}" has no scores in transactions.scores`);
    else if (col.length !== rows) problems.push(`transactions.scores.${m.id} has ${col.length} values, transactions.id has ${rows}`);
    else if (col.some((v) => typeof v !== "number" || !Number.isFinite(v))) problems.push(`transactions.scores.${m.id} has values that are not numbers`);
    if (!Number.isFinite(m.threshold)) problems.push(`model "${m.id}" has no threshold`);
  });
  if (!doc.meta?.game_day?.shifts?.length) problems.push("meta.game_day.shifts is missing");
  return problems;
}
