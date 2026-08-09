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

const canonicalTaskFields = [
  "type", "title", "source", "created", "completed", "start", "due",
  "workspace", "project", "status", "priority", "triaged", "backlog", "depends_on"
];

function makeFile(entry) {
  const filePath = entry.path;
  const name = filePath.split("/").pop();
  const extension = name.includes(".") ? name.split(".").pop() : "";
  const basename = extension ? name.slice(0, -(extension.length + 1)) : name;
  const parentPath = filePath.split("/").slice(0, -1).join("/");
  return {
    path: filePath,
    basename,
    extension,
    parent: parentPath ? { path: parentPath } : null,
    stat: {
      ctime: entry.ctime ?? Date.UTC(2026, 7, 1, 3, 0, 0),
      mtime: entry.mtime ?? Date.UTC(2026, 7, 2, 3, 0, 0)
    }
  };
}

function makeMoment() {
  function parse(value) {
    if (value instanceof Date) return new Date(value.getTime());
    if (typeof value === "number") return new Date(value);
    const raw = String(value ?? "").trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const date = new Date(Date.UTC(year, month - 1, day));
      if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
        return date;
      }
      return null;
    }
    const timestamp = Date.parse(raw);
    return Number.isFinite(timestamp) ? new Date(timestamp) : null;
  }

  function formatDate(date) {
    if (!date) return "Invalid date";
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const moment = value => {
    const date = parse(value);
    return {
      isValid: () => Boolean(date),
      format: () => formatDate(date),
      isAfter: other => {
        const otherDate = parse(other?.format ? other.format("YYYY-MM-DD") : other);
        return Boolean(date && otherDate && date.getTime() > otherDate.getTime());
      }
    };
  };
  moment.ISO_8601 = Symbol("ISO_8601");
  return moment;
}

function makeFakeVault(entries) {
  const files = entries.map(makeFile);
  const byPath = new Map(files.map(file => [file.path, file]));
  const frontmatter = new Map(entries.map(entry => [entry.path, structuredClone(entry.fm ?? {})]));
  const contents = new Map(entries.map(entry => [entry.path, entry.content ?? ""]));
  const referenceFile = {
    path: referencePath,
    basename: "reference_utils",
    extension: "js",
    parent: { path: "98-System/01-script" },
    stat: { ctime: 0, mtime: 0 }
  };
  const notices = [];
  const mutations = [];

  const app = {
    vault: {
      getMarkdownFiles: () => files,
      getAbstractFileByPath: requested => {
        if (requested === referencePath) return referenceFile;
        return byPath.get(requested) ?? null;
      },
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
    snapshot: filePath => structuredClone(frontmatter.get(filePath))
  };
}

function loadMigration(env) {
  const module = { exports: {} };
  const window = { moment: makeMoment() };
  const quietConsole = { log() {}, warn() {}, error() {}, table() {} };
  new Function("module", "window", "Notice", "console", migrationSource)(
    module,
    window,
    env.Notice,
    quietConsole
  );
  return module.exports;
}

function loadDoctor(env) {
  const module = { exports: {} };
  const window = { moment: makeMoment() };
  const quietConsole = { log() {}, warn() {}, error() {}, table() {} };
  new Function("module", "app", "Notice", "window", "console", doctorSource)(
    module,
    env.app,
    env.Notice,
    window,
    quietConsole
  );
  return module.exports;
}

async function migrateAndDoctor(entries) {
  const env = makeFakeVault(entries);
  const migrate = loadMigration(env);
  const doctor = loadDoctor(env);
  const report = await migrate({ app: env.app });
  const diagnosis = await doctor({});
  return { env, report, diagnosis };
}

function assertCanonicalTaskShape(fm) {
  for (const field of canonicalTaskFields) assert.ok(field in fm, `missing canonical Task field: ${field}`);
  for (const legacy of ["scheduled", "source_path", "updated", "reviewed"]) {
    assert.equal(legacy in fm, false, `legacy field remains: ${legacy}`);
  }
  assert.equal(fm.type, "task");
  assert.ok(["todo", "doing", "done", "cancelled"].includes(fm.status));
  assert.ok(["high", "medium", "low", null].includes(fm.priority));
  assert.equal(typeof fm.triaged, "boolean");
  assert.equal(typeof fm.backlog, "boolean");
  assert.ok(Array.isArray(fm.depends_on));
}

function task(pathName, fm, content = "", times = {}) {
  return {
    path: `02-Task/2026/08/${pathName}.md`,
    fm,
    content,
    ...times
  };
}

test("real Task migration converts task-pack metadata into canonical Task v3 and Doctor becomes clean", async () => {
  const taskPath = "02-Task/2026/08/20260801-120000-001-Legacy.md";
  const { env, report, diagnosis } = await migrateAndDoctor([
    task("20260801-120000-001-Legacy", {
      type: "task-pack",
      status: "archived",
      priority: "1",
      source_path: "00-DailyNote/2026/08/2026-08-01.md",
      updated: "2026-08-02",
      reviewed: true,
      marker: { keep: true }
    }, "# Legacy", {
      ctime: Date.UTC(2026, 7, 1, 3, 0, 0),
      mtime: Date.UTC(2026, 7, 3, 3, 0, 0)
    })
  ]);

  const fm = env.getFrontmatter(taskPath);
  assertCanonicalTaskShape(fm);
  assert.equal(fm.title, "Legacy");
  assert.equal(fm.status, "done");
  assert.equal(fm.priority, "high");
  assert.equal(fm.created, "2026-08-01");
  assert.equal(fm.completed, "2026-08-03");
  assert.equal(fm.source, "[[00-DailyNote/2026/08/2026-08-01]]");
  assert.equal(fm.triaged, false);
  assert.equal(fm.backlog, false);
  assert.deepEqual(fm.marker, { keep: true });
  assert.deepEqual(report, { migrated: 1, skipped: 0, failures: [] });
  assert.deepEqual(diagnosis.summary, { errors: 0, warnings: 0, entities: 0, notes: 0, tasks: 1 });
});

test("real Task migration maps scheduled to start and preserves a valid Due invariant", async () => {
  const taskPath = "02-Task/2026/08/Scheduled.md";
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

  const fm = env.getFrontmatter(taskPath);
  assertCanonicalTaskShape(fm);
  assert.equal(fm.status, "todo");
  assert.equal(fm.priority, "medium");
  assert.equal(fm.start, "2026-08-05");
  assert.equal(fm.due, "2026-08-10");
  assert.equal(fm.triaged, true);
  assert.equal(fm.source, "[[00-DailyNote/2026/08/2026-08-01]]");
  assert.deepEqual(diagnosis.summary, { errors: 0, warnings: 0, entities: 0, notes: 0, tasks: 1 });
});

test("real Task migration converts someday work into canonical Backlog semantics", async () => {
  const taskPath = "02-Task/2026/08/Someday.md";
  const { env, diagnosis } = await migrateAndDoctor([
    task("Someday", {
      type: "task-pack",
      title: "Someday",
      status: "someday",
      priority: "lowest",
      created: "2026-08-01",
      start: "2026-08-05",
      due: "2026-08-10",
      backlog: false
    })
  ]);

  const fm = env.getFrontmatter(taskPath);
  assertCanonicalTaskShape(fm);
  assert.equal(fm.status, "todo");
  assert.equal(fm.priority, "low");
  assert.equal(fm.backlog, true);
  assert.equal(fm.triaged, true);
  assert.equal(fm.start, null);
  assert.equal(fm.due, null);
  assert.deepEqual(diagnosis.summary, { errors: 0, warnings: 0, entities: 0, notes: 0, tasks: 1 });
});

test("real Task migration normalizes source and merges body dependencies without touching unrelated metadata", async () => {
  const taskPath = "02-Task/2026/08/Dependencies.md";
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
      "",
      "## Dependency",
      "[[02-Task/IgnoredOutsideSection|IgnoredOutsideSection]]",
      "",
      "## Dependencies",
      "[[02-Task/Existing|Existing]]",
      "[[02-Task/BodyDependency|BodyDependency]]",
      "[[98-System/03-template/ignore|ignore]]",
      "",
      "## Memo",
      "keep"
    ].join("\n"))
  ]);

  const fm = env.getFrontmatter(taskPath);
  assertCanonicalTaskShape(fm);
  assert.equal(fm.status, "doing");
  assert.equal(fm.priority, "high");
  assert.equal(fm.source, "[[00-DailyNote/2026/08/2026-08-01]]");
  assert.deepEqual(fm.depends_on, [
    "[[02-Task/Existing|Existing]]",
    "[[02-Task/BodyDependency|BodyDependency]]"
  ]);
  assert.deepEqual(fm.marker, { nested: true });
  assert.deepEqual(diagnosis.summary, { errors: 0, warnings: 0, entities: 0, notes: 0, tasks: 1 });
});

test("real Task migration is idempotent for an already-canonical Task", async () => {
  const taskPath = "02-Task/2026/08/Canonical.md";
  const env = makeFakeVault([
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
  const doctor = loadDoctor(env);
  const before = env.snapshot(taskPath);

  const first = await migrate({ app: env.app });
  const afterFirst = env.snapshot(taskPath);
  const second = await migrate({ app: env.app });
  const afterSecond = env.snapshot(taskPath);
  const diagnosis = await doctor({});

  assert.deepEqual(afterFirst, before);
  assert.deepEqual(afterSecond, before);
  assert.deepEqual(first, { migrated: 1, skipped: 0, failures: [] });
  assert.deepEqual(second, { migrated: 1, skipped: 0, failures: [] });
  assertCanonicalTaskShape(afterSecond);
  assert.equal(afterSecond.marker, "keep");
  assert.deepEqual(diagnosis.summary, { errors: 0, warnings: 0, entities: 0, notes: 0, tasks: 1 });
});
