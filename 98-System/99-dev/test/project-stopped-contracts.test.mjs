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
const entityMetaSource = read(entityMetaPath);
const migrationSource = read(migrationPath);
const doctorSource = read(doctorPath);
const referenceSource = read(referencePath);
const E = new Function(`"use strict"; return (${entityMetaSource});`)();

test("Project stopped status is canonical only for Project", () => {
  assert.equal(E.normalizeProjectStatus("stopped"), "stopped");
  assert.equal(E.normalizeWorkspaceStatus("stopped"), null);
  assert.equal(E.normalizeStatus("stopped"), null);
  assert.match(E.statusLabel("stopped"), /停止/);
  assert.equal(E.isActiveStatus("stopped"), false);
  assert.equal(E.isProjectListStatus("stopped"), true);
  assert.equal(E.isArchivedStatus("stopped"), false);
  assert.equal(E.isHiddenStatus("stopped"), false);
});

test("stopped Project remains visible but is excluded from active-work consumers", () => {
  const projectTable = read("98-System/04-view/project_table.js");
  const taskContext = read("98-System/01-script/select_task_context.js");
  const weeklyReview = read("98-System/04-view/weekly_review.js");
  const entityHealth = read("98-System/04-view/entity_task_health.js");

  assert.match(projectTable, /U\.isProjectListStatus\(p\.status\)/);
  assert.match(taskContext, /isActiveStatus: E\.isActiveStatus/);
  assert.match(weeklyReview, /entityReviewBucket\(entity, today, E\.isActiveStatus/);
  assert.match(entityHealth, /E\.isActiveStatus/);
});

function makeFile(filePath) {
  const name = filePath.split("/").pop();
  const extension = name.includes(".") ? name.split(".").pop() : "";
  const basename = extension ? name.slice(0, -(extension.length + 1)) : name;
  const parentPath = filePath.split("/").slice(0, -1).join("/");
  return { path: filePath, basename, extension, parent: parentPath ? { path: parentPath } : null };
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
      getAbstractFileByPath: requested => requested === referencePath
        ? referenceFile
        : byPath.get(requested) ?? null,
      read: async file => file.path === referencePath ? referenceSource : ""
    },
    metadataCache: {
      getFileCache: file => ({ frontmatter: frontmatter.get(file.path) ?? {} })
    },
    fileManager: {
      processFrontMatter: async (file, mutator) => {
        const fm = frontmatter.get(file.path);
        if (!fm) throw new Error(`FrontMatter not found: ${file.path}`);
        mutator(fm);
      }
    }
  };

  return {
    app,
    frontmatter,
    notices,
    Notice: function Notice(message) { notices.push(String(message)); }
  };
}

function loadDoctor(env) {
  const module = { exports: {} };
  const quietConsole = { log() {}, warn() {}, error() {}, table() {} };
  const moment = () => ({ isValid: () => false, format: () => "Invalid date" });
  moment.ISO_8601 = Symbol("ISO_8601");
  new Function("module", "app", "Notice", "window", "console", doctorSource)(
    module,
    env.app,
    env.Notice,
    { moment },
    quietConsole
  );
  return module.exports;
}

function loadMigration(env) {
  const module = { exports: {} };
  const quietConsole = { log() {}, warn() {}, error() {}, table() {} };
  new Function("module", "app", "Notice", "console", migrationSource)(
    module,
    env.app,
    env.Notice,
    quietConsole
  );
  return module.exports;
}

function workspace(name, status = "running") {
  return {
    path: `03-Workspace/${name}.md`,
    fm: {
      type: "workspace",
      uid: `ws_${name.toLowerCase()}`,
      title: name,
      aliases: [],
      status,
      priority: "medium"
    }
  };
}

function project(name, status = "running") {
  return {
    path: `10-Project/${name}.md`,
    fm: {
      type: "project",
      uid: `prj_${name.toLowerCase()}`,
      title: name,
      aliases: [],
      status,
      priority: "medium",
      workspace: "[[03-Workspace/W|W]]"
    }
  };
}

test("System Doctor accepts stopped Project and rejects stopped Workspace", async () => {
  const validEnv = makeFakeVault([workspace("W"), project("P", "stopped")]);
  const valid = await loadDoctor(validEnv)({});
  assert.equal(valid.summary.errors, 0);
  assert.equal(valid.summary.warnings, 0);

  const invalidEnv = makeFakeVault([workspace("Stopped", "stopped")]);
  const invalid = await loadDoctor(invalidEnv)({});
  assert.equal(invalid.summary.errors, 1);
  assert.ok(invalid.issues.some(issue => issue.field === "status"));
});

test("Entity recovery migration preserves Project stopped but normalizes Workspace stopped", async () => {
  const env = makeFakeVault([workspace("W", "stopped"), project("P", "stopped")]);
  const report = await loadMigration(env)({});

  assert.equal(env.frontmatter.get("03-Workspace/W.md").status, "planning");
  assert.equal(env.frontmatter.get("10-Project/P.md").status, "stopped");
  assert.deepEqual(report, {
    updated: 1,
    unchanged: 1,
    unknownStatus: [],
    unknownPriority: []
  });

  const diagnosis = await loadDoctor(env)({});
  assert.equal(diagnosis.summary.errors, 0);
  assert.equal(diagnosis.summary.warnings, 0);
});
