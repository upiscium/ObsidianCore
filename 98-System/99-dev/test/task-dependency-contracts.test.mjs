import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function readExpression(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  return new Function(`"use strict"; return (${source});`)();
}

const D = readExpression("98-System/01-script/task_dependency_utils.js");

test("dependency graph detects proposed cycles", () => {
  const graph = new Map([
    ["A", ["B"]],
    ["B", ["C"]],
    ["C", []]
  ]);
  const outgoing = path => graph.get(path) ?? [];

  assert.equal(D.reaches("A", "C", outgoing), true);
  assert.equal(D.reaches("C", "A", outgoing), false);
  assert.equal(D.wouldCreateCycle("C", "A", outgoing), true);
  assert.equal(D.wouldCreateCycle("A", "C", outgoing), false);
  assert.equal(D.wouldCreateCycle("A", "A", outgoing), true);
});

test("dependency graph reports every member of a multi-path cycle", () => {
  const graph = new Map([
    ["A", ["B", "C"]],
    ["B", ["D"]],
    ["C", ["D"]],
    ["D", ["A"]],
    ["E", ["F"]],
    ["F", []]
  ]);
  const members = D.cycleMembers([...graph.keys()], path => graph.get(path) ?? []);
  assert.deepEqual([...members].sort(), ["A", "B", "C", "D"]);
});

test("parent and child dependency buttons use fixed edge directions with cycle guards", () => {
  const parent = fs.readFileSync(
    path.join(root, "98-System/01-script/add_task_dependency.js"),
    "utf8"
  );
  const child = fs.readFileSync(
    path.join(root, "98-System/01-script/add_child_task_dependency.js"),
    "utf8"
  );

  assert.match(parent, /親タスクを選択/);
  assert.match(parent, /wouldCreateCycle\(activeFile\.path, task\.file\.path/);
  assert.doesNotMatch(parent, /依存関係の向きを選択/);

  assert.match(child, /子タスクを選択/);
  assert.match(child, /wouldCreateCycle\(task\.file\.path, activeFile\.path/);
  assert.match(child, /processFrontMatter\(selected\.file/);
});

test("Task note exposes exactly the three dependency controls through a shared embed", () => {
  const meta = fs.readFileSync(
    path.join(root, "98-System/02-embed/00-meta/task-note-meta.md"),
    "utf8"
  );
  const controls = fs.readFileSync(
    path.join(root, "98-System/02-embed/01-button/task-dependency-controls.md"),
    "utf8"
  );
  const template = fs.readFileSync(
    path.join(root, "98-System/03-template/01-note/task-note-template.md"),
    "utf8"
  );

  assert.match(meta, /id: task-add-dependency\nlabel: 親タスクを追加/);
  assert.match(meta, /id: task-add-child\nlabel: 子タスクを追加/);
  assert.match(meta, /id: task-remove-dependency\nlabel: 依存を削除/);
  assert.match(controls, /^`BUTTON\[task-add-dependency, task-add-child, task-remove-dependency\]`/m);
  assert.match(template, /\[\[98-System\/02-embed\/01-button\/task-dependency-controls\|task-dependency-controls\]\]/);
  assert.doesNotMatch(template, /BUTTON\[task-add-dependency/);
});

test("dependency removal can remove both parent and child edges", () => {
  const source = fs.readFileSync(
    path.join(root, "98-System/01-script/remove_task_dependency.js"),
    "utf8"
  );

  assert.match(source, /kind: "parent"/);
  assert.match(source, /kind: "child"/);
  assert.match(source, /removeParentDependency/);
  assert.match(source, /removeChildDependency/);
  assert.match(source, /processFrontMatter\(candidate\.file/);
});

test("normal and Backlog creation can choose dependencies without slowing Quick capture", () => {
  const create = fs.readFileSync(path.join(root, "98-System/01-script/create_task.js"), "utf8");
  const backlog = fs.readFileSync(path.join(root, "98-System/01-script/backlog_task.js"), "utf8");
  const quick = fs.readFileSync(path.join(root, "98-System/01-script/quick_task.js"), "utf8");

  for (const source of [create, backlog]) {
    assert.match(source, /chooseDependencies/);
    assert.match(source, /applyDependencies/);
  }
  assert.doesNotMatch(quick, /chooseDependencies/);
});

test("Vault validation command includes dependency validation", () => {
  const command = fs.readFileSync(
    path.join(root, "98-System/00-command/validate_vault.md"),
    "utf8"
  );
  assert.match(command, /tp\.user\.validate_vault\(tp\)/);
  assert.match(command, /tp\.user\.validate_task_dependencies\(tp\)/);
});
