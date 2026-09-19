import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const expression = relativePath => new Function(`"use strict"; return (${read(relativePath)});`)();

test("organized Task views compile and task_table owns the new view-model dependency", () => {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  for (const relativePath of [
    "98-System/04-view/tasks/task_table.js",
    "98-System/04-view/tasks/task_attention.js",
    "98-System/04-view/tasks/recurring_tasks.js",
  ]) {
    assert.doesNotThrow(() => new AsyncFunction(
      "dv", "input", "app", "document", "Notice", "window",
      read(relativePath),
    ));
  }

  const taskTable = read("98-System/04-view/tasks/task_table.js");
  assert.match(taskTable, /98-System\/05-lib\/tasks\/task_table_view_utils\.js/);
  assert.match(taskTable, /M\.isPrimary\(task,\{dv,today,primaryLimit\}\)/);
  assert.match(taskTable, /M\.taskSortKey\(task,\{dv,projects:allProjects\}\)/);
});

test("Task table view-model preserves Primary semantics and Project priority", () => {
  const factory = expression("98-System/05-lib/tasks/task_table_view_utils.js");
  const U = {
    stripTaskTimestamp: value => String(value ?? "").replace(/^\d+-/, ""),
    isTaskActionableStatus: status => status === "todo" || status === "doing",
    normalizeTaskPriority: value => value ?? null,
    taskPriorityOrder: value => ({ high: 0, medium: 1, low: 2, none: 3 }[value ?? "none"] ?? 3),
    dateOnly: value => value || null,
  };
  const O = { FAR_FUTURE: "9999-12-31" };
  const E = { priorityOrder: value => ({ high: 0, medium: 1, low: 2 }[value] ?? 3) };
  const G = {
    matchesReference(value, candidates) {
      return candidates.some(candidate => String(value ?? "").includes(String(candidate)));
    },
  };
  const M = factory({ U, O, E, G });
  const dv = { compare: (a, b) => String(a).localeCompare(String(b)) };
  const context = { dv, today: "2026-09-18", primaryLimit: "2026-10-02" };

  assert.equal(M.isPrimary({ status: "todo", priority: "high", due: "2026-12-01" }, context), true);
  assert.equal(M.isPrimary({ status: "doing", priority: "medium", due: "2026-09-25" }, context), true);
  assert.equal(M.isPrimary({ status: "todo", priority: "high", due: "2026-09-18" }, context), false);
  assert.equal(M.isPrimary({ status: "todo", priority: "high", start: "2026-09-20", due: "2026-12-01" }, context), false);
  assert.equal(M.isPrimary({ status: "done", priority: "high", due: "2026-12-01" }, context), false);
  assert.equal(M.isPrimary({ status: "todo", priority: "high", backlog: true, due: "2026-12-01" }, context), false);
  assert.equal(M.isPrimary({ status: "todo", priority: "high", triaged: false, due: "2026-12-01" }, context), false);

  const projects = [
    { file: { path: "10-Project/High/High.md", name: "High" }, priority: "high" },
  ];
  const key = M.taskSortKey({
    title: "Example",
    priority: "medium",
    project: "[[10-Project/High/High|High]]",
    due: null,
    start: null,
    file: { name: "Example.md" },
  }, { dv, projects });
  assert.deepEqual(key, {
    taskPriority: 1,
    projectPriority: 0,
    due: "9999-12-31",
    start: "9999-12-31",
    title: "Example",
  });
});

