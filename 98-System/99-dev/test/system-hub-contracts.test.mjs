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
  ai: "98-System/02-embed/hub/ai-hub.md",
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

test("Task HUB pins all reusable detail embeds to canonical exact paths", () => {
  const source = read(hubs.task);
  for (const target of [
    "98-System/02-embed/01-button/task-hub-buttons|task-hub-buttons",
    "98-System/02-embed/05-task/inbox|inbox",
    "98-System/02-embed/05-task/backlog|backlog",
    "98-System/02-embed/05-task/next-7-days|next-7-days",
    "98-System/02-embed/05-task/next-30-days|next-30-days",
    "98-System/02-embed/05-task/later|later",
    "98-System/02-embed/05-task/task-attention|task-attention",
    "98-System/02-embed/05-task/recurring-tasks|recurring-tasks",
  ]) {
    assert.ok(source.includes("[[" + target + "]]"), target);
  }
  assert.doesNotMatch(source, /\[\[(?:backlog|inbox|later)\]\]/);
  assert.doesNotMatch(source, /weekly-review/);
});

test("Project HUB owns global Workspace and Project overview with exact embeds", () => {
  const source = read(hubs.project);
  for (const target of [
    "98-System/02-embed/01-button/project-hub-buttons|project-hub-buttons",
    "98-System/02-embed/03-table/workspace-table|workspace-table",
    "98-System/02-embed/03-table/project-hub-active-table|project-hub-active-table",
    "98-System/02-embed/03-table/project-hub-archived-table|project-hub-archived-table",
  ]) {
    assert.ok(source.includes("[[" + target + "]]"), target);
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
  for (const target of [
    "98-System/02-embed/01-button/knowledge-hub-buttons|knowledge-hub-buttons",
    "98-System/02-embed/03-table/knowledge-table|knowledge-table",
    "98-System/02-embed/03-table/updated-knowledge-table|updated-knowledge-table",
  ]) {
    assert.ok(source.includes("[[" + target + "]]"), target);
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


test("AI HUB is a system-owned read-only current-case view over private 03-AI projections", () => {
  const source = read(hubs.ai);
  assert.match(source, /^# AI HUB$/m);
  for (const mode of ["review", "processing", "delivery", "completed", "failed"]) {
    assert.ok(source.includes(`mode: "${mode}"`), mode);
  }
  assert.doesNotMatch(source, /BUTTON\[.*approve|BUTTON\[.*reject/i);

  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  for (const viewPath of [
    "98-System/04-view/ai/ai_dashboard_summary.js",
    "98-System/04-view/ai/ai_stage_table.js",
  ]) {
    assert.doesNotThrow(() => new AsyncFunction("dv", "input", read(viewPath)));
  }

  const util = read("98-System/05-lib/ai/projection_utils.js");
  const factory = new Function(`return (${util});`);
  const U = factory();
  assert.equal(U.stateOf({ ai_case_id: "a".repeat(64), ai_stage: "review" }), "review");
  assert.equal(
    U.stateOf({
      ai_case_id: "b".repeat(64),
      ai_stage: "validation",
      validation_result: "rejected",
    }),
    "failed",
  );
  const dv = { compare: (a, b) => a === b ? 0 : a < b ? -1 : 1 };
  const latest = U.latestByCase([
    { ai_case_id: "c".repeat(64), ai_stage: "input", file: { path: "input", mtime: 1 } },
    { ai_case_id: "c".repeat(64), ai_stage: "review", file: { path: "review", mtime: 2 } },
  ], dv);
  assert.equal(latest.length, 1);
  assert.equal(latest[0].ai_stage, "review");
});

test("Core navigation buttons no longer depend on data-directory system UI files", () => {
  const contracts = [
    ["98-System/02-embed/01-button/dashboard-task-buttons.md", "98-System/02-embed/hub/task-hub", "02-Task/backlog"],
    ["98-System/02-embed/01-button/dashboard-workspace-buttons.md", "98-System/02-embed/hub/project-hub", "10-Project/hub"],
    ["98-System/02-embed/01-button/workspace-buttons.md", "98-System/02-embed/hub/project-hub", "10-Project/hub"],
    ["98-System/02-embed/01-button/dashboard-knowledge-buttons.md", "98-System/02-embed/hub/knowledge-hub", "11-Knowledge/hub"],
    ["98-System/02-embed/01-button/dashboard-ai-buttons.md", "98-System/02-embed/hub/ai-hub", "03-AI/Hub"],
  ];
  for (const [file, canonical, legacy] of contracts) {
    const source = read(file);
    assert.ok(source.includes(canonical), file + " must use canonical Hub");
    assert.equal(source.includes(legacy), false, file + " must not use legacy Hub");
  }
});

test("Core styles contain only canonical Hub selectors", () => {
  const base = read("98-System/90-config/styles/obsidian-core.css");
  const mobile = read("98-System/90-config/styles/obsidian-core-mobile.css");
  for (const canonical of [
    "98-System/02-embed/hub/task-hub",
    "98-System/02-embed/hub/project-hub",
    "98-System/02-embed/hub/knowledge-hub",
    "98-System/02-embed/hub/ai-hub",
  ]) {
    assert.ok(base.includes(canonical), canonical + " missing from base bundle");
    assert.ok(mobile.includes(canonical), canonical + " missing from mobile override");
  }
  for (const legacy of ["11-Knowledge/hub", "02-Memo/hub", "10-Project/hub"]) {
    assert.equal(base.includes(legacy), false, legacy + " must be retired from base bundle");
    assert.equal(mobile.includes(legacy), false, legacy + " must be retired from mobile override");
  }
});
