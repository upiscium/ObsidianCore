const config = {
  sources: [],
  emptyMessage: "AI成果物はありません。",
  ...(input ?? {}),
};

if (!Array.isArray(config.sources) || config.sources.some(value => typeof value !== "string")) {
  throw new Error("ai_stage_table requires sources: string[]");
}

const stageLabels = new Map([
  ["00-Input", "Input"],
  ["10-Context", "Context"],
  ["20-Generation", "Generation"],
  ["30-Validation", "Validation"],
  ["40-Evaluation", "Evaluation"],
  ["50-Review", "Review"],
  ["60-Execution", "Execution"],
  ["70-Transport", "Transport"],
  ["80-Completed", "Completed"],
  ["90-Failed", "Failed"],
]);

function pagesBelow(path) {
  return Array.from(dv.pages(`"${path}"`));
}

function stageFor(page) {
  const parts = String(page?.file?.path ?? "").split("/");
  const folder = parts.length >= 2 ? parts[1] : "";
  return stageLabels.get(folder) ?? folder ?? "▫️";
}

function displayStatus(page) {
  const value = page?.status ?? page?.ai_status ?? page?.state ?? null;
  return value === null || value === undefined || String(value).trim() === ""
    ? "▫️"
    : String(value);
}

const seen = new Map();
for (const source of config.sources) {
  for (const page of pagesBelow(source)) {
    if (page?.file?.path) seen.set(page.file.path, page);
  }
}

const rows = Array.from(seen.values()).sort((a, b) =>
  dv.compare(b?.file?.mtime ?? null, a?.file?.mtime ?? null)
);

if (rows.length === 0) {
  dv.paragraph(config.emptyMessage);
} else {
  dv.table(
    ["Artifact", "Stage", "Status", "Updated"],
    rows.map(page => [
      page.file.link,
      stageFor(page),
      displayStatus(page),
      page.file.mtime,
    ])
  );
}
