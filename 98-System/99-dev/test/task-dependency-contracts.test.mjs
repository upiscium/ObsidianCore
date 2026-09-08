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

test("existing dependency button supports both edge directions with cycle guards", () => {
  const source = fs.readFileSync(
    path.join(root, "98-System/01-script/add_task_dependency.js"),
    "utf8"
  );

  assert.match(source, /このTaskが依存するTaskを追加/);
  assert.match(source, /このTaskに依存するTaskを追加/);
  assert.match(source, /wouldCreateCycle\(activeFile\.path, task\.file\.path/);
  assert.match(source, /wouldCreateCycle\(task\.file\.path, activeFile\.path/);
  assert.match(source, /processFrontMatter\(selected\.file/);
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
