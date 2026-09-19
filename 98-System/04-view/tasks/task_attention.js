async function loadExpression(path) {
  const source = await dv.io.load(path);
  if (!source) throw new Error(`Dataview library not found: ${path}`);
  return new Function(`"use strict"; return (${source});`)();
}

const S = await loadExpression("98-System/01-script/task_schedule_utils.js");
const attentionFactory = await loadExpression("98-System/01-script/task_attention_utils.js");
const A = attentionFactory(S);
const T = await loadExpression("98-System/01-script/task_meta_utils.js");
const E = await loadExpression("98-System/01-script/entity_meta_utils.js");
const G = await loadExpression("98-System/01-script/reference_utils.js");
const runtimeFactory = await loadExpression("98-System/01-script/reference_runtime_utils.js");
const taskFactory = await loadExpression("98-System/01-script/task_reference_utils.js");
const X = runtimeFactory(G);
const R = taskFactory(G, X);
const visibilityFactory = await loadExpression("98-System/01-script/workspace_task_visibility_utils.js");
const V = visibilityFactory(G, E);

const config = {
  thresholds: {},
  ...(input ?? {})
};
const thresholds = A.thresholds(config.thresholds);
const todayValue = dv.date("today").startOf("day");
const today = todayValue.toISODate ? todayValue.toISODate() : String(todayValue).slice(0, 10);

const tasks = Array.from(dv.pages('"02-Task"').where(page => T.isTaskType(page.type)));
const projects = Array.from(dv.pages('"10-Project"').where(page => page.type === "project"));
const workspaces = Array.from(dv.pages('"03-Workspace"').where(page => page.type === "workspace"));
const operationalTasks = tasks.filter(task => V.isTaskOperationallyVisible(task, workspaces));

function workspaceForProject(project) {
  return workspaces.find(workspace => G.matchesReference(project.workspace, workspace.file.path)) ?? null;
}

function hasActiveWorkspace(project) {
  const workspace = workspaceForProject(project);
  return Boolean(workspace && E.isWorkspaceActiveLifecycle(workspace.lifecycle));
}

function title(page) {
  return String(page?.title ?? "").trim() || page?.file?.name || page?.file?.path || "(untitled)";
}

function link(page) {
  return page?.file?.path ? dv.fileLink(page.file.path, false, title(page)) : title(page);
}

function dateText(value) {
  if (!value) return "-";
  if (typeof value.toFormat === "function") return value.toFormat("yyyy-MM-dd");
  if (typeof value.toISODate === "function") return value.toISODate();
  return S.normalizeDateKey(value) ?? String(value);
}

function blockedReason(info) {
  const parts = [];
  if (info.cyclic) parts.push("循環依存");
  if (info.unresolved.length > 0) parts.push(`未完了: ${info.unresolved.map(title).join(", ")}`);
  if (info.missing.length > 0) parts.push(`参照不明: ${info.missing.join(", ")}`);
  return parts.join(" / ") || "依存関係によりBlocked";
}

const taskRows = [];
for (const task of operationalTasks) {
  const reasons = [];
  const info = R.dependencyInfo(dv, task, T.isTaskClosedStatus);

  if (A.isBlockedTask(task, info.blocked, T.isTaskActionableStatus)) {
    reasons.push(blockedReason(info));
  }

  if (A.isStaleDoingTask(task, today, thresholds)) {
    const age = A.daysSince(A.taskModifiedDate(task), today);
    reasons.push(A.reasonText("doing-stale", age, thresholds));
  }

  if (reasons.length > 0) {
    taskRows.push([
      "Task",
      link(task),
      dateText(task.due),
      reasons.join(" / ")
    ]);
  }
}

taskRows.sort((a, b) => {
  if (a[2] === b[2]) return String(a[1]).localeCompare(String(b[1]), "ja");
  if (a[2] === "-") return 1;
  if (b[2] === "-") return -1;
  return String(a[2]).localeCompare(String(b[2]));
});

const projectRows = projects
  .filter(hasActiveWorkspace)
  .filter(project =>
    A.isRunningProjectWithoutAction(
      project,
      operationalTasks,
      G.matchesReference,
      T.isTaskActionableStatus
    )
  )
  .sort((a, b) => title(a).localeCompare(title(b), "ja"))
  .map(project => [
    "Project",
    link(project),
    "-",
    A.reasonText("project-no-action", null, thresholds)
  ]);

const rows = [...taskRows, ...projectRows];

if (rows.length === 0) {
  dv.paragraph("要対応のTask / Projectはありません。");
} else {
  dv.table(["Type", "Item", "Due", "Reason"], rows);
}
