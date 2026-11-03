import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const root = process.cwd();
const require = createRequire(import.meta.url);
const deleteTask = require(path.join(root, "98-System/01-script/delete_task.js"));
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

function fixture({ status = "todo", type = "task", filePath = "02-Task/2026/11/Test.md",
                   answer = "DELETE", failTrash = false, onPrompt } = {}) {
  const basename = filePath.split("/").at(-1).replace(/\.md$/, "");
  const file = { path: filePath, basename, extension: "md", stat: { mtime: 100, size: 400 } };
  const fm = { type, title: "Example", status, completed: status === "done" ? "2026-11-03" : null };
  const map = new Map([[filePath, file]]);
  const notices = [];
  const trashed = [];
  let active = file;
  const app = {
    workspace: { getActiveFile: () => active },
    metadataCache: { getFileCache: () => ({ frontmatter: fm }) },
    vault: {
      getAbstractFileByPath: p => map.get(p) ?? null,
      trash: async (target, system) => {
        if (failTrash) throw Error("simulated trash failure");
        trashed.push({ target, system });
      }
    }
  };
  class Notice { constructor(message) { notices.push(String(message)); } }
  const tp = { system: { prompt: async (message) => {
    assert.equal(message, "Type DELETE");
    if (onPrompt) await onPrompt({ file, fm, map, changeActive: value => { active = value; } });
    return answer;
  } } };
  return { app, Notice, tp, file, fm, map, notices, trashed };
}

test("Task note deletion trashes only the selected note for open and completed statuses", async () => {
  for (const status of ["todo", "doing", "done"]) {
    const f = fixture({ status });
    const result = await deleteTask(f.tp, { app: f.app, Notice: f.Notice });
    assert.deepEqual(result, { ok: true, path: f.file.path });
    assert.deepEqual(f.trashed, [{ target: f.file, system: false }]);
    assert.match(f.notices.at(-1), /ゴミ箱/);
  }
});

test("Task note deletion requires an exact confirmation and preserves the note otherwise", async () => {
  for (const answer of [null, "", "DELETE Wrong", "Test"]) {
    const f = fixture({ answer });
    const result = await deleteTask(f.tp, { app: f.app, Notice: f.Notice });
    assert.equal(result.reason, "cancelled");
    assert.deepEqual(f.trashed, []);
  }
});

test("Task deletion refuses non-Task content, non-Task paths and a missing confirmation API", async () => {
  for (const f of [
    fixture({ type: "recurring-task", filePath: "02-Task/Recurring/Definition.md" }),
    fixture({ type: "project" }),
    fixture({ filePath: "10-Project/Project.md" }),
    fixture({ filePath: "02-Task/../Other.md" })
  ]) {
    const result = await deleteTask(f.tp, { app: f.app, Notice: f.Notice });
    assert.equal(result.ok, false);
    assert.deepEqual(f.trashed, []);
  }
  const f = fixture();
  const result = await deleteTask(null, { app: f.app, Notice: f.Notice });
  assert.equal(result.reason, "missing-api");
});

test("Task deletion fails closed when the selected note changes during confirmation", async () => {
  const changes = [
    ({ fm }) => { fm.status = "doing"; },
    ({ fm }) => { fm.title = "Changed"; },
    ({ file }) => { file.stat.mtime += 1; },
    ({ file }) => { file.stat.size += 1; },
    ({ file, map }) => { map.set(file.path, { ...file }); },
    ({ file, changeActive }) => { changeActive({ ...file }); },
    ({ fm }) => { fm.type = "note"; }
  ];
  for (const onPrompt of changes) {
    const f = fixture({ onPrompt });
    assert.equal((await deleteTask(f.tp, { app: f.app, Notice: f.Notice })).reason,
      "changed-since-confirmation");
    assert.deepEqual(f.trashed, []);
  }
});

test("Completed-list deletion rechecks done status and cannot trash a reopened Task", async () => {
  const f = fixture({ status: "done" });
  const result = await deleteTask(null, {
    app: f.app, Notice: f.Notice, file: f.file, completedOnly: true,
    confirm: async ({ token }) => { f.fm.status = "doing"; return token; }
  });
  assert.equal(result.reason, "changed-since-confirmation");
  assert.deepEqual(f.trashed, []);

  const normal = fixture({ status: "todo" });
  const result2 = await deleteTask(null, {
    app: normal.app, Notice: normal.Notice, file: normal.file, completedOnly: true,
    confirm: async ({ token }) => token
  });
  assert.equal(result2.reason, "not-completed");
  assert.deepEqual(normal.trashed, []);
});

test("List deletion requires explicit confirmation and reports trash failure without success", async () => {
  const f = fixture({ status: "done" });
  const cancel = await deleteTask(null, {
    app: f.app, Notice: f.Notice, file: f.file, completedOnly: true,
    confirm: async () => false
  });
  assert.equal(cancel.reason, "cancelled");
  assert.deepEqual(f.trashed, []);

  const fail = fixture({ failTrash: true });
  const result = await deleteTask(fail.tp, { app: fail.app, Notice: fail.Notice });
  assert.equal(result.reason, "trash-failed");
  assert.deepEqual(fail.trashed, []);
  assert.match(fail.notices.at(-1), /結果が不明/);
});

test("Task UI removes Cancel action, keeps legacy status compatibility, and wires all deletion surfaces", () => {
  const metadata = read("98-System/02-embed/00-meta/task-note-meta.md");
  assert.match(metadata, /BUTTON\[task-status-todo, task-status-doing, task-status-done\]/);
  assert.doesNotMatch(metadata, /task-status-cancelled/);
  assert.match(metadata, /id: task-delete/);
  assert.match(metadata, /style: destructive[\s\S]*?delete_task\.md/);

  const taskMeta = new Function('"use strict"; return (' +
    read("98-System/01-script/task_meta_utils.js") + ');')();
  assert.equal(taskMeta.isTaskClosedStatus("cancelled"), true);
  assert.equal(taskMeta.isTaskActionableStatus("cancelled"), false);

  const wrapper = read("98-System/00-command/delete_task.md");
  assert.match(wrapper, /tp\.user\.delete_task\(tp\)/);
  assert.match(wrapper, /Platform\?\.isMobile/);
  assert.match(wrapper, /98-System\/01-script\/delete_task\.js/);

  const view = read("98-System/04-view/tasks/task_table.js");
  assert.match(view, /case "completed": tasks=tasks\.filter/);
  assert.match(view, /createDeleteButton\(task,true\)/);
  assert.match(view, /createDeleteButton\(task\)/);
  assert.match(view, /deleteTask\(null,/);
  const hub = read("98-System/02-embed/hub/task-hub.md");
  assert.match(hub, /05-task\/completed/);
  const completed = read("98-System/02-embed/05-task/completed.md");
  assert.match(completed, /mode: "completed"/);
  for (const context of ["project", "workspace"]) {
    const source = read("98-System/02-embed/05-task/" + context + "-tasks.md");
    assert.match(source, /mode: "completed"/);
    assert.match(source, new RegExp(context + ": dv\\.current\\(\\)\\.file\\.link"));
  }

  const code = read("98-System/01-script/delete_task.js");
  assert.match(code, /vault\.trash\(file, false\)/);
  assert.doesNotMatch(code, /permanentDelete|vault\.delete\(/);
});

test("Completed Dataview renders archived-context history in descending date order and deletes the selected row", async () => {
  const workspace = {
    type: "workspace", lifecycle: "archived",
    file: { path: "03-Workspace/Archived.md", name: "Archived.md" }
  };
  const task = (basename, status, completed) => ({
    type: "task", title: basename, status, completed, priority: "low",
    workspace: "[[03-Workspace/Archived|Archived]]", project: null,
    file: {
      path: "02-Task/2026/11/" + basename + ".md", name: basename + ".md",
      mtime: completed || "2026-11-01", mday: completed || "2026-11-01",
      ctime: completed || "2026-11-01"
    }
  });
  const old = task("Old", "done", "2026-11-01");
  const newest = task("Newest", "done", "2026-11-03");
  const actionable = task("Active", "todo", null);
  const cancelled = task("Cancelled", "cancelled", null);
  const tasks = [old, actionable, newest, cancelled];
  const actualFiles = new Map();
  const fmByPath = new Map();
  for (const row of tasks) {
    const file = {
      path: row.file.path,
      basename: row.title,
      extension: "md",
      stat: { mtime: 101, size: 100 }
    };
    actualFiles.set(file.path, file);
    fmByPath.set(file.path, { type: "task", title: row.title, status: row.status, completed: row.completed });
  }
  const tableCalls = [];
  const trashed = [];
  const notices = [];
  const confirmations = [];
  const query = values => ({
    [Symbol.iterator]: function* () { yield* values; },
    where(predicate) { return query(values.filter(predicate)); }
  });
  const date = value => ({
    key: value, startOf() { return this; },
    plus() { return this; },
    toFormat() { return value; }
  });
  const dv = {
    io: { load: async p => read(p) },
    pages: folder => folder === '"03-Workspace"' ? query([workspace])
      : folder === '"10-Project"' ? query([]) : query(tasks),
    date,
    compare: (a,b) => {
      const av = a?.key ?? a; const bv = b?.key ?? b;
      return av < bv ? -1 : av > bv ? 1 : 0;
    },
    fileLink: (p, _embed, label) => label + "@" + p,
    page: () => null,
    table: (headers, rows) => tableCalls.push({ headers, rows }),
    paragraph: () => { throw Error("Expected nonempty completed list"); }
  };
  const app = {
    metadataCache: {
      getFileCache: file => ({ frontmatter: fmByPath.get(file.path) })
    },
    vault: {
      getAbstractFileByPath: p => actualFiles.get(p) ?? null,
      trash: async (file, system) => trashed.push({ file, system })
    }
  };
  const document = {
    createElement: tag => {
      assert.equal(tag, "button", "Completed view must not add a done checkbox");
      const listeners = new Map();
      return {
        classList: { add() {} },
        setAttribute() {},
        addEventListener: (name, fn) => listeners.set(name, fn),
        closest: () => ({ remove() { document.deletedRow = true; } }),
        click: async () => listeners.get("click")()
      };
    },
    deletedRow: false
  };
  class Notice { constructor(message) { notices.push(String(message)); } }
  const window = { confirm: message => { confirmations.push(message); return true; } };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const render = new AsyncFunction("dv", "input", "app", "document", "Notice", "window",
    read("98-System/04-view/tasks/task_table.js"));
  await render(dv, { mode: "completed" }, app, document, Notice, window);

  assert.equal(tableCalls.length, 1);
  const { headers, rows } = tableCalls[0];
  assert.deepEqual(headers, ["Task","完了日","Priority","Due","Workspace","Project","削除"]);
  assert.equal(rows.length, 2);
  assert.match(rows[0][0], /^Newest@/);
  assert.match(rows[1][0], /^Old@/);

  await rows[0].at(-1).click();
  assert.deepEqual(trashed, [{ file: actualFiles.get(newest.file.path), system: false }]);
  assert.equal(document.deletedRow, true);
  assert.equal(confirmations.length, 1);
  assert.match(confirmations[0], /Task「Newest」/);
  assert.match(notices.at(-1), /ゴミ箱/);
});
