async function loadLib(path) {
  const source = await dv.io.load(path);
  if (!source) throw new Error(`Dataview library not found: ${path}`);
  return new Function("dv", `"use strict"; return (${source});`)(dv);
}

const U = await loadLib("98-System/05-lib/ai/projection_utils.js");

const config = {
  mode: "processing", // processing | review | delivery | completed | failed | all
  emptyMessage: "AI成果物はありません。",
  ...(input ?? {}),
};

const allowedModes = new Set([
  "processing",
  "review",
  "delivery",
  "completed",
  "failed",
  "all",
]);
if (!allowedModes.has(config.mode)) {
  throw new Error(`ai_stage_table requires a supported mode (got: ${String(config.mode)})`);
}

const pages = U.projectionPages(dv);
const current = U.latestByCase(pages, dv)
  .filter(page => config.mode === "all" || U.stateOf(page) === config.mode)
  .sort((a, b) => dv.compare(b?.file?.mtime ?? null, a?.file?.mtime ?? null));

if (current.length === 0) {
  dv.paragraph(config.emptyMessage);
} else {
  dv.table(
    ["Artifact", "Current stage", "Status", "Updated"],
    current.map(page => [
      page.file.link,
      U.stateLabel(page),
      page?.ai_status ?? "▫️",
      page.file.mtime,
    ])
  );
}
