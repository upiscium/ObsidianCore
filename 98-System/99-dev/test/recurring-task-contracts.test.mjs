import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
function readExpression(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  return new Function(`"use strict"; return (${source});`)();
}
function readCommonJsFunction(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const module = { exports: {} };
  new Function("module", "exports", source)(module, module.exports);
  return module.exports;
}
function frontmatterKeys(content) {
  const match = String(content).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match);
  return match[1].split(/\r?\n/).filter(Boolean).map(line => line.slice(0, line.indexOf(":"))).filter(Boolean);
}

const S = readExpression("98-System/01-script/task_schedule_utils.js");
const recurringFactory = readExpression("98-System/01-script/recurring_task_utils.js");
const R = recurringFactory(S);
const C = readExpression("98-System/01-script/task_creation_utils.js");

const base = {
  type: "recurring-task",
  uid: "rct_test-123",
  title: "Weekly review",
  enabled: true,
  frequency: "daily",
  interval: 1,
  anchor: "2026-08-09",
  lookahead_days: 7,
  start_offset_days: null,
  due_offset_days: 0,
  priority: "medium",
  workspace: "[[03-Workspace/Research|Research]]",
  project: "[[10-Project/Terreate|Terreate]]"
};

const canonicalTaskKeys = [
  "type", "title", "source", "created", "completed", "start", "due",
  "workspace", "project", "status", "priority", "triaged", "backlog", "depends_on"
];

test("daily recurrence fills the configured lookahead window", () => {
  assert.deepEqual(R.occurrencesInWindow(base, "2026-08-09"), [
    "2026-08-09", "2026-08-10", "2026-08-11", "2026-08-12",
    "2026-08-13", "2026-08-14", "2026-08-15", "2026-08-16"
  ]);
});

test("weekly recurrence uses the anchor weekday and interval", () => {
  const definition = { ...base, frequency: "weekly", interval: 2, anchor: "2026-08-03", lookahead_days: 30 };
  assert.deepEqual(R.occurrencesInWindow(definition, "2026-08-09"), ["2026-08-17", "2026-08-31"]);
});

test("monthly recurrence skips months without the anchor day", () => {
  const definition = { ...base, frequency: "monthly", anchor: "2026-01-31", lookahead_days: 70 };
  assert.deepEqual(R.occurrencesInWindow(definition, "2026-02-01"), ["2026-03-31"]);
});

test("disabled definitions generate no occurrences", () => {
  assert.deepEqual(R.occurrencesInWindow({ ...base, enabled: false }, "2026-08-09"), []);
});

test("definition validation is strict and bounded", () => {
  assert.throws(() => R.normalizeDefinition({ ...base, type: "task" }), /recurring-task/);
  assert.throws(() => R.normalizeDefinition({ ...base, uid: "bad uid" }), /uid/);
  assert.throws(() => R.normalizeDefinition({ ...base, frequency: "cron" }), /frequency/);
  assert.throws(() => R.normalizeDefinition({ ...base, lookahead_days: 91 }), /lookahead_days/);
  assert.throws(() => R.normalizeDefinition({ ...base, priority: "urgent" }), /priority/);
});

test("occurrence paths are deterministic and unique per definition/date", () => {
  const first = R.occurrenceTaskPath(base, "2026-08-09");
  const second = R.occurrenceTaskPath(base, "2026-08-09");
  assert.equal(first, second);
  assert.equal(first, "02-Task/2026/08/20260809-R-rct_test-123.md");
  assert.notEqual(first, R.occurrenceTaskPath({ ...base, uid: "rct_other" }, "2026-08-09"));
});

test("occurrence fields apply relative Start/Due offsets", () => {
  assert.deepEqual(R.occurrenceTaskFields({ ...base, start_offset_days: -1, due_offset_days: 2 }, "2026-08-10", "2026-08-09"), {
    title: "Weekly review",
    created: "2026-08-09",
    start: "2026-08-09",
    due: "2026-08-12",
    workspace: "[[03-Workspace/Research|Research]]",
    project: "[[10-Project/Terreate|Terreate]]",
    priority: "medium"
  });
  assert.throws(
    () => R.occurrenceTaskFields({ ...base, start_offset_days: 2, due_offset_days: 0 }, "2026-08-10", "2026-08-09"),
    /StartはDue以前/
  );
});

test("generated occurrence content remains exact canonical Task v3", () => {
  const fields = R.occurrenceTaskFields(base, "2026-08-10", "2026-08-09");
  const content = C.buildTaskContent({
    ...fields,
    source: "[[02-Task/Recurring/Weekly review|Weekly review]]",
    triaged: true,
    backlog: false,
    body: "# Weekly review"
  });
  assert.deepEqual(frontmatterKeys(content), canonicalTaskKeys);
  assert.match(content, /^type: task$/m);
  assert.match(content, /^triaged: true$/m);
  assert.match(content, /^backlog: false$/m);
  assert.doesNotMatch(content, /^recurrence:/m);
  assert.doesNotMatch(content, /^recurring_uid:/m);
});

test("generator is idempotent against a fake Vault", async () => {
  const generator = readCommonJsFunction("98-System/01-script/generate_recurring_tasks.js");
  const definition = { ...base, lookahead_days: 1 };
  const definitionFile = {
    path: "02-Task/Recurring/Weekly review.md",
    extension: "md",
    basename: "Weekly review"
  };
  const createdFiles = new Map();
  const createdFrontmatter = new Map();

  function systemFile(filePath) {
    const absolute = path.join(root, filePath);
    if (!fs.existsSync(absolute)) return null;
    return {
      path: filePath,
      extension: path.extname(filePath).slice(1),
      basename: path.basename(filePath, path.extname(filePath))
    };
  }

  globalThis.app = {
    vault: {
      getMarkdownFiles: () => [definitionFile, ...createdFiles.values()],
      getAbstractFileByPath: filePath => {
        if (filePath === definitionFile.path) return definitionFile;
        return createdFiles.get(filePath) ?? systemFile(filePath);
      },
      read: async file => fs.readFileSync(path.join(root, file.path), "utf8"),
      createFolder: async () => ({}),
      create: async (filePath, content) => {
        const file = { path: filePath, extension: "md", basename: path.basename(filePath, ".md") };
        createdFiles.set(filePath, file);
        createdFrontmatter.set(filePath, { type: "task" });
        return file;
      }
    },
    metadataCache: {
      getFileCache: file => {
        if (file.path === definitionFile.path) return { frontmatter: definition };
        return { frontmatter: createdFrontmatter.get(file.path) ?? {} };
      }
    },
    fileManager: {
      generateMarkdownLink: (file, _sourcePath, _subpath, alias) => `[[${file.path.replace(/\.md$/, "")}|${alias}]]`
    }
  };
  globalThis.window = { moment: () => ({ format: () => "2026-08-09" }) };
  globalThis.Notice = class Notice { constructor() {} };

  const first = await generator({});
  assert.deepEqual({ generated: first.generated, existing: first.existing, disabled: first.disabled, errors: first.errors.length }, {
    generated: 2, existing: 0, disabled: 0, errors: 0
  });
  const firstPaths = [...createdFiles.keys()].sort();
  assert.deepEqual(firstPaths, [
    "02-Task/2026/08/20260809-R-rct_test-123.md",
    "02-Task/2026/08/20260810-R-rct_test-123.md"
  ]);

  const second = await generator({});
  assert.deepEqual({ generated: second.generated, existing: second.existing, disabled: second.disabled, errors: second.errors.length }, {
    generated: 0, existing: 2, disabled: 0, errors: 0
  });
  assert.deepEqual([...createdFiles.keys()].sort(), firstPaths);

  delete globalThis.app;
  delete globalThis.window;
  delete globalThis.Notice;
});

test("Dashboard exposes recurring creation, generation, and definition management", () => {
  const dashboard = fs.readFileSync(path.join(root, "Dashboard.md"), "utf8");
  const dashboardTasks = fs.readFileSync(path.join(root, "98-System/02-embed/05-task/dashboard-tasks.md"), "utf8");
  const buttons = fs.readFileSync(path.join(root, "98-System/02-embed/01-button/dashboard-buttons.md"), "utf8");
  assert.match(dashboard, /BUTTON\[create-recurring-task, generate-recurring-tasks\]/);
  assert.match(dashboardTasks, /\[\[recurring-tasks\]\]/);
  assert.match(buttons, /id: create-recurring-task/);
  assert.match(buttons, /id: generate-recurring-tasks/);
});

test("Recurring Definition Dataview compiles inside an async wrapper", () => {
  const view = fs.readFileSync(path.join(root, "98-System/04-view/recurring_tasks.js"), "utf8");
  assert.doesNotThrow(() => new Function(
    "dv", "input", "app", "Notice", "document",
    `"use strict"; return (async () => {\n${view}\n});`
  ));
});
