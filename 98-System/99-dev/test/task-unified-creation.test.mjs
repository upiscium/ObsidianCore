import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const dir = "98-System/01-script/";
const read = name => fs.readFileSync(path.join(root, dir + name), "utf8");
const oldFiles = {
  actionable: "create_task.js",
  backlog: "backlog_task.js"
};

function readExpression(filename) {
  return new Function(`"use strict"; return (${read(filename)});`)();
}

const U = readExpression("task_creation_utils.js");

function invoke(scriptName, params) {
  const mod = { exports: {} };
  new Function("module", "exports", read(scriptName))(mod, mod.exports);
  return mod.exports(params);
}

function file(pathname) {
  return { path: pathname, extension: pathname.split(".").pop(), basename: pathname.split("/").pop().replace(/\.md$/, "") };
}

async function withFixture(options, action) {
  const {
    activeFile = null, cancel = null, start = "2026-11-18", due = "2026-11-25",
    dependencyError = false, dailyError = false, selectedMode = "actionable"
  } = options;
  const events = [];
  const writes = [];
  const notices = [];
  const virtual = new Map();
  const date = "2026-11-16";
  const dailyPath = "00-DailyNote/2026/11/2026-11-16.md";
  const maybeCancel = key => cancel === key;
  const taskUtils = {
    async readRequiredText({ initialValue, prompt, placeholder }) {
      events.push({ op: "title", initialValue, prompt, placeholder });
      return maybeCancel("title")
        ? { cancelled: true }
        : { cancelled: false, value: initialValue ?? "Prompt Title" };
    },
    async choosePriority() {
      events.push({ op: "priority" });
      return { cancelled: maybeCancel("priority"), value: "high" };
    },
    async chooseOptionalDate(_api, label) {
      events.push({ op: "start", label });
      return { cancelled: maybeCancel("start"), value: start };
    },
    async chooseRequiredDate({ initialValue, label }) {
      events.push({ op: "due", label, initialValue });
      return { cancelled: maybeCancel("due"), value: due };
    },
    async chooseContext() {
      events.push({ op: "context" });
      return { cancelled: maybeCancel("context"),
        workspace: { link: "[[03-Workspace/Research|Research]]" },
        project: { link: "[[10-Project/Example|Example]]" } };
    },
    buildDailyPath() {
      events.push({ op: "buildDailyPath" });
      return dailyPath;
    },
    async ensureDailyNote({ dailyPath: given }) {
      events.push({ op: "ensureDailyNote", path: given });
      assert.equal(given, dailyPath);
      virtual.set(given, file(given));
    },
    async prepareTaskFile({ title }) {
      events.push({ op: "prepareTaskFile", title });
      return { taskPath: `02-Task/2026/11/20261116-230000-000-${title}.md` };
    },
    makeSourceLink(args) {
      events.push({ op: "source", path: args.sourceFile?.path ?? null });
      return U.makeSourceLink(args);
    },
    makeEntityLink({ entity }) {
      return entity?.link ?? null;
    },
    async readTaskTemplate({ title }) {
      events.push({ op: "template", title });
      return `# ${title}`;
    },
    buildTaskContent: U.buildTaskContent,
    async appendTaskLinkToDaily({ dailyPath: given, taskFile }) {
      events.push({ op: "appendDaily", path: given, taskFile: taskFile.path });
      if (dailyError) throw new Error("synthetic daily error");
    }
  };
  const dependencyUtils = {
    async chooseDependencies() {
      events.push({ op: "dependencies" });
      return { cancelled: maybeCancel("dependencies"), tasks: ["existing parent"] };
    },
    async applyDependencies({ taskFile, dependencies }) {
      events.push({ op: "applyDependencies", taskFile: taskFile.path, dependencies });
      if (dependencyError) throw new Error("synthetic dependency error");
    }
  };
  const SOURCES = new Map([
    [dir + "task_create_flow.js", read("task_create_flow.js")],
    [dir + "task_creation_utils.js", "(() => globalThis.__unifyTaskFixtureU)()"],
    [dir + "task_dependency_creation_utils.js", "(() => globalThis.__unifyTaskFixtureD)()"]
  ]);

  const app = {
    vault: {
      getAbstractFileByPath(pathname) {
        if (SOURCES.has(pathname)) return { ...file(pathname), extension: "js" };
        return virtual.get(pathname) ?? null;
      },
      async read(f) {
        events.push({ op: "load", path: f.path });
        return SOURCES.get(f.path);
      },
      async create(pathname, content) {
        events.push({ op: "create", path: pathname });
        const created = file(pathname);
        virtual.set(pathname, created);
        writes.push({ path: pathname, content });
        return created;
      }
    },
    workspace: { getActiveFile: () => activeFile },
    fileManager: {
      generateMarkdownLink(f, origin, _subpath, alias) {
        return `[[${f.path.replace(/\.md$/, "")}|${alias}]]`;
      }
    }
  };
  const quickAddApi = {
    async suggester(labels, values) {
      events.push({ op: "selectMode", labels, values });
      return selectedMode;
    }
  };
  const moment = input => {
    const stamp = input === undefined ? date : String(input);
    const tokens = {
      "YYYY": "2026",
      "MM": "11",
      "YYYY-MM-DD": date,
      "YYYYMMDD-HHmmss-SSS": "20261116-230000-000"
    };
    return {
      stamp,
      format: key => tokens[key] ?? key,
      isAfter(other, unit) { assert.equal(unit, "day"); return stamp > other.stamp; }
    };
  };
  const before = new Map(["__unifyTaskFixtureU", "__unifyTaskFixtureD", "window", "Notice"]
    .map(key => [key, Object.hasOwn(globalThis, key) ? { present: true, value: globalThis[key] } : { present: false }]));
  globalThis.__unifyTaskFixtureU = taskUtils;
  globalThis.__unifyTaskFixtureD = dependencyUtils;
  globalThis.window = { moment };
  globalThis.Notice = class Notice { constructor(message) { notices.push(message); } };

  try {
    return await action({
      app, quickAddApi, events, writes, notices, virtual, dailyPath
    });
  } finally {
    for (const [key, item] of before) {
      if (item.present) globalThis[key] = item.value;
      else delete globalThis[key];
    }
  }
}

async function execute(scriptName, options = {}, variables = { title: "Example" }) {
  return withFixture(options, async fixture => {
    const result = await invoke(scriptName, {
      app: fixture.app, quickAddApi: fixture.quickAddApi, variables
    });
    return { ...fixture, result, variables };
  });
}

function fm(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(match, "canonical frontmatter exists");
  return match[1];
}

test("legacy Task: Create preserves due/start, Daily note creation, links and metadata", async () => {
  const r = await execute(oldFiles.actionable, {}, { title: "Exam", due: "2026-11-25" });
  assert.equal(r.writes.length, 1);
  assert.equal(r.result, r.writes[0].path);
  assert.equal(r.variables.createdTaskPath, r.result);
  assert.match(fm(r.writes[0].content), /^type: task$/m);
  assert.match(fm(r.writes[0].content), /^title: "Exam"$/m);
  assert.match(fm(r.writes[0].content), /^due: 2026-11-25$/m);
  assert.match(fm(r.writes[0].content), /^start: 2026-11-18$/m);
  assert.match(fm(r.writes[0].content), /^triaged: true$/m);
  assert.match(fm(r.writes[0].content), /^backlog: false$/m);
  assert.match(fm(r.writes[0].content), /^depends_on: \[\]$/m);
  assert.match(fm(r.writes[0].content), /^source: "\[\[00-DailyNote\/2026\/11\/2026-11-16\|2026-11-16\]\]"$/m);
  assert.ok(r.events.some(e => e.op === "ensureDailyNote"));
  assert.ok(r.events.some(e => e.op === "appendDaily"));
  assert.ok(r.events.some(e => e.op === "applyDependencies"));
  assert.equal(r.events.filter(e => e.op === "selectMode").length, 0);
  assert.deepEqual(r.notices, ["Taskを作成しました: Exam"]);
});

test("legacy Task: Backlog preserves undated behavior without any Daily write", async () => {
  const r = await execute(oldFiles.backlog, {}, { value: "Maybe Later" });
  assert.equal(r.writes.length, 1);
  assert.equal(r.variables.createdTaskPath, r.result);
  assert.match(fm(r.writes[0].content), /^title: "Maybe Later"$/m);
  assert.match(fm(r.writes[0].content), /^due:\s*$/m);
  assert.match(fm(r.writes[0].content), /^start:\s*$/m);
  assert.match(fm(r.writes[0].content), /^triaged: true$/m);
  assert.match(fm(r.writes[0].content), /^backlog: true$/m);
  assert.match(fm(r.writes[0].content), /^status: todo$/m);
  assert.ok(!r.events.some(e => ["start", "due", "ensureDailyNote", "appendDaily"].includes(e.op)));
  assert.equal(r.events.filter(e => e.op === "selectMode").length, 0);
  assert.deepEqual(r.notices, ["Backlogへ追加しました: Maybe Later"]);
});

test("unified chooser reproduces each legacy route exactly after selection", async () => {
  for (const mode of ["actionable", "backlog"]) {
    const script = oldFiles[mode];
    const options = { selectedMode: mode, activeFile: file("11-Knowledge/Reference.md") };
    const variables = { title: "Identical", due: "2026-11-25" };
    const legacy = await execute(script, options, { ...variables });
    const unified = await execute("create_task_unified.js", options, { ...variables });
    assert.deepEqual(unified.writes, legacy.writes, `${mode} writes`);
    assert.equal(unified.result, legacy.result);
    assert.deepEqual(unified.events.filter(e => e.op !== "selectMode"), legacy.events,
      `${mode} side effects`);
    assert.deepEqual(unified.notices, legacy.notices);
    const picker = unified.events.find(e => e.op === "selectMode");
    assert.deepEqual(picker.values, ["actionable", "backlog"]);
    assert.equal(picker.labels.length, 2);
    assert.match(fm(unified.writes[0].content), /^source: "\[\[11-Knowledge\/Reference\|Reference\]\]"$/m);
  }
});

test("cancel mode selection without creating a note or loading dependent utilities", async () => {
  const r = await execute("create_task_unified.js", { selectedMode: null });
  assert.equal(r.result, undefined);
  assert.deepEqual(r.writes, []);
  assert.ok(!r.events.some(e => ["title", "priority", "create", "ensureDailyNote"].includes(e.op)));
  assert.equal(r.events.filter(e => e.op === "load").length, 1); // only the chooser itself
});

test("explicit taskMode supports callers while unknown modes fail closed", async () => {
  const r = await execute("create_task_unified.js", {}, {
    title: "Explicit Backlog", taskMode: "backlog", due: "2026-11-25"
  });
  assert.equal(r.events.filter(e => e.op === "selectMode").length, 0);
  assert.match(fm(r.writes[0].content), /^backlog: true$/m);
  assert.match(fm(r.writes[0].content), /^due:\s*$/m);

  for (const taskMode of ["backlog ", "unknown", true, ""]) {
    await withFixture({}, async f => {
      await assert.rejects(invoke("create_task_unified.js", {
        app: f.app, quickAddApi: f.quickAddApi, variables: { taskMode }
      }), /Task作成モードが不正/);
      assert.deepEqual(f.writes, []);
      assert.ok(!f.events.some(e => e.op === "title"));
    });
  }
  await withFixture({ selectedMode: "invalid" }, async f => {
    await assert.rejects(invoke("create_task_unified.js", {
      app: f.app, quickAddApi: f.quickAddApi, variables: {}
    }), /Task作成モードが不正/);
    assert.deepEqual(f.writes, []);
  });
});

test("legacy scripts keep their respective title-variable contracts", async () => {
  const normal = await execute(oldFiles.actionable, {}, { value: "Injected" });
  assert.equal(normal.events.find(e => e.op === "title").initialValue, undefined);
  assert.match(fm(normal.writes[0].content), /^title: "Prompt Title"$/m);
  const backlog = await execute(oldFiles.backlog, {}, { value: "Injected" });
  assert.equal(backlog.events.find(e => e.op === "title").initialValue, "Injected");
  assert.match(fm(backlog.writes[0].content), /^title: "Injected"$/m);
});

test("cancellation at any pre-create step leaves both Task modes without writes", async () => {
  for (const mode of ["actionable", "backlog"]) {
    const stages = mode === "actionable"
      ? ["title", "priority", "start", "due", "context", "dependencies"]
      : ["title", "priority", "context", "dependencies"];
    for (const cancel of stages) {
      const r = await execute(oldFiles[mode], { cancel });
      assert.equal(r.result, undefined, `${mode} / ${cancel}`);
      assert.deepEqual(r.writes, []);
      assert.ok(!r.events.some(e => e.op === "ensureDailyNote"), `${mode} / ${cancel}`);
      assert.ok(!r.events.some(e => e.op === "prepareTaskFile"), `${mode} / ${cancel}`);
    }
  }
});

test("actionable Start after Due fails before any write; Backlog ignores dates", async () => {
  const invalid = await execute(oldFiles.actionable, { start: "2026-11-30", due: "2026-11-18" });
  assert.equal(invalid.result, undefined);
  assert.deepEqual(invalid.writes, []);
  assert.deepEqual(invalid.notices, ["StartはDue以前の日付にしてください。"]);
  const backlog = await execute(oldFiles.backlog, { start: "2026-11-30", due: "2026-11-18" });
  assert.equal(backlog.writes.length, 1);
});

test("dependency failure keeps the already-created note and old error Notice", async () => {
  for (const mode of ["actionable", "backlog"]) {
    const previousError = console.error;
    console.error = () => {};
    try {
      const r = await execute(oldFiles[mode], { dependencyError: true });
      assert.equal(r.result, r.writes[0].path);
      assert.equal(r.variables.createdTaskPath, r.result);
      assert.equal(r.notices.length, 2);
      assert.match(r.notices[0], mode === "actionable" ? /^Taskは作成しましたが/ : /^Backlog Taskは作成しましたが/);
      assert.equal(r.events.some(e => e.op === "appendDaily"), mode === "actionable");
    } finally {
      console.error = previousError;
    }
  }
});

test("actionable Daily link failure keeps created Task without success Notice", async () => {
  const previousError = console.error;
  console.error = () => {};
  try {
    const r = await execute(oldFiles.actionable, { dailyError: true });
    assert.equal(r.writes.length, 1);
    assert.equal(r.result, r.writes[0].path);
    assert.equal(r.variables.createdTaskPath, r.result);
    assert.deepEqual(r.notices, ["Taskは作成しましたが、Daily Noteへのリンク追加に失敗しました。"]);
  } finally {
    console.error = previousError;
  }
});
