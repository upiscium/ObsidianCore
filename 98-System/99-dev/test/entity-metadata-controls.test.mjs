import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

const projectStatusPath = "98-System/02-embed/00-meta/project-status-controls.md";
const workspaceLifecyclePath = "98-System/02-embed/00-meta/workspace-lifecycle-controls.md";
const priorityPath = "98-System/02-embed/00-meta/entity-priority-controls.md";
const projectMetaPath = "98-System/02-embed/00-meta/project-meta.md";
const workspaceMetaPath = "98-System/02-embed/00-meta/workspace-meta.md";
const legacyCompatibilityPath = "98-System/02-embed/00-meta/entity-meta-controls.md";
const legacyWorkspaceStatusPath = "98-System/02-embed/00-meta/workspace-status-controls.md";
const statusDropdownPath = "98-System/02-embed/06-dropdown/entity-status-dropdown.md";
const priorityDropdownPath = "98-System/02-embed/06-dropdown/entity-priority-dropdown.md";
const cssPath = ".obsidian/snippets/task-controls.css";

function buttonBlock(source, id) {
  const blocks = source.match(/```meta-bind-button\n[\s\S]*?```/g) ?? [];
  const block = blocks.find(item => item.includes(`id: ${id}\n`));
  assert.ok(block, `Missing Meta Bind button: ${id}`);
  return block;
}

test("Project and Workspace own separate metadata callouts", () => {
  const projectMeta = read(projectMetaPath);
  const workspaceMeta = read(workspaceMetaPath);
  const projectStatus = read(projectStatusPath);
  const workspaceLifecycle = read(workspaceLifecyclePath);
  const priority = read(priorityPath);

  assert.match(projectMeta, /^> \[!info\]- メタデータ管理/m);
  assert.match(projectMeta, /> ```meta-bind-embed\n> \[\[project-status-controls\]\]\n> ```/);
  assert.match(projectMeta, /> ```meta-bind-embed\n> \[\[entity-priority-controls\]\]\n> ```/);
  assert.doesNotMatch(projectMeta, /workspace-lifecycle-controls/);

  assert.match(workspaceMeta, /^> \[!info\]- メタデータ管理/m);
  assert.match(workspaceMeta, /> ```meta-bind-embed\n> \[\[workspace-lifecycle-controls\]\]\n> ```/);
  assert.doesNotMatch(workspaceMeta, /entity-priority-controls|project-status-controls|workspace-status-controls/);

  for (const component of [projectStatus, workspaceLifecycle, priority]) {
    assert.doesNotMatch(component, /^> \[!info\]/m);
  }
});

test("Project status controls keep the canonical five-state contract", () => {
  const controls = read(projectStatusPath);
  assert.match(controls, /BUTTON\[entity-status-planning, entity-status-running, entity-status-stopped, entity-status-done, entity-status-cancelled\]/);
  const expected = {
    "entity-status-planning": "planning",
    "entity-status-running": "running",
    "entity-status-stopped": "stopped",
    "entity-status-done": "done",
    "entity-status-cancelled": "cancelled"
  };
  for (const [id, value] of Object.entries(expected)) {
    const block = buttonBlock(controls, id);
    assert.match(block, /bindTarget: status/);
    assert.match(block, new RegExp(`value: ${value}(?:\\n|$)`));
    assert.match(block, /class: project-status-button/);
  }
});

test("Workspace lifecycle controls expose only active inactive archived", () => {
  const controls = read(workspaceLifecyclePath);
  assert.match(controls, /^\*\*ライフサイクル:\*\* `VIEW\[\{lifecycle\}\]\[text\]`/m);
  assert.match(controls, /BUTTON\[workspace-lifecycle-active, workspace-lifecycle-inactive, workspace-lifecycle-archived\]/);
  const expected = {
    "workspace-lifecycle-active": "active",
    "workspace-lifecycle-inactive": "inactive",
    "workspace-lifecycle-archived": "archived"
  };
  for (const [id, value] of Object.entries(expected)) {
    const block = buttonBlock(controls, id);
    assert.match(block, /bindTarget: lifecycle/);
    assert.match(block, new RegExp(`value: ${value}(?:\\n|$)`));
    assert.match(block, /class: workspace-lifecycle-button/);
    assert.doesNotMatch(block, /bindTarget: status|bindTarget: priority/);
  }
});

test("Entity priority controls remain available to Project UI only", () => {
  const controls = read(priorityPath);
  for (const [id, value] of Object.entries({
    "entity-priority-high": "high",
    "entity-priority-medium": "medium",
    "entity-priority-low": "low"
  })) {
    const block = buttonBlock(controls, id);
    assert.match(block, /bindTarget: priority/);
    assert.match(block, new RegExp(`value: ${value}(?:\\n|$)`));
  }
  const none = buttonBlock(controls, "entity-priority-none");
  assert.match(none, /evaluate: true/);
  assert.match(none, /value: "null"/);
  assert.doesNotMatch(read(workspaceMetaPath), /entity-priority-controls/);
});

test("Workspace lifecycle three-button layout preserves overflow containment", () => {
  const css = read(cssPath);
  assert.match(css, /\.mb-button-group:has\(> \.mb-button\.workspace-lifecycle-button\)[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.workspace-lifecycle-button/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /overflow:\s*hidden/);
});

test("legacy Workspace status wrapper and controls are removed", () => {
  assert.equal(fs.existsSync(path.join(root, legacyCompatibilityPath)), false);
  assert.equal(fs.existsSync(path.join(root, legacyWorkspaceStatusPath)), false);
});

test("legacy Entity dropdown embeds remain removed", () => {
  assert.equal(fs.existsSync(path.join(root, statusDropdownPath)), false);
  assert.equal(fs.existsSync(path.join(root, priorityDropdownPath)), false);
});

test("Entity metadata semantics match Workspace lifecycle and Project status UI", () => {
  const E = new Function(`"use strict"; return (${read("98-System/01-script/entity_meta_utils.js")});`)();
  for (const lifecycle of ["active", "inactive", "archived"]) {
    assert.equal(E.normalizeWorkspaceLifecycle(lifecycle), lifecycle);
  }
  assert.equal(E.normalizeWorkspaceLifecycle("running"), null);
  for (const status of ["planning", "running", "stopped", "done", "cancelled"]) {
    assert.equal(E.normalizeProjectStatus(status), status);
  }
  assert.equal(E.normalizeProjectStatus("active"), null);
  assert.equal(E.projectStatusLabel("stopped"), "⏸️ 停止");
  assert.equal(E.workspaceLifecycleLabel("inactive"), "⏸️ 休止");
});
