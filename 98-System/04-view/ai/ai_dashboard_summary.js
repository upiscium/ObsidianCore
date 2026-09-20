async function loadLib(path) {
  const source = await dv.io.load(path);
  if (!source) throw new Error(`Dataview library not found: ${path}`);
  return new Function("dv", `"use strict"; return (${source});`)(dv);
}

const U = await loadLib("98-System/05-lib/ai/projection_utils.js");
const pages = Array.from(dv.pages('"03-AI"'));
const current = U.latestByCase(pages, dv);

const counts = {
  processing: 0,
  review: 0,
  failed: 0,
  completed: 0,
};

for (const page of current) {
  const state = U.stateOf(page);
  if (Object.prototype.hasOwnProperty.call(counts, state)) counts[state] += 1;
}

dv.table(
  ["Processing", "Review", "Failed", "Completed"],
  [[counts.processing, counts.review, counts.failed, counts.completed]]
);
