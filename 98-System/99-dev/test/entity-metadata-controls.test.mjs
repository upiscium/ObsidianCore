import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

const controlsPath = "98-System/02-embed/00-meta/entity-meta-controls.md";
const projectMetaPath = "98-System/02-embed/00-meta/project-meta.md";
const workspaceMetaPath = "98-System/02-embed/00-meta/workspace-meta.md";
const statusDropdownPath = "98-System/02-embed/06-dropdown/entity-status-dropdown.md";
const priorityDropdownPath = "98-System/02-embed/06-dropdown/entity-priority-dropdown.md";
const cssPath = ".obsidian/snippets/task-controls.css";

function buttonBlock(source, id) {
  const blocks = source.match(/```meta-bind-button\n[\s\S]*?```/g) ?? [];
  const block = blocks.find(item => item.includes(`id: ${id}\n`));
  assert.ok(block, `Missing Meta Bind button: ${id}`);
  return block;
}

test("Entity metadata controls expose current values and four-button groups", () => {
  const controls = read(controlsPath);

  assert.match(controls, /\*\*状態:\*\* `VIEW\[\{status\}\]\[text\]`/);
  assert.match(controls, /BUTTON\[entity-status-planning, entity-status-running, entity-status-done, entity-status-cancelled\]/);
  assert.match(controls, /\*\*優先度:\*\* `VIEW\[\{priority\}\]\[text\]`/);
  assert.match(controls, /BUTTON\[entity-priority-high, entity-priority-medium, entity-priority-low, entity-priority-none\]/);
  assert.doesNotMatch(controls, /inlineSelect/);
});

test("Entity status buttons write only canonical Entity statuses", () => {
  const controls = read(controlsPath);
  const expected = {
    "entity-status-planning": "planning",
    "entity-status-running": "running",
    "entity-status-done": "done",
    "entity-status-cancelled": "cancelled"
  };

  for (const [id, value] of Object.entries(expected)) {
    const block = buttonBlock(controls, id);
    assert.match(block, /bindTarget: status/);
    assert.match(block, new RegExp(`value: ${value}(?:\\n|$)`));
    assert.match(block, /class: entity-status-button/);
  }
});

test("Entity priority buttons write only canonical Entity priorities", () => {
  const controls = read(controlsPath);
  const expected = {
    "entity-priority-high": "high",
    "entity-priority-medium": "medium",
    "entity-priority-low": "low"
  };

  for (const [id, value] of Object.entries(expected)) {
    const block = buttonBlock(controls, id);
    assert.match(block, /bindTarget: priority/);
    assert.match(block, new RegExp(`value: ${value}(?:\\n|$)`));
    assert.match(block, /class: entity-priority-button/);
  }

  const none = buttonBlock(controls, "entity-priority-none");
  assert.match(none, /bindTarget: priority/);
  assert.match(none, /evaluate: true/);
  assert.match(none, /value: "null"/);
  assert.match(none, /class: entity-priority-button/);
});

test("Project and Workspace metadata use the same shared Entity controls", () => {
  const project = read(projectMetaPath);
  const workspace = read(workspaceMetaPath);

  assert.equal(project, workspace);
  assert.match(project, /\[\[entity-meta-controls\]\]/);
  assert.doesNotMatch(project, /entity-status-dropdown|entity-priority-dropdown/);
  assert.doesNotMatch(workspace, /entity-status-dropdown|entity-priority-dropdown/);
});

test("legacy Entity dropdown embeds are removed", () => {
  assert.equal(fs.existsSync(path.join(root, statusDropdownPath)), false);
  assert.equal(fs.existsSync(path.join(root, priorityDropdownPath)), false);
});

test("Entity button groups reuse the four-column Task control layout", () => {
  const css = read(cssPath);
  assert.match(css, /\.entity-status-button/);
  assert.match(css, /\.entity-priority-button/);
  assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
});

test("Entity metadata semantics remain canonical", () => {
  const source = read("98-System/01-script/entity_meta_utils.js");
  const E = new Function(`"use strict"; return (${source});`)();

  for (const status of ["planning", "running", "done", "cancelled"]) {
    assert.equal(E.normalizeStatus(status), status);
  }
  for (const priority of ["high", "medium", "low"]) {
    assert.equal(E.normalizePriority(priority), priority);
  }
  assert.equal(E.normalizePriority(null), "none");
});
