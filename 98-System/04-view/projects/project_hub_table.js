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
  mode: "active",
  emptyMessage: "対象のProjectはありません。",
  ...(input ?? {})
};

if (!["active", "archived"].includes(config.mode)) {
  throw new Error(`Unknown Project HUB mode: ${config.mode}`);
}

const workspaces = Array.from(
  dv.pages(config.workspaceSource).where(workspace => workspace.type === "workspace")
);

let projects = Array.from(
  dv.pages(config.source)
    .where(project => project.type === "project")
    .where(project => !U.isProjectHiddenStatus(project.status))
);

if (config.mode === "active") {
  projects = projects.filter(project =>
    U.isProjectListStatus(project.status) &&
    M.projectHasActiveWorkspace(project, workspaces)
  );
  projects.sort((a, b) => {
    const statusDelta = U.projectStatusOrder(a?.status) - U.projectStatusOrder(b?.status);
    if (statusDelta !== 0) return statusDelta;
    return M.compareRecent(a, b, dv.compare);
  });
} else {
  projects = projects
    .filter(project => U.isProjectArchivedStatus(project.status))
    .sort((a, b) => M.compareRecent(a, b, dv.compare));
}

if (projects.length === 0) {
  dv.paragraph(config.emptyMessage);
} else if (config.mode === "archived") {
  dv.table(
    ["Project", "Workspace", "最終更新日"],
    projects.map(project => [
      project.file.link,
      project.workspace ?? "-",
      U.formatDate(project.file.mday)
    ])
  );
} else {
  dv.table(
    ["Project", "Workspace", "Status", "Priority", "最終更新日"],
    projects.map(project => [
      project.file.link,
      project.workspace ?? "-",
      U.projectStatusLabel(project.status),
      U.priorityLabel(project.priority),
      U.formatDate(project.file.mday)
    ])
  );
}
