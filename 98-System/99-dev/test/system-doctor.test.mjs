import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const doctorSource = fs.readFileSync(
  path.join(root, "98-System/01-script/validate_vault.js"),
  "utf8"
);
const referencePath = "98-System/01-script/reference_utils.js";
const referenceSource = fs.readFileSync(path.join(root, referencePath), "utf8");

function makeFile(filePath) {
  const name = filePath.split("/").pop();
  const extension = name.includes(".") ? name.split(".").pop() : "";
  const basename = extension ? name.slice(0, -(extension.length + 1)) : name;
  return { path: filePath, basename, extension };
}

function makeMoment() {
  const moment = value => {
    const raw = String(value ?? "");
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    let valid = false;
    if (match) {
      const [, y, m, d] = match.map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      valid = date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
    }
    return {
      isValid: () => valid,
      format: () => valid ? raw : "Invalid date"
    };
  };
  moment.ISO_8601 = Symbol("ISO_8601");
  return moment;
}

function makeApp(entries) {
  const files = entries.map(entry => makeFile(entry.path));
  const frontmatter = new Map(entries.map(entry => [entry.path, entry.fm ?? {}]));
  const referenceFile = makeFile(referencePath);

  return {
    vault: {
      getMarkdownFiles: () => files,
      getAbstractFileByPath: requested => {
        if (requested === referencePath) return referenceFile;
        return files.find(file => file.path === requested) ?? null;
      },
      read: async file => file.path === referencePath ? referenceSource : ""
    },
    metadataCache: {
      getFileCache: file => ({ frontmatter: frontmatter.get(file.path) ?? {} })
    }
  };
}

function loadDoctor(app) {
  const module = { exports: {} };
  const notices = [];
  const Notice = function Notice(message) { notices.push(String(message)); };
  const window = { moment: makeMoment() };
  const quietConsole = { log() {}, warn() {}, table() {} };

  new Function("module", "app", "Notice", "window", "console", doctorSource)(
    module,
    app,
    Notice,
    window,
    quietConsole
  );

  return { validateVault: module.exports, notices };
}

async function runDoctor(entries) {
  const app = makeApp(entries);
  const { validateVault, notices } = loadDoctor(app);
  const result = await validateVault({});
  return { ...result, notices };
}

function workspace(pathName, uid, extra = {}) {
  return {
    path: `03-Workspace/${pathName}.md`,
    fm: {
      type: "workspace",
      uid,
      title: pathName,
      status: "running",
      priority: "medium",
      ...extra
    }
  };
}

function project(pathName, uid, workspaceName = "A", extra = {}) {
  return {
    path: `10-Project/${pathName}.md`,
    fm: {
      type: "project",
      uid,
      title: pathName,
      status: "running",
      priority: "high",
      workspace: `[[03-Workspace/${workspaceName}|${workspaceName}]]`,
      ...extra
    }
  };
}

function task(pathName, extra = {}) {
  return {
    path: `02-Task/2026/08/${pathName}.md`,
    fm: {
      type: "task",
      title: pathName,
      status: "todo",
      priority: "medium",
      completed: null,
      start: null,
      due: null,
      workspace: null,
      project: null,
      triaged: false,
      backlog: false,
      depends_on: [],
      ...extra
    }
  };
}

function issueFor(result, pathValue, field, severity) {
  return result.issues.find(issue =>
    issue.path === pathValue && issue.field === field && (!severity || issue.severity === severity)
  );
}

test("System Doctor accepts a canonical connected Vault", async () => {
  const result = await runDoctor([
    workspace("A", "workspace-a"),
    project("P", "project-p", "A"),
    {
      path: "03-Workspace/A/Note.md",
      fm: { type: "workspace-note", workspace: "[[03-Workspace/A|A]]" }
    },
    {
      path: "10-Project/P/Note.md",
      fm: {
        type: "project-note",
        project: "[[10-Project/P|P]]",
        workspace: "[[03-Workspace/A|A]]"
      }
    },
    task("Good", {
      workspace: "[[03-Workspace/A|A]]",
      project: "[[10-Project/P|P]]"
    })
  ]);

  assert.deepEqual(result.summary, { errors: 0, warnings: 0, entities: 2, notes: 2, tasks: 1 });
  assert.deepEqual(result.issues, []);
  assert.match(result.notices.at(-1), /error 0 \/ warning 0/);
});

test("System Doctor ignores Entry and Note templates outside canonical roots", async () => {
  const result = await runDoctor([
    workspace("A", "workspace-a"),
    project("P", "project-p", "A"),
    { path: "98-System/03-template/01-note/workspace-entry-template.md", fm: { type: "workspace" } },
    { path: "98-System/03-template/01-note/project-entry-template.md", fm: { type: "project" } },
    { path: "98-System/03-template/01-note/workspace-note-template.md", fm: { type: "workspace-note" } },
    { path: "98-System/03-template/01-note/project-note-template.md", fm: { type: "project-note" } }
  ]);

  assert.equal(result.summary.errors, 0);
  assert.equal(result.summary.warnings, 0);
  assert.equal(result.summary.entities, 2);
  assert.equal(result.summary.notes, 0);
});

test("System Doctor reports missing live Workspace Note relation", async () => {
  const notePath = "03-Workspace/A/Missing.md";
  const result = await runDoctor([
    workspace("A", "workspace-a"),
    { path: notePath, fm: { type: "workspace-note" } }
  ]);

  assert.ok(issueFor(result, notePath, "workspace", "error"));
});

test("System Doctor surfaces legacy task-pack type", async () => {
  const taskPath = "02-Task/2026/08/Legacy.md";
  const result = await runDoctor([
    {
      path: taskPath,
      fm: {
        type: "task-pack",
        status: "todo",
        priority: null,
        completed: null,
        triaged: false,
        backlog: false,
        depends_on: []
      }
    }
  ]);

  const legacyIssue = issueFor(result, taskPath, "type", "error");
  assert.ok(legacyIssue);
  assert.match(legacyIssue.message, /旧Task type/);
});

test("System Doctor detects Task Workspace and Project Workspace mismatch", async () => {
  const taskPath = "02-Task/2026/08/Mismatch.md";
  const result = await runDoctor([
    workspace("A", "workspace-a"),
    workspace("B", "workspace-b"),
    project("P", "project-p", "A"),
    task("Mismatch", {
      workspace: "[[03-Workspace/B|B]]",
      project: "[[10-Project/P|P]]"
    })
  ]);

  assert.ok(issueFor(result, taskPath, "workspace/project", "error"));
});

test("System Doctor warns when a triaged non-backlog Task has no Due", async () => {
  const taskPath = "02-Task/2026/08/NoDue.md";
  const result = await runDoctor([
    task("NoDue", { triaged: true, backlog: false, due: null })
  ]);

  assert.equal(result.summary.errors, 0);
  assert.ok(issueFor(result, taskPath, "due", "warning"));
});
