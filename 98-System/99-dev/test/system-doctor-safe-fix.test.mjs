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

function basename(filePath) {
  return path.posix.basename(filePath, path.posix.extname(filePath));
}

function record(filePath, fm, parentPath = path.posix.dirname(filePath)) {
  return {
    file: {
      path: filePath,
      basename: basename(filePath),
      extension: "md",
      parent: { path: parentPath }
    },
    parentPath,
    fm
  };
}

function issue(pathValue, field, severity = "error") {
  return { path: pathValue, field, severity, message: "test" };
}

const G = readExpression("98-System/01-script/reference_utils.js");
const factory = readExpression("98-System/01-script/system_doctor_safe_fix_utils.js");
const F = factory(G);
const makeLink = (target) => `[[${target.file.path.replace(/\.md$/, "")}|${target.fm.title ?? target.file.basename}]]`;

function canonicalRecords() {
  const workspace = record("03-Workspace/A/A.md", {
    type: "workspace",
    uid: "ws-a",
    title: "A",
    aliases: ["Alpha"],
    status: "running",
    priority: "medium"
  });
  const project = record("10-Project/P/P.md", {
    type: "project",
    uid: "prj-p",
    title: "P",
    aliases: [],
    status: "running",
    priority: "high",
    workspace: "[[03-Workspace/A/A|A]]"
  });
  return { workspace, project };
}

test("safe planner proposes only unique deterministic relation repairs", () => {
  const { workspace, project } = canonicalRecords();
  const workspaceNote = record("03-Workspace/A/Note.md", { type: "workspace-note" });
  const projectNote = record("10-Project/P/Note.md", { type: "project-note" });
  const projectTask = record("02-Task/2026/08/ProjectTask.md", {
    type: "task",
    project: "[[10-Project/P/P|P]]",
    workspace: null
  });
  const legacyTask = record("02-Task/2026/08/LegacyWorkspace.md", {
    type: "task",
    project: null,
    workspace: "Alpha"
  });

  const fixes = F.planSafeFixes({
    records: [workspace, project, workspaceNote, projectNote, projectTask, legacyTask],
    doctorIssues: [
      issue(workspaceNote.file.path, "workspace"),
      issue(projectNote.file.path, "project"),
      issue(projectTask.file.path, "workspace", "warning"),
      issue(legacyTask.file.path, "workspace", "warning")
    ],
    makeLink
  });

  assert.equal(fixes.length, 5);
  assert.deepEqual(
    fixes.map(fix => [fix.path, fix.field, fix.kind]),
    [
      [legacyTask.file.path, "workspace", "canonicalize-relation"],
      [workspaceNote.file.path, "workspace", "infer-folder-workspace"],
      [projectNote.file.path, "project", "infer-folder-project"],
      [projectNote.file.path, "workspace", "derive-project-workspace"],
      [projectTask.file.path, "workspace", "derive-project-workspace"]
    ]
  );
  assert.equal(fixes.find(fix => fix.path === legacyTask.file.path).after, "[[03-Workspace/A/A|A]]");
});

test("ambiguous aliases and parent-folder inference remain report-only", () => {
  const a = record("03-Workspace/Shared/A.md", {
    type: "workspace", uid: "ws-a", title: "A", aliases: ["Shared"], status: "running", priority: null
  }, "03-Workspace/Shared");
  const b = record("03-Workspace/Shared/B.md", {
    type: "workspace", uid: "ws-b", title: "B", aliases: ["Shared"], status: "running", priority: null
  }, "03-Workspace/Shared");
  const note = record("03-Workspace/Shared/Note.md", { type: "workspace-note" }, "03-Workspace/Shared");
  const task = record("02-Task/2026/08/Ambiguous.md", { type: "task", workspace: "Shared", project: null });

  const fixes = F.planSafeFixes({
    records: [a, b, note, task],
    doctorIssues: [issue(note.file.path, "workspace"), issue(task.file.path, "workspace", "warning")],
    makeLink
  });

  assert.deepEqual(fixes, []);
});

test("Doctor findings outside the safe relation scope are never mutated", () => {
  const { workspace, project } = canonicalRecords();
  const task = record("02-Task/2026/08/Unsafe.md", {
    type: "task",
    status: "done",
    completed: null,
    start: "2026-08-20",
    due: "2026-08-10",
    workspace: "[[03-Workspace/A/A|A]]",
    project: "[[10-Project/P/P|P]]"
  });

  const fixes = F.planSafeFixes({
    records: [workspace, project, task],
    doctorIssues: [
      issue(task.file.path, "completed"),
      issue(task.file.path, "start/due"),
      issue(task.file.path, "workspace/project")
    ],
    makeLink
  });

  assert.deepEqual(fixes, []);
});

test("no Doctor finding means no Safe Fix proposal", () => {
  const { workspace, project } = canonicalRecords();
  const task = record("02-Task/2026/08/Legacy.md", { type: "task", workspace: "Alpha", project: null });
  assert.deepEqual(F.planSafeFixes({ records: [workspace, project, task], doctorIssues: [], makeLink }), []);
});

test("Safe Fix application uses an optimistic before-value precondition", () => {
  const fix = {
    field: "workspace",
    before: null,
    after: "[[03-Workspace/A/A|A]]"
  };
  const unchanged = { workspace: null, project: "[[10-Project/P/P|P]]" };
  assert.equal(F.applySafeFixToFrontmatter(unchanged, fix), true);
  assert.equal(unchanged.workspace, fix.after);

  const changedByUser = { workspace: "[[03-Workspace/B/B|B]]" };
  assert.equal(F.applySafeFixToFrontmatter(changedByUser, fix), false);
  assert.equal(changedByUser.workspace, "[[03-Workspace/B/B|B]]");
});

function makeMoment() {
  const moment = value => {
    const raw = String(value ?? "").slice(0, 10);
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    let valid = false;
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const date = new Date(Date.UTC(year, month - 1, day));
      valid = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
    }
    return { isValid: () => valid, format: () => valid ? raw : "Invalid date" };
  };
  moment.ISO_8601 = Symbol("ISO_8601");
  return moment;
}

function makeFakeApp(entries) {
  const files = new Map();
  const frontmatter = new Map();
  for (const entry of entries) {
    const file = record(entry.path, entry.fm).file;
    files.set(entry.path, file);
    frontmatter.set(entry.path, entry.fm);
  }

  function systemFile(filePath) {
    const absolute = path.join(root, filePath);
    if (!fs.existsSync(absolute)) return null;
    return {
      path: filePath,
      basename: basename(filePath),
      extension: path.extname(filePath).slice(1),
      parent: { path: path.posix.dirname(filePath) }
    };
  }

  return {
    app: {
      vault: {
        getMarkdownFiles: () => [...files.values()],
        getAbstractFileByPath: requested => files.get(requested) ?? systemFile(requested),
        read: async file => fs.readFileSync(path.join(root, file.path), "utf8")
      },
      metadataCache: {
        getFileCache: file => ({ frontmatter: frontmatter.get(file.path) ?? {} })
      },
      fileManager: {
        generateMarkdownLink: (target, _sourcePath, _subpath, alias) => `[[${target.path.replace(/\.md$/, "")}|${alias ?? target.basename}]]`,
        processFrontMatter: async (file, callback) => {
          const fm = frontmatter.get(file.path);
          callback(fm);
        }
      }
    },
    frontmatter
  };
}

test("real Safe Fix flow repairs a fake Vault only after preview and Apply", async () => {
  const safeFix = readCommonJsFunction("98-System/01-script/system_doctor_safe_fix.js");
  const entries = [
    {
      path: "03-Workspace/A/A.md",
      fm: { type: "workspace", uid: "ws-a", title: "A", aliases: [], status: "running", priority: "medium" }
    },
    {
      path: "03-Workspace/A/Note.md",
      fm: {
        type: "workspace-note",
        lifecycle: "active",
        category: null,
        aliases: [],
        tags: []
      }
    }
  ];
  const fake = makeFakeApp(entries);
  const notices = [];
  const previous = { app: globalThis.app, window: globalThis.window, Notice: globalThis.Notice };
  globalThis.app = fake.app;
  globalThis.window = { moment: makeMoment() };
  globalThis.Notice = class Notice { constructor(message) { notices.push(String(message)); } };

  let suggesterCalls = 0;
  const tp = {
    system: {
      suggester: async (_labels, values) => {
        suggesterCalls += 1;
        return values[0];
      }
    }
  };

  try {
    const result = await safeFix(tp);
    assert.equal(suggesterCalls, 2);
    assert.equal(result.applied, 1);
    assert.equal(result.before.errors, 1);
    assert.equal(result.after.errors, 0);
    assert.equal(fake.frontmatter.get("03-Workspace/A/Note.md").workspace, "[[03-Workspace/A/A|A]]");
    assert.match(notices.at(-1), /error 1→0/);
  } finally {
    globalThis.app = previous.app;
    globalThis.window = previous.window;
    globalThis.Notice = previous.Notice;
  }
});

test("Dashboard exposes Safe Fix through the Templater command", () => {
  const dashboard = fs.readFileSync(path.join(root, "Dashboard.md"), "utf8");
  const buttons = fs.readFileSync(path.join(root, "98-System/02-embed/01-button/dashboard-buttons.md"), "utf8");
  const command = fs.readFileSync(path.join(root, "98-System/00-command/system_doctor_safe_fix.md"), "utf8");
  assert.match(dashboard, /BUTTON\[system-doctor-safe-fix\]/);
  assert.match(buttons, /id: system-doctor-safe-fix/);
  assert.match(buttons, /system_doctor_safe_fix\.md/);
  assert.match(command, /tp\.user\.system_doctor_safe_fix\(tp\)/);
});
