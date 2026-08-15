import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const E = new Function(`"use strict"; return (${read("98-System/01-script/entity_meta_utils.js")});`)();

test("Workspace v2 template has lifecycle only and no Task-derived state", () => {
  const template = read("98-System/03-template/00-entry/workspace-entry-template.md");
  assert.match(template, /^---\ntype: workspace\nlifecycle: active\n---/);
  assert.doesNotMatch(template, /^status:/m);
  assert.doesNotMatch(template, /^priority:/m);
});

test("Workspace lifecycle distinguishes active, inactive and archived", () => {
  assert.equal(E.workspaceLifecycleLabel("active"), "✅ 有効");
  assert.equal(E.workspaceLifecycleLabel("inactive"), "⏸️ 休止");
  assert.equal(E.workspaceLifecycleLabel("archived"), "📦 アーカイブ");
  assert.equal(E.isWorkspaceActiveLifecycle("active"), true);
  assert.equal(E.isWorkspaceActiveLifecycle("inactive"), false);
  assert.equal(E.isWorkspaceVisibleLifecycle("active"), true);
  assert.equal(E.isWorkspaceVisibleLifecycle("inactive"), true);
  assert.equal(E.isWorkspaceVisibleLifecycle("archived"), false);
});

test("Project visibility is gated by parent Workspace lifecycle without mutating Project status", () => {
  for (const status of ["planning", "running", "stopped"]) {
    assert.equal(E.isProjectVisibleInWorkspace(status, "active"), true, status);
    assert.equal(E.isProjectVisibleInWorkspace(status, "inactive"), false, status);
    assert.equal(E.isProjectVisibleInWorkspace(status, "archived"), false, status);
  }
  assert.equal(E.normalizeProjectStatus("running"), "running");
  assert.equal(E.normalizeProjectStatus("stopped"), "stopped");
});

test("Workspace list keeps inactive rows and reports actual Project Entry counts", () => {
  const view = read("98-System/04-view/workspace_table.js");
  assert.match(view, /isWorkspaceVisibleLifecycle\(w\.lifecycle\)/);
  assert.match(view, /\.where\(p => p\.type === "project"\)/);
  assert.match(view, /projectCount: projects\.filter\(p => isSameWorkspace\(p, w\)\)\.length/);
  assert.doesNotMatch(view, /isWorkspaceActiveLifecycle\(w\.lifecycle\)/);
  assert.doesNotMatch(view, /isProjectListStatus\(p\.status\)/);
  assert.match(view, /\["Workspace", "ライフサイクル", "Project数", "最終更新日"\]/);
  assert.doesNotMatch(view, /\["Workspace", "ステータス", "優先度"/);
});

test("normal Project surfaces require an active parent Workspace", () => {
  const projectTable = read("98-System/04-view/project_table.js");
  const dashboard = read("98-System/04-view/high_priority_project_table.js");
  const health = read("98-System/04-view/entity_task_health.js");
  const weekly = read("98-System/04-view/weekly_review.js");

  assert.match(projectTable, /!U\.isWorkspaceActiveLifecycle\(current\.lifecycle\)/);
  assert.match(dashboard, /U\.isWorkspaceActiveLifecycle\(workspace\.lifecycle\)/);
  assert.match(health, /E\.isWorkspaceActiveLifecycle\(current\.lifecycle\)/);
  assert.match(weekly, /const projects = allProjects\.filter\(hasActiveWorkspace\)/);
  assert.match(weekly, /const activeWorkspaces = workspaces\.filter\(workspace => E\.isWorkspaceActiveLifecycle\(workspace\.lifecycle\)\)/);
});

test("Task context selectors accept active Workspace lifecycle but reject inactive", () => {
  const refs = read("98-System/01-script/entity_reference_utils.js");
  const taskCreation = read("98-System/01-script/task_creation_utils.js");
  const selectContext = read("98-System/01-script/select_task_context.js");
  const recurring = read("98-System/01-script/create_recurring_task.js");
  const taskTable = read("98-System/04-view/task_table.js");

  assert.match(refs, /isActiveStatus\(entity\.status \|\| entity\.lifecycle\)/);
  for (const consumer of [taskCreation, selectContext, recurring, taskTable]) {
    assert.match(consumer, /isActiveStatus:\s*E\.isActiveStatus/);
  }
  assert.equal(E.isActiveStatus("active"), true);
  assert.equal(E.isActiveStatus("inactive"), false);
  assert.equal(E.isActiveStatus("archived"), false);
});

test("direct Project creation is blocked outside active Workspace", () => {
  const source = read("98-System/01-script/create_workspace_project.js");
  assert.match(source, /cache\.frontmatter\.lifecycle !== "active"/);
  assert.match(source, /Projectは有効なWorkspaceでのみ作成できます/);
});
