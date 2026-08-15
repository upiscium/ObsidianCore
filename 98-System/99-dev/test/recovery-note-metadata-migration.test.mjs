import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const migrationPath = "98-System/01-script/migrate_note_metadata_v2.js";
const doctorPath = "98-System/01-script/validate_vault.js";
const referencePath = "98-System/01-script/reference_utils.js";
const noteMetaPath = "98-System/01-script/note_meta_utils.js";

const migrationSource = fs.readFileSync(path.join(root, migrationPath), "utf8");
const doctorSource = fs.readFileSync(path.join(root, doctorPath), "utf8");
const referenceSource = fs.readFileSync(path.join(root, referencePath), "utf8");
const noteMetaSource = fs.readFileSync(path.join(root, noteMetaPath), "utf8");

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
  const frontmatter = new Map(entries.map(entry => [entry.path, structuredClone(entry.fm ?? {})]));
  const contents = new Map(entries.map(entry => [entry.path, entry.content ?? ""]));
  const utilityFiles = new Map([
    [referencePath, makeFile(referencePath)],
    [noteMetaPath, makeFile(noteMetaPath)]
  ]);
  const notices = [];

  const app = {
    vault: {
      getMarkdownFiles: () => files,
      getAbstractFileByPath: requested => utilityFiles.get(requested) ?? byPath.get(requested) ?? null,
      read: async file => {
        if (file.path === referencePath) return referenceSource;
        if (file.path === noteMetaPath) return noteMetaSource;
        return contents.get(file.path) ?? "";
      }
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
    contents,
    notices,
    Notice: function Notice(message) { notices.push(String(message)); },
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

const workspaceLink = "[[03-Workspace/W|W]]";
const projectLink = "[[10-Project/P|P]]";

function workspaceEntry() {
  return {
    path: "03-Workspace/W.md",
    fm: {
      type: "workspace",
      uid: "ws_w",
      title: "W",
      status: "running",
      priority: "medium"
    }
  };
}

function projectEntry() {
  return {
    path: "10-Project/P.md",
    fm: {
      type: "project",
      uid: "prj_p",
      title: "P",
      status: "running",
      priority: "medium",
      workspace: workspaceLink
    }
  };
}

function projectNote(name, extra = {}, content = "") {
  return {
    path: `10-Project/P/${name}.md`,
    fm: {
      type: "project-note",
      project: projectLink,
      workspace: workspaceLink,
      category: "memo",
      status: "running",
      priority: 5,
      ...extra
    },
    content
  };
}

test("legacy Note statuses migrate to lifecycle without treating work completion as archival", async () => {
  const cases = [
    ["NotYet", "not-yet-running", "active"],
    ["Planning", "planning", "active"],
    ["Running", "running", "active"],
    ["Done", "done", "active"],
    ["Stopped", "stopped", "active"],
    ["Waiting", "waiting", "active"],
    ["Blocked", "blocked", "active"],
    ["Someday", "someday", "active"],
    ["Cancelled", "cancelled", "active"],
    ["None", "none", "active"],
    ["Empty", "", "active"],
    ["Archived", "archived", "archived"],
    ["Deleted", "deleted", "archived"]
  ];

  const env = makeFakeVault([
    workspaceEntry(),
    projectEntry(),
    ...cases.map(([name, status]) => projectNote(name, { status }))
  ]);
  const report = await loadMigration(env)({});
  const diagnosis = await loadDoctor(env)({});

  for (const [name, , expected] of cases) {
    const fm = env.frontmatter.get(`10-Project/P/${name}.md`);
    assert.equal(fm.lifecycle, expected);
    assert.equal("status" in fm, false);
    assert.equal("priority" in fm, false);
    assert.deepEqual(fm.aliases, []);
    assert.deepEqual(fm.tags, []);
  }

  assert.equal(report.updated, cases.length);
  assert.equal(report.unchanged, 0);
  assert.deepEqual(report.unknownLifecycle, []);
  assert.deepEqual(report.unknownStatus, []);
  assert.equal(diagnosis.summary.errors, 0);
  assert.equal(diagnosis.summary.warnings, 0);
});

test("Note migration normalizes scalar aliases/tags and preserves relation, category, custom metadata, and body", async () => {
  const body = "# Design\n\nKeep this body exactly.\n";
  const env = makeFakeVault([
    workspaceEntry(),
    projectEntry(),
    projectNote("Design", {
      status: "running",
      priority: "urgent",
      category: "document",
      aliases: "Design Doc",
      tags: "architecture",
      custom: { keep: true }
    }, body)
  ]);

  const report = await loadMigration(env)({});
  const diagnosis = await loadDoctor(env)({});
  const fm = env.frontmatter.get("10-Project/P/Design.md");

  assert.equal(fm.lifecycle, "active");
  assert.equal(fm.category, "document");
  assert.deepEqual(fm.aliases, ["Design Doc"]);
  assert.deepEqual(fm.tags, ["architecture"]);
  assert.deepEqual(fm.custom, { keep: true });
  assert.equal(fm.project, projectLink);
  assert.equal(fm.workspace, workspaceLink);
  assert.equal(env.contents.get("10-Project/P/Design.md"), body);
  assert.equal("status" in fm, false);
  assert.equal("priority" in fm, false);
  assert.equal(report.updated, 1);
  assert.equal(diagnosis.summary.errors, 0);
});

test("unknown legacy Note status is reported without deleting status or priority", async () => {
  const env = makeFakeVault([
    workspaceEntry(),
    projectEntry(),
    projectNote("Unknown", {
      status: "paused-forever",
      priority: "critical",
      aliases: [],
      tags: []
    })
  ]);

  const report = await loadMigration(env)({});
  const diagnosis = await loadDoctor(env)({});
  const fm = env.frontmatter.get("10-Project/P/Unknown.md");

  assert.equal(fm.status, "paused-forever");
  assert.equal(fm.priority, "critical");
  assert.equal("lifecycle" in fm, false);
  assert.deepEqual(report.unknownStatus, ["10-Project/P/Unknown.md: paused-forever"]);
  assert.ok(diagnosis.issues.some(item => item.field === "lifecycle"));
  assert.ok(diagnosis.issues.some(item => item.field === "status"));
  assert.ok(diagnosis.issues.some(item => item.field === "priority"));
});

test("canonical Note v2 migration is idempotent", async () => {
  const canonical = projectNote("Canonical", {
    lifecycle: "active",
    category: null,
    aliases: ["Alias"],
    tags: ["topic"]
  });
  delete canonical.fm.status;
  delete canonical.fm.priority;

  const env = makeFakeVault([workspaceEntry(), projectEntry(), canonical]);
  const migrate = loadMigration(env);
  const before = env.snapshot("10-Project/P/Canonical.md");

  const first = await migrate({});
  const second = await migrate({});
  const diagnosis = await loadDoctor(env)({});

  assert.deepEqual(env.snapshot("10-Project/P/Canonical.md"), before);
  assert.equal(first.updated, 0);
  assert.equal(first.unchanged, 1);
  assert.deepEqual(second, first);
  assert.equal(diagnosis.summary.errors, 0);
  assert.equal(diagnosis.summary.warnings, 0);
});
