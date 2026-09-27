async function loadExpression(path) {
  const source = await dv.io.load(path);
  if (!source) throw new Error(`Dataview library not found: ${path}`);
  return new Function(`"use strict"; return (${source});`)();
}

const I = await loadExpression("98-System/01-script/idea_meta_utils.js");
const R = await loadExpression("98-System/01-script/reference_utils.js");
const V = await loadExpression("98-System/05-lib/shared/view_utils.js");

const config = {
  mode: "active", // active | adopted | archived | all
  workspace: null,
  project: null,
  limit: null,
  emptyMessage: "対象のIdeaはありません。",
  ...(input ?? {})
};

const allowedModes = new Set(["active", "adopted", "archived", "all"]);
if (!allowedModes.has(config.mode)) {
  throw new Error(`idea_table requires mode: active | adopted | archived | all (got: ${String(config.mode)})`);
}

let pages = dv.pages('"05-Idea"')
  .where(page => page.type === "idea");

if (config.mode !== "all") {
  pages = pages.where(page => I.normalizeStatus(page.status) === config.mode);
}
if (config.workspace) {
  pages = pages.where(page => R.matchesReference(page.workspace, config.workspace));
}
if (config.project) {
  pages = pages.where(page => R.matchesReference(page.project, config.project));
}

let rows = Array.from(pages)
  .sort((a, b) => V.compareFileMtimeDesc(a, b, dv.compare));

if (Number.isInteger(config.limit) && config.limit > 0) {
  rows = rows.slice(0, config.limit);
}

if (rows.length === 0) {
  dv.paragraph(config.emptyMessage);
} else {
  dv.table(
    ["Idea", "Workspace", "Project", "Status", "最終更新日"],
    rows.map(page => [
      page.file.link,
      R.referenceLabel(page.workspace) || "—",
      R.referenceLabel(page.project) || "—",
      I.statusLabel(page.status),
      V.formatDate(page.file.mday)
    ])
  );
}
