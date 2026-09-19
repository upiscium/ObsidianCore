import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const dashboardPath = "Dashboard.md";
const dashboardFragmentPath = "98-System/02-embed/dashboard/high-priority-projects.md";
const embedPath = "98-System/02-embed/03-table/high-priority-project-table.md";
const viewPath = "98-System/04-view/projects/high_priority_project_table.js";

test("Dashboard no longer exposes High Priority Projects", () => {
  const dashboard = read(dashboardPath);
  assert.doesNotMatch(dashboard, /dashboard\/high-priority-projects/);
  assert.equal(fs.existsSync(path.join(root, dashboardFragmentPath)), false);
});

test("Reusable High Priority Project embed remains available outside Dashboard", () => {
  assert.equal(fs.existsSync(path.join(root, embedPath)), true);
  assert.match(read(embedPath), /await dv\.view\("98-System\/04-view\/projects\/high_priority_project_table"\)/);
});

test("High Priority Project view keeps canonical Project semantics and active Workspace", () => {
  const view = read(viewPath);
  assert.match(view, /entity_meta_utils\.js/);
  assert.match(view, /reference_utils\.js/);
  assert.match(view, /U\.normalizePriority\(p\.priority\) === "high"/);
  assert.match(view, /U\.isProjectListStatus\(p\.status\)/);
  assert.match(view, /M\.projectHasActiveWorkspace\(p, workspaces\)/);
  assert.match(view, /entity_view_utils\.js/);
});

test("High Priority Project view keeps standalone ordering and columns", () => {
  const view = read(viewPath);
  assert.match(view, /M\.compareHighPriorityProjects\(a, b, dv\.compare\)/);
  assert.match(view, /\["Project", "Workspace", "Status", "最終更新日"\]/);
  assert.match(view, /High Priority Projectはありません。/);
});
