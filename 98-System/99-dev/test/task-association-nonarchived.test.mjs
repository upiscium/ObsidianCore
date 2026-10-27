import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const evalExpression = relative => new Function('"use strict"; return (' + read(relative) + ');')();

const E = evalExpression("98-System/01-script/entity_meta_utils.js");
const G = evalExpression("98-System/01-script/reference_utils.js");
const ER = evalExpression("98-System/01-script/entity_reference_utils.js")(G);
const C = evalExpression("98-System/01-script/task_creation_utils.js");

const fixtureData = [
  ["03-Workspace/Active.md", "workspace", "active", null, null],
  ["03-Workspace/Inactive.md", "workspace", "inactive", null, null],
  ["03-Workspace/Archived.md", "workspace", "archived", null, null],
  ["03-Workspace/Unknown.md", "workspace", "wrong", null, null],
  ...["planning", "running", "stopped", "stable", "cancelled", "done", "unknown"].map(
    status => ["10-Project/" + status + ".md", "project", null, status,
      "[[03-Workspace/Inactive|Inactive]]"]
  ),
  ["10-Project/Other.md", "project", null, "running", "[[03-Workspace/Active|Active]]"],
  ["10-Project/InArchived.md", "project", null, "running", "[[03-Workspace/Archived|Archived]]"]
];

function fixture() {
  const content = new Map();
  const notes = [];
  for (const [filename, type, lifecycle, status, workspace] of fixtureData) {
    const file = { path: filename, extension: "md", basename: path.basename(filename, ".md") };
    const fm = { type, title: file.basename };
    if (lifecycle !== null) fm.lifecycle = lifecycle;
    if (status !== null) fm.status = status;
    if (workspace !== null) fm.workspace = workspace;
    content.set(file.path, fm);
    notes.push(file);
  }
  const taskFile = { path: "02-Task/2026/10/Test.md", extension: "md", basename: "Test" };
  content.set(taskFile.path, { type: "task", title: "Test", workspace: null, project: null });
  const writes = [];
  const virtual = new Map([[taskFile.path, taskFile]]);
  for (const f of notes) virtual.set(f.path, f);

  const app = {
    vault: {
      getMarkdownFiles: () => [...notes],
      getAbstractFileByPath: filename => virtual.get(filename) ??
        (fs.existsSync(path.join(root, filename))
          ? { path: filename, extension: path.extname(filename).slice(1), basename: path.basename(filename) }
          : null),
      read: async file => read(file.path),
      createFolder: async filename => virtual.set(filename, { path: filename }),
      create: async (filename, data) => {
        writes.push({ filename, data });
        const f = { path: filename, extension: "md", basename: path.basename(filename, ".md") };
        virtual.set(filename, f);
        return f;
      }
    },
    metadataCache: { getFileCache: file => ({ frontmatter: content.get(file.path) ?? {} }) },
    fileManager: {
      generateMarkdownLink: (file, _sourcePath, _subpath, display) =>
        "[[" + file.path.replace(/\.md$/, "") + "|" + display + "]]",
      processFrontMatter: async (file, operation) => operation(content.get(file.path))
    },
    workspace: {
      getActiveFile: () => taskFile,
      getLeaf: () => ({ openFile: async () => {} })
    }
  };
  return { app, notes, content, writes, taskFile };
}

function selectable(f) {
  return {
    workspaces: ER.findEntityNotes(f.app, {
      folder: "03-Workspace", types: ["workspace"],
      isEligible: item => E.isWorkspaceTaskAssignableLifecycle(item.lifecycle)
    }),
    projects: ER.findEntityNotes(f.app, {
      folder: "10-Project", types: ["project"],
      isEligible: item => E.isProjectTaskAssignableStatus(item.status)
    })
  };
}

function byName(options, text) {
  const candidate = options.find(item => item?.displayName === text);
  assert.ok(candidate, "Expected selectable entity: " + text);
  return candidate;
}

async function withGlobals(globals, runner) {
  const previous = new Map(Object.keys(globals).map(key => [key, globalThis[key]]));
  for (const [key, value] of Object.entries(globals)) globalThis[key] = value;
  try { return await runner(); }
  finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
}

test("Task assignment eligibility is precisely known non-archived statuses", () => {
  assert.deepEqual(
    ["active", "inactive", "archived", "missing", null].filter(x => E.isWorkspaceTaskAssignableLifecycle(x)),
    ["active", "inactive"]
  );
  assert.deepEqual(
    ["planning", "running", "stopped", "stable", "done", "cancelled", "archived", "wrong", null]
      .filter(x => E.isProjectTaskAssignableStatus(x)),
    ["planning", "running", "stopped", "stable", "cancelled"]
  );
  assert.equal(E.isProjectArchivedStatus("done"), true);
  assert.equal(E.isProjectHiddenStatus("cancelled"), true);
  assert.equal(E.isProjectTaskAssignableStatus("cancelled"), true);
  assert.equal(E.isProjectTaskAssignableStatus(undefined), false);
  assert.equal(E.isWorkspaceTaskAssignableLifecycle(undefined), false);
  // Do not broaden global visibility or active-only Project/Workspace APIs.
  assert.equal(E.isProjectActiveStatus("stopped"), false);
  assert.equal(E.isWorkspaceActiveLifecycle("inactive"), false);
  assert.equal(E.isProjectVisibleInWorkspace("stopped", "inactive"), false);
});

test("Typed candidate discovery shows inactive Workspace and all non-archived Projects", () => {
  const f = fixture();
  const available = selectable(f);
  assert.deepEqual(available.workspaces.map(x => x.displayName), ["Active", "Inactive"]);
  assert.deepEqual(available.projects.map(x => x.displayName).sort(),
    ["Other", "cancelled", "planning", "running", "stable", "stopped", "InArchived"].sort());
  const inactive = byName(available.workspaces, "Inactive");
  assert.deepEqual(available.projects.filter(x => ER.entityMatchesReference(x.workspace, inactive))
    .map(x => x.displayName).sort(), ["cancelled", "planning", "running", "stable", "stopped"].sort());
  assert.ok(!available.projects.some(x => x.displayName === "done"));
  assert.ok(!available.projects.some(x => x.displayName === "unknown"));
});

test("QuickAdd detailed Task creator can choose inactive Workspace and stopped Project", async () => {
  const f = fixture();
  let calls = 0;
  const result = await C.chooseContext({
    app: f.app,
    quickAddApi: {
      suggester: async (labels, values) => {
        calls += 1;
        if (calls === 1) {
          assert.ok(labels.includes("Inactive"));
          assert.ok(!labels.includes("Archived"));
          assert.ok(!labels.includes("Unknown"));
          return byName(values, "Inactive");
        }
        assert.ok(labels.includes("stopped"));
        assert.ok(labels.includes("stable"));
        assert.ok(labels.includes("cancelled"));
        assert.ok(!labels.includes("done"));
        assert.ok(!labels.includes("Other"));
        return byName(values, "stopped");
      }
    }
  });
  assert.equal(calls, 2);
  assert.equal(result.cancelled, false);
  assert.equal(result.workspace.displayName, "Inactive");
  assert.equal(result.project.status, "stopped");
  assert.equal(f.writes.length, 0);
});

test("Task context editor saves inactive Workspace and stable Project together", async () => {
  const f = fixture();
  const notices = [];
  let calls = 0;
  const module = { exports: {} };
  new Function("module", "exports", read("98-System/01-script/select_task_context.js"))(module, module.exports);
  await withGlobals({ app: f.app, Notice: class Notice { constructor(message) { notices.push(message); } } }, async () => {
    await module.exports({ system: { suggester: async (labels, values) => {
      calls++;
      if (calls === 1) {
        assert.ok(labels.includes("Inactive"));
        assert.ok(!labels.includes("Archived"));
        return byName(values, "Inactive");
      }
      assert.ok(labels.includes("stable"));
      assert.ok(labels.includes("cancelled"));
      assert.ok(!labels.includes("done"));
      return byName(values, "stable");
    }}});
  });
  assert.equal(calls, 2);
  const updated = f.content.get(f.taskFile.path);
  assert.equal(updated.workspace, "[[03-Workspace/Inactive|Inactive]]");
  assert.equal(updated.project, "[[10-Project/stable|stable]]");
  assert.equal(notices.length, 1);
});

test("Recurring Definition creator offers cancelled non-archived Project in inactive Workspace", async () => {
  const f = fixture();
  const prompts = ["Weekly", "2026-10-27", "1", "1,5", "7"];
  let calls = 0;
  const module = { exports: {} };
  new Function("module", "exports", read("98-System/01-script/create_recurring_task.js"))(module, module.exports);
  const moments = (_date) => ({ format: () => "2026-10-27", isValid: () => true });
  await withGlobals({
    app: f.app,
    window: { moment: moments },
    Notice: class Notice { constructor() {} }
  }, async () => {
    await module.exports({ system: {
      prompt: async () => prompts.shift(),
      suggester: async (labels, values) => {
        calls++;
        if (calls === 1) return "weekly";
        if (calls === 2) return "none";
        if (calls === 3) {
          assert.ok(labels.includes("Inactive"));
          assert.ok(!labels.includes("Archived"));
          return byName(values, "Inactive");
        }
        assert.ok(labels.includes("cancelled"));
        assert.ok(!labels.includes("done"));
        return byName(values, "cancelled");
      }
    }});
  });
  assert.equal(calls, 4);
  assert.equal(f.writes.length, 1);
  const body = f.writes[0].data;
  assert.match(body, /^type: recurring-task$/m);
  assert.match(body, /^workspace: "\[\[03-Workspace\/Inactive\|Inactive\]\]"$/m);
  assert.match(body, /^project: "\[\[10-Project\/cancelled\|cancelled\]\]"$/m);
  assert.match(body, /^weekdays: \[1, 5\]$/m);
});

test("Inbox triage view builds candidates from Task-specific non-archived policy", async () => {
  const f = fixture();
  const dvCollection = xs => ({
    where(predicate) { return dvCollection(xs.filter(predicate)); },
    [Symbol.iterator]: function* () { yield* xs; }
  });
  const dv = {
    io: { load: async rel => read(rel) },
    pages: () => dvCollection([]),
    date: () => {
      const instance = { startOf: () => instance, plus: () => instance };
      return instance;
    },
    compare: () => 0,
    paragraph: () => {}
  };
  const view = read("98-System/04-view/tasks/task_table.js");
  const run = new Function("dv", "app", "input",
    "return (async () => {\n" + view + "\nreturn triage;\n})();");
  const triage = await run(dv, f.app, { mode: "inbox" });
  assert.ok(triage, "inbox mode must initialize triage candidates");
  assert.deepEqual(triage.workspaces.map(x => x.displayName), ["Active", "Inactive"]);
  assert.ok(triage.projects.some(x => x.displayName === "stopped"));
  assert.ok(triage.projects.some(x => x.displayName === "stable"));
  assert.ok(triage.projects.some(x => x.displayName === "cancelled"));
  assert.ok(!triage.projects.some(x => x.displayName === "done"));
});

test("Task association does not relax primary task visibility or unrelated Idea selectors", () => {
  const V = evalExpression("98-System/01-script/workspace_task_visibility_utils.js")(G, E);
  const f = fixture();
  assert.equal(V.isTaskOperationallyVisible({
    workspace: "[[03-Workspace/Inactive|Inactive]]"
  }, selectable(f).workspaces), false);
  for (const rel of [
    "98-System/01-script/create_idea.js",
    "98-System/01-script/select_idea_context.js"
  ]) {
    assert.match(read(rel), /E\.isWorkspaceActiveLifecycle\(entity\.lifecycle\)/);
    assert.match(read(rel), /E\.isProjectActiveStatus\(entity\.status\)/);
  }
});
