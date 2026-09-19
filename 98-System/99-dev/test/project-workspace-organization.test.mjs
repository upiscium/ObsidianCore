import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const expression = relativePath => new Function(`"use strict"; return (${read(relativePath)});`)();

test("stable Project and Workspace entry basenames delegate to organized composition", () => {
  assert.equal(
    read("98-System/02-embed/02-entry/project-entry.md"),
    "```meta-bind-embed\n[[98-System/02-embed/projects/project-entry-content|project-entry-content]]\n```\n",
  );
  assert.equal(
    read("98-System/02-embed/02-entry/workspace-entry.md"),
    "```meta-bind-embed\n[[98-System/02-embed/projects/workspace-entry-content|workspace-entry-content]]\n```\n",
  );
  assert.match(read("98-System/02-embed/projects/project-entry-content.md"), /\[\[project-github-status\]\]/);
  assert.match(read("98-System/02-embed/projects/project-entry-content.md"), /\[\[entity-task-health\]\]/);
  assert.match(read("98-System/02-embed/projects/workspace-entry-content.md"), /\[\[active-project-table\]\]/);
});

test("organized Project Workspace views compile", () => {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  for (const relativePath of [
    "98-System/04-view/projects/project_table.js",
    "98-System/04-view/projects/workspace_table.js",
    "98-System/04-view/projects/high_priority_project_table.js",
    "98-System/04-view/projects/note_table.js",
    "98-System/04-view/projects/entity_task_health.js",
    "98-System/04-view/projects/project_github_status.js",
  ]) {
    assert.doesNotThrow(() => new AsyncFunction("dv", "input", "app", "document", "Notice", relativePath === "" ? "" : read(relativePath)));
  }
});

test("Entity view-model preserves Workspace relation, visibility, counts and ordering", () => {
  const V = expression("98-System/05-lib/shared/view_utils.js");
  const factory = expression("98-System/05-lib/projects/entity_view_utils.js");
  const U = {
    isWorkspaceActiveLifecycle: value => value === "active",
    normalizeProjectStatus: value =>
      new Set(["planning", "running", "stopped", "done", "cancelled"]).has(value)
        ? value
        : null,
    projectStatusOrder: value => ({ running: 0, planning: 1, stopped: 2 }[value] ?? 9),
    workspaceLifecycleOrder: value => ({ active: 0, inactive: 1, archived: 2 }[value] ?? 9),
  };
  const R = {
    matchesReference(value, target) {
      return String(value ?? "").includes(String(target ?? ""));
    },
  };
  const M = factory({ U, R, S: V });
  const active = { file: { path: "03-Workspace/A/A.md", mtime: 2 }, lifecycle: "active" };
  const inactive = { file: { path: "03-Workspace/B/B.md", mtime: 3 }, lifecycle: "inactive" };
  const projects = [
    { file: { path: "10-Project/P1.md", mtime: 4 }, workspace: "[[03-Workspace/A/A.md|A]]", status: "planning" },
    { file: { path: "10-Project/P2.md", mtime: 5 }, workspace: "[[03-Workspace/A/A.md|A]]", status: "running" },
    { file: { path: "10-Project/P3.md", mtime: 6 }, workspace: "[[03-Workspace/B/B.md|B]]", status: "running" },
    { file: { path: "10-Project/P4.md", mtime: 7 }, workspace: "[[03-Workspace/A/A.md|A]]", status: "stopped" },
    { file: { path: "10-Project/P5.md", mtime: 8 }, workspace: "[[03-Workspace/A/A.md|A]]", status: "done" },
    { file: { path: "10-Project/P6.md", mtime: 9 }, workspace: "[[03-Workspace/A/A.md|A]]", status: "cancelled" },
  ];
  const compare = (a, b) => Number(a ?? 0) - Number(b ?? 0);

  assert.equal(M.projectMatchesWorkspace(projects[0], active), true);
  assert.equal(M.projectMatchesWorkspace(projects[0], inactive), false);
  assert.equal(M.projectHasActiveWorkspace(projects[1], [active, inactive]), true);
  assert.equal(M.projectHasActiveWorkspace(projects[2], [active, inactive]), false);
  assert.equal(M.projectCountForWorkspace(projects, active), 5);
  assert.deepEqual(
    M.projectStatusCountsForWorkspace(projects, active),
    { planning: 1, running: 1, stopped: 1 }
  );
  assert.equal(
    M.formatProjectStatusCounts(M.projectStatusCountsForWorkspace(projects, active)),
    "1 | 1 | 1"
  );
  assert.ok(M.compareHighPriorityProjects(projects[1], projects[0], compare) < 0);
  assert.ok(M.compareWorkspaceRows(active, inactive, compare) < 0);
});

test("public interface registry protects Project Workspace basename surfaces", () => {
  const registry = JSON.parse(read("98-System/99-dev/setup/system-interfaces.json"));
  const basename = new Set(registry.groups.filter(group => group.resolution === "basename").flatMap(group => group.paths ?? []));
  for (const publicEmbed of [
    "98-System/02-embed/02-entry/project-entry.md",
    "98-System/02-embed/02-entry/workspace-entry.md",
    "98-System/02-embed/03-table/active-project-table.md",
    "98-System/02-embed/03-table/archived-project-table.md",
    "98-System/02-embed/03-table/workspace-table.md",
    "98-System/02-embed/03-table/high-priority-project-table.md",
    "98-System/02-embed/03-table/project-github-status.md",
    "98-System/02-embed/05-task/entity-task-health.md",
  ]) assert.equal(basename.has(publicEmbed), true, `${publicEmbed} must remain protected`);
});
