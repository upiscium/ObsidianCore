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
if (String(current?.type ?? "") !== "project") {
  throw new Error(`Task HealthはProject Entry専用です: ${current?.type || "(missing type)"}`);
}

const todayValue = dv.date("today").startOf("day");
const today = todayValue.toISODate ? todayValue.toISODate() : String(todayValue).slice(0, 10);
const currentLink = current.file.link;
const allTasks = Array.from(dv.pages('"02-Task"').where(page => T.isTaskType(page.type)));
const relatedTasks = allTasks.filter(task => G.matchesReference(task.project, currentLink));

const taskSummary = H.summarizeTasks(relatedTasks, {
  today,
  isTodoStatus: T.isTaskTodoStatus,
  isDoingStatus: T.isTaskDoingStatus,
  isActionableStatus: T.isTaskActionableStatus,
  isBlocked: task => R.dependencyInfo(dv, task, T.isTaskClosedStatus).blocked
});

const attention = H.projectAttention({
  entityStatus: current.status,
  taskSummary,
  isRunningStatus: value => E.normalizeProjectStatus(value) === "running"
});

if (attention) dv.paragraph(attention);

dv.table(
  ["Todo", "Doing", "Actionable", "Next Action", "Blocked", "Overdue", "Next Due"],
  [[
    taskSummary.todo,
    taskSummary.doing,
    taskSummary.actionable,
    taskSummary.nextAction,
    taskSummary.blocked,
    taskSummary.overdue,
    taskSummary.nextDue ?? "-"
  ]]
);
