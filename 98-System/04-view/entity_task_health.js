async function loadExpression(path) {
  const source = await dv.io.load(path);
  if (!source) throw new Error(`Dataview library not found: ${path}`);
  return new Function(`"use strict"; return (${source});`)();
}

const S = await loadExpression("98-System/01-script/task_schedule_utils.js");
const healthFactory = await loadExpression("98-System/01-script/entity_task_health_utils.js");
const H = healthFactory(S);
const T = await loadExpression("98-System/01-script/task_meta_utils.js");
const E = await loadExpression("98-System/01-script/entity_meta_utils.js");
const G = await loadExpression("98-System/01-script/reference_utils.js");
const runtimeFactory = await loadExpression("98-System/01-script/reference_runtime_utils.js");
const taskFactory = await loadExpression("98-System/01-script/task_reference_utils.js");
const X = runtimeFactory(G);
const R = taskFactory(G, X);

const current = dv.current();
const entityType = String(current?.type ?? "");
if (!["project", "workspace"].includes(entityType)) {
  throw new Error(`Entity Task healthはProject/Workspace Entry専用です: ${entityType || "(missing type)"}`);
}

const todayValue = dv.date("today").startOf("day");
const today = todayValue.toISODate ? todayValue.toISODate() : String(todayValue).slice(0, 10);
const currentLink = current.file.link;
const allTasks = Array.from(dv.pages('"02-Task"').where(page => T.isTaskType(page.type)));
const allProjects = Array.from(dv.pages('"10-Project"').where(page => page.type === "project"));

function tasksForReference(field, reference) {
  return allTasks.filter(task => G.matchesReference(task[field], reference));
}

function summarize(tasks) {
  return H.summarizeTasks(tasks, {
    today,
    isTodoStatus: T.isTaskTodoStatus,
    isDoingStatus: T.isTaskDoingStatus,
    isActionableStatus: T.isTaskActionableStatus,
    isBlocked: task => R.dependencyInfo(dv, task, T.isTaskClosedStatus).blocked
  });
}

function valueText(value) {
  return value ?? "-";
}

function compactStats(parts) {
  dv.paragraph(parts.filter(Boolean).join(" · "));
}

const relatedTasks = entityType === "project"
  ? tasksForReference("project", currentLink)
  : tasksForReference("workspace", currentLink);
const taskSummary = summarize(relatedTasks);

if (entityType === "project") {
  const executionState = H.projectExecutionState({
    entityStatus: current.status,
    taskSummary,
    isRunningStatus: value => E.normalizeProjectStatus(value) === "running"
  });

  if (executionState === null) {
    dv.paragraph("— running ProjectのみExecution Healthを判定します。");
  } else if (executionState === "attention") {
    dv.paragraph("🔥 **Attention required**");
    compactStats([
      `Overdue: ${taskSummary.overdue}`,
      `Next Action: ${taskSummary.nextAction}`,
      taskSummary.blocked > 0 ? `Blocked: ${taskSummary.blocked}` : null,
      `Next Due: ${valueText(taskSummary.nextDue)}`
    ]);
  } else if (executionState === "ready-with-blockers") {
    dv.paragraph("⚠️ **Ready with blockers**");
    compactStats([
      `Next Action: ${taskSummary.nextAction}`,
      `Blocked: ${taskSummary.blocked}`,
      `Next Due: ${valueText(taskSummary.nextDue)}`
    ]);
  } else if (executionState === "ready") {
    dv.paragraph("✅ **Ready**");
    compactStats([
      `Next Action: ${taskSummary.nextAction}`,
      `Next Due: ${valueText(taskSummary.nextDue)}`
    ]);
  } else if (executionState === "blocked") {
    dv.paragraph("⛔ **No Next Action**");
    compactStats([
      `Blocked: ${taskSummary.blocked}`,
      taskSummary.future > 0 ? `Future: ${taskSummary.future}` : null,
      taskSummary.nextStart ? `Next Start: ${taskSummary.nextStart}` : null
    ]);
  } else if (executionState === "future") {
    dv.paragraph("⏳ **No Next Action yet**");
    compactStats([
      `Future: ${taskSummary.future}`,
      `Next Start: ${valueText(taskSummary.nextStart)}`
    ]);
  } else {
    dv.paragraph("📭 **No Next Action**");
    dv.paragraph("Running Projectですが、実行可能なTaskがありません。");
  }
} else {
  dv.table(
    ["Todo", "Doing", "Actionable", "Next Action", "Blocked", "Overdue", "Next Due"],
    [[
      taskSummary.todo,
      taskSummary.doing,
      taskSummary.actionable,
      taskSummary.nextAction,
      taskSummary.blocked,
      taskSummary.overdue,
      valueText(taskSummary.nextDue)
    ]]
  );

  const linkedProjects = E.isWorkspaceActiveLifecycle(current.lifecycle)
    ? allProjects.filter(project => G.matchesReference(project.workspace, currentLink))
    : [];
  const projectSummary = H.summarizeProjects(
    linkedProjects,
    project => summarize(tasksForReference("project", project.file.link)),
    E.isProjectActiveStatus,
    value => E.normalizeProjectStatus(value) === "running"
  );

  dv.table(
    ["Active Projects", "Running without Next Action"],
    [[projectSummary.active, projectSummary.runningWithoutNextAction]]
  );
}
