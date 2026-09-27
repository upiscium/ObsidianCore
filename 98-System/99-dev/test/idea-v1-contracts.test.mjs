import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const expression = relativePath => new Function(`"use strict"; return (${read(relativePath)});`)();

const I = expression("98-System/01-script/idea_meta_utils.js");

test("Idea v1 metadata contract is narrow and canonical", () => {
  assert.equal(I.normalizeStatus("active"), "active");
  assert.equal(I.normalizeStatus("adopted"), "adopted");
  assert.equal(I.normalizeStatus("archived"), "archived");
  assert.equal(I.normalizeStatus("todo"), null);
  assert.equal(I.isActive("active"), true);
  assert.equal(I.isAdopted("adopted"), true);
  assert.equal(I.isArchived("archived"), true);
  assert.equal(I.isStringArray(["a"]), true);
  assert.equal(I.isStringArray("a"), false);

  const template = read("98-System/03-template/01-note/idea-note-template.md");
  assert.match(template, /^---\ntype: idea\ntitle:\ncreated:\nworkspace:\nproject:\nstatus: active\naliases: \[\]\ntags: \[\]\n---/);
  assert.match(template, /\[\[idea-meta\]\]/);
  assert.match(template, /# __TITLE__/);
});

test("Idea visibility is centralized under 05-Idea and context-filtered by relations", () => {
  const view = read("98-System/04-view/ideas/idea_table.js");
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction("dv", "input", view));
  assert.match(view, /dv\.pages\('\\"05-Idea\\"'\)/);
  assert.match(view, /R\.matchesReference\(page\.workspace, config\.workspace\)/);
  assert.match(view, /R\.matchesReference\(page\.project, config\.project\)/);

  const dashboard = read("Dashboard.md");
  assert.match(dashboard, /dashboard\/ideas\|dashboard-ideas/);

  const workspace = read("98-System/02-embed/projects/workspace-entry-content.md");
  assert.match(workspace, /\[\[workspace-idea-table\]\]/);

  const project = read("98-System/02-embed/projects/project-entry-content.md");
  assert.match(project, /\[\[project-idea-table\]\]/);
});

test("Idea creation and context editing never expose an unscoped Workspace option", () => {
  const create = read("98-System/01-script/create_idea.js");
  const select = read("98-System/01-script/select_idea_context.js");

  for (const source of [create, select]) {
    assert.match(source, /folder: "03-Workspace"/);
    assert.match(source, /folder: "10-Project"/);
    assert.match(source, /isWorkspaceActiveLifecycle/);
    assert.match(source, /isProjectActiveStatus/);
    assert.doesNotMatch(source, /Workspaceを設定しない/);
  }

  assert.match(create, /const root = "05-Idea"/);
  assert.match(create, /"type: idea"/);
  assert.match(create, /"status: active"/);
  assert.match(select, /activeFile\.path\.startsWith\("05-Idea\/"\)/);
});

test("Idea public interfaces are registered", () => {
  const registry = JSON.parse(read("98-System/99-dev/setup/system-interfaces.json"));
  const paths = new Set(registry.groups.flatMap(group => group.paths ?? []));
  for (const expected of [
    "98-System/02-embed/hub/idea-hub.md",
    "98-System/00-command/create_idea.md",
    "98-System/00-command/select_idea_context.md",
    "98-System/01-script/create_idea.js",
    "98-System/01-script/select_idea_context.js",
    "98-System/02-embed/00-meta/idea-meta.md",
    "98-System/02-embed/01-button/idea-buttons.md",
    "98-System/03-template/01-note/idea-note-template.md"
  ]) {
    assert.equal(paths.has(expected), true, expected);
  }
});
