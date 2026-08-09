import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function readExpression(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  return new Function(`"use strict"; return (${source});`)();
}

const Q = readExpression("98-System/01-script/task_triage_utils.js");

test("Task triage builds the canonical mutation patch", () => {
  const patch = Q.buildTriagePatch({
    priority: "high",
    start: "2026-08-10",
    due: "2026-08-20",
    workspace: "[[03-Workspace/Research|Research]]",
    project: "[[10-Project/Terreate|Terreate]]"
  });

  assert.deepEqual(patch, {
    priority: "high",
    start: "2026-08-10",
    due: "2026-08-20",
    workspace: "[[03-Workspace/Research|Research]]",
    project: "[[10-Project/Terreate|Terreate]]",
    triaged: true
  });
});

test("Task triage supports empty optional fields", () => {
  assert.deepEqual(Q.buildTriagePatch({
    priority: null,
    start: "",
    due: "2026-08-20",
    workspace: null,
    project: null
  }), {
    priority: null,
    start: null,
    due: "2026-08-20",
    workspace: null,
    project: null,
    triaged: true
  });
});

test("Task triage requires a valid Due", () => {
  assert.throws(() => Q.buildTriagePatch({ due: "" }), /Dueは必須/);
  assert.throws(() => Q.buildTriagePatch({ due: "2026-02-30" }), /Dueの日付が不正/);
  assert.throws(() => Q.buildTriagePatch({ due: "2026\/08\/20" }), /YYYY-MM-DD/);
});

test("Task triage rejects invalid priority and Start after Due", () => {
  assert.throws(() => Q.buildTriagePatch({ priority: "urgent", due: "2026-08-20" }), /priority/);
  assert.throws(() => Q.buildTriagePatch({ start: "2026-08-21", due: "2026-08-20" }), /StartはDue以前/);
});

test("Task triage requires Workspace when Project is set", () => {
  assert.throws(() => Q.buildTriagePatch({
    due: "2026-08-20",
    project: "[[10-Project/Terreate|Terreate]]"
  }), /Workspace/);
});

test("applying a triage patch preserves unrelated Task metadata", () => {
  const frontmatter = {
    type: "task",
    title: "Example",
    source: "[[Source]]",
    created: "2026-08-09",
    completed: null,
    status: "todo",
    backlog: false,
    depends_on: ["[[02-Task/Dependency]]"],
    priority: null,
    start: null,
    due: "2026-08-10",
    workspace: null,
    project: null,
    triaged: false
  };
  const patch = Q.buildTriagePatch({
    priority: "medium",
    start: "2026-08-10",
    due: "2026-08-18",
    workspace: "[[03-Workspace/Research|Research]]",
    project: null
  });

  Q.applyTriagePatch(frontmatter, patch);

  assert.equal(frontmatter.type, "task");
  assert.equal(frontmatter.title, "Example");
  assert.equal(frontmatter.source, "[[Source]]");
  assert.equal(frontmatter.status, "todo");
  assert.equal(frontmatter.backlog, false);
  assert.deepEqual(frontmatter.depends_on, ["[[02-Task/Dependency]]"]);
  assert.equal(frontmatter.priority, "medium");
  assert.equal(frontmatter.start, "2026-08-10");
  assert.equal(frontmatter.due, "2026-08-18");
  assert.equal(frontmatter.workspace, "[[03-Workspace/Research|Research]]");
  assert.equal(frontmatter.project, null);
  assert.equal(frontmatter.triaged, true);
});
