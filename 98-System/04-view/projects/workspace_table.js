// 98-System/dataview/views/workspace-table/view.js

async function loadLib(path) {
  const source = await dv.io.load(path);
  if (!source) throw new Error(`Dataview library not found: ${path}`);
  return new Function("dv", `"use strict"; return (${source});`)(dv);
}

const U = await loadLib("98-System/01-script/entity_meta_utils.js");
const R = await loadLib("98-System/01-script/reference_utils.js");
const entityViewFactory = await loadLib("98-System/05-lib/projects/entity_view_utils.js");
const M = entityViewFactory({ U, R });

const config = {
  source: '"03-Workspace"',
  projectSource: '"10-Project"',
  emptyMessage: "Workspaceはまだありません。",
  ...(input ?? {})
};

try {
  const workspaces = Array.from(
    dv.pages(config.source)
      .where(w => w.type === "workspace")
      .where(w => U.isWorkspaceVisibleLifecycle(w.lifecycle))
  );

  const projects = Array.from(
    dv.pages(config.projectSource)
      .where(p => p.type === "project")
  );

  const rows = workspaces
    .map(w => ({
      workspace: w,
      projectCount: M.projectCountForWorkspace(projects, w)
    }))
    .sort((a, b) => M.compareWorkspaceRows(a.workspace, b.workspace, dv.compare));

  if (rows.length === 0) {
    dv.paragraph(config.emptyMessage);
  } else {
    dv.table(
      ["Workspace", "ライフサイクル", "Project数", "最終更新日"],
      rows.map(row => {
        const w = row.workspace;
        return [
          w.file.link,
          U.workspaceLifecycleLabel(w.lifecycle),
          row.projectCount,
          U.formatDate(w.file.mday)
        ];
      })
    );
  }
} catch (error) {
  dv.paragraph("⚠️ Workspace table の描画中にエラーが発生しました。");
  dv.paragraph("```text\n" + String(error.stack ?? error.message ?? error) + "\n```");
}
