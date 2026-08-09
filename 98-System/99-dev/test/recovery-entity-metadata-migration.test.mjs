import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const migrationPath = "98-System/01-script/migrate_entity_metadata_v2.js";
const doctorPath = "98-System/01-script/validate_vault.js";
const referencePath = "98-System/01-script/reference_utils.js";
const entityMetaPath = "98-System/01-script/entity_meta_utils.js";

const migrationSource = fs.readFileSync(path.join(root, migrationPath), "utf8");
const doctorSource = fs.readFileSync(path.join(root, doctorPath), "utf8");
const referenceSource = fs.readFileSync(path.join(root, referencePath), "utf8");
const entityMetaSource = fs.readFileSync(path.join(root, entityMetaPath), "utf8");
const E = new Function(`"use strict"; return (${entityMetaSource});`)();

function makeFile(entry) {
  const filePath = entry.path;
  const name = filePath.split("/").pop();
  const extension = name.includes(".") ? name.split(".").pop() : "";
  const basename = extension ? name.slice(0, -(extension.length + 1)) : name;
  const parentPath = filePath.split("/").slice(0, -1).join("/");
  return { path: filePath, basename, extension, parent: parentPath ? { path: parentPath } : null };
}

function makeFakeVault(entries) {
  const files = entries.map(makeFile);
  const byPath = new Map(files.map(file => [file.path, file]));
  const frontmatter = new Map(entries.map(entry => [entry.path, structuredClone(entry.fm ?? {})]));
  const contents = new Map(entries.map(entry => [entry.path, entry.content ?? ""]));
  const referenceFile = makeFile({ path: referencePath });
  const notices = [];
  const mutations = [];

  const app = {
    vault: {
      getMarkdownFiles: () => files,
      getAbstractFileByPath: requested => requested === referencePath
        ? referenceFile
        : byPath.get(requested) ?? null,
      read: async file => file.path === referencePath
        ? referenceSource
        : contents.get(file.path) ?? ""
    },
    metadataCache: {
      getFileCache: file => ({ frontmatter: frontmatter.get(file.path) ?? {} })
    },
    fileManager: {
      processFrontMatter: async (file, mutator) => {
        const fm = frontmatter.get(file.path);
        if (!fm) throw new Error(`FrontMatter not found: ${file.path}`);
        const before = structuredClone(fm);
        mutator(fm);
        mutations.push({ path: file.path, before, after: structuredClone(fm) });
      }
    }
  };

  return {
    app,
    notices,
    mutations,
    Notice: function Notice(message) { notices.push(String(message)); },
    getFrontmatter: filePath => frontmatter.get(filePath),
    getContent: filePath => contents.get(filePath),
    snapshot: filePath => structuredClone(frontmatter.get(filePath))
  };
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

async function migrateAndDoctor(entries) {
  const env = makeFakeVault(entries);
  const report = await loadMigration(env)({});
  const diagnosis = await loadDoctor(env)({});
  return { env, report, diagnosis };
}

function workspace(name, extra = {}, content = "") {
  return {
    path: `03-Workspace/${name}.md`,
    fm: {
      type: "workspace",
      uid: `ws_${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title: name,
      aliases: [],
      status: "running",
      priority: "medium",
      ...extra
    },
    content
  };
}

function project(name, workspaceLink, extra = {}, content = "") {
  return {
    path: `10-Project/${name}.md`,
    fm: {
      type: "project",
      uid: `prj_${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title: name,
      aliases: [],
      status: "running",
      priority: "medium",
      workspace: workspaceLink,
      ...extra
    },
    content
  };
}

function assertCanonicalEntity(fm) {
  assert.ok(["planning", "running", "done", "cancelled"].includes(fm.status));
  assert.ok(["high", "medium", "low", null, undefined, ""].includes(fm.priority));
  assert.notEqual(E.normalizeStatus(fm.status), null);
  assert.notEqual(E.normalizePriority(fm.priority), null);
}

const researchLink = "[[03-Workspace/Research|Research]]";

test("real Entity migration maps every supported legacy status to the canonical contract", async () => {
  const cases = [
    ["Planning", "planning", "planning"],
    ["Running", "running", "running"],
    ["Done", "done", "done"],
    ["Cancelled", "cancelled", "cancelled"],
    ["NotYet", "not-yet-running", "planning"],
    ["Stopped", "stopped", "planning"],
    ["Waiting", "waiting", "planning"],
    ["Blocked", "blocked", "planning"],
    ["Someday", "someday", "planning"],
    ["Archived", "archived", "done"],
    ["Deleted", "deleted", "cancelled"],
    ["NoneLiteral", "none", "planning"],
    ["Empty", "", "planning"]
  ];
  const { env, report, diagnosis } = await migrateAndDoctor(
    cases.map(([name, status]) => workspace(name, { status, priority: "medium" }))
  );

  for (const [name, , expected] of cases) {
    const fm = env.getFrontmatter(`03-Workspace/${name}.md`);
    assert.equal(fm.status, expected);
    assertCanonicalEntity(fm);
  }
  assert.equal(report.unknownStatus.length, 0);
  assert.equal(report.unknownPriority.length, 0);
  assert.equal(report.updated, 9);
  assert.equal(report.unchanged, 4);
  assert.equal(diagnosis.summary.errors, 0);
  assert.equal(diagnosis.summary.warnings, 0);
});

test("real Entity migration maps every supported legacy priority to the canonical contract", async () => {
  const cases = [
    ["High", "high", "high"],
    ["Medium", "medium", "medium"],
    ["Low", "low", "low"],
    ["NoneLiteral", "none", null],
    ["Urgent", "urgent", "high"],
    ["Normal", "normal", "medium"],
    ["Lowest", "lowest", "low"],
    ["Zero", "0", "high"],
    ["One", "1", "high"],
    ["Two", "2", "medium"],
    ["Three", "3", "low"],
    ["Four", "4", "low"],
    ["Five", "5", null],
    ["Empty", "", ""],
    ["Null", null, null]
  ];
  const { env, report, diagnosis } = await migrateAndDoctor(
    cases.map(([name, priority]) => workspace(`Priority-${name}`, { status: "running", priority }))
  );

  for (const [name, , expected] of cases) {
    const fm = env.getFrontmatter(`03-Workspace/Priority-${name}.md`);
    assert.equal(fm.priority, expected);
    assertCanonicalEntity(fm);
  }
  assert.equal(report.unknownStatus.length, 0);
  assert.equal(report.unknownPriority.length, 0);
  assert.equal(report.updated, 10);
  assert.equal(report.unchanged, 5);
  assert.equal(diagnosis.summary.errors, 0);
  assert.equal(diagnosis.summary.warnings, 0);
});

test("Workspace and Project migration preserves metadata, relation, and note content it does not own", async () => {
  const projectBody = "# Terreate\n\nProject body must remain untouched.\n";
  const { env, report, diagnosis } = await migrateAndDoctor([
    workspace("Research", {
      status: "waiting",
      priority: "urgent",
      aliases: ["Lab"],
      marker: { nested: true }
    }, "# Research\n"),
    project("Terreate", researchLink, {
      status: "archived",
      priority: "4",
      aliases: ["Engine"],
      marker: ["keep"]
    }, projectBody)
  ]);

  const ws = env.getFrontmatter("03-Workspace/Research.md");
  const prj = env.getFrontmatter("10-Project/Terreate.md");
  assert.equal(ws.status, "planning");
  assert.equal(ws.priority, "high");
  assert.deepEqual(ws.aliases, ["Lab"]);
  assert.deepEqual(ws.marker, { nested: true });
  assert.equal(prj.status, "done");
  assert.equal(prj.priority, "low");
  assert.equal(prj.workspace, researchLink);
  assert.deepEqual(prj.aliases, ["Engine"]);
  assert.deepEqual(prj.marker, ["keep"]);
  assert.equal(env.getContent("10-Project/Terreate.md"), projectBody);
  assert.equal(report.updated, 2);
  assert.equal(report.unchanged, 0);
  assert.deepEqual(diagnosis.summary, { errors: 0, warnings: 0, entities: 2, notes: 0, tasks: 0 });
});

test("real Entity migration is idempotent for already-canonical Workspace and Project entries", async () => {
  const env = makeFakeVault([
    workspace("Research", { status: "running", priority: "medium", marker: "keep" }),
    project("Terreate", researchLink, { status: "planning", priority: null, marker: "keep" })
  ]);
  const migrate = loadMigration(env);
  const doctor = loadDoctor(env);
  const wsBefore = env.snapshot("03-Workspace/Research.md");
  const projectBefore = env.snapshot("10-Project/Terreate.md");

  const first = await migrate({});
  const second = await migrate({});
  const diagnosis = await doctor({});

  assert.deepEqual(env.snapshot("03-Workspace/Research.md"), wsBefore);
  assert.deepEqual(env.snapshot("10-Project/Terreate.md"), projectBefore);
  assert.deepEqual(first, { updated: 0, unchanged: 2, unknownStatus: [], unknownPriority: [] });
  assert.deepEqual(second, first);
  assert.deepEqual(diagnosis.summary, { errors: 0, warnings: 0, entities: 2, notes: 0, tasks: 0 });
});

test("unknown legacy Entity values remain unchanged, are reported, and stay visible to System Doctor", async () => {
  const env = makeFakeVault([
    workspace("Unknown", { status: "paused-forever", priority: "critical", marker: "keep" })
  ]);
  const report = await loadMigration(env)({});
  const diagnosis = await loadDoctor(env)({});
  const fm = env.getFrontmatter("03-Workspace/Unknown.md");

  assert.equal(fm.status, "paused-forever");
  assert.equal(fm.priority, "critical");
  assert.equal(fm.marker, "keep");
  assert.deepEqual(report, {
    updated: 0,
    unchanged: 1,
    unknownStatus: ["03-Workspace/Unknown.md: paused-forever"],
    unknownPriority: ["03-Workspace/Unknown.md: critical"]
  });
  assert.equal(diagnosis.summary.errors, 2);
  assert.equal(diagnosis.summary.warnings, 0);
  assert.ok(diagnosis.issues.some(issue => issue.field === "status"));
  assert.ok(diagnosis.issues.some(issue => issue.field === "priority"));
});
