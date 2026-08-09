import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const migrationPath = "98-System/01-script/migrate_tasks_v3.js";
const doctorPath = "98-System/01-script/validate_vault.js";
const referencePath = "98-System/01-script/reference_utils.js";
const migrationSource = fs.readFileSync(path.join(root, migrationPath), "utf8");
const doctorSource = fs.readFileSync(path.join(root, doctorPath), "utf8");
const referenceSource = fs.readFileSync(path.join(root, referencePath), "utf8");

const canonicalFields = [
  "type", "title", "source", "created", "completed", "start", "due",
  "workspace", "project", "status", "priority", "triaged", "backlog", "depends_on"
];

function makeMoment() {
  const parse = value => {
    if (value?._date instanceof Date) return new Date(value._date.getTime());
    if (value instanceof Date) return new Date(value.getTime());
    if (typeof value === "number") return new Date(value);
    const raw = String(value ?? "").trim();
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return date.getUTCFullYear() === Number(m[1]) &&
      date.getUTCMonth() === Number(m[2]) - 1 &&
      date.getUTCDate() === Number(m[3]) ? date : null;
  };

  const moment = value => {
    const date = parse(value);
    const full = date
      ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`
      : "Invalid date";
    return {
      _date: date,
      isValid: () => Boolean(date),
      format: pattern => pattern === "YYYY" ? full.slice(0, 4) : pattern === "MM" ? full.slice(5, 7) : full,
      isAfter: other => Boolean(date && parse(other) && date.getTime() > parse(other).getTime())
    };
  };
  moment.ISO_8601 = Symbol("ISO_8601");
  return moment;
}

function makeFile(entry) {
  const name = entry.path.split("/").pop();
  const extension = name.includes(".") ? name.split(".").pop() : "";
  const basename = extension ? name.slice(0, -(extension.length + 1)) : name;
  const parentPath = entry.path.split("/").slice(0, -1).join("/");
  return {
    path: entry.path,
    basename,
    extension,
    parent: parentPath ? { path: parentPath } : null,
    stat: {
      ctime: entry.ctime ?? Date.UTC(2026, 7, 1),
      mtime: entry.mtime ?? Date.UTC(2026, 7, 2)
    }
  };
}

function makeEnv(entries) {
  const files = entries.map(makeFile);
  const byPath = new Map(files.map(file => [file.path, file]));
  const fm = new Map(entries.map(entry => [entry.path, structuredClone(entry.fm ?? {})]));
  const contents = new Map(entries.map(entry => [entry.path, entry.content ?? ""]));
  const referenceFile = { path: referencePath, basename: "reference_utils", extension: "js" };
  const notices = [];

  const app = {
    vault: {
      getMarkdownFiles: () => files,
      getAbstractFileByPath: requested => requested === referencePath ? referenceFile : byPath.get(requested) ?? null,
      read: async file => file.path === referencePath ? referenceSource : contents.get(file.path) ?? ""
    },
    metadataCache: {
      getFileCache: file => ({ frontmatter: fm.get(file.path) ?? {} })
    },
    fileManager: {
      processFrontMatter: async (file, mutator) => mutator(fm.get(file.path))
    }
  };

  return {
    app,
    Notice: function Notice(message) { notices.push(String(message)); },
    notices,
    get: filePath => fm.get(filePath),
    snapshot: filePath => structuredClone(fm.get(filePath))
  };
}

function loadCommonJs(source, args, values) {
  const module = { exports: {} };
  new Function("module", ...args, source)(module, ...values);
  return module.exports;
}

function loadMigration(env) {
  return loadCommonJs(
    migrationSource,
    ["window", "Notice", "console"],
    [{ moment: makeMoment() }, env.Notice, { log() {}, warn() {}, error() {}, table() {} }]
  );
}

function loadDoctor(env) {
  return loadCommonJs(
    doctorSource,
    ["app", "Notice", "window", "console"],
    [env.app, env.Notice, { moment: makeMoment() }, { log() {}, warn() {}, error() {}, table() {} }]
  );
}

async function migrateAndDoctor(entries) {
  const env = makeEnv(entries);
  const report = await loadMigration(env)({ app: env.app });
  const diagnosis = await loadDoctor(env)({});
  return { env, report, diagnosis };
}

function task(name, fm, content = "", times = {}) {
  return { path: `02-Task/2026/08/${name}.md`, fm, content, ...times };
}

function assertCanonical(fm) {
  for (const field of canonicalFields) assert.ok(field in fm, `missing canonical field: ${field}`);
  for (const field of ["scheduled", "source_path", "updated", "reviewed"]) assert.equal(field in fm, false);
  assert.equal(fm.type, "task");
  assert.ok(["todo", "doing", "done", "cancelled"].includes(fm.status));
  assert.ok(["high", "medium", "low", null].includes(fm.priority));
  assert.equal(typeof fm.triaged, "boolean");
  assert.equal(typeof fm.backlog, "boolean");
  assert.ok(Array.isArray(fm.depends_on));
}

const cleanSummary = { errors: 0, warnings: 0, entities: 0, notes: 0, tasks: 1 };

test("real migration converts task-pack aliases into canonical Task v3", async () => {
  const pathValue = "02-Task/2026/08/20260801-120000-001-Legacy.md";
  const { env, report, diagnosis } = await migrateAndDoctor([
    task("20260801-120000-001-Legacy", {
      type: "task-pack",
      status: "archived",
      priority: "1",
      source_path: "00-DailyNote/2026/08/2026-08-01.md",
      updated: "old",
      reviewed: true,
      marker: { keep: true }
    }, "# Legacy", {
      ctime: Date.UTC(2026, 7, 1),
      mtime: Date.UTC(2026, 7, 3)
    })
  ]);

  const fm = env.get(pathValue);
  assertCanonical(fm);
  assert.equal(fm.title, "Legacy");
  assert.equal(fm.status, "done");
  assert.equal(fm.priority, "high");
  assert.equal(fm.created, "2026-08-01");
  assert.equal(fm.completed, "2026-08-03");
  assert.equal(fm.source, "[[00-DailyNote/2026/08/2026-08-01]]");
  assert.equal(fm.triaged, false);
  assert.deepEqual(fm.marker, { keep: true });
  assert.deepEqual(report, { migrated: 1, skipped: 0, failures: [] });
  assert.deepEqual(diagnosis.summary, cleanSummary);
});

test("real migration maps scheduled to start and builds the fallback Daily source", async () => {
  const pathValue = "02-Task/2026/08/Scheduled.md";
  const { env, diagnosis } = await migrateAndDoctor([
    task("Scheduled", {
      type: "task-pack",
      title: "Scheduled",
      status: "planning",
      priority: "normal",
      created: "2026-08-01",
      scheduled: "2026-08-05",
      due: "2026-08-10"
    })
  ]);

  const fm = env.get(pathValue);
  assertCanonical(fm);
  assert.equal(fm.status, "todo");
  assert.equal(fm.priority, "medium");
  assert.equal(fm.start, "2026-08-05");
  assert.equal(fm.due, "2026-08-10");
  assert.equal(fm.triaged, true);
  assert.equal(fm.source, "[[00-DailyNote/2026/08/2026-08-01]]");
  assert.deepEqual(diagnosis.summary, cleanSummary);
});

test("real migration converts someday into canonical Backlog semantics", async () => {
  const pathValue = "02-Task/2026/08/Someday.md";
  const { env, diagnosis } = await migrateAndDoctor([
    task("Someday", {
      type: "task-pack",
      title: "Someday",
      status: "someday",
      priority: "lowest",
      created: "2026-08-01",
      start: "2026-08-05",
      due: "2026-08-10"
    })
  ]);

  const fm = env.get(pathValue);
  assertCanonical(fm);
  assert.equal(fm.status, "todo");
  assert.equal(fm.priority, "low");
  assert.equal(fm.backlog, true);
  assert.equal(fm.triaged, true);
  assert.equal(fm.start, null);
  assert.equal(fm.due, null);
  assert.deepEqual(diagnosis.summary, cleanSummary);
});

test("real migration normalizes source and merges body dependencies", async () => {
  const pathValue = "02-Task/2026/08/Dependencies.md";
  const { env, diagnosis } = await migrateAndDoctor([
    task("Dependencies", {
      type: "task-pack",
      title: "Dependencies",
      status: "running",
      priority: "urgent",
      created: "2026-08-01",
      scheduled: "2026-08-04",
      due: "2026-08-10",
      source_path: "00-DailyNote/2026/08/2026-08-01.md",
      depends_on: ["[[02-Task/Existing|Existing]]"],
      marker: { nested: true }
    }, [
      "# Dependencies",
      "## Dependencies",
      "[[02-Task/Existing|Existing]]",
      "[[02-Task/BodyDependency|BodyDependency]]",
      "[[98-System/03-template/ignore|ignore]]",
      "## Memo",
      "keep"
    ].join("\n"))
  ]);

  const fm = env.get(pathValue);
  assertCanonical(fm);
  assert.equal(fm.status, "doing");
  assert.equal(fm.priority, "high");
  assert.equal(fm.source, "[[00-DailyNote/2026/08/2026-08-01]]");
  assert.deepEqual(fm.depends_on, [
    "[[02-Task/Existing|Existing]]",
    "[[02-Task/BodyDependency|BodyDependency]]"
  ]);
  assert.deepEqual(fm.marker, { nested: true });
  assert.deepEqual(diagnosis.summary, cleanSummary);
});

test("real migration is idempotent for an already-canonical Task", async () => {
  const pathValue = "02-Task/2026/08/Canonical.md";
  const env = makeEnv([
    task("Canonical", {
      type: "task",
      title: "Canonical",
      source: "[[00-DailyNote/2026/08/2026-08-01]]",
      created: "2026-08-01",
      completed: null,
      start: null,
      due: "2026-08-10",
      workspace: null,
      project: null,
      status: "todo",
      priority: "medium",
      triaged: true,
      backlog: false,
      depends_on: [],
      marker: "keep"
    })
  ]);
  const migrate = loadMigration(env);
  const before = env.snapshot(pathValue);

  assert.deepEqual(await migrate({ app: env.app }), { migrated: 1, skipped: 0, failures: [] });
  assert.deepEqual(env.snapshot(pathValue), before);
  assert.deepEqual(await migrate({ app: env.app }), { migrated: 1, skipped: 0, failures: [] });
  assert.deepEqual(env.snapshot(pathValue), before);
  assertCanonical(env.get(pathValue));
  assert.deepEqual((await loadDoctor(env)({})).summary, cleanSummary);
});
