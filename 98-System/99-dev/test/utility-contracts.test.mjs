import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function readExpression(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  return new Function(`"use strict"; return (${source});`)();
}

const G = readExpression("98-System/01-script/reference_utils.js");
const T = readExpression("98-System/01-script/task_meta_utils.js");
const E = readExpression("98-System/01-script/entity_meta_utils.js");
const taskReferenceFactory = readExpression("98-System/01-script/task_reference_utils.js");
const R = taskReferenceFactory(G);

test("reference parsing preserves path and alias", () => {
  assert.deepEqual(G.parseReference("[[03-Workspace/Research|研究]]"), {
    path: "03-Workspace/Research",
    alias: "研究"
  });
  assert.deepEqual(G.parseReference({ path: "10-Project/Terreate.md", display: "Terreate" }), {
    path: "10-Project/Terreate",
    alias: "Terreate"
  });
});

test("reference normalization supports arrays and Dataview-like arrays", () => {
  const dataArray = { array: () => ["[[A]]", "[[B]]"] };
  assert.deepEqual(G.asArray(null), []);
  assert.deepEqual(G.asArray(dataArray), ["[[A]]", "[[B]]"]);
  assert.deepEqual(G.normalizeReferences(["[[A]]", "[[Folder/B|Bee]]"]), ["A", "Folder/B"]);
});

test("reference matching accepts full path and basename", () => {
  const value = "[[03-Workspace/Research|研究]]";
  assert.equal(G.matchesReference(value, "03-Workspace/Research"), true);
  assert.equal(G.matchesReference(value, "Research"), true);
  assert.equal(G.matchesReference(value, "Other"), false);
  assert.equal(G.matchesReference(value, null), true);
});

test("indexed references resolve case-insensitively by path or basename", () => {
  const workspace = { file: { path: "03-Workspace/Research.md", basename: "Research" } };
  const index = G.indexByFilePath([workspace]);
  assert.equal(G.resolveIndexedReference("[[03-workspace/research]]", index), workspace);
  assert.equal(G.resolveIndexedReference("[[RESEARCH]]", index), workspace);
  assert.equal(G.resolveIndexedReference("[[Missing]]", index), null);
});

test("reference labels prefer aliases", () => {
  assert.equal(G.referenceLabel("[[10-Project/Terreate|Engine]]"), "Engine");
  assert.equal(G.referenceLabel("[[10-Project/Terreate]]"), "Terreate");
  assert.equal(G.looksLikeLink("[[Terreate]]"), true);
  assert.equal(G.looksLikeLink("Terreate"), false);
});

test("Task metadata accepts canonical values and rejects legacy values", () => {
  assert.equal(T.isTaskType("task"), true);
  assert.equal(T.isTaskType("task-pack"), false);
  assert.equal(T.normalizeTaskStatus("doing"), "doing");
  assert.equal(T.normalizeTaskStatus("running"), null);
  assert.equal(T.normalizeTaskPriority("high"), "high");
  assert.equal(T.normalizeTaskPriority("1"), null);
  assert.equal(T.normalizeTaskPriority(null), "none");
  assert.equal(T.isTaskClosedStatus("done"), true);
  assert.equal(T.isTaskActionableStatus("todo"), true);
});

test("Entity metadata accepts canonical values and rejects legacy values", () => {
  assert.equal(E.normalizeStatus("planning"), "planning");
  assert.equal(E.normalizeStatus("archived"), null);
  assert.equal(E.normalizePriority("medium"), "medium");
  assert.equal(E.normalizePriority("2"), null);
  assert.equal(E.normalizePriority(null), "none");
  assert.equal(E.isActiveStatus("running"), true);
  assert.equal(E.isArchivedStatus("done"), true);
  assert.equal(E.isHiddenStatus("cancelled"), true);
});

test("Task reference utility delegates generic behavior without metadata semantics", () => {
  assert.equal(R.normalizeLinkpath("[[03-Workspace/Research|研究]]"), "03-Workspace/Research");
  assert.equal(R.referenceLabel("[[10-Project/Terreate|Engine]]"), "Engine");
  assert.equal(R.isTaskType, undefined);
  assert.equal(R.normalizeTaskStatus, undefined);
  assert.equal(R.taskStatusLabel, undefined);
  assert.equal(R.taskStatusOrder, undefined);
  assert.equal(R.stripTaskTimestamp("20260809-123456-789-Example"), "Example");
});

test("dependencyInfo reports open, missing, and closed dependencies", () => {
  const open = { file: { path: "02-Task/Open.md", name: "Open" }, status: "todo", depends_on: [] };
  const closed = { file: { path: "02-Task/Closed.md", name: "Closed" }, status: "done", depends_on: [] };
  const pages = new Map([
    ["02-Task/Open", open], ["Open", open],
    ["02-Task/Closed", closed], ["Closed", closed]
  ]);
  const dv = { page: key => pages.get(key) ?? null };
  const task = {
    file: { path: "02-Task/Root.md", name: "Root" },
    depends_on: ["[[02-Task/Open]]", "[[02-Task/Closed]]", "[[02-Task/Missing|Lost]]"]
  };

  const info = R.dependencyInfo(dv, task, T.isTaskClosedStatus);
  assert.equal(info.blocked, true);
  assert.equal(info.cyclic, false);
  assert.deepEqual(info.unresolved.map(page => page.file.path), ["02-Task/Open.md"]);
  assert.deepEqual(info.missing, ["Lost"]);
});

test("dependencyInfo detects cycles", () => {
  const a = { file: { path: "02-Task/A.md", name: "A" }, status: "todo", depends_on: ["[[02-Task/B]]"] };
  const b = { file: { path: "02-Task/B.md", name: "B" }, status: "todo", depends_on: ["[[02-Task/A]]"] };
  const pages = new Map([
    ["02-Task/A", a], ["A", a],
    ["02-Task/B", b], ["B", b]
  ]);
  const dv = { page: key => pages.get(key) ?? null };

  const info = R.dependencyInfo(dv, a, T.isTaskClosedStatus);
  assert.equal(info.cyclic, true);
  assert.equal(info.blocked, true);
});
