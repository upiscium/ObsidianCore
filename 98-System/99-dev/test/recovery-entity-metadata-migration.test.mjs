import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const migrationPath = "98-System/01-script/migrate_entity_metadata_v2.js";
const doctorPath = "98-System/01-script/validate_vault.js";
const referencePath = "98-System/01-script/reference_utils.js";
const migrationSource = fs.readFileSync(path.join(root, migrationPath), "utf8");
const doctorSource = fs.readFileSync(path.join(root, doctorPath), "utf8");
const referenceSource = fs.readFileSync(path.join(root, referencePath), "utf8");

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
      getAbstractFileByPath: requested => requested === referencePath ? referenceFile : byPath.get(requested) ?? null,
      read: async file => file.path === referencePath ? referenceSource : contents.get(file.path) ?? ""
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
  new Function("module", "app", "Notice", "console", migrationSource)(module, env.app, env.Notice, quietConsole);
  return module.exports;
}

function loadDoctor(env) {
  const module = { exports: {} };
  const quietConsole = { log() {}, warn() {}, error() {}, table() {} };
  const moment = () => ({ isValid: () => false, format: () => "Invalid date" });
  moment.ISO_8601 = Symbol("ISO_8601");
  new Function("module", "app", "Notice", "window", "console", doctorSource)(
    module, env.app, env.Notice, { moment }, quietConsole
  );
  return module.exports;
}

async function migrateAndDoctor(entries) {
  const env = makeFakeVault(entries);
  const report = await loadMigration(env)({});
  const diagnosis = await loadDoctor(env)({});
  return { env, report, diagnosis };
}

function legacyWorkspace(name, extra = {}, content = "") {
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

function workspace(name, lifecycle = "active", extra = {}, content = "") {
  return {
    path: `03-Workspace/${name}.md`,
    fm: {
      type: "workspace",
      uid: `ws_${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title: name,
      aliases: [],
      lifecycle,
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

const researchLink = "[[03-Workspace/Research|Research]]";

test("Workspace legacy statuses migrate to lifecycle and legacy priority is removed", async () => {
  const cases = [
    ["Planning", "planning", "active"],
    ["Running", "running", "active"],
    ["NotYet", "not-yet-running", "active"],
    ["NoneLiteral", "none", "active"],
    ["Empty", "", "active"],
    ["Stopped", "stopped", "inactive"],
    ["Waiting", "waiting", "inactive"],
    ["Blocked", "blocked", "inactive"],
    ["Someday", "someday", "inactive"],
    ["Done", "done", "archived"],
    ["Cancelled", "cancelled", "archived"],
    ["Archived", "archived", "archived"],
    ["Deleted", "deleted", "archived"]
  ];

  const { env, report, diagnosis } = await migrateAndDoctor(
    cases.map(([name, status]) => legacyWorkspace(name, { status, priority: "urgent" }))
  );

  for (const [name, , expected] of cases) {
    const fm = env.getFrontmatter(`03-Workspace/${name}.md`);
    assert.equal(fm.lifecycle, expected);
    assert.equal("status" in fm, false);
    assert.equal("priority" in fm, false);
  }
  assert.equal(report.updated, cases.length);
  assert.equal(report.unchanged, 0);
  assert.deepEqual(report.unknownLifecycle, []);
  assert.deepEqual(report.unknownStatus, []);
  assert.deepEqual(report.unknownPriority, []);
  assert.equal(diagnosis.summary.errors, 0);
  assert.equal(diagnosis.summary.warnings, 0);
});

test("Project status and priority migration remains unchanged", async () => {
  const { env, report, diagnosis } = await migrateAndDoctor([
    workspace("Research"),
    project("Stopped", researchLink, { status: "stopped", priority: "high" }),
    project("Archived", researchLink, { status: "archived", priority: "4" }),
    project("Legacy", researchLink, { status: "waiting", priority: "urgent" })
  ]);

  assert.equal(env.getFrontmatter("10-Project/Stopped.md").status, "stopped");
  assert.equal(env.getFrontmatter("10-Project/Stopped.md").priority, "high");
  assert.equal(env.getFrontmatter("10-Project/Archived.md").status, "done");
  assert.equal(env.getFrontmatter("10-Project/Archived.md").priority, "low");
  assert.equal(env.getFrontmatter("10-Project/Legacy.md").status, "planning");
  assert.equal(env.getFrontmatter("10-Project/Legacy.md").priority, "high");
  assert.deepEqual(report.unknownLifecycle, []);
  assert.deepEqual(report.unknownStatus, []);
  assert.deepEqual(report.unknownPriority, []);
  assert.equal(diagnosis.summary.errors, 0);
});

test("Workspace and Project migration preserves metadata, relation, and note content it does not own", async () => {
  const workspaceBody = "# Research\n\nWorkspace body must remain untouched.\n";
  const projectBody = "# Terreate\n\nProject body must remain untouched.\n";
  const { env, report, diagnosis } = await migrateAndDoctor([
    legacyWorkspace("Research", {
      status: "waiting",
      priority: "urgent",
      aliases: ["Lab"],
      marker: { nested: true }
    }, workspaceBody),
    project("Terreate", researchLink, {
      status: "archived",
      priority: "4",
      aliases: ["Engine"],
      marker: ["keep"]
    }, projectBody)
  ]);

  const ws = env.getFrontmatter("03-Workspace/Research.md");
  const prj = env.getFrontmatter("10-Project/Terreate.md");
  assert.equal(ws.lifecycle, "inactive");
  assert.equal("status" in ws, false);
  assert.equal("priority" in ws, false);
  assert.deepEqual(ws.aliases, ["Lab"]);
  assert.deepEqual(ws.marker, { nested: true });
  assert.equal(prj.status, "done");
  assert.equal(prj.priority, "low");
  assert.equal(prj.workspace, researchLink);
  assert.deepEqual(prj.aliases, ["Engine"]);
  assert.deepEqual(prj.marker, ["keep"]);
  assert.equal(env.getContent("03-Workspace/Research.md"), workspaceBody);
  assert.equal(env.getContent("10-Project/Terreate.md"), projectBody);
  assert.equal(report.updated, 2);
  assert.equal(diagnosis.summary.errors, 0);
});

test("Entity migration is idempotent for canonical Workspace v2 and Project entries", async () => {
  const env = makeFakeVault([
    workspace("Research", "active", { marker: "keep" }),
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
  assert.deepEqual(first, {
    updated: 0,
    unchanged: 2,
    unknownLifecycle: [],
    unknownStatus: [],
    unknownPriority: []
  });
  assert.deepEqual(second, first);
  assert.equal(diagnosis.summary.errors, 0);
});

test("unknown legacy Workspace status remains non-destructive and visible to System Doctor", async () => {
  const env = makeFakeVault([
    legacyWorkspace("Unknown", { status: "paused-forever", priority: "critical", marker: "keep" })
  ]);
  const report = await loadMigration(env)({});
  const diagnosis = await loadDoctor(env)({});
  const fm = env.getFrontmatter("03-Workspace/Unknown.md");

  assert.equal(fm.status, "paused-forever");
  assert.equal(fm.priority, "critical");
  assert.equal("lifecycle" in fm, false);
  assert.equal(fm.marker, "keep");
  assert.deepEqual(report, {
    updated: 0,
    unchanged: 1,
    unknownLifecycle: [],
    unknownStatus: ["03-Workspace/Unknown.md: paused-forever"],
    unknownPriority: []
  });
  assert.equal(diagnosis.summary.errors, 3);
  assert.ok(diagnosis.issues.some(issue => issue.field === "lifecycle"));
  assert.ok(diagnosis.issues.some(issue => issue.field === "status"));
  assert.ok(diagnosis.issues.some(issue => issue.field === "priority"));
});

test("unknown canonical Workspace lifecycle remains non-destructive", async () => {
  const env = makeFakeVault([
    legacyWorkspace("UnknownLifecycle", {
      lifecycle: "paused",
      status: "running",
      priority: "medium",
      marker: "keep"
    })
  ]);
  const report = await loadMigration(env)({});
  const diagnosis = await loadDoctor(env)({});
  const fm = env.getFrontmatter("03-Workspace/UnknownLifecycle.md");

  assert.equal(fm.lifecycle, "paused");
  assert.equal(fm.status, "running");
  assert.equal(fm.priority, "medium");
  assert.deepEqual(report.unknownLifecycle, ["03-Workspace/UnknownLifecycle.md: paused"]);
  assert.deepEqual(report.unknownStatus, []);
  assert.equal(diagnosis.summary.errors, 3);
});
