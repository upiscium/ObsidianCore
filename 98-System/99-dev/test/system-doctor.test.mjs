import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const doctorSource = fs.readFileSync(path.join(root, "98-System/01-script/validate_vault.js"), "utf8");
const referencePath = "98-System/01-script/reference_utils.js";
const noteMetaPath = "98-System/01-script/note_meta_utils.js";
const ideaMetaPath = "98-System/01-script/idea_meta_utils.js";
const referenceSource = fs.readFileSync(path.join(root, referencePath), "utf8");
const noteMetaSource = fs.readFileSync(path.join(root, noteMetaPath), "utf8");
const ideaMetaSource = fs.readFileSync(path.join(root, ideaMetaPath), "utf8");

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
    return { isValid: () => valid, format: () => valid ? raw : "Invalid date" };
  };
  moment.ISO_8601 = Symbol("ISO_8601");
  return moment;
}

function makeApp(entries) {
  const files = entries.map(entry => makeFile(entry.path));
  const frontmatter = new Map(entries.map(entry => [entry.path, entry.fm ?? {}]));
  const systemFiles = new Map([
    [referencePath, makeFile(referencePath)],
    [noteMetaPath, makeFile(noteMetaPath)],
    [ideaMetaPath, makeFile(ideaMetaPath)]
  ]);

  return {
    vault: {
      create: () => assert.fail("Doctor must not create notes"),
      modify: () => assert.fail("Doctor must not modify notes"),
      process: () => assert.fail("Doctor must not rewrite frontmatter"),
      delete: () => assert.fail("Doctor must not delete notes"),
      rename: () => assert.fail("Doctor must not move notes"),
      getMarkdownFiles: () => files,
      getAbstractFileByPath: requested => systemFiles.get(requested) ?? files.find(file => file.path === requested) ?? null,
      read: async file => {
        if (file.path === referencePath) return referenceSource;
        if (file.path === noteMetaPath) return noteMetaSource;
        if (file.path === ideaMetaPath) return ideaMetaSource;
        return "";
      }
    },
    metadataCache: { getFileCache: file => ({ frontmatter: frontmatter.get(file.path) ?? {} }) },
    fileManager: { processFrontMatter: () => assert.fail("Doctor must not migrate metadata") }
  };
}

function loadDoctor(app) {
  const module = { exports: {} };
  const notices = [];
  const Notice = function Notice(message) { notices.push(String(message)); };
  const window = { moment: makeMoment() };
  const quietConsole = { log() {}, warn() {}, table() {} };
  new Function("module", "app", "Notice", "window", "console", doctorSource)(module, app, Notice, window, quietConsole);
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
      lifecycle: "active",
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

function note(type, extra = {}) {
  return { type, lifecycle: "active", category: null, aliases: [], tags: [], ...extra };
}

function task(pathName, extra = {}) {
  return {
    path: `02-Task/2026/08/${pathName}.md`,
    fm: {
      type: "task", title: pathName, status: "todo", priority: "medium", completed: null,
      start: null, due: null, workspace: null, project: null, triaged: false, backlog: false, depends_on: [],
      ...extra
    }
  };
}

function idea(pathName, extra = {}) {
  return {
    path: `05-Idea/${pathName}.md`,
    fm: {
      type: "idea",
      title: pathName,
      created: "2026-09-27",
      workspace: "[[03-Workspace/A|A]]",
      project: null,
      status: "active",
      aliases: [],
      tags: [],
      ...extra
    }
  };
}

function issueFor(result, pathValue, field, severity) {
  return result.issues.find(issue => issue.path === pathValue && issue.field === field && (!severity || issue.severity === severity));
}

test("System Doctor accepts a canonical connected Vault", async () => {
  const result = await runDoctor([
    workspace("A", "workspace-a"),
    project("P", "project-p", "A"),
    { path: "03-Workspace/A/Note.md", fm: note("workspace-note", { workspace: "[[03-Workspace/A|A]]" }) },
    { path: "10-Project/P/Note.md", fm: note("project-note", { project: "[[10-Project/P|P]]", workspace: "[[03-Workspace/A|A]]" }) },
    task("Good", { workspace: "[[03-Workspace/A|A]]", project: "[[10-Project/P|P]]" }),
    idea("Good Idea", { project: "[[10-Project/P|P]]" })
  ]);
  assert.deepEqual(result.summary, { errors: 0, warnings: 0, entities: 2, notes: 2, tasks: 1, ideas: 1 });
  assert.deepEqual(result.issues, []);
  assert.match(result.notices.at(-1), /error 0 \/ warning 0/);
});

test("System Doctor accepts all canonical Workspace lifecycle values", async () => {
  for (const lifecycle of ["active", "inactive", "archived"]) {
    const result = await runDoctor([workspace(`W-${lifecycle}`, `ws-${lifecycle}`, { lifecycle })]);
    assert.equal(result.summary.errors, 0, lifecycle);
  }
});

test("System Doctor rejects legacy Workspace status and priority", async () => {
  const pathValue = "03-Workspace/Legacy.md";
  const result = await runDoctor([workspace("Legacy", "ws-legacy", { lifecycle: undefined, status: "running", priority: "high" })]);
  assert.ok(issueFor(result, pathValue, "lifecycle", "error"));
  assert.ok(issueFor(result, pathValue, "status", "error"));
  assert.ok(issueFor(result, pathValue, "priority", "error"));
});

test("System Doctor ignores Entry and Note templates outside canonical roots", async () => {
  const result = await runDoctor([
    workspace("A", "workspace-a"), project("P", "project-p", "A"),
    { path: "98-System/03-template/00-entry/workspace-entry-template.md", fm: { type: "workspace" } },
    { path: "98-System/03-template/00-entry/project-entry-template.md", fm: { type: "project" } },
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
  const result = await runDoctor([workspace("A", "workspace-a"), { path: notePath, fm: note("workspace-note") }]);
  assert.equal(result.summary.errors, 1);
  assert.ok(issueFor(result, notePath, "workspace", "error"));
});

test("System Doctor surfaces legacy Note metadata", async () => {
  const notePath = "03-Workspace/A/Legacy.md";
  const result = await runDoctor([
    workspace("A", "workspace-a"),
    { path: notePath, fm: { type: "workspace-note", workspace: "[[03-Workspace/A|A]]", status: "running", priority: 5, category: "memo", aliases: [], tags: [] } }
  ]);
  assert.ok(issueFor(result, notePath, "lifecycle", "error"));
  assert.ok(issueFor(result, notePath, "status", "error"));
  assert.ok(issueFor(result, notePath, "priority", "error"));
});

test("System Doctor surfaces legacy task-pack type", async () => {
  const taskPath = "02-Task/2026/08/Legacy.md";
  const result = await runDoctor([{ path: taskPath, fm: { type: "task-pack", status: "todo", priority: null, completed: null, triaged: false, backlog: false, depends_on: [] } }]);
  const legacyIssue = issueFor(result, taskPath, "type", "error");
  assert.ok(legacyIssue);
  assert.match(legacyIssue.message, /旧Task type/);
});

test("System Doctor detects Task Workspace and Project Workspace mismatch", async () => {
  const taskPath = "02-Task/2026/08/Mismatch.md";
  const result = await runDoctor([
    workspace("A", "workspace-a"), workspace("B", "workspace-b"), project("P", "project-p", "A"),
    task("Mismatch", { workspace: "[[03-Workspace/B|B]]", project: "[[10-Project/P|P]]" })
  ]);
  assert.ok(issueFor(result, taskPath, "workspace/project", "error"));
});

test("System Doctor warns when a triaged non-backlog Task has no Due", async () => {
  const taskPath = "02-Task/2026/08/NoDue.md";
  const result = await runDoctor([task("NoDue", { triaged: true, backlog: false, due: null })]);
  assert.equal(result.summary.errors, 0);
  assert.ok(issueFor(result, taskPath, "due", "warning"));
});


test("System Doctor accepts stable and warns when a terminal Project still watches GitHub", async () => {
  const stablePath = "10-Project/Stable.md";
  const donePath = "10-Project/Done.md";
  const result = await runDoctor([
    workspace("A", "workspace-a"),
    project("Stable", "project-stable", "A", { status: "stable" }),
    project("Done", "project-done", "A", { status: "done", github_watch: true })
  ]);

  assert.equal(result.summary.errors, 0);
  assert.equal(issueFor(result, stablePath, "status", "error"), undefined);
  assert.ok(issueFor(result, donePath, "github_watch", "warning"));
});


test("System Doctor rejects Idea without Workspace", async () => {
  const pathValue = "05-Idea/NoWorkspace.md";
  const result = await runDoctor([idea("NoWorkspace", { workspace: null })]);
  assert.ok(issueFor(result, pathValue, "workspace", "error"));
});

test("System Doctor detects Idea Workspace and Project Workspace mismatch", async () => {
  const pathValue = "05-Idea/Mismatch.md";
  const result = await runDoctor([
    workspace("A", "workspace-a"),
    workspace("B", "workspace-b"),
    project("P", "project-p", "A"),
    idea("Mismatch", {
      workspace: "[[03-Workspace/B|B]]",
      project: "[[10-Project/P|P]]"
    })
  ]);
  assert.ok(issueFor(result, pathValue, "workspace/project", "error"));
});

test("System Doctor validates Idea status and owned fields", async () => {
  const pathValue = "05-Idea/Invalid.md";
  const result = await runDoctor([
    workspace("A", "workspace-a"),
    idea("Invalid", { status: "todo", created: "bad", aliases: "alias", tags: [1] })
  ]);
  assert.ok(issueFor(result, pathValue, "status", "error"));
  assert.ok(issueFor(result, pathValue, "created", "error"));
  assert.ok(issueFor(result, pathValue, "aliases", "error"));
  assert.ok(issueFor(result, pathValue, "tags", "error"));
});

test("Idea adoption history is optional for active ideas and complete for adopted ideas", async () => {
  const result = await runDoctor([
    workspace("A", "workspace-a"), project("P", "project-p"),
    idea("Active", { status: "active", adopted_project: null, adopted_at: "" }),
    idea("Adopted", { status: "adopted", adopted_project: "[[10-Project/P|P]]", adopted_at: "2026-02-28" })
  ]);
  assert.equal(result.summary.errors, 0);
  assert.equal(issueFor(result, "05-Idea/Active.md", "adopted_project", "error"), undefined);
  assert.equal(issueFor(result, "05-Idea/Adopted.md", "adopted_project", "error"), undefined);
});

test("adopted Idea without adoption fields gets one actionable legacy warning", async () => {
  const result = await runDoctor([workspace("A", "workspace-a"), project("P", "project-p"),
    idea("Legacy", { status: "adopted", project: "[[10-Project/P|P]]" })]);
  const warnings = result.issues.filter(issue => issue.path === "05-Idea/Legacy.md" && issue.severity === "warning");
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].message, /reconcil|手動|manual/i);
});

test("Idea adoption metadata rejects partial pairs, invalid dates, and active adoption", async () => {
  const result = await runDoctor([workspace("A", "workspace-a"), project("P", "project-p"),
    idea("Partial", { status: "adopted", adopted_project: "[[10-Project/P|P]]" }),
    idea("BadDate", { status: "archived", adopted_project: "[[10-Project/P|P]]", adopted_at: "2026-02-29" }),
    idea("ActiveMetadata", { adopted_at: "2026-01-01" })]);
  assert.ok(issueFor(result, "05-Idea/Partial.md", "adopted_project/adopted_at", "error"));
  assert.ok(issueFor(result, "05-Idea/BadDate.md", "adopted_at", "error"));
  assert.ok(issueFor(result, "05-Idea/ActiveMetadata.md", "adopted_project/adopted_at", "error"));
});

test("Idea relation errors are reported without mutating any frontmatter", async () => {
  const entries = [workspace("A", "workspace-a"), project("P", "project-p"),
    idea("BadRelation", { project: ["[[10-Project/P|P]]"], provenance: { untouched: true }, custom: "preserve" })];
  const before = structuredClone(entries.map(entry => entry.fm));
  const result = await runDoctor(entries);
  assert.ok(issueFor(result, "05-Idea/BadRelation.md", "project", "error"));
  assert.deepEqual(entries.map(entry => entry.fm), before);
});

test("Idea v2 accepts distinct related and adopted Projects and preserves historical statuses", async () => {
  for (const status of ["adopted", "archived"]) {
    for (const projectStatus of ["planning", "running", "stopped", "stable", "done", "cancelled"]) {
      const result = await runDoctor([
        workspace("A", "workspace-a", { lifecycle: "archived" }),
        project("Related", "related"), project("Adoption", "adoption", "A", { status: projectStatus }),
        idea("History", { status, project: "[[10-Project/Related]]", adopted_project: "[[10-Project/Adoption]]", adopted_at: "2024-02-29" })
      ]);
      assert.deepEqual(result.issues, [], `${status} / ${projectStatus}`);
    }
  }
  const result = await runDoctor([workspace("A", "workspace-a"), idea("Archived", { status: "archived" })]);
  assert.deepEqual(result.issues, []);
});

test("Idea v2 diagnoses every incomplete pair and active adoption without assuming history", async () => {
  for (const status of ["active", "adopted", "archived"]) {
    for (const pair of [{ adopted_project: "[[10-Project/P]]" }, { adopted_at: "2026-10-28" }]) {
      const result = await runDoctor([workspace("A", "workspace-a"), project("P", "project-p"), idea("Partial", { status, ...pair })]);
      assert.ok(issueFor(result, "05-Idea/Partial.md", "adopted_project/adopted_at", "error"), `${status} ${JSON.stringify(pair)}`);
      assert.equal(result.summary.warnings, 0);
    }
  }
  const result = await runDoctor([workspace("A", "workspace-a"), project("P", "project-p"),
    idea("Active", { adopted_project: "[[10-Project/P]]", adopted_at: "2026-10-28" })]);
  assert.ok(issueFor(result, "05-Idea/Active.md", "adopted_project/adopted_at", "error"));
});

test("Idea v2 strictly rejects non-date and impossible adoption dates", async () => {
  for (const adopted_at of ["bad", "2026-02-29", "1900-02-29", "2026-04-31", "2026-13-01", "2026-00-01", "2026-01-00",
    "2026-2-01", "2026-10-28T10:00:00Z", " 2026-10-28", "2026-10-28\n", 20261028, ["2026-10-28"], { date: "2026-10-28" }]) {
    const result = await runDoctor([workspace("A", "workspace-a"), project("P", "project-p"),
      idea("Date", { status: "adopted", adopted_project: "[[10-Project/P]]", adopted_at })]);
    assert.ok(issueFor(result, "05-Idea/Date.md", "adopted_at", "error"), JSON.stringify(adopted_at));
  }
});

test("Idea v2 enforces single well-formed references in all relation fields", async () => {
  for (const field of ["workspace", "project", "adopted_project"]) {
    const link = field === "workspace" ? "[[03-Workspace/A]]" : "[[10-Project/P]]";
    for (const value of [[], [link], [link, link], `${link} ${link}`, link.slice(0, -1), { bad: link }, 1, false]) {
      const result = await runDoctor([workspace("A", "workspace-a"), project("P", "project-p"),
        idea("Relation", { status: "adopted", adopted_project: "[[10-Project/P]]", adopted_at: "2026-10-28", [field]: value })]);
      const diagnostic = issueFor(result, "05-Idea/Relation.md", field, "error");
      assert.ok(diagnostic, `${field} ${JSON.stringify(value)}`);
      assert.match(diagnostic.message, /単一|不正/);
    }
  }
});

test("Idea v2 distinguishes missing, unresolved, stale and ambiguous relations", async () => {
  for (const field of ["workspace", "project", "adopted_project"]) {
    const workspaceField = field === "workspace";
    const prefix = workspaceField ? "03-Workspace" : "10-Project";
    const name = workspaceField ? "A" : "P";
    const base = [workspace("A", "workspace-a"), project("P", "project-p")];
    for (const value of [`[[${prefix}/Missing]]`, `[[${prefix}/Old/${name}]]`]) {
      const result = await runDoctor([...base, idea("Broken", { [field]: value })]);
      const diagnostic = issueFor(result, "05-Idea/Broken.md", field, "error");
      assert.ok(diagnostic, `${field} ${value}`);
      assert.match(diagnostic.message, /解決できません/);
    }
    const duplicate = workspaceField ? workspace("Nested/A", "workspace-duplicate") : project("Nested/P", "project-duplicate");
    const ambiguous = await runDoctor([...base, duplicate, idea("Ambiguous", { [field]: `[[${name}]]` })]);
    assert.match(issueFor(ambiguous, "05-Idea/Ambiguous.md", field, "error").message, /曖昧/);
    const qualified = await runDoctor([...base, duplicate,
      idea("Qualified", { status: "adopted", adopted_project: "[[10-Project/P]]", adopted_at: "2026-10-28", [field]: `[[${prefix}/${name}.md|Alias]]` })]);
    assert.equal(qualified.issues.filter(x => x.path === "05-Idea/Qualified.md").length, 0);
  }
  for (const workspaceValue of [null, undefined, ""]) {
    const result = await runDoctor([idea("Missing", { workspace: workspaceValue })]);
    assert.match(issueFor(result, "05-Idea/Missing.md", "workspace", "error").message, /未設定/);
  }
});

test("Idea v2 checks both Project ownerships and disallows non-Project adoption targets", async () => {
  for (const field of ["project", "adopted_project"]) {
    const result = await runDoctor([workspace("A", "workspace-a"), workspace("B", "workspace-b"), project("Other", "other", "B"),
      idea("Cross", { [field]: "[[10-Project/Other]]" })]);
    assert.ok(issueFor(result, "05-Idea/Cross.md", `workspace/${field}`, "error"));
    for (const owner of [null, "[[03-Workspace/Missing]]", "[[03-Workspace/Old/A]]", ["[[03-Workspace/A]]"], "[[A]", "[[A]] [[A]]"]) {
      const broken = await runDoctor([workspace("A", "workspace-a"), project("P", "project-p", "A", { workspace: owner }),
        idea("Ownership", { [field]: "[[10-Project/P]]" })]);
      assert.ok(issueFor(broken, "05-Idea/Ownership.md", field, "error"), `${field} ${JSON.stringify(owner)}`);
    }
    const ambiguous = await runDoctor([workspace("A", "workspace-a"), workspace("Nested/A", "duplicate"),
      project("P", "project-p", "A", { workspace: "[[A]]" }), idea("AmbiguousOwner", { [field]: "[[10-Project/P]]" })]);
    assert.ok(issueFor(ambiguous, "05-Idea/AmbiguousOwner.md", field, "error"));
  }
  for (const target of ["[[03-Workspace/A]]", "[[05-Idea/Target]]", "[[10-Project/NotProject]]"]) {
    const result = await runDoctor([workspace("A", "workspace-a"), idea("Target"),
      { path: "10-Project/NotProject.md", fm: {} },
      idea("WrongType", { status: "adopted", adopted_project: target, adopted_at: "2026-10-28" })]);
    assert.ok(issueFor(result, "05-Idea/WrongType.md", "adopted_project", "error"), target);
  }
});

test("Idea v2 does not disambiguate short links by ignoring other note types", async () => {
  for (const field of ["workspace", "project", "adopted_project"]) {
    const name = field === "workspace" ? "A" : "P";
    const result = await runDoctor([workspace("A", "workspace-a"), project("P", "project-p"),
      { path: `Other/${name}.md`, fm: {} }, idea("Ambiguous", { [field]: `[[${name}]]` })]);
    assert.match(issueFor(result, "05-Idea/Ambiguous.md", field, "error").message, /曖昧/);
  }
});

test("Idea v2 reports missing owned metadata and invalid statuses without hiding notes", async () => {
  for (const field of ["title", "created", "aliases", "tags"]) {
    const result = await runDoctor([workspace("A", "workspace-a"), idea("Missing", { [field]: undefined })]);
    assert.equal(result.summary.ideas, 1);
    assert.ok(issueFor(result, "05-Idea/Missing.md", field, "error"), field);
  }
  for (const status of [undefined, "", "todo", "accepted", "ADOPTED"]) {
    const result = await runDoctor([workspace("A", "workspace-a"), idea("Invalid", { status })]);
    assert.ok(issueFor(result, "05-Idea/Invalid.md", "status", "error"), String(status));
  }
});

test("Idea v2 leaves legacy adoption, body-independent metadata and AI provenance untouched", async () => {
  const entries = [workspace("A", "workspace-a"), project("P", "project-p"),
    idea("Legacy", { status: "adopted", project: "[[10-Project/P]]", aliases: ["old"], tags: ["retain"],
      ai_source: "candidate", ai_provenance: { id: "abc", links: ["source"] }, custom: { unknown: true } }),
    idea("NullLegacy", { status: "adopted", adopted_project: null, adopted_at: "" }),
    idea("Bare", { workspace: "03-Workspace/A", project: "10-Project/P" })];
  const before = structuredClone(entries);
  const result = await runDoctor(entries);
  assert.equal(result.summary.errors, 0);
  assert.equal(result.summary.ideas, 3);
  assert.equal(result.summary.warnings, 4);
  assert.equal(result.issues.filter(x => x.field === "adopted_project/adopted_at").length, 2);
  assert.ok(issueFor(result, "05-Idea/Bare.md", "workspace", "warning"));
  assert.ok(issueFor(result, "05-Idea/Bare.md", "project", "warning"));
  assert.deepEqual(entries, before);
});
