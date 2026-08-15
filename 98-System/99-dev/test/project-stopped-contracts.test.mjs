import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const entityMetaPath = "98-System/01-script/entity_meta_utils.js";
const migrationPath = "98-System/01-script/migrate_entity_metadata_v2.js";
const doctorPath = "98-System/01-script/validate_vault.js";
const referencePath = "98-System/01-script/reference_utils.js";
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const E = new Function(`"use strict"; return (${read(entityMetaPath)});`)();
const migrationSource = read(migrationPath);
const doctorSource = read(doctorPath);
const referenceSource = read(referencePath);

test("Project stopped remains a Project-only execution status", () => {
  assert.equal(E.normalizeProjectStatus("stopped"), "stopped");
  assert.equal(E.normalizeWorkspaceLifecycle("stopped"), null);
  assert.match(E.projectStatusLabel("stopped"), /停止/);
  assert.equal(E.isProjectActiveStatus("stopped"), false);
  assert.equal(E.isProjectListStatus("stopped"), true);
  assert.equal(E.isProjectArchivedStatus("stopped"), false);
  assert.equal(E.isProjectHiddenStatus("stopped"), false);
});

test("stopped Project remains visible only when its Workspace is active", () => {
  assert.equal(E.isProjectVisibleInWorkspace("stopped", "active"), true);
  assert.equal(E.isProjectVisibleInWorkspace("stopped", "inactive"), false);
  assert.equal(E.isProjectVisibleInWorkspace("stopped", "archived"), false);

  const projectTable = read("98-System/04-view/project_table.js");
  const dashboard = read("98-System/04-view/high_priority_project_table.js");
  const weeklyReview = read("98-System/04-view/weekly_review.js");
  assert.match(projectTable, /isWorkspaceActiveLifecycle\(current\.lifecycle\)/);
  assert.match(dashboard, /isWorkspaceActiveLifecycle\(workspace\.lifecycle\)/);
  assert.match(weeklyReview, /hasActiveWorkspace/);
});

function makeFile(filePath) {
  const name = filePath.split("/").pop();
  const extension = name.includes(".") ? name.split(".").pop() : "";
  const basename = extension ? name.slice(0, -(extension.length + 1)) : name;
  return { path: filePath, basename, extension };
}

function makeFakeVault(entries) {
  const files = entries.map(entry => makeFile(entry.path));
  const byPath = new Map(files.map(file => [file.path, file]));
  const frontmatter = new Map(entries.map(entry => [entry.path, structuredClone(entry.fm)]));
  const referenceFile = makeFile(referencePath);
  const notices = [];
  const app = {
    vault: {
      getMarkdownFiles: () => files,
      getAbstractFileByPath: requested => requested === referencePath ? referenceFile : byPath.get(requested) ?? null,
      read: async file => file.path === referencePath ? referenceSource : ""
    },
    metadataCache: { getFileCache: file => ({ frontmatter: frontmatter.get(file.path) ?? {} }) },
    fileManager: { processFrontMatter: async (file, mutator) => mutator(frontmatter.get(file.path)) }
  };
  return { app, frontmatter, notices, Notice: function Notice(message) { notices.push(String(message)); } };
}

function loadDoctor(env) {
  const module = { exports: {} };
  const quietConsole = { log() {}, warn() {}, error() {}, table() {} };
  const moment = () => ({ isValid: () => false, format: () => "Invalid date" });
  moment.ISO_8601 = Symbol("ISO_8601");
  new Function("module", "app", "Notice", "window", "console", doctorSource)(module, env.app, env.Notice, { moment }, quietConsole);
  return module.exports;
}

function loadMigration(env) {
  const module = { exports: {} };
  const quietConsole = { log() {}, warn() {}, error() {}, table() {} };
  new Function("module", "app", "Notice", "console", migrationSource)(module, env.app, env.Notice, quietConsole);
  return module.exports;
}

function legacyWorkspace(name, status = "running") {
  return { path: `03-Workspace/${name}.md`, fm: { type: "workspace", uid: `ws_${name.toLowerCase()}`, title: name, aliases: [], status, priority: "medium" } };
}
function workspace(name, lifecycle = "active") {
  return { path: `03-Workspace/${name}.md`, fm: { type: "workspace", uid: `ws_${name.toLowerCase()}`, title: name, aliases: [], lifecycle } };
}
function project(name, status = "running") {
  return { path: `10-Project/${name}.md`, fm: { type: "project", uid: `prj_${name.toLowerCase()}`, title: name, aliases: [], status, priority: "medium", workspace: "[[03-Workspace/W|W]]" } };
}

test("System Doctor accepts stopped Project under canonical Workspace", async () => {
  const env = makeFakeVault([workspace("W"), project("P", "stopped")]);
  const diagnosis = await loadDoctor(env)({});
  assert.equal(diagnosis.summary.errors, 0);
  assert.equal(diagnosis.summary.warnings, 0);
});

test("Entity recovery migration preserves Project stopped and maps legacy Workspace stopped to inactive", async () => {
  const env = makeFakeVault([legacyWorkspace("W", "stopped"), project("P", "stopped")]);
  const report = await loadMigration(env)({});

  const ws = env.frontmatter.get("03-Workspace/W.md");
  assert.equal(ws.lifecycle, "inactive");
  assert.equal("status" in ws, false);
  assert.equal("priority" in ws, false);
  assert.equal(env.frontmatter.get("10-Project/P.md").status, "stopped");
  assert.deepEqual(report, {
    updated: 1,
    unchanged: 1,
    unknownLifecycle: [],
    unknownStatus: [],
    unknownPriority: []
  });

  const diagnosis = await loadDoctor(env)({});
  assert.equal(diagnosis.summary.errors, 0);
  assert.equal(diagnosis.summary.warnings, 0);
});
