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
  for (const status of ["planning", "running", "stopped", "stable"]) {
    assert.equal(E.isProjectVisibleInWorkspace(status, "active"), true, status);
    assert.equal(E.isProjectVisibleInWorkspace(status, "inactive"), false, status);
    assert.equal(E.isProjectVisibleInWorkspace(status, "archived"), false, status);
  }
  assert.equal(E.normalizeProjectStatus("running"), "running");
  assert.equal(E.normalizeProjectStatus("stopped"), "stopped");
  assert.equal(E.normalizeProjectStatus("stable"), "stable");
});

test("Workspace list keeps inactive rows and reports planning-running-stopped-stable Project counts", () => {
  const view = read("98-System/04-view/projects/workspace_table.js");
  assert.match(view, /isWorkspaceVisibleLifecycle\(w\.lifecycle\)/);
  assert.match(view, /\.where\(p => p\.type === "project"\)/);
  assert.match(view, /projectCounts: M\.projectStatusCountsForWorkspace\(projects, w\)/);
  assert.match(view, /M\.formatProjectStatusCounts\(row\.projectCounts\)/);
  assert.doesNotMatch(view, /isWorkspaceActiveLifecycle\(w\.lifecycle\)/);
  assert.match(
    view,
    /\["Workspace", "ライフサイクル", "Project数 \(planning \| running \| stopped \| stable\)", "最終更新日"\]/
  );
  assert.doesNotMatch(view, /\["Workspace", "ステータス", "優先度"/);
});

test("normal Project surfaces require an active parent Workspace", () => {
  const projectTable = read("98-System/04-view/projects/project_table.js");
  const dashboard = read("98-System/04-view/projects/high_priority_project_table.js");
  const attention = read("98-System/04-view/tasks/task_attention.js");

  assert.match(projectTable, /!U\.isWorkspaceActiveLifecycle\(current\.lifecycle\)/);
  assert.match(dashboard, /M\.projectHasActiveWorkspace\(p, workspaces\)/);
  const projectEntry = read("98-System/02-embed/projects/project-entry-content.md");
  const workspaceEntry = read("98-System/02-embed/projects/workspace-entry-content.md");
  assert.doesNotMatch(projectEntry, /entity-task-health|Task Health/);
  assert.doesNotMatch(workspaceEntry, /entity-task-health|Task Health/);
  assert.match(attention, /projects[\s\S]*?\.filter\(hasActiveWorkspace\)/);
  assert.match(attention, /E\.isWorkspaceActiveLifecycle\(workspace\.lifecycle\)/);
});

test("Task context selectors use typed Workspace and Project eligibility", () => {
  const refs = read("98-System/01-script/entity_reference_utils.js");
  const taskCreation = read("98-System/01-script/task_creation_utils.js");
  const selectContext = read("98-System/01-script/select_task_context.js");
  const recurring = read("98-System/01-script/create_recurring_task.js");
  const taskTable = read("98-System/04-view/tasks/task_table.js");

  assert.match(refs, /typeof isEligible !== "function"/);
  assert.doesNotMatch(refs, /isActiveStatus/);
  for (const consumer of [taskCreation, selectContext, recurring, taskTable]) {
    assert.match(consumer, /isEligible:/);
    assert.match(consumer, /isWorkspaceActiveLifecycle\(entity\.lifecycle\)/);
    assert.match(consumer, /isProjectActiveStatus\(entity\.status\)/);
    assert.doesNotMatch(consumer, /isActiveStatus/);
  }
});

test("direct Project creation is blocked outside active Workspace", () => {
  const source = read("98-System/01-script/create_workspace_project.js");
  assert.match(source, /cache\.frontmatter\.lifecycle !== "active"/);
  assert.match(source, /Projectは有効なWorkspaceでのみ作成できます/);
});
