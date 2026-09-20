async function loadLib(path) {
  const source = await dv.io.load(path);
  if (!source) throw new Error(`Dataview library not found: ${path}`);
  return new Function("dv", `"use strict"; return (${source});`)(dv);
}

const U = await loadLib("98-System/01-script/entity_meta_utils.js");
const R = await loadLib("98-System/01-script/reference_utils.js");
const V = await loadLib("98-System/05-lib/shared/view_utils.js");
const entityViewFactory = await loadLib("98-System/05-lib/projects/entity_view_utils.js");
const M = entityViewFactory({ U, R, S: V });

const config = {
  source: '"10-Project"',
  workspaceSource: '"03-Workspace"',
  emptyMessage: "High Priority Projectはありません。",
  ...(input ?? {})
};

try {
  const workspaces = Array.from(
    dv.pages(config.workspaceSource).where(w => w.type === "workspace")
  );

  const projects = Array.from(
    dv.pages(config.source)
      .where(p => p.type === "project")
      .where(p => U.normalizePriority(p.priority) === "high")
      .where(p => U.isProjectAttentionStatus(p.status))
      .where(p => M.projectHasActiveWorkspace(p, workspaces))
  ).sort((a, b) => M.compareHighPriorityProjects(a, b, dv.compare));

  if (projects.length === 0) {
    dv.paragraph(config.emptyMessage);
  } else {
    dv.table(
      ["Project", "Workspace", "Status", "最終更新日"],
      projects.map(project => [
        project.file.link,
        project.workspace ?? "-",
        U.projectStatusLabel(project.status),
        U.formatDate(project.file.mday)
      ])
    );
  }
} catch (error) {
  dv.paragraph("⚠️ High Priority Project table の描画中にエラーが発生しました。");
  dv.paragraph("```text\n" + String(error.stack ?? error.message ?? error) + "\n```");
}
