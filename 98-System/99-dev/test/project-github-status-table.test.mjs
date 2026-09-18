import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

const entryPath = "98-System/02-embed/02-entry/project-entry.md";
const embedPath = "98-System/02-embed/03-table/project-github-status.md";
const viewPath = "98-System/04-view/project_github_status.js";


test("Project Entry wires the GitHub Status Dataview embed", () => {
  const entry = read(entryPath);
  const embed = read(embedPath);

  assert.match(entry, /\[\[project-github-status\]\]/);
  assert.match(embed, /dv\.view\("98-System\/04-view\/project_github_status"\)/);
});


test("GitHub Status only renders for opted-in Projects and reads managed sibling data", () => {
  const view = read(viewPath);

  assert.match(view, /current\?\.github_watch/);
  assert.match(view, /current\?\.github_repo/);
  assert.match(view, /current\.file\.folder\}\/Status/);
  assert.match(view, /status\.github_status_managed/);
  assert.match(view, /status\.github_repo/);
  assert.match(view, /status\.github_pull_requests/);
});


test("GitHub Status table exposes PR status and bound issues", () => {
  const view = read(viewPath);

  assert.match(view, /\["PR", "PR Status", "Bound Issue"\]/);
  assert.match(view, /statusValue === "draft"/);
  assert.match(view, /"Draft"/);
  assert.match(view, /statusValue === "ready"/);
  assert.match(view, /"Ready"/);
  assert.match(view, /pull\?\.bound_issues/);
  assert.match(view, /GitHub PR詳細はまだ同期されていません/);
  assert.match(view, /Open PRはありません/);
  assert.match(view, /issueRepository !== repository/);
});
