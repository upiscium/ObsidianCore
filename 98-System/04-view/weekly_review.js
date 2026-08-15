async function loadExpression(path) {
  const source = await dv.io.load(path);
  if (!source) throw new Error(`Dataview library not found: ${path}`);
  return new Function(`"use strict"; return (${source});`)();
}

async function loadReferenceLibs() {
  const G = await loadExpression("98-System/01-script/reference_utils.js");
  const runtimeFactory = await loadExpression("98-System/01-script/reference_runtime_utils.js");
  const taskFactory = await loadExpression("98-System/01-script/task_reference_utils.js");
  const X = runtimeFactory(G);
  return { G, R: taskFactory(G, X) };
}

const S = await loadExpression("98-System/01-script/task_schedule_utils.js");
const weeklyReviewFactory = await loadExpression("98-System/01-script/weekly_review_utils.js");
const W = weeklyReviewFactory(S);
const T = await loadExpression("98-System/01-script/task_meta_utils.js");
const E = await loadExpression("98-System/01-script/entity_meta_utils.js");
const { G, R } = await loadReferenceLibs();
const visibilityFactory = await loadExpression("98-System/01-script/workspace_task_visibility_utils.js");
const V = visibilityFactory(G, E);

const config = {
  thresholds: {},
  ...(input ?? {})
};
const thresholds = W.thresholds(config.thresholds);
const todayValue = dv.date("today").startOf("day");
const today = todayValue.toISODate ? todayValue.toISODate() : String(todayValue).slice(0, 10);

const tasks = Array.from(dv.pages('"02-Task"').where(page => T.isTaskType(page.type)));
const allProjects = Array.from(dv.pages('"10-Project"').where(page => page.type === "project"));
const workspaces = Array.from(dv.pages('"03-Workspace"').where(page => page.type === "workspace"));
const operationalTasks = tasks.filter(task => V.isTaskOperationallyVisible(task, workspaces));

function workspaceForProject(project) {
  return workspaces.find(workspace => G.matchesReference(project.workspace, workspace.file.path)) ?? null;
}

function hasActiveWorkspace(project) {
  const workspace = workspaceForProject(project);
  return Boolean(workspace && E.isWorkspaceActiveLifecycle(workspace.lifecycle));
}

const projects = allProjects.filter(hasActiveWorkspace);
const activeWorkspaces = workspaces.filter(workspace => E.isWorkspaceActiveLifecycle(workspace.lifecycle));
const entities = [
  ...projects.map(page => ({ ...page, entityType: "Project" })),
  ...activeWorkspaces.map(page => ({ ...page, status: page.lifecycle, entityType: "Workspace" }))
];

function pageTitle(page) {
  return String(page?.title ?? "").trim() || page?.file?.name || page?.file?.path || "(untitled)";
}

function pageLink(page) {
  return page?.file?.path ? dv.fileLink(page.file.path, false, pageTitle(page)) : pageTitle(page);
}

function dateText(value) {
  if (!value) return "-";
  if (typeof value.toFormat === "function") return value.toFormat("yyyy-MM-dd");
  if (typeof value.toISODate === "function") return value.toISODate();
  return S.normalizeDateKey(value) ?? String(value);
}

function modifiedAge(page) {
  return W.daysSince(page?.file?.mtime ?? page?.file?.mday, today);
}

function taskAge(task, useCreated = false) {
  const value = useCreated ? W.taskCreatedDate(task) : W.taskModifiedDate(task);
  return W.daysSince(value, today);
}

function blockedReason(info) {
  const parts = [];
  if (info.cyclic) parts.push("循環依存");
  if (info.unresolved.length > 0) parts.push(`未完了: ${info.unresolved.map(pageTitle).join(", ")}`);
  if (info.missing.length > 0) parts.push(`参照不明: ${info.missing.join(", ")}`);
  return parts.join(" / ") || "依存関係によりBlocked";
}

function renderSection(title, explanation, headers, rows) {
  dv.header(3, title);
  dv.paragraph(explanation);
  if (rows.length === 0) {
    dv.paragraph("対象はありません。");
    return;
  }
  dv.table(headers, rows);
}

function entityStateLabel(entity) {
  return entity.entityType === "Workspace"
    ? E.workspaceLifecycleLabel(entity.lifecycle)
    : E.projectStatusLabel(entity.status);
}

const staleDoing = operationalTasks
  .filter(task => W.isStaleDoingTask(task, today, thresholds))
  .sort((a, b) => taskAge(b) - taskAge(a));

const blocked = operationalTasks
  .map(task => ({ task, info: R.dependencyInfo(dv, task, T.isTaskClosedStatus) }))
  .filter(item => W.isBlockedTask(item.task, item.info.blocked, T.isTaskActionableStatus));

const oldBacklog = tasks
  .filter(task => W.isOldBacklogTask(task, today, T.isTaskActionableStatus, thresholds))
  .sort((a, b) => taskAge(b, true) - taskAge(a, true));

const projectsWithoutAction = projects
  .filter(project => W.isRunningProjectWithoutAction(project, operationalTasks, G.matchesReference, T.isTaskActionableStatus))
  .sort((a, b) => pageTitle(a).localeCompare(pageTitle(b), "ja"));

const staleEntities = entities
  .filter(entity => W.entityReviewBucket(entity, today, E.isActiveStatus, thresholds) === "stale")
  .sort((a, b) => modifiedAge(b) - modifiedAge(a));

const stateDecisionEntities = entities
  .filter(entity => W.entityReviewBucket(entity, today, E.isActiveStatus, thresholds) === "state-decision")
  .sort((a, b) => modifiedAge(b) - modifiedAge(a));

dv.paragraph(
  `レビュー基準: doing ${thresholds.doingStaleDays}日 / Backlog ${thresholds.backlogStaleDays}日 / ` +
  `Entity ${thresholds.entityStaleDays}日 / 状態見直し ${thresholds.entityStateDecisionDays}日。` +
  " これは運用レビューであり、System Doctorのerror/warningではありません。"
);

renderSection(
  "🏃 更新が止まった Doing Task",
  "通常運用対象のWorkspaceまたはWorkspace未設定Taskのうち、doingのまま一定期間更新されていないTaskです。",
  ["Task", "Modified", "経過", "理由"],
  staleDoing.map(task => {
    const age = taskAge(task);
    return [pageLink(task), dateText(task.file.mtime), `${age}日`, W.reasonText("doing-stale", age, thresholds)];
  })
);

renderSection(
  "⛔ Blocked Task",
  "通常運用対象のWorkspaceまたはWorkspace未設定Taskのうち、依存関係によって現在Blockedになっているactionable Taskです。",
  ["Task", "Due", "理由"],
  blocked.map(({ task, info }) => [pageLink(task), dateText(task.due), blockedReason(info)])
);

renderSection(
  "📦 長期 Backlog",
  "Backlog全体から長く残っているTaskを表示します。inactive/archived Workspace配下も棚卸し対象として残します。",
  ["Task", "Created", "経過", "理由"],
  oldBacklog.map(task => {
    const age = taskAge(task, true);
    return [pageLink(task), dateText(W.taskCreatedDate(task)), `${age}日`, W.reasonText("backlog-old", age, thresholds)];
  })
);

renderSection(
  "🚧 Next Actionがない Running Project",
  "active Workspace配下でrunning状態なのに、通常運用対象のtodo/doing Taskが1件も紐づいていないProjectです。",
  ["Project", "Workspace", "理由"],
  projectsWithoutAction.map(project => [pageLink(project), G.referenceLabel(project.workspace) || "-", W.reasonText("project-no-action", null, thresholds)])
);

renderSection(
  "🕰️ 更新が止まった Active Entity",
  "active Workspaceまたはactive Projectのまま一定期間更新されていないEntityです。inactive Workspaceとその配下Projectは対象外です。",
  ["Type", "Entity", "State", "Modified", "経過", "理由"],
  staleEntities.map(entity => {
    const age = modifiedAge(entity);
    return [entity.entityType, pageLink(entity), entityStateLabel(entity), dateText(entity.file.mtime), `${age}日`, W.reasonText("entity-stale", age, thresholds)];
  })
);

renderSection(
  "🧹 状態見直し候補",
  "長期間更新されていないActive Entityです。Workspaceは継続・休止・アーカイブ、Projectは継続・完了・中止を判断します。",
  ["Type", "Entity", "State", "Modified", "経過", "理由"],
  stateDecisionEntities.map(entity => {
    const age = modifiedAge(entity);
    return [entity.entityType, pageLink(entity), entityStateLabel(entity), dateText(entity.file.mtime), `${age}日`, W.reasonText("entity-state-decision", age, thresholds)];
  })
);