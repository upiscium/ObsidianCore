// 98-System/dataview/views/workspace-table/view.js

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
  source: '"03-Workspace"',
  projectSource: '"10-Project"',
  emptyMessage: "Workspaceはまだありません。",
  ...(input ?? {})
};

const PROJECT_COUNT_STATUSES = ["running", "planning", "stopped", "stable"];

function createProjectStatusCounts(counts) {
  const container = document.createElement("div");
  container.classList.add("workspace-project-counts");

  for (const status of PROJECT_COUNT_STATUSES) {
    const count = Number(counts?.[status] ?? 0);
    const item = document.createElement("span");
    item.classList.add("workspace-project-count");
    item.dataset.projectStatus = status;
    item.dataset.empty = count === 0 ? "true" : "false";
    item.setAttribute("aria-label", `${U.projectStatusLabel(status)}: ${count}件`);

    const label = document.createElement("span");
    label.classList.add("workspace-project-count-label");
    label.textContent = U.projectStatusLabel(status);

    const value = document.createElement("strong");
    value.classList.add("workspace-project-count-value");
    value.textContent = String(count);

    item.append(label, value);
    container.appendChild(item);
  }

  return container;
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
      projectCounts: M.projectStatusCountsForWorkspace(projects, w)
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
          createProjectStatusCounts(row.projectCounts),
          U.formatDate(w.file.mday)
        ];
      })
    );
  }
} catch (error) {
  dv.paragraph("⚠️ Workspace table の描画中にエラーが発生しました。");
  dv.paragraph("```text\n" + String(error.stack ?? error.message ?? error) + "\n```");
}
