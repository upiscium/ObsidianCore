import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const expression = relativePath => new Function(`"use strict"; return (${read(relativePath)});`)();

const G = expression("98-System/01-script/reference_utils.js");
const E = expression("98-System/01-script/entity_meta_utils.js");
const factory = expression("98-System/01-script/workspace_task_visibility_utils.js");
const V = factory(G, E);

const workspaces = [
  { file: { path: "03-Workspace/Active/Active.md" }, lifecycle: "active" },
  { file: { path: "03-Workspace/Inactive/Inactive.md" }, lifecycle: "inactive" },
  { file: { path: "03-Workspace/Archived/Archived.md" }, lifecycle: "archived" }
];

test("Task operational visibility follows referenced Workspace lifecycle", () => {
  assert.equal(V.isTaskOperationallyVisible({ workspace: "[[03-Workspace/Active/Active|Active]]" }, workspaces), true);
  assert.equal(V.isTaskOperationallyVisible({ workspace: "[[03-Workspace/Inactive/Inactive|Inactive]]" }, workspaces), false);
  assert.equal(V.isTaskOperationallyVisible({ workspace: "[[03-Workspace/Archived/Archived|Archived]]" }, workspaces), false);
});

test("unassigned and unresolved Workspace references stay visible for recovery", () => {
  assert.equal(V.isTaskOperationallyVisible({ workspace: null }, workspaces), true);
  assert.equal(V.isTaskOperationallyVisible({}, workspaces), true);
  assert.equal(V.isTaskOperationallyVisible({ workspace: "[[03-Workspace/Missing/Missing|Missing]]" }, workspaces), true);
});

test("workspace resolution does not infer from Project or mutate Task metadata", () => {
  const task = {
    workspace: null,
    project: "[[10-Project/P/P|P]]",
    status: "todo",
    marker: { keep: true }
  };
  const before = structuredClone(task);
  assert.equal(V.workspaceForTask(task, workspaces), null);
  assert.equal(V.isTaskOperationallyVisible(task, workspaces), true);
  assert.deepEqual(task, before);
});

test("Task table gates operational modes while preserving Inbox and Backlog", () => {
  const source = read("98-System/04-view/task_table.js");
  assert.match(source, /workspace_task_visibility_utils\.js/);
  assert.match(source, /if\(!\["inbox","backlog"\]\.includes\(config\.mode\)\)/);
  assert.match(source, /V\.isTaskOperationallyVisible\(task,allWorkspaces\)/);
  assert.match(source, /case "inbox"/);
  assert.match(source, /case "backlog"/);
});

test("Weekly Review gates operational Task decisions but keeps Backlog decisions global", () => {
  const source = read("98-System/04-view/weekly_review.js");
  assert.match(source, /const operationalTasks = tasks\.filter\(task => V\.isTaskOperationallyVisible\(task, workspaces\)\)/);
  assert.match(source, /operationalTasks\.filter\(task => task\.backlog !== true && W\.isStaleDoingTask/);
  assert.match(source, /for \(const task of operationalTasks\.filter\(task => task\.backlog !== true\)\)/);
  assert.match(source, /const oldBacklog = tasks/);
  assert.match(source, /isRunningProjectWithoutNextAction\(project, summary, isRunningProjectStatus\)/);
});

test("Task and Weekly Review Dataview sources still compile", () => {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  for (const relativePath of ["98-System/04-view/task_table.js", "98-System/04-view/weekly_review.js"]) {
    const source = read(relativePath);
    assert.doesNotThrow(() => new AsyncFunction("dv", "input", "app", "document", "Notice", source));
  }
});
