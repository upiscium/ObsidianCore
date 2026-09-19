import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readExpression(relativePath) {
  const source = read(relativePath);
  return new Function(`"use strict"; return (${source});`)();
}

const O = readExpression("98-System/01-script/task_sort_utils.js");

function key({ taskPriority, projectPriority, due = null, start = null, title = "Task" }) {
  return { taskPriority, projectPriority, due, start, title };
}

test("Task priority remains the primary ordering key over Project priority", () => {
  const highTaskLowProject = key({ taskPriority: 0, projectPriority: 2, title: "High task" });
  const mediumTaskHighProject = key({ taskPriority: 1, projectPriority: 0, title: "Medium task" });

  assert.ok(O.compareTaskSortKeys(highTaskLowProject, mediumTaskHighProject) < 0);
  assert.ok(O.compareTaskSortKeys(mediumTaskHighProject, highTaskLowProject) > 0);
});

test("Project priority breaks ties between Tasks with the same priority", () => {
  const highProject = key({ taskPriority: 0, projectPriority: 0, title: "High project" });
  const mediumProject = key({ taskPriority: 0, projectPriority: 1, title: "Medium project" });
  const noProject = key({ taskPriority: 0, projectPriority: 3, title: "No project" });

  const sorted = [noProject, mediumProject, highProject].sort(O.compareTaskSortKeys);
  assert.deepEqual(sorted.map(item => item.title), ["High project", "Medium project", "No project"]);
});

test("Due, Start, and title are deterministic tie breakers after both priorities", () => {
  const values = [
    key({ taskPriority: 1, projectPriority: 1, due: "2026-09-20", start: "2026-09-18", title: "B" }),
    key({ taskPriority: 1, projectPriority: 1, due: "2026-09-19", start: "2026-09-18", title: "Z" }),
    key({ taskPriority: 1, projectPriority: 1, due: "2026-09-20", start: "2026-09-17", title: "C" }),
    key({ taskPriority: 1, projectPriority: 1, due: "2026-09-20", start: "2026-09-18", title: "A" })
  ];

  values.sort(O.compareTaskSortKeys);
  assert.deepEqual(values.map(item => item.title), ["Z", "C", "A", "B"]);
});

test("missing dates sort after concrete dates", () => {
  const dated = key({ taskPriority: 1, projectPriority: 1, due: "2026-09-20" });
  const undated = key({ taskPriority: 1, projectPriority: 1, due: null });
  assert.ok(O.compareTaskSortKeys(dated, undated) < 0);
});

test("organized Task table delegates view-model sorting", () => {
  const source = read("98-System/04-view/tasks/task_table.js");
  const viewModel = read("98-System/05-lib/tasks/task_table_view_utils.js");

  assert.match(source, /task_sort_utils\.js/);
  assert.match(source, /task_table_view_utils\.js/);
  assert.match(source, /const allProjects = Array\.from\(dv\.pages\('\"10-Project\"'\)/);
  assert.match(source, /M\.taskSortKey\(task,\{dv,projects:allProjects\}\)/);
  assert.match(source, /compareTaskSortKeys\(taskSortKey\(a\),taskSortKey\(b\)\)/);
  assert.match(viewModel, /E\.priorityOrder\(project\?\.priority \?\? null\)/);
  assert.match(viewModel, /taskPriority: U\.taskPriorityOrder\(task\?\.priority\)/);
  assert.doesNotMatch(source, /function statusRank/);
  assert.doesNotMatch(source, /futureDateKey/);
});

test("Primary view-model keeps high-priority future Tasks while excluding future-start and overdue/today", () => {
  const source = read("98-System/05-lib/tasks/task_table_view_utils.js");
  const match = source.match(/function isPrimary\(task, \{ dv, today, primaryLimit \}\) \{([\s\S]*?)\n  \}/);
  assert.ok(match, "isPrimary() must exist in the Task table view-model");
  const body = match[1];

  assert.doesNotMatch(body, /isTaskDoingStatus/);
  assert.match(body, /U\.isTaskActionableStatus\(task\?\.status\)/);
  assert.match(body, /dv\.compare\(start, today\) > 0/);
  assert.match(body, /dv\.compare\(due, today\) <= 0/);
  assert.match(body, /dv\.compare\(due, primaryLimit\) <= 0/);
  assert.match(body, /normalizeTaskPriority\(task\?\.priority\) === "high"/);
});
