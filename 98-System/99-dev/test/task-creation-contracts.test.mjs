import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function readExpression(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  return new Function(`"use strict"; return (${source});`)();
}

function frontmatterBlock(content) {
  const match = String(content).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match, "frontmatter block is required");
  return match[1];
}

function frontmatterKeys(content) {
  return frontmatterBlock(content)
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => line.slice(0, line.indexOf(":")))
    .filter(Boolean);
}

const C = readExpression("98-System/01-script/task_creation_utils.js");
const template = fs.readFileSync(
  path.join(root, "98-System/03-template/01-note/task-note-template.md"),
  "utf8"
);

const canonicalKeys = [
  "type",
  "title",
  "source",
  "created",
  "completed",
  "start",
  "due",
  "workspace",
  "project",
  "status",
  "priority",
  "triaged",
  "backlog",
  "depends_on"
];

test("Task template and creation utility share the canonical Task v3 key set", () => {
  const created = C.buildTaskContent({
    title: "Test",
    source: "[[00-DailyNote/2026/08/2026-08-09|2026-08-09]]",
    created: "2026-08-09",
    body: "# Test"
  });

  assert.deepEqual(frontmatterKeys(template), canonicalKeys);
  assert.deepEqual(frontmatterKeys(created), canonicalKeys);
});

test("Task creation defaults are canonical and legacy fields do not return", () => {
  const created = C.buildTaskContent({
    title: "Quick",
    source: "[[Source]]",
    created: "2026-08-09",
    due: "2026-08-10",
    body: "# Quick"
  });
  const fm = frontmatterBlock(created);

  assert.match(fm, /^type: task$/m);
  assert.match(fm, /^status: todo$/m);
  assert.match(fm, /^completed:\s*$/m);
  assert.match(fm, /^priority:\s*$/m);
  assert.match(fm, /^triaged: false$/m);
  assert.match(fm, /^backlog: false$/m);
  assert.match(fm, /^depends_on: \[\]$/m);

  for (const legacyField of ["scheduled", "source_path", "task_uid", "updated"]) {
    assert.doesNotMatch(fm, new RegExp(`^${legacyField}:`, "m"));
  }
});

test("Detailed and Backlog flags serialize without changing the Task schema", () => {
  const detailed = C.buildTaskContent({
    title: "Detailed",
    source: "[[Source]]",
    created: "2026-08-09",
    start: "2026-08-10",
    due: "2026-08-20",
    workspace: "[[03-Workspace/Research|Research]]",
    project: "[[10-Project/Terreate|Terreate]]",
    priority: "high",
    triaged: true,
    backlog: false,
    body: "# Detailed"
  });
  const backlog = C.buildTaskContent({
    title: "Backlog",
    source: "[[Source]]",
    created: "2026-08-09",
    workspace: "[[03-Workspace/Research|Research]]",
    project: "[[10-Project/Terreate|Terreate]]",
    priority: "low",
    triaged: true,
    backlog: true,
    body: "# Backlog"
  });

  assert.deepEqual(frontmatterKeys(detailed), canonicalKeys);
  assert.deepEqual(frontmatterKeys(backlog), canonicalKeys);
  assert.match(frontmatterBlock(detailed), /^triaged: true$/m);
  assert.match(frontmatterBlock(detailed), /^backlog: false$/m);
  assert.match(frontmatterBlock(backlog), /^start:\s*$/m);
  assert.match(frontmatterBlock(backlog), /^due:\s*$/m);
  assert.match(frontmatterBlock(backlog), /^triaged: true$/m);
  assert.match(frontmatterBlock(backlog), /^backlog: true$/m);
});

test("Task template rendering strips template frontmatter and replaces the title placeholder", async () => {
  const templateFile = { path: C.TASK_TEMPLATE_PATH, extension: "md" };
  const app = {
    vault: {
      getAbstractFileByPath: p => p === C.TASK_TEMPLATE_PATH ? templateFile : null,
      read: async file => file === templateFile ? template : ""
    }
  };

  const body = await C.readTaskTemplate({ app, title: "Rendered Title" });
  assert.equal(body.startsWith("---"), false);
  assert.match(body, /^# Rendered Title$/m);
  assert.match(body, /task-note-meta/);
  assert.match(body, /task_dependencies/);
});

test("Daily path and source links keep stable repository conventions", () => {
  const date = { format: token => ({ YYYY: "2026", MM: "08", "YYYY-MM-DD": "2026-08-09" })[token] };
  assert.equal(C.buildDailyPath(date), "00-DailyNote/2026/08/2026-08-09.md");

  const sourceFile = { extension: "md", basename: "Source", path: "11-Knowledge/Source.md" };
  const app = {
    fileManager: {
      generateMarkdownLink: (file, sourcePath, _subpath, alias) => `[[${file.path.replace(/\.md$/, "")}|${alias}]]@${sourcePath}`
    }
  };
  assert.equal(
    C.makeSourceLink({
      app,
      sourceFile,
      taskPath: "02-Task/2026/08/Test.md",
      fallbackDailyPath: "00-DailyNote/2026/08/2026-08-09.md",
      fallbackLabel: "2026-08-09"
    }),
    "[[11-Knowledge/Source|Source]]@02-Task/2026/08/Test.md"
  );
  assert.equal(
    C.makeSourceLink({
      app,
      sourceFile: null,
      taskPath: "02-Task/2026/08/Test.md",
      fallbackDailyPath: "00-DailyNote/2026/08/2026-08-09.md",
      fallbackLabel: "2026-08-09"
    }),
    "[[00-DailyNote/2026/08/2026-08-09|2026-08-09]]"
  );
});
