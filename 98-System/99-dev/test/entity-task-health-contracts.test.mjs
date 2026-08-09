import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function readExpression(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  return new Function(`"use strict"; return (${source});`)();
}

const S = readExpression("98-System/01-script/task_schedule_utils.js");
const healthFactory = readExpression("98-System/01-script/entity_task_health_utils.js");
const H = healthFactory(S);
const T = readExpression("98-System/01-script/task_meta_utils.js");
const E = readExpression("98-System/01-script/entity_meta_utils.js");
const today = "2026-08-09";

function summarize(tasks, blockedPaths = new Set()) {
  return H.summarizeTasks(tasks, {
    today,
    isTodoStatus: T.isTaskTodoStatus,
    isDoingStatus: T.isTaskDoingStatus,
    isActionableStatus: T.isTaskActionableStatus,
    isBlocked: task => blockedPaths.has(task.file?.path)
  });
}

test("Task health counts actionable non-Backlog work only", () => {
  const tasks = [
    { file: { path: "overdue.md" }, status: "todo", due: "2026-08-08", backlog: false },
    { file: { path: "blocked.md" }, status: "doing", due: "2026-08-15", backlog: false },
    { file: { path: "future-start.md" }, status: "todo", start: "2026-08-10", due: "2026-08-12", backlog: false },
    { file: { path: "backlog.md" }, status: "todo", due: "2026-08-11", backlog: true },
    { file: { path: "done.md" }, status: "done", due: "2026-08-09", backlog: false }
  ];

  assert.deepEqual(summarize(tasks, new Set(["blocked.md"])), {
    todo: 2,
    doing: 1,
    actionable: 3,
    blocked: 1,
    overdue: 1,
    nextAction: 1,
    nextDue: "2026-08-12"
  });
});

test("Blocked and future-Start Tasks are not Next Actions", () => {
  const tasks = [
    { file: { path: "blocked.md" }, status: "todo", due: "2026-08-10", backlog: false },
    { file: { path: "future.md" }, status: "doing", start: "2026-08-11", due: "2026-08-20", backlog: false }
  ];
  const summary = summarize(tasks, new Set(["blocked.md"]));
  assert.equal(summary.actionable, 2);
  assert.equal(summary.nextAction, 0);
  assert.equal(summary.blocked, 1);
});

test("Next Due ignores overdue dates and chooses the nearest current/future Due", () => {
  const summary = summarize([
    { file: { path: "past.md" }, status: "todo", due: "2026-08-01" },
    { file: { path: "today.md" }, status: "todo", due: "2026-08-09" },
    { file: { path: "future.md" }, status: "todo", due: "2026-08-10" }
  ]);
  assert.equal(summary.overdue, 1);
  assert.equal(summary.nextDue, "2026-08-09");
});

test("Project health counts active Projects and running Projects without Next Action", () => {
  const projects = [
    { file: { path: "planning.md" }, status: "planning" },
    { file: { path: "running-good.md" }, status: "running" },
    { file: { path: "running-empty.md" }, status: "running" },
    { file: { path: "done.md" }, status: "done" }
  ];
  const summaries = new Map([
    ["planning.md", { nextAction: 0 }],
    ["running-good.md", { nextAction: 2 }],
    ["running-empty.md", { nextAction: 0 }],
    ["done.md", { nextAction: 0 }]
  ]);

  assert.deepEqual(H.summarizeProjects(
    projects,
    project => summaries.get(project.file.path),
    E.isActiveStatus,
    value => E.normalizeStatus(value) === "running"
  ), {
    active: 3,
    runningWithoutNextAction: 1
  });
});

test("running Project without Next Action gets explicit attention", () => {
  const isRunning = value => E.normalizeStatus(value) === "running";
  assert.match(H.projectAttention({ entityStatus: "running", taskSummary: { nextAction: 0 }, isRunningStatus: isRunning }), /Next Action/);
  assert.equal(H.projectAttention({ entityStatus: "running", taskSummary: { nextAction: 1 }, isRunningStatus: isRunning }), null);
  assert.equal(H.projectAttention({ entityStatus: "planning", taskSummary: { nextAction: 0 }, isRunningStatus: isRunning }), null);
});

test("Entity Task health Dataview compiles inside an async wrapper", () => {
  const source = fs.readFileSync(path.join(root, "98-System/04-view/entity_task_health.js"), "utf8");
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction("dv", "input", "app", "document", "Notice", source));
});

test("Project and Workspace Entries expose the shared Task health embed", () => {
  const project = fs.readFileSync(path.join(root, "98-System/02-embed/02-entry/project-entry.md"), "utf8");
  const workspace = fs.readFileSync(path.join(root, "98-System/02-embed/02-entry/workspace-entry.md"), "utf8");
  const embed = fs.readFileSync(path.join(root, "98-System/02-embed/05-task/entity-task-health.md"), "utf8");

  assert.match(project, /\[\[entity-task-health\]\]/);
  assert.match(workspace, /\[\[entity-task-health\]\]/);
  assert.match(embed, /dv\.view\("98-System\/04-view\/entity_task_health"\)/);
});
