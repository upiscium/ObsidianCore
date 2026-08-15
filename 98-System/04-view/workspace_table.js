// 98-System/dataview/views/workspace-table/view.js

async function loadLib(path) {
  const source = await dv.io.load(path);
  if (!source) throw new Error(`Dataview library not found: ${path}`);
  return new Function("dv", `"use strict"; return (${source});`)(dv);
}

const U = await loadLib("98-System/01-script/entity_meta_utils.js");
const R = await loadLib("98-System/01-script/reference_utils.js");

const config = {
  source: '"03-Workspace"',
  projectSource: '"10-Project"',
  emptyMessage: "Workspaceはまだありません。",
  ...(input ?? {})
};

function isSameWorkspace(project, workspace) {
  return R.matchesReference(project.workspace, workspace.file.path);
}

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
      projectCount: projects.filter(p => isSameWorkspace(p, w)).length
    }))
    .sort((a, b) => {
      const lifecycleDelta = U.workspaceLifecycleOrder(a.workspace.lifecycle) - U.workspaceLifecycleOrder(b.workspace.lifecycle);
      if (lifecycleDelta !== 0) return lifecycleDelta;
      return dv.compare(b.workspace.file.mtime, a.workspace.file.mtime);
    });

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
