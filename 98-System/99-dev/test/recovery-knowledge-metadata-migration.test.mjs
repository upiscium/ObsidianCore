import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const migrationPath = "98-System/01-script/migrate_knowledge_metadata_v2.js";
const doctorPath = "98-System/01-script/validate_vault.js";
const referencePath = "98-System/01-script/reference_utils.js";
const knowledgeMetaPath = "98-System/01-script/knowledge_meta_utils.js";

const migrationSource = fs.readFileSync(path.join(root, migrationPath), "utf8");
const doctorSource = fs.readFileSync(path.join(root, doctorPath), "utf8");

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
  const notices = [];
  const mutations = [];

  const systemFiles = new Map([referencePath, knowledgeMetaPath].map(filePath => [
    filePath,
    makeFile({ path: filePath })
  ]));

  const app = {
    vault: {
      getMarkdownFiles: () => files,
      getAbstractFileByPath: requested => byPath.get(requested) ?? systemFiles.get(requested) ?? null,
      read: async file => systemFiles.has(file.path)
        ? fs.readFileSync(path.join(root, file.path), "utf8")
        : contents.get(file.path) ?? ""
    },
    metadataCache: {
      getFileCache: file => ({ frontmatter: frontmatter.get(file.path) ?? {} })
    },
    fileManager: {
      processFrontMatter: async (file, mutator) => {
        const fm = frontmatter.get(file.path);
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
    getContent: filePath => contents.get(filePath)
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

function makeMoment() {
  const moment = () => ({ isValid: () => false, format: () => "Invalid date" });
  moment.ISO_8601 = Symbol("ISO_8601");
  return moment;
}

function loadDoctor(env) {
  const module = { exports: {} };
  const quietConsole = { log() {}, warn() {}, error() {}, table() {} };
  new Function("module", "app", "Notice", "window", "console", doctorSource)(
    module,
    env.app,
    env.Notice,
    { moment: makeMoment() },
    quietConsole
  );
  return module.exports;
}

function knowledge(name, extra = {}, content = "# Body\n") {
  return {
    path: `11-Knowledge/${name}.md`,
    fm: {
      type: "knowledge-note",
      status: "not-yet-running",
      category: null,
      maturity: null,
      source_type: null,
      ...extra
    },
    content
  };
}

test("Knowledge recovery migration maps every supported legacy work status to active", async () => {
  const legacyStatuses = [
    "not-yet-running", "planning", "running", "done", "stopped",
    "waiting", "blocked", "someday", "cancelled", null
  ];
  const entries = legacyStatuses.map((status, index) => knowledge(`Legacy-${index}`, { status, maturity: "draft" }));
  const env = makeFakeVault(entries);
  const report = await loadMigration(env)({});

  assert.equal(report.updated, entries.length);
  assert.equal(report.unknownStatus.length, 0);
  for (const entry of entries) {
    assert.equal(env.getFrontmatter(entry.path).status, "active");
  }

  const diagnosis = await loadDoctor(env)({});
  assert.equal(diagnosis.summary.errors, 0);
  assert.equal(diagnosis.summary.warnings, 0);
});

test("outdated maturity moves to lifecycle status while archived/deleted visibility dominates", async () => {
  const entries = [
    knowledge("Current", { status: "running", maturity: "outdated" }),
    knowledge("Archived", { status: "archived", maturity: "outdated" }),
    knowledge("Deleted", { status: "deleted", maturity: "outdated" })
  ];
  const env = makeFakeVault(entries);
  await loadMigration(env)({});

  assert.equal(env.getFrontmatter(entries[0].path).status, "outdated");
  assert.equal(env.getFrontmatter(entries[1].path).status, "archived");
  assert.equal(env.getFrontmatter(entries[2].path).status, "deleted");
  for (const entry of entries) assert.equal(env.getFrontmatter(entry.path).maturity, null);

  const diagnosis = await loadDoctor(env)({});
  assert.equal(diagnosis.summary.errors, 0);
});

test("canonical Knowledge v2 migration is idempotent and preserves unrelated metadata/body", async () => {
  const entry = knowledge("Canonical", {
    status: "active",
    category: "spec",
    maturity: "stable",
    source_type: "official",
    aliases: ["Spec"],
    tags: ["example"],
    custom_field: "keep"
  }, "# Canonical\nBody must remain untouched.\n");
  const env = makeFakeVault([entry]);
  const beforeBody = env.getContent(entry.path);
  const first = await loadMigration(env)({});
  const second = await loadMigration(env)({});

  assert.equal(first.updated, 0);
  assert.equal(first.unchanged, 1);
  assert.equal(second.updated, 0);
  assert.deepEqual(env.getFrontmatter(entry.path).aliases, ["Spec"]);
  assert.deepEqual(env.getFrontmatter(entry.path).tags, ["example"]);
  assert.equal(env.getFrontmatter(entry.path).custom_field, "keep");
  assert.equal(env.getContent(entry.path), beforeBody);

  const diagnosis = await loadDoctor(env)({});
  assert.deepEqual(diagnosis.summary, {
    errors: 0, warnings: 0, entities: 0, notes: 0, tasks: 0
  });
});

test("unknown Knowledge values remain untouched, are reported, and Doctor rejects them", async () => {
  const entry = knowledge("Unknown", {
    status: "mystery",
    category: "memo",
    maturity: "ancient",
    source_type: "chat"
  });
  const env = makeFakeVault([entry]);
  const before = structuredClone(env.getFrontmatter(entry.path));
  const report = await loadMigration(env)({});

  assert.equal(report.updated, 0);
  assert.equal(report.unknownStatus.length, 1);
  assert.equal(report.unknownCategory.length, 1);
  assert.equal(report.unknownMaturity.length, 1);
  assert.equal(report.unknownSourceType.length, 1);
  assert.deepEqual(env.getFrontmatter(entry.path), before);

  const diagnosis = await loadDoctor(env)({});
  assert.ok(diagnosis.issues.some(issue => issue.path === entry.path && issue.field === "status"));
  assert.ok(diagnosis.issues.some(issue => issue.path === entry.path && issue.field === "category"));
  assert.ok(diagnosis.issues.some(issue => issue.path === entry.path && issue.field === "maturity"));
  assert.ok(diagnosis.issues.some(issue => issue.path === entry.path && issue.field === "source_type"));
});

test("outdated maturity is not destructively moved when legacy status is unknown", async () => {
  const entry = knowledge("UnknownStatusOutdated", {
    status: "mystery",
    category: "summary",
    maturity: "outdated",
    source_type: "self"
  });
  const env = makeFakeVault([entry]);
  const report = await loadMigration(env)({});

  assert.equal(report.unknownStatus.length, 1);
  assert.equal(report.unknownMaturity.length, 0);
  assert.equal(env.getFrontmatter(entry.path).status, "mystery");
  assert.equal(env.getFrontmatter(entry.path).maturity, "outdated");
});
