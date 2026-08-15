import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

function readExpression(relativePath) {
  return new Function(`"use strict"; return (${read(relativePath)});`)();
}

const N = readExpression("98-System/01-script/note_meta_utils.js");
const P = readExpression("98-System/01-script/knowledge_promotion_utils.js");

test("Note v2 utility exposes document lifecycle and category semantics only", () => {
  assert.equal(N.normalizeLifecycle("active"), "active");
  assert.equal(N.normalizeLifecycle("archived"), "archived");
  assert.equal(N.normalizeLifecycle("running"), null);
  assert.equal(N.isActiveLifecycle("active"), true);
  assert.equal(N.isArchivedLifecycle("archived"), true);
  assert.equal(N.normalizeCategory("memo"), "memo");
  assert.equal(N.normalizeCategory(null), "none");
  assert.equal(N.normalizeCategory("spec"), null);
  assert.equal(N.isStringArray([]), true);
  assert.equal(N.isStringArray(["a", "b"]), true);
  assert.equal(N.isStringArray(["a", 1]), false);
  for (const legacy of ["normalizePriority", "priorityLabel", "isActiveStatus", "isArchivedStatus", "statusLabel"]) {
    assert.equal(N[legacy], undefined);
  }
});

test("Project and Workspace Note templates use canonical Note v2 defaults", () => {
  const project = read("98-System/03-template/01-note/project-note-template.md");
  const workspace = read("98-System/03-template/01-note/workspace-note-template.md");

  for (const source of [project, workspace]) {
    assert.match(source, /lifecycle: active/);
    assert.match(source, /category:/);
    assert.match(source, /aliases: \[\]/);
    assert.match(source, /tags: \[\]/);
    assert.doesNotMatch(source, /^status:/m);
    assert.doesNotMatch(source, /^priority:/m);
  }

  assert.match(project, /^project:/m);
  assert.match(project, /^workspace:/m);
  assert.match(workspace, /^workspace:/m);
});

test("Note table filters by lifecycle and renders category instead of work status/priority", () => {
  const table = read("98-System/04-view/note_table.js");
  assert.match(table, /U\.isActiveLifecycle\(p\.lifecycle\)/);
  assert.match(table, /U\.isArchivedLifecycle\(p\.lifecycle\)/);
  assert.match(table, /U\.categoryLabel\(p\.category\)/);
  assert.match(table, /\["ノート名", "カテゴリ", "最終更新日"\]/);
  assert.doesNotMatch(table, /p\.status|p\.priority|statusLabel|priorityLabel/);
});

test("Knowledge promotion drops Note lifecycle while preserving aliases and tags", () => {
  const promoted = P.promotedFrontmatter({
    type: "project-note",
    project: "[[10-Project/Test]]",
    workspace: "[[03-Workspace/Test]]",
    lifecycle: "archived",
    category: "document",
    aliases: ["Alias"],
    tags: ["topic"],
    custom: "keep"
  });

  assert.equal(promoted.type, "knowledge-note");
  assert.equal(promoted.status, "active");
  assert.equal(promoted.category, null);
  assert.equal(promoted.maturity, "draft");
  assert.equal(promoted.source_type, "self");
  assert.equal("lifecycle" in promoted, false);
  assert.equal("project" in promoted, false);
  assert.equal("workspace" in promoted, false);
  assert.deepEqual(promoted.aliases, ["Alias"]);
  assert.deepEqual(promoted.tags, ["topic"]);
  assert.equal(promoted.custom, "keep");
});
