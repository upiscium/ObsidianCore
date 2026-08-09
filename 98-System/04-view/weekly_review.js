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

const config = {
  thresholds: {},
  ...(input ?? {})
};
const thresholds = W.thresholds(config.thresholds);
const todayValue = dv.date("today").startOf("day");
const today = todayValue.toISODate ? todayValue.toISODate() : String(todayValue).slice(0, 10);

const tasks = Array.from(dv.pages('"02-Task"').where(page => T.isTaskType(page.type)));
const projects = Array.from(dv.pages('"10-Project"').where(page => page.type === "project"));
const workspaces = Array.from(dv.pages('"03-Workspace"').where(page => page.type === "workspace"));
const entities = [...projects.map(page => ({ ...page, entityType: "Project" })), ...workspaces.map(page => ({ ...page, entityType: "Workspace" }))];

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

const staleDoing = tasks
  .filter(task => W.isStaleDoingTask(task, today, thresholds))
  .sort((a, b) => taskAge(b) - taskAge(a));

const blocked = tasks
  .map(task => ({ task, info: R.dependencyInfo(dv, task, T.isTaskClosedStatus) }))
  .filter(item => W.isBlockedTask(item.task, item.info.blocked, T.isTaskActionableStatus));

const oldBacklog = tasks
  .filter(task => W.isOldBacklogTask(task, today, T.isTaskActionableStatus, thresholds))
  .sort((a, b) => taskAge(b, true) - taskAge(a, true));

const projectsWithoutAction = projects
  .filter(project => W.isRunningProjectWithoutAction(project, tasks, G.matchesReference, T.isTaskActionableStatus))
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
  "doingのまま一定期間更新されていないTaskです。継続中か、完了/延期/中止すべきか確認します。",
  ["Task", "Modified", "経過", "理由"],
  staleDoing.map(task => {
    const age = taskAge(task);
    return [pageLink(task), dateText(task.file.mtime), `${age}日`, W.reasonText("doing-stale", age, thresholds)];
  })
);

renderSection(
  "⛔ Blocked Task",
  "未完了依存、参照不明、循環依存によって現在Blockedになっているactionable Taskです。",
  ["Task", "Due", "理由"],
  blocked.map(({ task, info }) => [pageLink(task), dateText(task.due), blockedReason(info)])
);

renderSection(
  "📦 長期 Backlog",
  "Backlogに長く残っているTaskです。昇格・継続保留・中止を判断します。",
  ["Task", "Created", "経過", "理由"],
  oldBacklog.map(task => {
    const age = taskAge(task, true);
    return [pageLink(task), dateText(W.taskCreatedDate(task)), `${age}日`, W.reasonText("backlog-old", age, thresholds)];
  })
);

renderSection(
  "🚧 Next Actionがない Running Project",
  "running状態なのに、Backlog以外のtodo/doing Taskが1件も紐づいていないProjectです。",
  ["Project", "Workspace", "理由"],
  projectsWithoutAction.map(project => [pageLink(project), G.referenceLabel(project.workspace) || "-", W.reasonText("project-no-action", null, thresholds)])
);

renderSection(
  "🕰️ 更新が止まった Active Entity",
  "planning/runningのまま一定期間更新されていないWorkspace/Projectです。",
  ["Type", "Entity", "Status", "Modified", "経過", "理由"],
  staleEntities.map(entity => {
    const age = modifiedAge(entity);
    return [entity.entityType, pageLink(entity), E.statusLabel(entity.status), dateText(entity.file.mtime), `${age}日`, W.reasonText("entity-stale", age, thresholds)];
  })
);

renderSection(
  "🧹 状態見直し候補",
  "長期間更新されていないActive Entityです。継続・done・cancelledのいずれが妥当か明示的に判断します。",
  ["Type", "Entity", "Status", "Modified", "経過", "理由"],
  stateDecisionEntities.map(entity => {
    const age = modifiedAge(entity);
    return [entity.entityType, pageLink(entity), E.statusLabel(entity.status), dateText(entity.file.mtime), `${age}日`, W.reasonText("entity-state-decision", age, thresholds)];
  })
);
