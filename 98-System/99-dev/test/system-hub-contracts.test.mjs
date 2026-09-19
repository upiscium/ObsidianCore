import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

const hubs = {
  task: "98-System/02-embed/hub/task-hub.md",
  project: "98-System/02-embed/hub/project-hub.md",
  knowledge: "98-System/02-embed/hub/knowledge-hub.md",
};

test("system-owned Hubs live under 98-System and are registered public interfaces", () => {
  const registry = JSON.parse(read("98-System/99-dev/setup/system-interfaces.json"));
  const exact = new Set(
    registry.groups.filter(group => group.resolution === "exact").flatMap(group => group.paths ?? [])
  );
  for (const hub of Object.values(hubs)) {
    assert.equal(fs.existsSync(path.join(root, hub)), true, hub);
    assert.equal(exact.has(hub), true, hub + " must remain a protected public UI");
  }
});

test("Task HUB owns triage, planning, review and recurring detail composition", () => {
  const source = read(hubs.task);
  for (const embed of ["task-hub-buttons", "inbox", "backlog", "next-7-days", "next-30-days", "later", "weekly-review", "recurring-tasks"]) {
    assert.ok(source.includes("[[" + embed + "]]"), embed);
  }
});

test("Project HUB owns global Workspace and Project overview", () => {
  const source = read(hubs.project);
  for (const embed of ["project-hub-buttons", "workspace-table", "project-hub-active-table", "project-hub-archived-table"]) {
    assert.ok(source.includes("[[" + embed + "]]"), embed);
  }
  const view = read("98-System/04-view/projects/project_hub_table.js");
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction("dv", "input", view));
  assert.match(view, /U\.isProjectListStatus\(project\.status\)/);
  assert.match(view, /M\.projectHasActiveWorkspace\(project, workspaces\)/);
  assert.match(view, /U\.isProjectArchivedStatus\(project\.status\)/);
  assert.match(view, /!U\.isProjectHiddenStatus\(project\.status\)/);
});

test("Knowledge HUB owns canonical visible Knowledge inventory plus recent view", () => {
  const source = read(hubs.knowledge);
  for (const embed of ["knowledge-hub-buttons", "knowledge-table", "updated-knowledge-table"]) {
    assert.ok(source.includes("[[" + embed + "]]"), embed);
  }
  const view = read("98-System/04-view/knowledge/knowledge_table.js");
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction("dv", "input", view));
  assert.match(view, /page\?\.type === "knowledge-note"/);
  assert.match(view, /!K\.isArchivedStatus\(page\.status\)/);
  assert.match(view, /!K\.isHiddenStatus\(page\.status\)/);
  assert.match(view, /K\.categoryLabel\(page\.category\)/);
  assert.match(view, /K\.maturityLabel\(page\.maturity\)/);
  assert.match(view, /K\.sourceTypeLabel\(page\.source_type\)/);
});

test("Core navigation buttons no longer depend on data-directory system UI files", () => {
  const contracts = [
    ["98-System/02-embed/01-button/dashboard-task-buttons.md", "98-System/02-embed/hub/task-hub", "02-Task/backlog"],
    ["98-System/02-embed/01-button/dashboard-workspace-buttons.md", "98-System/02-embed/hub/project-hub", "10-Project/hub"],
    ["98-System/02-embed/01-button/workspace-buttons.md", "98-System/02-embed/hub/project-hub", "10-Project/hub"],
    ["98-System/02-embed/01-button/dashboard-knowledge-buttons.md", "98-System/02-embed/hub/knowledge-hub", "11-Knowledge/hub"],
  ];
  for (const [file, canonical, legacy] of contracts) {
    const source = read(file);
    assert.ok(source.includes(canonical), file + " must use canonical Hub");
    assert.equal(source.includes(legacy), false, file + " must not use legacy Hub");
  }
});

test("legacy Mobile Home selectors remain until private 02-Memo and Hub caller audit", () => {
  const css = read("98-System/90-config/styles/obsidian-core.css");
  for (const legacy of ["11-Knowledge/hub", "02-Memo/hub", "10-Project/hub"]) {
    assert.ok(css.includes(legacy), legacy + " compatibility selector must remain during Phase A");
  }
});
