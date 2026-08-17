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
const healthFactory = await loadExpression("98-System/01-script/entity_task_health_utils.js");
const H = healthFactory(S);
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
  ...activeWorkspaces.map(page => ({ ...page, entityType: "Workspace" }))
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

function isActiveReviewEntity(entity) {
  return entity.entityType === "Workspace"
    ? E.isWorkspaceActiveLifecycle(entity.lifecycle)
    : E.isProjectActiveStatus(entity.status);
}

function entityStateLabel(entity) {
  return entity.entityType === "Workspace"
    ? E.workspaceLifecycleLabel(entity.lifecycle)
    : E.projectStatusLabel(entity.status);
}

function isRunningProjectStatus(value) {
  return E.normalizeProjectStatus(value) === "running";
}

function tasksForProject(project) {
  return operationalTasks.filter(task => G.matchesReference(task.project, project.file.path));
}

function tasksForWorkspace(workspace) {
  return operationalTasks.filter(task => G.matchesReference(task.workspace, workspace.file.path));
}

function summarize(tasksForEntity) {
  return H.summarizeTasks(tasksForEntity, {
    today,
    isTodoStatus: T.isTaskTodoStatus,
    isDoingStatus: T.isTaskDoingStatus,
    isActionableStatus: T.isTaskActionableStatus,
    isBlocked: task => R.dependencyInfo(dv, task, T.isTaskClosedStatus).blocked
  });
}

const projectTaskSummaries = new Map(
  projects.map(project => [project.file.path, summarize(tasksForProject(project))])
);

const projectActivities = new Map(
  projects.map(project => [
    project.file.path,
    W.latestActivity([
      project.file.mtime ?? project.file.mday,
      ...tasksForProject(project).map(W.taskModifiedDate)
    ])
  ])
);

function workspaceProjects(workspace) {
  return projects.filter(project => G.matchesReference(project.workspace, workspace.file.path));
}

function entityActivity(entity) {
  if (entity.entityType === "Project") {
    return projectActivities.get(entity.file.path) ?? W.latestActivity([entity.file.mtime ?? entity.file.mday]);
  }

  return W.latestActivity([
    entity.file.mtime ?? entity.file.mday,
    ...tasksForWorkspace(entity).map(W.taskModifiedDate),
    ...workspaceProjects(entity).map(project => projectActivities.get(project.file.path))
  ]);
}

function entityReviewOptions(entity) {
  return entity.entityType === "Workspace"
    ? ["継続", "休止", "アーカイブ"]
    : ["継続", "停止", "完了", "キャンセル"];
}

function addDecision(map, page, { reason, options, score = 0, activity = null }) {
  const key = page.file.path;
  const current = map.get(key) ?? {
    page,
    reasons: [],
    options: new Set(),
    score: 0,
    activity
  };
  if (reason && !current.reasons.includes(reason)) current.reasons.push(reason);
  for (const option of options ?? []) current.options.add(option);
  current.score = Math.max(current.score, score);
  if (activity && (!current.activity || activity > current.activity)) current.activity = activity;
  map.set(key, current);
}

const entityDecisions = new Map();

for (const project of projects) {
  const summary = projectTaskSummaries.get(project.file.path);
  if (!W.isRunningProjectWithoutNextAction(project, summary, isRunningProjectStatus)) continue;

  const details = [];
  if (summary.blocked > 0) details.push(`Blocked ${summary.blocked}件`);
  if (summary.future > 0 && summary.nextStart) details.push(`Next Start ${summary.nextStart}`);
  const suffix = details.length > 0 ? `（${details.join(" / ")}）` : "";
  addDecision(entityDecisions, { ...project, entityType: "Project" }, {
    reason: `${W.reasonText("project-no-action", null, thresholds)}${suffix}`,
    options: ["Next Action追加", "停止", "完了", "キャンセル"],
    score: 2,
    activity: projectActivities.get(project.file.path)
  });
}

for (const entity of entities) {
  const activity = entityActivity(entity);
  const bucket = W.entityReviewBucket(entity, today, isActiveReviewEntity, thresholds, activity);
  if (!bucket) continue;
  const age = W.daysSince(activity, today);
  addDecision(entityDecisions, entity, {
    reason: W.reasonText(bucket === "state-decision" ? "entity-state-decision" : "entity-stale", age, thresholds),
    options: entityReviewOptions(entity),
    score: bucket === "state-decision" ? 3 : 1,
    activity
  });
}

const entityDecisionRows = Array.from(entityDecisions.values())
  .sort((a, b) => b.score - a.score || (W.daysSince(b.activity, today) ?? -1) - (W.daysSince(a.activity, today) ?? -1))
  .map(item => [
    item.page.entityType,
    pageLink(item.page),
    entityStateLabel(item.page),
    dateText(item.activity),
    item.reasons.join(" / "),
    Array.from(item.options).join(" / ")
  ]);

const taskDecisions = new Map();

function addTaskDecision(task, reason, options, score) {
  const key = task.file.path;
  const current = taskDecisions.get(key) ?? {
    task,
    reasons: [],
    options: new Set(),
    score: 0
  };
  if (reason && !current.reasons.includes(reason)) current.reasons.push(reason);
  for (const option of options ?? []) current.options.add(option);
  current.score = Math.max(current.score, score);
  taskDecisions.set(key, current);
}

for (const task of operationalTasks.filter(task => task.backlog !== true && W.isStaleDoingTask(task, today, thresholds))) {
  const age = taskAge(task);
  addTaskDecision(
    task,
    W.reasonText("doing-stale", age, thresholds),
    ["継続", "Todoへ戻す", "Reschedule", "Backlog", "完了", "キャンセル"],
    1
  );
}

for (const task of operationalTasks.filter(task => task.backlog !== true)) {
  const info = R.dependencyInfo(dv, task, T.isTaskClosedStatus);
  if (!W.isBlockedTask(task, info.blocked, T.isTaskActionableStatus)) continue;
  addTaskDecision(
    task,
    `Blocked: ${blockedReason(info)}`,
    ["Blocker解消", "Reschedule", "Backlog", "キャンセル"],
    2
  );
}

const taskDecisionRows = Array.from(taskDecisions.values())
  .sort((a, b) => b.score - a.score || taskAge(b.task) - taskAge(a.task))
  .map(item => [
    pageLink(item.task),
    T.taskStatusLabel(item.task.status),
    dateText(item.task.due),
    item.reasons.join(" / "),
    Array.from(item.options).join(" / ")
  ]);

const oldBacklog = tasks
  .filter(task => W.isOldBacklogTask(task, today, T.isTaskActionableStatus, thresholds))
  .sort((a, b) => taskAge(b, true) - taskAge(a, true));

const backlogDecisionRows = oldBacklog.map(task => [
  pageLink(task),
  dateText(W.taskCreatedDate(task)),
  `${taskAge(task, true)}日`,
  "Promote / Keep / Cancel"
]);

dv.paragraph(
  `レビュー基準: doing ${thresholds.doingStaleDays}日 / Backlog ${thresholds.backlogStaleDays}日 / ` +
  `Entity ${thresholds.entityStaleDays}日 / 状態見直し ${thresholds.entityStateDecisionDays}日。` +
  " これは運用レビューであり、System Doctorのerror/warningではありません。"
);

renderSection(
  "🧭 Project / Workspace Decisions",
  "Project/Workspaceについて、継続・停止・完了・休止などの判断が必要な対象です。",
  ["Type", "Entity", "State", "Last Activity", "理由", "Review"],
  entityDecisionRows
);

renderSection(
  "🧩 Task Decisions",
  "停滞中またはBlocked中のTaskについて、次の扱いを判断するためのキューです。",
  ["Task", "Status", "Due", "理由", "Review"],
  taskDecisionRows
);

renderSection(
  "📦 Backlog Decisions",
  "長期Backlogについて、実行対象へ戻すか、保持するか、取り下げるかを判断します。",
  ["Task", "Created", "経過", "Review"],
  backlogDecisionRows
);
