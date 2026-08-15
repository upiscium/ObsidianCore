import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
function readExpression(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  return new Function(`"use strict"; return (${source});`)();
}

const G = readExpression("98-System/01-script/reference_utils.js");
const T = readExpression("98-System/01-script/task_meta_utils.js");
const E = readExpression("98-System/01-script/entity_meta_utils.js");
const runtimeReferenceFactory = readExpression("98-System/01-script/reference_runtime_utils.js");
const taskReferenceFactory = readExpression("98-System/01-script/task_reference_utils.js");
const entityReferenceFactory = readExpression("98-System/01-script/entity_reference_utils.js");
const X = runtimeReferenceFactory(G);
const R = taskReferenceFactory(G, X);
const ER = entityReferenceFactory(G);

test("reference parsing preserves path and alias", () => {
  assert.deepEqual(G.parseReference("[[03-Workspace/Research|研究]]"), { path: "03-Workspace/Research", alias: "研究" });
  assert.deepEqual(G.parseReference({ path: "10-Project/Terreate.md", display: "Terreate" }), { path: "10-Project/Terreate", alias: "Terreate" });
});

test("reference normalization supports arrays and Dataview-like arrays", () => {
  const dataArray = { array: () => ["[[A]]", "[[B]]"] };
  assert.deepEqual(G.asArray(null), []);
  assert.deepEqual(G.asArray(dataArray), ["[[A]]", "[[B]]"]);
  assert.deepEqual(G.normalizeReferences(["[[A]]", "[[Folder/B|Bee]]"]), ["A", "Folder/B"]);
});

test("reference matching accepts full path and basename", () => {
  const value = "[[03-Workspace/Research|研究]]";
  assert.equal(G.matchesReference(value, "03-Workspace/Research"), true);
  assert.equal(G.matchesReference(value, "Research"), true);
  assert.equal(G.matchesReference(value, "Other"), false);
  assert.equal(G.matchesReference(value, null), true);
});

test("indexed references resolve case-insensitively by path or basename", () => {
  const workspace = { file: { path: "03-Workspace/Research.md", basename: "Research" } };
  const index = G.indexByFilePath([workspace]);
  assert.equal(G.resolveIndexedReference("[[03-workspace/research]]", index), workspace);
  assert.equal(G.resolveIndexedReference("[[RESEARCH]]", index), workspace);
  assert.equal(G.resolveIndexedReference("[[Missing]]", index), null);
});

test("reference labels prefer aliases", () => {
  assert.equal(G.referenceLabel("[[10-Project/Terreate|Engine]]"), "Engine");
  assert.equal(G.referenceLabel("[[10-Project/Terreate]]"), "Terreate");
  assert.equal(G.looksLikeLink("[[Terreate]]"), true);
  assert.equal(G.looksLikeLink("Terreate"), false);
});

test("runtime reference utility resolves Obsidian and Dataview references", () => {
  const destination = { path: "02-Task/A.md" };
  const app = { metadataCache: { getFirstLinkpathDest: (linkpath, sourcePath) => linkpath === "02-Task/A" && sourcePath === "02-Task/B.md" ? destination : null } };
  assert.equal(X.resolveLinkFile(app, "[[02-Task/A]]", "02-Task/B.md"), destination);
  const page = { file: { path: "02-Task/A.md", name: "A" } };
  const dv = { page: key => key === "02-Task/A" ? page : null, fileLink: (filePath, embed, label) => `${filePath}|${embed}|${label}` };
  assert.equal(X.resolveDataviewPage(dv, "[[02-Task/A]]"), page);
  assert.equal(X.dataviewReferenceDisplay(dv, "[[02-Task/A|Alias]]"), "02-Task/A.md|false|Alias");
});

test("Task metadata accepts canonical values and rejects legacy values", () => {
  assert.equal(T.isTaskType("task"), true);
  assert.equal(T.isTaskType("task-pack"), false);
  assert.equal(T.normalizeTaskStatus("doing"), "doing");
  assert.equal(T.normalizeTaskStatus("running"), null);
  assert.equal(T.normalizeTaskPriority("high"), "high");
  assert.equal(T.normalizeTaskPriority("1"), null);
  assert.equal(T.normalizeTaskPriority(null), "none");
  assert.equal(T.isTaskClosedStatus("done"), true);
  assert.equal(T.isTaskActionableStatus("todo"), true);
  assert.equal(T.stripTaskTimestamp("20260809-123456-789-Example"), "Example");
});

test("Workspace lifecycle and Project status have separate canonical contracts", () => {
  assert.equal(E.normalizeWorkspaceLifecycle("active"), "active");
  assert.equal(E.normalizeWorkspaceLifecycle("inactive"), "inactive");
  assert.equal(E.normalizeWorkspaceLifecycle("archived"), "archived");
  assert.equal(E.normalizeWorkspaceLifecycle("running"), null);
  assert.equal(E.isWorkspaceActiveLifecycle("active"), true);
  assert.equal(E.isWorkspaceVisibleLifecycle("inactive"), true);
  assert.equal(E.isWorkspaceArchivedLifecycle("archived"), true);

  assert.equal(E.normalizeProjectStatus("planning"), "planning");
  assert.equal(E.normalizeProjectStatus("stopped"), "stopped");
  assert.equal(E.normalizeProjectStatus("archived"), null);
  assert.equal(E.isProjectActiveStatus("running"), true);
  assert.equal(E.isProjectListStatus("stopped"), true);
  assert.equal(E.isProjectArchivedStatus("done"), true);
  assert.equal(E.isProjectHiddenStatus("cancelled"), true);
  assert.equal(E.isProjectVisibleInWorkspace("running", "active"), true);
  assert.equal(E.isProjectVisibleInWorkspace("running", "inactive"), false);

  assert.equal(E.normalizePriority("medium"), "medium");
  assert.equal(E.normalizePriority("2"), null);
  assert.equal(E.normalizePriority(null), "none");
});

test("Entity metadata exposes no generic status compatibility APIs", () => {
  for (const name of ["normalizeStatus", "statusLabel", "statusOrder", "isActiveStatus", "isArchivedStatus", "isHiddenStatus"]) {
    assert.equal(E[name], undefined, name);
  }
});

test("Task reference utility exposes dependency APIs only", () => {
  for (const name of ["dependencyPages", "dependencyHasPathTo", "dependencyInfo"]) assert.equal(typeof R[name], "function");
  for (const name of ["asArray", "normalizeLinkpath", "parseReference", "matchesReference", "referenceLabel", "resolveLinkFile", "resolveDataviewPage", "dataviewReferenceDisplay", "stripTaskTimestamp", "findEntityNotes", "entityMatchesReference", "makeEntityLink"]) assert.equal(R[name], undefined);
});

test("Entity reference utility exposes Entity-specific APIs only", () => {
  for (const name of ["findEntityNotes", "entityMatchesReference", "makeEntityLink"]) assert.equal(typeof ER[name], "function");
  for (const name of ["asArray", "normalizeLinkpath", "parseReference", "matchesReference", "referenceLabel"]) assert.equal(ER[name], undefined);
});

test("Entity discovery requires explicit typed eligibility predicates", () => {
  const files = [
    { path: "03-Workspace/Active.md", basename: "Active" },
    { path: "03-Workspace/Inactive.md", basename: "Inactive" },
    { path: "10-Project/Running.md", basename: "Running" },
    { path: "10-Project/Stopped.md", basename: "Stopped" }
  ];
  const frontmatter = new Map([
    ["03-Workspace/Active.md", { type: "workspace", lifecycle: "active", title: "Active" }],
    ["03-Workspace/Inactive.md", { type: "workspace", lifecycle: "inactive", title: "Inactive" }],
    ["10-Project/Running.md", { type: "project", status: "running", title: "Running" }],
    ["10-Project/Stopped.md", { type: "project", status: "stopped", title: "Stopped" }]
  ]);
  const app = { vault: { getMarkdownFiles: () => files }, metadataCache: { getFileCache: file => ({ frontmatter: frontmatter.get(file.path) }) } };
  assert.throws(() => ER.findEntityNotes(app, { folder: "03-Workspace", types: ["workspace"] }), /isEligible is required/);
  const workspaces = ER.findEntityNotes(app, {
    folder: "03-Workspace",
    types: ["workspace"],
    isEligible: entity => E.isWorkspaceActiveLifecycle(entity.lifecycle)
  });
  const projects = ER.findEntityNotes(app, {
    folder: "10-Project",
    types: ["project"],
    isEligible: entity => E.isProjectActiveStatus(entity.status)
  });
  assert.deepEqual(workspaces.map(entity => entity.file.path), ["03-Workspace/Active.md"]);
  assert.deepEqual(projects.map(entity => entity.file.path), ["10-Project/Running.md"]);
});

test("Entity reference matching and link generation use generic references", () => {
  const entity = { file: { path: "03-Workspace/Research.md", basename: "Research" }, displayName: "研究" };
  assert.equal(ER.entityMatchesReference("[[03-Workspace/Research|研究]]", entity), true);
  const app = { fileManager: { generateMarkdownLink: (file, source, subpath, alias) => `${file.path}|${source}|${subpath ?? ""}|${alias}` } };
  assert.equal(ER.makeEntityLink(app, entity, "02-Task/Test.md"), "03-Workspace/Research.md|02-Task/Test.md||研究");
  assert.equal(ER.makeEntityLink(app, null, "02-Task/Test.md"), null);
});

test("dependencyInfo reports open, missing, and closed dependencies", () => {
  const open = { file: { path: "02-Task/Open.md", name: "Open" }, status: "todo", depends_on: [] };
  const closed = { file: { path: "02-Task/Closed.md", name: "Closed" }, status: "done", depends_on: [] };
  const pages = new Map([["02-Task/Open", open], ["Open", open], ["02-Task/Closed", closed], ["Closed", closed]]);
  const dv = { page: key => pages.get(key) ?? null };
  const task = { file: { path: "02-Task/Root.md", name: "Root" }, depends_on: ["[[02-Task/Open]]", "[[02-Task/Closed]]", "[[02-Task/Missing|Lost]]"] };
  const info = R.dependencyInfo(dv, task, T.isTaskClosedStatus);
  assert.equal(info.blocked, true);
  assert.equal(info.cyclic, false);
  assert.deepEqual(info.unresolved.map(page => page.file.path), ["02-Task/Open.md"]);
  assert.deepEqual(info.missing, ["Lost"]);
});

test("dependencyInfo detects cycles", () => {
  const a = { file: { path: "02-Task/A.md", name: "A" }, status: "todo", depends_on: ["[[02-Task/B]]"] };
  const b = { file: { path: "02-Task/B.md", name: "B" }, status: "todo", depends_on: ["[[02-Task/A]]"] };
  const pages = new Map([["02-Task/A", a], ["A", a], ["02-Task/B", b], ["B", b]]);
  const dv = { page: key => pages.get(key) ?? null };
  const info = R.dependencyInfo(dv, a, T.isTaskClosedStatus);
  assert.equal(info.cyclic, true);
  assert.equal(info.blocked, true);
});
