import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const migrationPath = "98-System/01-script/migrate_entity_relations.js";
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
  return {
    path: filePath,
    basename,
    extension,
    parent: parentPath ? { path: parentPath } : null
  };
}

function makeMoment() {
  const moment = value => {
    const raw = String(value ?? "");
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    let valid = false;
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const date = new Date(Date.UTC(year, month - 1, day));
      valid = date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day;
    }
    return {
      isValid: () => valid,
      format: () => valid ? raw : "Invalid date"
    };
  };
  moment.ISO_8601 = Symbol("ISO_8601");
  return moment;
}

function makeFakeVault(entries) {
  const files = entries.map(entry => makeFile(entry.path));
  const frontmatter = new Map(entries.map(entry => [entry.path, structuredClone(entry.fm ?? {})]));
  const byPath = new Map(files.map(file => [file.path, file]));
  const systemFiles = new Map([
    [referencePath, makeFile(referencePath)],
    [noteMetaPath, makeFile(noteMetaPath)]
  ]);
  const notices = [];
  const mutations = [];

  const app = {
    vault: {
      getMarkdownFiles: () => files,
      getAbstractFileByPath: requested => systemFiles.get(requested) ?? byPath.get(requested) ?? null,
      read: async file => {
        if (file.path === referencePath) return referenceSource;
        if (file.path === noteMetaPath) return noteMetaSource;
        return "";
      }
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
      },
      generateMarkdownLink: target => `[[${target.path.replace(/\.md$/, "")}|${target.basename}]]`
    }
  };

  return {
    app,
    notices,
    mutations,
    getFrontmatter: filePath => frontmatter.get(filePath),
    Notice: function Notice(message) { notices.push(String(message)); }
  };
}

function loadMigration(env) {
  const module = { exports: {} };
  const quietConsole = { log() {}, warn() {}, table() {} };
  const crypto = { randomUUID: () => "00000000-0000-4000-8000-000000000000" };
  new Function("module", "app", "Notice", "crypto", "console", migrationSource)(
    module,
    env.app,
    env.Notice,
    crypto,
    quietConsole
  );
  return module.exports;
}

function loadDoctor(env) {
  const module = { exports: {} };
  const quietConsole = { log() {}, warn() {}, table() {} };
  const window = { moment: makeMoment() };
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
  const report = await migrate({});
  const diagnosis = await doctor({});
  return { env, report, diagnosis };
}

function workspace(folder, name = folder, extra = {}) {
  return {
    path: `03-Workspace/${folder}/${name}.md`,
    fm: {
      type: "workspace",
      uid: `ws_${name.toLowerCase()}`,
      title: name,
      aliases: [],
      status: "running",
      priority: "medium",
      ...extra
    }
  };
}

function project(folder, name = folder, workspaceLink, extra = {}) {
  return {
    path: `10-Project/${folder}/${name}.md`,
    fm: {
      type: "project",
      uid: `prj_${name.toLowerCase()}`,
      title: name,
      aliases: [],
      status: "running",
      priority: "high",
      workspace: workspaceLink,
      ...extra
    }
  };
}

function canonicalNote(type, extra = {}) {
  return {
    type,
    lifecycle: "active",
    category: null,
    aliases: [],
    tags: [],
    ...extra
  };
}

function task(fileName, extra = {}) {
  return {
    path: `02-Task/2026/08/${fileName}.md`,
    fm: {
      type: "task",
      title: fileName,
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

const researchLink = "[[03-Workspace/Research/Research|Research]]";
const terreateLink = "[[10-Project/Terreate/Terreate|Terreate]]";

test("real migration infers a missing Workspace Note relation and Doctor becomes clean", async () => {
  const notePath = "03-Workspace/Research/Meeting.md";
  const { env, report, diagnosis } = await migrateAndDoctor([
    workspace("Research", "Research"),
    {
      path: notePath,
      fm: canonicalNote("workspace-note", { title: "Meeting", marker: "keep" })
    }
  ]);

  assert.equal(env.getFrontmatter(notePath).workspace, researchLink);
  assert.equal(env.getFrontmatter(notePath).marker, "keep");
  assert.equal(report.inferred, 1);
  assert.equal(report.ambiguous.length, 0);
  assert.equal(report.unresolved.length, 0);
  assert.deepEqual(diagnosis.summary, { errors: 0, warnings: 0, entities: 1, notes: 1, tasks: 0 });
});

test("real migration infers Project and derives Workspace for a Project Note", async () => {
  const notePath = "10-Project/Terreate/Design.md";
  const { env, report, diagnosis } = await migrateAndDoctor([
    workspace("Research", "Research"),
    project("Terreate", "Terreate", researchLink),
    {
      path: notePath,
      fm: canonicalNote("project-note", { title: "Design", marker: "keep" })
    }
  ]);

  const fm = env.getFrontmatter(notePath);
  assert.equal(fm.project, terreateLink);
  assert.equal(fm.workspace, researchLink);
  assert.equal(fm.marker, "keep");
  assert.equal(report.inferred, 2);
  assert.equal(report.ambiguous.length, 0);
  assert.equal(report.unresolved.length, 0);
  assert.deepEqual(diagnosis.summary, { errors: 0, warnings: 0, entities: 2, notes: 1, tasks: 0 });
});

test("ambiguous parent Entries are reported without mutating the relation", async () => {
  const notePath = "03-Workspace/Shared/Note.md";
  const env = makeFakeVault([
    workspace("Shared", "Alpha", { uid: "ws_alpha" }),
    workspace("Shared", "Beta", { uid: "ws_beta" }),
    { path: notePath, fm: canonicalNote("workspace-note", { title: "Note", marker: "keep" }) }
  ]);
  const report = await loadMigration(env)({});

  const fm = env.getFrontmatter(notePath);
  assert.equal(fm.workspace, undefined);
  assert.equal(fm.marker, "keep");
  assert.equal(report.unresolved.length, 0);
  assert.equal(report.ambiguous.length, 1);
  assert.deepEqual(report.ambiguous[0], {
    owner: notePath,
    field: "workspace",
    value: "(parent folder)",
    candidates: [
      "03-Workspace/Shared/Alpha.md",
      "03-Workspace/Shared/Beta.md"
    ]
  });
});

test("unresolved parent relation is reported without mutation", async () => {
  const notePath = "03-Workspace/Orphan/Note.md";
  const env = makeFakeVault([
    workspace("Research", "Research"),
    { path: notePath, fm: canonicalNote("workspace-note", { title: "Note", marker: "keep" }) }
  ]);
  const report = await loadMigration(env)({});

  const fm = env.getFrontmatter(notePath);
  assert.equal(fm.workspace, undefined);
  assert.equal(fm.marker, "keep");
  assert.equal(report.ambiguous.length, 0);
  assert.equal(report.unresolved.length, 1);
  assert.match(report.unresolved[0], /workspaceを親フォルダから推定できません/);
});

test("real migration canonicalizes resolvable legacy Task relations and preserves unrelated metadata", async () => {
  const taskPath = "02-Task/2026/08/LegacyRelations.md";
  const { env, report, diagnosis } = await migrateAndDoctor([
    workspace("Research", "Research", { aliases: ["Lab"] }),
    project("Terreate", "Terreate", researchLink, { aliases: ["Engine"] }),
    task("LegacyRelations", {
      workspace: "Lab",
      project: "Engine",
      marker: { nested: true }
    })
  ]);

  const fm = env.getFrontmatter(taskPath);
  assert.equal(fm.workspace, researchLink);
  assert.equal(fm.project, terreateLink);
  assert.deepEqual(fm.marker, { nested: true });
  assert.equal(report.ambiguous.length, 0);
  assert.equal(report.unresolved.length, 0);
  assert.deepEqual(diagnosis.summary, { errors: 0, warnings: 0, entities: 2, notes: 0, tasks: 1 });
});
