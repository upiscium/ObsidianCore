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

test("Task health classifies actionable non-Backlog work into ready, blocked, and future", () => {
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
    future: 1,
    nextDue: "2026-08-12",
    nextStart: "2026-08-10"
  });
});

test("canonical task execution state excludes Backlog and closed Tasks", () => {
  const base = {
    today,
    isActionableStatus: T.isTaskActionableStatus,
    isBlocked: task => task.file?.path === "blocked.md"
  };

  assert.equal(H.taskExecutionState({ file: { path: "ready.md" }, status: "todo" }, base), "ready");
  assert.equal(H.taskExecutionState({ file: { path: "blocked.md" }, status: "doing" }, base), "blocked");
  assert.equal(H.taskExecutionState({ file: { path: "future.md" }, status: "todo", start: "2026-08-10" }, base), "future");
  assert.equal(H.taskExecutionState({ file: { path: "backlog.md" }, status: "todo", backlog: true }, base), null);
  assert.equal(H.taskExecutionState({ file: { path: "done.md" }, status: "done" }, base), null);
});

test("Next Due ignores overdue dates and Next Start chooses the nearest future Start", () => {
  const summary = summarize([
    { file: { path: "past.md" }, status: "todo", due: "2026-08-01" },
    { file: { path: "today.md" }, status: "todo", due: "2026-08-09" },
    { file: { path: "future-a.md" }, status: "todo", start: "2026-08-12", due: "2026-08-10" },
    { file: { path: "future-b.md" }, status: "todo", start: "2026-08-11" }
  ]);
  assert.equal(summary.overdue, 1);
  assert.equal(summary.nextDue, "2026-08-09");
  assert.equal(summary.nextStart, "2026-08-11");
});

test("Project execution state only evaluates running Projects", () => {
  const state = summary => H.projectExecutionState({
    entityStatus: "running",
    taskSummary: summary,
    isRunningStatus: value => E.normalizeProjectStatus(value) === "running"
  });
  const planning = H.projectExecutionState({
    entityStatus: "planning",
    taskSummary: { nextAction: 0 },
    isRunningStatus: value => E.normalizeProjectStatus(value) === "running"
  });

  assert.equal(state({ nextAction: 2, blocked: 0, future: 0, overdue: 0 }), "ready");
  assert.equal(state({ nextAction: 2, blocked: 1, future: 0, overdue: 0 }), "ready-with-blockers");
  assert.equal(state({ nextAction: 0, blocked: 2, future: 0, overdue: 0 }), "blocked");
  assert.equal(state({ nextAction: 0, blocked: 0, future: 2, overdue: 0 }), "future");
  assert.equal(state({ nextAction: 0, blocked: 0, future: 0, overdue: 0 }), "empty");
  assert.equal(state({ nextAction: 1, blocked: 0, future: 0, overdue: 1 }), "attention");
  assert.equal(planning, null);
});

test("Project health counts active Projects and running Projects without canonical Next Action", () => {
  const projects = [
    { file: { path: "planning.md" }, status: "planning" },
    { file: { path: "running-good.md" }, status: "running" },
    { file: { path: "running-future.md" }, status: "running" },
    { file: { path: "done.md" }, status: "done" }
  ];
  const summaries = new Map([
    ["planning.md", { nextAction: 0 }],
    ["running-good.md", { nextAction: 2 }],
    ["running-future.md", { nextAction: 0, future: 1 }],
    ["done.md", { nextAction: 0 }]
  ]);

  assert.deepEqual(H.summarizeProjects(
    projects,
    project => summaries.get(project.file.path),
    E.isProjectActiveStatus,
    value => E.normalizeProjectStatus(value) === "running"
  ), {
    active: 3,
    runningWithoutNextAction: 1
  });
});

test("Entity Task health Dataview compiles and Project view is attention-oriented", () => {
  const source = fs.readFileSync(path.join(root, "98-System/04-view/entity_task_health.js"), "utf8");
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction("dv", "input", "app", "document", "Notice", source));
  assert.match(source, /projectExecutionState/);
  assert.match(source, /Ready with blockers/);
  assert.match(source, /No Next Action/);
  assert.doesNotMatch(source, /E\.isActiveStatus|E\.normalizeStatus/);
});

test("Project Entry names the Project-specific view Execution Health", () => {
  const project = fs.readFileSync(path.join(root, "98-System/02-embed/02-entry/project-entry.md"), "utf8");
  const workspace = fs.readFileSync(path.join(root, "98-System/02-embed/02-entry/workspace-entry.md"), "utf8");
  const embed = fs.readFileSync(path.join(root, "98-System/02-embed/05-task/entity-task-health.md"), "utf8");

  assert.match(project, /# Execution Health/);
  assert.match(project, /\[\[entity-task-health\]\]/);
  assert.match(workspace, /# Task Health/);
  assert.match(workspace, /\[\[entity-task-health\]\]/);
  assert.match(embed, /dv\.view\("98-System\/04-view\/entity_task_health"\)/);
});
