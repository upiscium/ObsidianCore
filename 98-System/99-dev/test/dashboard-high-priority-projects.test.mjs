import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const dashboardPath = "Dashboard.md";
const embedPath = "98-System/02-embed/03-table/high-priority-project-table.md";
const viewPath = "98-System/04-view/high_priority_project_table.js";

test("Dashboard root keeps High Priority Projects before Workspaces and Recent Knowledge fragments", () => {
  const dashboard = read(dashboardPath);
  const highPriorityIndex = dashboard.indexOf("dashboard/high-priority-projects");
  const workspaceIndex = dashboard.indexOf("dashboard/workspaces");
  const knowledgeIndex = dashboard.indexOf("dashboard/recent-knowledge");
  assert.ok(highPriorityIndex >= 0);
  assert.ok(workspaceIndex > highPriorityIndex);
  assert.ok(knowledgeIndex > workspaceIndex);

  const fragment = read("98-System/02-embed/dashboard/high-priority-projects.md");
  assert.match(fragment, /^# 🔥 High Priority Projects$/m);
  assert.match(fragment, /\[\[high-priority-project-table\]\]/);
});

test("Dashboard High Priority Project embed calls the repository-managed view", () => {
  assert.match(read(embedPath), /await dv\.view\("98-System\/04-view\/high_priority_project_table"\)/);
});

test("High Priority Project view requires canonical Project semantics and active Workspace", () => {
  const view = read(viewPath);
  assert.match(view, /entity_meta_utils\.js/);
  assert.match(view, /reference_utils\.js/);
  assert.match(view, /U\.normalizePriority\(p\.priority\) === "high"/);
  assert.match(view, /U\.isProjectListStatus\(p\.status\)/);
  assert.match(view, /U\.isWorkspaceActiveLifecycle\(workspace\.lifecycle\)/);
  assert.match(view, /R\.matchesReference\(project\.workspace, w\.file\.path\)/);
});

test("High Priority Project view sorts by Project status then recent modification", () => {
  const view = read(viewPath);
  assert.match(view, /U\.projectStatusOrder\(a\.status\) - U\.projectStatusOrder\(b\.status\)/);
  assert.match(view, /dv\.compare\(b\.file\.mtime, a\.file\.mtime\)/);
  assert.match(view, /\["Project", "Workspace", "Status", "最終更新日"\]/);
  assert.match(view, /High Priority Projectはありません。/);
  assert.doesNotMatch(view, /\["Project", "Workspace", "Priority"/);
});
