import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = process.cwd();
const addWork = require(path.join(root, "98-System/01-script/add_work.js"));

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function compileDvjs(relativePath) {
  const source = read(relativePath);
  const match = source.match(/^```dvjs\r?\n([\s\S]*?)\r?\n```\s*$/);
  assert.ok(match, `${relativePath} must contain one dvjs block`);
  assert.doesNotThrow(() => new Function(
    "dv", "app", "moment", "document",
    `"use strict"; return (async function () {\n${match[1]}\n});`
  ));
}

function makeMoment(fallback = "2026-09-14") {
  return (value, _format, strict) => {
    const date = value || fallback;
    const valid = !strict || /^\d{4}-\d{2}-\d{2}$/.test(date);
    return {
      isValid: () => valid,
      format: pattern => {
        if (pattern === "YYYY") return date.slice(0, 4);
        if (pattern === "YYYY-MM") return date.slice(0, 7);
        if (pattern === "YYYY-MM-DD") return date;
        return date;
      }
    };
  };
}

function makeWorkApp(initial = "---\ntype: monthly-review\n---\n# 今月の勤務\n") {
  const monthlyFile = { path: "01-MonthlyNote/2026/2026-09.md", basename: "2026-09" };
  let stored = initial;
  return {
    app: {
      workspace: {
        getActiveFile: () => ({ basename: "2026-09-14" })
      },
      vault: {
        getFileByPath: filePath => filePath === monthlyFile.path ? monthlyFile : null,
        read: async () => stored,
        modify: async (_file, content) => { stored = content; }
      }
    },
    stored: () => stored
  };
}

test("work duration accepts canonical H:MM and stores minutes", () => {
  assert.equal(addWork.parseWorkDuration("7:30"), 450);
  assert.equal(addWork.parseWorkDuration("0:30"), 30);
  assert.equal(addWork.parseWorkDuration("24:00"), 1440);
  assert.equal(addWork.parseWorkDuration("7.5"), null);
  assert.equal(addWork.parseWorkDuration("7:60"), null);
  assert.equal(addWork.parseWorkDuration("24:01"), null);
  assert.equal(addWork.parseWorkDuration("0:00"), null);
});

test("work duration display is derived from stored minutes", () => {
  assert.equal(addWork.formatWorkDuration(450), "7h 30m");
  assert.equal(addWork.formatWorkDuration(60), "1h");
  assert.equal(addWork.formatWorkDuration(30), "30m");
});

test("work record fixes workplace to composition", () => {
  assert.equal(
    addWork.buildWorkRecord("2026-09-14", 450),
    "- [date:: 2026-09-14] [workplace:: composition] [work_min:: 450]"
  );
});

test("work record is inserted inside the monthly work section", () => {
  const before = "# A\n\n# 今月の勤務\n\n# B\n";
  const record = addWork.buildWorkRecord("2026-09-14", 450);
  const after = addWork.appendWorkRecord(before, record);
  assert.match(after, /# 今月の勤務\n- \[date:: 2026-09-14\].*\n\n# B/);
});

test("missing monthly work section is created for older notes", () => {
  const record = addWork.buildWorkRecord("2026-09-14", 450);
  const after = addWork.appendWorkRecord("# Existing\n", record);
  assert.match(after, /# Existing\n\n# 今月の勤務\n- \[date:: 2026-09-14\]/);
});

test("Templater entrypoint records into the target monthly note", async () => {
  const env = makeWorkApp();
  const prompts = ["", "7:30"];

  globalThis.app = env.app;
  globalThis.window = { moment: makeMoment() };
  globalThis.Notice = class Notice { constructor() {} };

  const result = await addWork({
    system: {
      prompt: async () => prompts.shift()
    }
  });

  assert.deepEqual(result, {
    date: "2026-09-14",
    workplace: "composition",
    work_min: 450,
    target_path: "01-MonthlyNote/2026/2026-09.md"
  });
  assert.match(env.stored(), /\[date:: 2026-09-14\] \[workplace:: composition\] \[work_min:: 450\]/);

  delete globalThis.app;
  delete globalThis.window;
  delete globalThis.Notice;
});

test("QuickAdd entrypoint uses inputPrompt without requiring Templater", async () => {
  const env = makeWorkApp();
  const prompts = ["", "6:45"];
  const notices = [];

  const result = await addWork({
    app: env.app,
    moment: makeMoment(),
    Notice: class Notice {
      constructor(message) { notices.push(String(message)); }
    },
    quickAddApi: {
      inputPrompt: async () => prompts.shift()
    }
  });

  assert.deepEqual(result, {
    date: "2026-09-14",
    workplace: "composition",
    work_min: 405,
    target_path: "01-MonthlyNote/2026/2026-09.md"
  });
  assert.match(env.stored(), /\[work_min:: 405\]/);
  assert.match(notices.at(-1), /勤務時間を記録しました/);
});

test("Work: Add is a required QuickAdd choice", () => {
  const manifest = JSON.parse(read("98-System/99-dev/setup/automation-manifest.json"));
  const workChoice = manifest.quickadd?.required_choices?.find(choice => choice.name === "Work: Add");
  assert.deepEqual(workChoice, {
    name: "Work: Add",
    script: "98-System/01-script/add_work.js"
  });
});

test("Daily, Monthly, and Dashboard expose the work tracker", () => {
  const daily = read("98-System/03-template/01-note/daily-note-template.md");
  const monthly = read("98-System/03-template/01-note/monthly-note-template.md");
  const dashboard = read("Dashboard.md");
  const buttons = read("98-System/02-embed/01-button/work-buttons.md");
  const command = read("98-System/00-command/add_work.md");

  assert.match(daily, /\[\[work-buttons\]\]/);
  assert.match(daily, /\[\[daily-work\]\]/);
  assert.match(monthly, /\[\[work-buttons\]\]/);
  assert.match(monthly, /\[\[work-visualiser\]\]/);
  assert.match(monthly, /^# 今月の勤務$/m);
  assert.match(dashboard, /\[\[work-buttons\]\]/);
  assert.match(dashboard, /\[\[work-summary\]\]/);
  assert.match(buttons, /id: add-work/);
  assert.match(buttons, /98-System\/00-command\/add_work\.md/);
  assert.match(command, /tp\.user\.add_work\(tp\)/);
});

test("work tracker DataviewJS embeds compile", () => {
  compileDvjs("98-System/02-embed/04-viz/daily-work.md");
  compileDvjs("98-System/02-embed/04-viz/work-visualiser.md");
  compileDvjs("98-System/02-embed/04-viz/work-summary.md");
});
