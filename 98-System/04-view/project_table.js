async function loadLib(path) {
  const source = await dv.io.load(path);
  if (!source) throw new Error(`Dataview library not found: ${path}`);
  return new Function("dv", `"use strict"; return (${source});`)(dv);
}

const U = await loadLib("98-System/01-script/entity_meta_utils.js");
const R = await loadLib("98-System/01-script/reference_utils.js");
const current = dv.current();

const config = {
  workspaceName: current.file.name,
  workspacePath: current.file.path,
  workspaceTitle: current.title ?? current.file.name,
  mode: "active",
  emptyMessage: "対象のProjectはありません。",
  ...(input ?? {})
};

function relationMatches(value) {
  return R.matchesReference(value, config.workspacePath);
}

let projects = dv.pages('"10-Project"')
  .where(p => p.type === "project")
  .where(p => relationMatches(p.workspace))
  .where(p => !U.isHiddenStatus(p.status));

if (config.mode === "active") projects = projects.where(p => U.isActiveStatus(p.status));
if (config.mode === "archived") projects = projects.where(p => U.isArchivedStatus(p.status));

const rows = Array.from(projects)
  .sort((a, b) => dv.compare(b.file.mtime, a.file.mtime));

if (rows.length === 0) {
  dv.paragraph(config.emptyMessage);
} else if (config.mode === "archived") {
  dv.table(["Project", "最終更新日"], rows.map(p => [p.file.link, U.formatDate(p.file.mday)]));
} else {
  dv.table(
    ["Project", "ステータス", "優先度", "最終更新日"],
    rows.map(p => [
      p.file.link,
      U.statusLabel(p.status),
      U.priorityLabel(p.priority),
      U.formatDate(p.file.mday)
    ])
  );
}
