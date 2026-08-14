import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

const compatibilityPath = "98-System/02-embed/00-meta/entity-meta-controls.md";
const projectStatusPath = "98-System/02-embed/00-meta/project-status-controls.md";
const workspaceStatusPath = "98-System/02-embed/00-meta/workspace-status-controls.md";
const priorityPath = "98-System/02-embed/00-meta/entity-priority-controls.md";
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

test("Project and Workspace status controls are separated while priority remains shared", () => {
  const projectMeta = read(projectMetaPath);
  const workspaceMeta = read(workspaceMetaPath);
  const compatibility = read(compatibilityPath);

  assert.match(projectMeta, /\[\[project-status-controls\]\]/);
  assert.match(projectMeta, /\[\[entity-priority-controls\]\]/);
  assert.doesNotMatch(projectMeta, /\[\[workspace-status-controls\]\]/);
  assert.match(workspaceMeta, /\[\[entity-meta-controls\]\]/);
  assert.match(compatibility, /\[\[workspace-status-controls\]\]/);
  assert.match(compatibility, /\[\[entity-priority-controls\]\]/);
});

test("Project status controls expose stopped without changing the other canonical values", () => {
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

test("Workspace status controls remain four-state and do not expose stopped", () => {
  const controls = read(workspaceStatusPath);
  assert.match(controls, /BUTTON\[entity-status-planning, entity-status-running, entity-status-done, entity-status-cancelled\]/);
  assert.doesNotMatch(controls, /entity-status-stopped|value: stopped/);
  for (const id of ["entity-status-planning", "entity-status-running", "entity-status-done", "entity-status-cancelled"]) {
    assert.match(buttonBlock(controls, id), /class: entity-status-button/);
  }
});

test("Entity priority controls stay shared and canonical", () => {
  const controls = read(priorityPath);
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
});

test("Project five-button layout preserves overflow containment", () => {
  const css = read(cssPath);
  assert.match(css, /\.mb-button-group:has\(> \.mb-button\.project-status-button\)[\s\S]*?grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.project-status-button/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /overflow:\s*hidden/);
});

test("legacy Entity dropdown embeds remain removed", () => {
  assert.equal(fs.existsSync(path.join(root, statusDropdownPath)), false);
  assert.equal(fs.existsSync(path.join(root, priorityDropdownPath)), false);
});

test("Entity metadata semantics match the Project/Workspace contracts", () => {
  const source = read("98-System/01-script/entity_meta_utils.js");
  const E = new Function(`"use strict"; return (${source});`)();
  for (const status of ["planning", "running", "done", "cancelled"]) {
    assert.equal(E.normalizeWorkspaceStatus(status), status);
    assert.equal(E.normalizeProjectStatus(status), status);
  }
  assert.equal(E.normalizeWorkspaceStatus("stopped"), null);
  assert.equal(E.normalizeProjectStatus("stopped"), "stopped");
  assert.equal(E.statusLabel("stopped"), "⏸️ 停止");
});
