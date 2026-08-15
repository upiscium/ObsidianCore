import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

const projectMetaPath = "98-System/02-embed/00-meta/project-note-meta.md";
const workspaceMetaPath = "98-System/02-embed/00-meta/workspace-note-meta.md";
const lifecyclePath = "98-System/02-embed/00-meta/note-lifecycle-controls.md";
const cssPath = ".obsidian/snippets/task-controls.css";

function buttonBlock(source, id) {
  const blocks = source.match(/```meta-bind-button\n[\s\S]*?```/g) ?? [];
  const block = blocks.find(item => item.includes(`id: ${id}\n`));
  assert.ok(block, `Missing Meta Bind button: ${id}`);
  return block;
}

test("Project and Workspace Note metadata share the Note v2 controls", () => {
  const project = read(projectMetaPath);
  const workspace = read(workspaceMetaPath);

  assert.equal(project, workspace);
  assert.match(project, /> \[!info\]- メタデータ管理/);
  assert.match(project, /\[\[note-lifecycle-controls\]\]/);
  assert.match(project, /\[\[note-category-dropdown\]\]/);
  assert.match(project, /\[\[knowledge-promotion-button\]\]/);
  assert.doesNotMatch(project, /\[\[status-dropdown\]\]|\[\[priority-dropdown\]\]/);
});

test("Note lifecycle controls expose only active and archived", () => {
  const controls = read(lifecyclePath);

  assert.match(controls, /\*\*ライフサイクル:\*\* `VIEW\[\{lifecycle\}\]\[text\]`/);
  assert.match(controls, /BUTTON\[note-lifecycle-active, note-lifecycle-archived\]/);

  for (const [id, value] of [
    ["note-lifecycle-active", "active"],
    ["note-lifecycle-archived", "archived"]
  ]) {
    const block = buttonBlock(controls, id);
    assert.match(block, /bindTarget: lifecycle/);
    assert.match(block, new RegExp(`value: ${value}(?:\\n|$)`));
    assert.match(block, /class: note-lifecycle-button/);
  }

  assert.doesNotMatch(controls, /bindTarget: (?:status|priority)/);
});

test("Note lifecycle controls match the canonical Note v2 utility", () => {
  const source = read("98-System/01-script/note_meta_utils.js");
  const N = new Function(`"use strict"; return (${source});`)();

  assert.equal(N.normalizeLifecycle("active"), "active");
  assert.equal(N.normalizeLifecycle("archived"), "archived");
  assert.equal(N.normalizeLifecycle("running"), null);
});

test("Note lifecycle buttons use a compact two-column overflow-safe layout", () => {
  const css = read(cssPath);

  assert.match(css, /\.mb-button-group:has\(> \.mb-button\.note-lifecycle-button\)[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.note-lifecycle-button[\s\S]*?overflow-wrap:\s*anywhere/);
  assert.match(css, /\.note-lifecycle-button[\s\S]*?overflow:\s*hidden/);
});
