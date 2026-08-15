import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const dashboardPath = "Dashboard.md";
const embedPath = "98-System/02-embed/03-table/high-priority-project-table.md";
const viewPath = "98-System/04-view/high_priority_project_table.js";

test("Dashboard places High Priority Projects between Workspaces and Recent knowledges", () => {
  const dashboard = read(dashboardPath);
  const workspaceIndex = dashboard.indexOf("# Workspaces");
  const highPriorityIndex = dashboard.indexOf("# 🔥 High Priority Projects");
  const knowledgeIndex = dashboard.indexOf("# 📝 Recent knowledges");
  assert.ok(workspaceIndex >= 0);
  assert.ok(highPriorityIndex > workspaceIndex);
  assert.ok(knowledgeIndex > highPriorityIndex);
  assert.match(dashboard, /\[\[high-priority-project-table\]\]/);
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
