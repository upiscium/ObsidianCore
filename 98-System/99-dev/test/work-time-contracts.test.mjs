import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { ACTIVATION_CONVERGENCE_MARKER } from "../tools/build-styles.mjs";

const require = createRequire(import.meta.url);
const root = process.cwd();
const addWork = require(path.join(root, "98-System/01-script/add_work.js"));
const manageWorkplaces = require(path.join(root, "98-System/01-script/manage_workplaces.js"));
const registry = require(path.join(root, "98-System/05-lib/work/workplace_registry.js"));
const sharedViewUtils = new Function(`"use strict"; return (${fs.readFileSync(path.join(root, "98-System/05-lib/shared/view_utils.js"), "utf8")});`)();
const workFactory = new Function(`"use strict"; return (${fs.readFileSync(path.join(root, "98-System/05-lib/work/work_time_utils.js"), "utf8")});`)();
const workUtils = workFactory(sharedViewUtils);

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

function compileView(relativePath) {
  const source = read(relativePath);
  assert.doesNotThrow(() => new Function(
    "dv", "input", "app", "moment", "document",
    `"use strict"; return (async function () {\n${source}\n});`
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

function makeWorkApp(initial = "---\ntype: monthly-review\n---\n# 今月の勤務\n", options = {}) {
  const monthlyPath = "01-MonthlyNote/2026/2026-09.md";
  const registryPath = "96-Global/01-workplace/workplaces.json";
  const documents = new Map([[monthlyPath, initial]]);
  if (options.globalExists !== false) {
    documents.set("96-Global/00-subscription/Example.md", "# Existing subscription fixture\n");
  }
  const workLibraryPaths = [
    "98-System/01-script/add_work.js",
    "98-System/01-script/manage_workplaces.js",
    "98-System/05-lib/work/workplace_registry.js"
  ];
  for (const libraryPath of workLibraryPaths) documents.set(libraryPath, read(libraryPath));
  if (options.registry !== undefined) documents.set(registryPath, options.registry);
  const createdFolders = options.globalExists === false
    ? new Set()
    : new Set(["96-Global", "96-Global/00-subscription"]);

  const fileFor = filePath => documents.has(filePath)
    ? {
        path: filePath,
        basename: filePath === monthlyPath ? "2026-09" : path.parse(filePath).name,
        extension: path.extname(filePath).slice(1)
      }
    : null;

  const app = {
    workspace: { getActiveFile: () => ({ basename: "2026-09-14" }) },
    vault: {
      getFileByPath: fileFor,
      getAbstractFileByPath: filePath =>
        fileFor(filePath) ?? (createdFolders.has(filePath) ? { path: filePath } : null),
      read: async file => documents.get(file.path),
      modify: async (file, content) => {
        if (!documents.has(file.path)) throw new Error("file_not_found");
        documents.set(file.path, content);
      },
      createFolder: async folder => {
        const parent = folder.includes("/") ? folder.slice(0, folder.lastIndexOf("/")) : null;
        if (parent && !createdFolders.has(parent)) throw new Error("parent_missing");
        if (createdFolders.has(folder)) throw new Error("already_exists");
        createdFolders.add(folder);
      },
      create: async (filePath, content) => {
        const parent = filePath.slice(0, filePath.lastIndexOf("/"));
        if (parent && !createdFolders.has(parent)) throw new Error("parent_missing");
        if (documents.has(filePath)) throw new Error("already_exists");
        documents.set(filePath, content);
        return fileFor(filePath);
      },
      process: async (file, fn) => {
        if (!documents.has(file.path)) throw new Error("file_not_found");
        documents.set(file.path, fn(documents.get(file.path)));
      }
    }
  };
  return {
    app,
    stored: () => documents.get(monthlyPath),
    registryStored: () => documents.get(registryPath),
    replaceRegistry: source => documents.set(registryPath, source),
    getDocument: filePath => documents.get(filePath),
    folderExists: folder => createdFolders.has(folder)
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

test("shared Work library normalizes Workplace and duration without fixed names", () => {
  assert.equal(workUtils.monthlyFolder, "01-MonthlyNote");
  assert.equal(workUtils.normalizeWorkplace(" composition "), "composition");
  assert.equal(workUtils.normalizeWorkplace("研究所"), "研究所");
  assert.equal(workUtils.normalizeWorkplace("  "), "未指定");
  assert.equal(workUtils.normalizeWorkplace(null), "未指定");
  assert.equal(workUtils.normalizeMinutes("450"), 450);
  assert.equal(workUtils.normalizeMinutes(0), null);
  assert.equal(workUtils.formatDuration(450), "7h 30m");
});

function multipleWorkplaceRecords() {
  return [
    { date: "2026-09-14", workplace: "composition", work_min: 450 },
    { date: "2026-09-14", workplace: "composition", work_min: 30 },
    { date: "2026-09-14", workplace: "lab", work_min: 90 },
    { date: "2026-09-15", workplace: "composition", work_min: 60 },
    { date: "2026-09-15", workplace: "lab", work_min: 120 },
    { date: "2026-09-15", workplace: " ", work_min: 15 },
    { date: "2026-08-31", workplace: "lab", work_min: 999 },
    { date: "2026-09-14", workplace: "composition", work_min: 0 },
    { date: "2026-09-14", workplace: "lab", work_min: "invalid" }
  ];
}

test("shared Work library includes every Workplace and counts dates only once", () => {
  const items = multipleWorkplaceRecords();

  assert.deepEqual(workUtils.recordsForDate(items, "2026-09-14"), {
    total: 570,
    records: 3
  });
  assert.deepEqual(workUtils.rowsForMonth(items, "2026-09"), [
    { date: "2026-09-14", minutes: 570 },
    { date: "2026-09-15", minutes: 195 }
  ]);
  assert.equal(workUtils.totalMinutes(workUtils.rowsForMonth(items, "2026-09")), 765);
  assert.deepEqual(workUtils.workplaceTotalsForMonth(items, "2026-09"), [
    { workplace: "composition", minutes: 540, days: 2 },
    { workplace: "lab", minutes: 210, days: 2 },
    { workplace: "未指定", minutes: 15, days: 1 }
  ]);
  assert.deepEqual(
    workUtils.rowsByWorkplaceForMonth(items, "2026-09").sort(
      (a, b) => a.date.localeCompare(b.date) || a.workplace.localeCompare(b.workplace)
    ),
    [
      { date: "2026-09-14", workplace: "composition", minutes: 480 },
      { date: "2026-09-14", workplace: "lab", minutes: 90 },
      { date: "2026-09-15", workplace: "composition", minutes: 60 },
      { date: "2026-09-15", workplace: "lab", minutes: 120 },
      { date: "2026-09-15", workplace: "未指定", minutes: 15 }
    ].sort((a, b) => a.date.localeCompare(b.date) || a.workplace.localeCompare(b.workplace))
  );
  assert.deepEqual(workUtils.rowsForMonth(items, "2026-10"), []);
});

test("work record writes the chosen Workplace using the established schema", () => {
  assert.equal(
    addWork.buildWorkRecord("2026-09-14", 450, "研究所"),
    "- [date:: 2026-09-14] [workplace:: 研究所] [work_min:: 450]"
  );
  assert.equal(addWork.normalizeWorkplaceInput(" lab "), "lab");
  assert.equal(addWork.normalizeWorkplaceInput(""), null);
  assert.equal(addWork.normalizeWorkplaceInput("unsafe]"), null);
  assert.equal(addWork.normalizeWorkplaceInput("unsafe\nline"), null);
  assert.throws(() => addWork.buildWorkRecord("2026-09-14", 450, ""), /Workplace/);
});

test("work record is inserted inside the monthly work section", () => {
  const before = "# A\n\n# 今月の勤務\n\n# B\n";
  const record = addWork.buildWorkRecord("2026-09-14", 450, "composition");
  const after = addWork.appendWorkRecord(before, record);
  assert.match(after, /# 今月の勤務\n- \[date:: 2026-09-14\].*\n\n# B/);
});

test("missing monthly work section is created for older notes", () => {
  const record = addWork.buildWorkRecord("2026-09-14", 450, "composition");
  const after = addWork.appendWorkRecord("# Existing\n", record);
  assert.match(after, /# Existing\n\n# 今月の勤務\n- \[date:: 2026-09-14\]/);
});

test("Templater entrypoint records into the target monthly note", async () => {
  const env = makeWorkApp();
  const prompts = ["", "7:30", "composition"];

  globalThis.app = env.app;
  globalThis.window = { moment: makeMoment() };
  globalThis.Notice = class Notice { constructor() {} };

  const result = await addWork({
    system: {
      prompt: async () => prompts.shift(),
      suggester: async () => { throw new Error("unexpected_suggester"); }
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
  const prompts = ["", "6:45", "lab"];
  const notices = [];

  const result = await addWork({
    app: env.app,
    moment: makeMoment(),
    Notice: class Notice {
      constructor(message) { notices.push(String(message)); }
    },
    quickAddApi: {
      inputPrompt: async () => prompts.shift(),
      suggester: async () => { throw new Error("unexpected_suggester"); }
    }
  });

  assert.deepEqual(result, {
    date: "2026-09-14",
    workplace: "lab",
    work_min: 405,
    target_path: "01-MonthlyNote/2026/2026-09.md"
  });
  assert.match(env.stored(), /\[workplace:: lab\] \[work_min:: 405\]/);
  assert.match(notices.at(-1), /勤務時間を記録しました/);
});

test("Work: Add is a required QuickAdd choice", () => {
  const manifest = JSON.parse(read("98-System/99-dev/setup/automation-manifest.json"));
  const workChoice = manifest.quickadd?.required_choices?.find(choice => choice.name === "Work: Add");
  assert.deepEqual(workChoice, {
    name: "Work: Add",
    script: "98-System/01-script/add_work.js"
  });
  assert.deepEqual(
    manifest.quickadd.required_choices.find(choice => choice.name === "Work: Manage"),
    { name: "Work: Manage", script: "98-System/01-script/manage_workplaces.js" }
  );
});

test("Daily, Monthly, and Dashboard expose the work tracker", () => {
  const daily = read("98-System/03-template/01-note/daily-note-template.md");
  const monthly = read("98-System/03-template/01-note/monthly-note-template.md");
  const dashboard = read("Dashboard.md");
  const today = read("98-System/02-embed/dashboard/today.md");
  const workFinance = read("98-System/02-embed/dashboard/work-finance.md");
  const buttons = read("98-System/02-embed/01-button/work-buttons.md");
  const command = read("98-System/00-command/add_work.md");

  assert.match(daily, /\[\[work-buttons\]\]/);
  assert.match(daily, /\[\[daily-work\]\]/);
  assert.match(monthly, /\[\[work-buttons\]\]/);
  assert.match(monthly, /\[\[work-summary\]\]/);
  assert.match(monthly, /\[\[work-visualiser\]\]/);
  assert.match(monthly, /^# 今月の勤務$/m);
  assert.match(dashboard, /98-System\/02-embed\/dashboard\/today/);
  assert.match(dashboard, /98-System\/02-embed\/dashboard\/work-finance/);
  assert.match(today, /\[\[work-buttons\]\]/);
  assert.match(workFinance, /\[\[work-summary\]\]/);
  assert.match(buttons, /id: add-work/);
  assert.match(buttons, /id: manage-workplaces/);
  assert.match(buttons, /98-System\/00-command\/add_work\.md/);
  assert.match(buttons, /98-System\/00-command\/manage_workplaces\.md/);
  assert.match(command, /tp\.user\.add_work\(tp\)/);
  assert.match(command, /Platform\?\.isMobile/);
  const manageCommand = read("98-System/00-command/manage_workplaces.md");
  assert.match(manageCommand, /tp\.user\.manage_workplaces\(tp\)/);
  assert.match(manageCommand, /Platform\?\.isMobile/);
});

test("stable Work embeds delegate to the organized Work views", () => {
  const delegates = new Map([
    ["98-System/02-embed/04-viz/daily-work.md", "98-System/04-view/work/daily_work"],
    ["98-System/02-embed/04-viz/work-visualiser.md", "98-System/04-view/work/monthly_work"],
    ["98-System/02-embed/04-viz/work-summary.md", "98-System/04-view/work/work_summary"],
  ]);

  for (const [embed, view] of delegates) {
    const source = read(embed);
    assert.match(source, new RegExp(`await dv\\.view\\("${view.replaceAll("/", "\\/")}"\\)`));
    compileDvjs(embed);
  }
});

test("shared Work summary targets the Monthly Note month when embedded there", () => {
  const summary = read("98-System/04-view/work/work_summary.js");
  const monthly = read("98-System/04-view/work/monthly_work.js");

  assert.match(summary, /isMonthlyNote = \/\^\\d\{4\}-\\d\{2\}\$\//);
  assert.match(summary, /const page = isMonthlyNote[\s\S]*?\? current[\s\S]*?: dv\.page/);
  assert.doesNotMatch(monthly, /work-time-summary/);
});

test("organized Work views compile and load the shared Work library", () => {
  for (const view of [
    "98-System/04-view/work/daily_work.js",
    "98-System/04-view/work/monthly_work.js",
    "98-System/04-view/work/work_summary.js",
  ]) {
    const source = read(view);
    assert.match(source, /98-System\/05-lib\/shared\/view_utils\.js/);
    assert.match(source, /98-System\/05-lib\/work\/work_time_utils\.js/);
    compileView(view);
  }
});

test("work-time CSS is delivered by the enabled Core bundle", () => {
  const convergence = fs.existsSync(path.join(root, ACTIVATION_CONVERGENCE_MARKER));
  const appearance = JSON.parse(read(".obsidian/appearance.json"));
  const css = read(".obsidian/snippets/obsidian-core.css");

  if (convergence) {
    assert.equal(appearance.enabledCssSnippets.includes("obsidian-core"), false);
    assert.equal(appearance.enabledCssSnippets.includes("work-time"), true);
  } else {
    assert.ok(appearance.enabledCssSnippets.includes("obsidian-core"));
    assert.equal(appearance.enabledCssSnippets.includes("work-time"), false);
  }

  assert.match(css, /\.work-time-daily/);
  assert.match(css, /\.work-time-monthly/);
  assert.match(css, /\.work-time-dashboard/);
  assert.match(css, /\.work-time-table/);
  assert.match(css, /@media \(max-width: 600px\)/);
});

test("cancelled or unsafe Workplace input never modifies the Monthly Note", async () => {
  for (const workplaceInput of ["", "bad]", null]) {
    const env = makeWorkApp();
    const original = env.stored();
    const prompts = ["", "1:00", workplaceInput];
    const notices = [];

    const result = await addWork({
      app: env.app,
      moment: makeMoment(),
      Notice: class Notice {
        constructor(message) { notices.push(String(message)); }
      },
      quickAddApi: {
        inputPrompt: async () => prompts.shift(),
        suggester: async () => { throw new Error("unexpected_suggester"); }
      }
    });

    assert.equal(result, null);
    assert.equal(env.stored(), original);
    if (workplaceInput !== null) {
      assert.match(notices.at(-1), /勤務先名が不正/);
    }
  }
});

function fakeElement(tag, attributes = {}) {
  const element = {
    tag,
    text: attributes.text ?? null,
    children: [],
    classList: { add() {} },
    createEl(childTag, opts = {}) {
      const child = fakeElement(childTag, opts);
      this.children.push(child);
      return child;
    }
  };
  return element;
}

function allElements(element) {
  return [element, ...element.children.flatMap(allElements)];
}

function findElements(rootElement, tag) {
  return allElements(rootElement).filter(element => element.tag === tag);
}

function readText(rootElement) {
  return allElements(rootElement).map(element => element.text).filter(value => value !== null);
}

async function renderWorkView(relativePath, currentPage, monthlyPage) {
  const source = read(relativePath);
  const rootElement = fakeElement("root");
  const mockDataview = {
    container: rootElement,
    current: () => currentPage,
    page: () => monthlyPage,
    io: { load: async filePath => read(filePath) }
  };
  const render = new Function(
    "dv", "moment",
    '"use strict"; return (async function () {\n' + source + '\n})()'
  );
  await render(mockDataview, makeMoment());
  return rootElement;
}

test("Dashboard shows the all-Workplace total, while Monthly Note shows each Workplace", async () => {
  const monthlyPage = { file: { name: "2026-09", lists: multipleWorkplaceRecords() } };
  const summaryView = "98-System/04-view/work/work_summary.js";
  const monthlyView = "98-System/04-view/work/monthly_work.js";

  const dashboard = await renderWorkView(summaryView, { file: { name: "Dashboard" } }, monthlyPage);
  const dashboardText = readText(dashboard);
  assert.ok(dashboardText.includes("今月の勤務日数: 2日"));
  assert.ok(dashboardText.includes("今月の合計勤務時間: 12h 45m"));
  assert.equal(findElements(dashboard, "table").length, 0);

  const monthly = await renderWorkView(summaryView, monthlyPage, null);
  const monthlyText = readText(monthly);
  assert.ok(monthlyText.includes("勤務日数: 2日"));
  assert.ok(monthlyText.includes("合計勤務時間: 12h 45m"));
  assert.ok(monthlyText.includes("勤務先別の勤務時間"));

  const summaryTable = findElements(monthly, "tbody")[0];
  assert.deepEqual(summaryTable.children.map(row => row.children.map(cell => cell.text)), [
    ["composition", "2日", "9h"],
    ["lab", "2日", "3h 30m"],
    ["未指定", "1日", "15m"]
  ]);

  const detail = await renderWorkView(monthlyView, monthlyPage, null);
  const headers = findElements(detail, "th").map(cell => cell.text);
  assert.deepEqual(headers, ["勤務日", "勤務先", "勤務時間"]);
  const detailRows = findElements(detail, "tbody")[0].children;
  assert.equal(detailRows.length, 5);
  assert.deepEqual(detailRows[0].children.map(cell => cell.text), [
    "2026-09-14", "composition", "8h"
  ]);
});

test("Work summary reports a missing Monthly Note without crashing", async () => {
  const dashboard = await renderWorkView(
    "98-System/04-view/work/work_summary.js",
    { file: { name: "Dashboard" } },
    null
  );
  assert.ok(readText(dashboard).some(text => text.includes("Monthly Noteが見つかりません")));
  assert.equal(findElements(dashboard, "table").length, 0);
});

test("Daily Note sums records across Workplaces on the selected day", async () => {
  const monthlyPage = { file: { name: "2026-09", lists: multipleWorkplaceRecords() } };
  const daily = await renderWorkView(
    "98-System/04-view/work/daily_work.js",
    { file: { name: "2026-09-14" } },
    monthlyPage
  );
  const text = readText(daily);
  assert.ok(text.includes("勤務時間: 9h 30m"));
  assert.ok(text.includes("3件の記録を合算しています．"));
});

test("Workplace registry persists user settings outside managed Core and rejects duplicates", async () => {
  const env = makeWorkApp();
  assert.equal(registry.REGISTRY_PATH, "96-Global/01-workplace/workplaces.json");
  assert.deepEqual(await registry.readRegistry(env.app), registry.emptyRegistry());
  const first = await registry.registerWorkplace(env.app, "composition");
  assert.deepEqual(first, { name: "composition", created: true, default_workplace: "composition" });
  assert.deepEqual(JSON.parse(env.registryStored()), {
    schema_version: 1, workplaces: ["composition"], default_workplace: "composition"
  });

  const second = await registry.registerWorkplace(env.app, "lab");
  assert.deepEqual(second, { name: "lab", created: true, default_workplace: "composition" });
  const unchanged = env.registryStored();
  const duplicate = await registry.registerWorkplace(env.app, " LAB ");
  assert.deepEqual(duplicate, { name: "lab", created: false, default_workplace: "composition" });
  assert.equal(env.registryStored(), unchanged);

  assert.deepEqual(await registry.setDefaultWorkplace(env.app, "lab"), {
    default_workplace: "lab"
  });
  assert.equal((await registry.readRegistry(env.app)).default_workplace, "lab");
  await registry.setDefaultWorkplace(env.app, null);
  assert.equal((await registry.readRegistry(env.app)).default_workplace, null);
  const before = env.registryStored();
  await assert.rejects(registry.setDefaultWorkplace(env.app, "unknown"), /登録済み/);
  await assert.rejects(registry.registerWorkplace(env.app, "lab]"), /不正/);
  await assert.rejects(registry.registerWorkplace(env.app, "未指定"), /不正/);
  assert.equal(env.registryStored(), before);
});

test("malformed, future or conflicting Workplace settings fail closed", async () => {
  const env = makeWorkApp();
  await registry.registerWorkplace(env.app, "composition");
  for (const bad of [
    "{not json",
    JSON.stringify({ schema_version: 2, workplaces: [], default_workplace: null }),
    JSON.stringify({ schema_version: 1, workplaces: ["Lab", "lab"], default_workplace: "Lab" }),
    JSON.stringify({ schema_version: 1, workplaces: ["composition"], default_workplace: "missing" }),
    JSON.stringify({ schema_version: 1, workplaces: ["bad]"], default_workplace: null })
  ]) {
    env.replaceRegistry(bad);
    await assert.rejects(registry.readRegistry(env.app));
    await assert.rejects(registry.registerWorkplace(env.app, "new"));
    assert.equal(env.registryStored(), bad);
  }
});

test("Work: Add lists registered Workplaces with the current default first", async () => {
  const env = makeWorkApp();
  await registry.registerWorkplace(env.app, "composition");
  await registry.registerWorkplace(env.app, "lab", true);
  const prompts = ["", "2:30"];
  const displayed = [];
  const result = await addWork({
    app: env.app,
    moment: makeMoment(),
    quickAddApi: {
      inputPrompt: async () => prompts.shift(),
      suggester: async (labels, values) => {
        displayed.push([...labels]);
        return values[1]; // composition instead of default lab
      }
    }
  });
  assert.equal(result.workplace, "composition");
  assert.equal(prompts.length, 0);
  assert.match(env.stored(), /\[workplace:: composition\] \[work_min:: 150\]/);
  assert.deepEqual(displayed, [[
    "★ lab (デフォルト)", "composition", "＋ 新しい勤務先を登録"
  ]]);
  assert.equal((await registry.readRegistry(env.app)).default_workplace, "lab");
});

test("Work: Add can register a new Workplace and optionally set it as default", async () => {
  const env = makeWorkApp();
  await registry.registerWorkplace(env.app, "composition");
  const prompts = ["", "1:15", "seminar"];
  let selections = 0;
  const result = await addWork({
    app: env.app, moment: makeMoment(),
    quickAddApi: {
      inputPrompt: async () => prompts.shift(),
      suggester: async (_labels, values) =>
        ++selections === 1 ? values.at(-1) : true
    }
  });
  assert.equal(result.workplace, "seminar");
  assert.equal((await registry.readRegistry(env.app)).default_workplace, "seminar");
  assert.deepEqual((await registry.readRegistry(env.app)).workplaces, ["composition", "seminar"]);
  assert.match(env.stored(), /\[workplace:: seminar\] \[work_min:: 75\]/);
});

test("Work: Manage registers new names and can change or clear the default", async () => {
  const env = makeWorkApp();
  const prompts = ["composition", "lab"];
  let choices = ["register", "register", "default", "clear"];
  let registerDefaultAnswers = [false];
  const api = {
    inputPrompt: async () => prompts.shift(),
    suggester: async (_labels, values) => {
      if (typeof values[0] === "boolean") return registerDefaultAnswers.shift();
      if (typeof values[0] === "string") return values[1]; // select lab for default
      const action = choices.shift();
      return values.find(value => value.type === action);
    }
  };
  const context = { app: env.app, quickAddApi: api };
  assert.deepEqual(await manageWorkplaces(context), {
    operation: "register", workplace: "composition"
  });
  assert.deepEqual(await manageWorkplaces(context), {
    operation: "register", workplace: "lab"
  });
  assert.equal((await registry.readRegistry(env.app)).default_workplace, "composition");
  assert.deepEqual(await manageWorkplaces(context), {
    operation: "default", workplace: "lab"
  });
  assert.equal((await registry.readRegistry(env.app)).default_workplace, "lab");
  assert.deepEqual(await manageWorkplaces(context), {
    operation: "clear", workplace: null
  });
  assert.equal((await registry.readRegistry(env.app)).default_workplace, null);
});

test("cancelled selection or default changes never update stored Workplace data", async () => {
  const env = makeWorkApp();
  await registry.registerWorkplace(env.app, "composition");
  const currentRegistry = env.registryStored();
  const currentMonthly = env.stored();
  const result = await addWork({
    app: env.app, moment: makeMoment(),
    quickAddApi: {
      inputPrompt: async () => "",
      suggester: async () => null
    }
  });
  assert.equal(result, null);
  assert.equal(env.registryStored(), currentRegistry);
  assert.equal(env.stored(), currentMonthly);
  const manage = await manageWorkplaces({
    app: env.app, quickAddApi: {
      inputPrompt: async () => { throw new Error("unexpected input"); },
      suggester: async () => null
    }
  });
  assert.equal(manage, null);
  assert.equal(env.registryStored(), currentRegistry);
});

test("malformed Workplace registry aborts Work: Add without modifying work records", async () => {
  const env = makeWorkApp(undefined, { registry: "{invalid" });
  const before = env.stored();
  const inputs = ["", "1:00"];
  await assert.rejects(addWork({
    app: env.app, moment: makeMoment(),
    quickAddApi: {
      inputPrompt: async () => inputs.shift(),
      suggester: async () => { throw new Error("should not open selection"); }
    }
  }), /Workplace設定ファイル/);
  assert.equal(env.stored(), before);
  assert.equal(env.registryStored(), "{invalid");
});

async function executeWorkTemplaterWrapper(commandPath, env, prompt, suggester) {
  const source = read(commandPath);
  const block = source.match(/^<%\*\n([\s\S]*?)\n-%>\s*$/);
  assert.ok(block, "expected one Templater command block");
  const runner = new Function("tp", "return (async function () {\n" + block[1] + "\n})()");
  await runner({
    app: env.app,
    obsidian: { Platform: { isMobile: true }, Notice: class Notice { constructor() {} } },
    system: { prompt, suggester },
    user: { add_work: () => { throw new Error("Mobile must not use tp.user"); },
      manage_workplaces: () => { throw new Error("Mobile must not use tp.user"); } }
  });
}

test("mobile Meta Bind command loaders can register and select Workplace via Vault API", async () => {
  const env = makeWorkApp();
  globalThis.window = { moment: makeMoment() };
  try {
    await executeWorkTemplaterWrapper(
      "98-System/00-command/manage_workplaces.md", env,
      async () => "composition",
      async (_labels, values) => values[0]
    );
    assert.equal((await registry.readRegistry(env.app)).default_workplace, "composition");

    const inputs = ["", "3:00"];
    await executeWorkTemplaterWrapper(
      "98-System/00-command/add_work.md", env,
      async () => inputs.shift(),
      async (_labels, values) => values[0]
    );
    assert.match(env.stored(), /\[workplace:: composition\] \[work_min:: 180\]/);
  } finally {
    delete globalThis.window;
  }
});

test("an intentionally cleared default remains cleared after registering another Workplace", async () => {
  const env = makeWorkApp();
  await registry.registerWorkplace(env.app, "composition");
  await registry.setDefaultWorkplace(env.app, null);
  await registry.registerWorkplace(env.app, "lab");
  assert.deepEqual(await registry.readRegistry(env.app), {
    schema_version: 1, workplaces: ["composition", "lab"], default_workplace: null
  });

  const prompts = ["", "1:00", "seminar"];
  let index = 0;
  const result = await addWork({
    app: env.app, moment: makeMoment(),
    quickAddApi: {
      inputPrompt: async () => prompts.shift(),
      suggester: async (_labels, values) => ++index === 1
        ? values.at(-1) : false
    }
  });
  assert.equal(result.workplace, "seminar");
  assert.equal((await registry.readRegistry(env.app)).default_workplace, null);
  assert.match(env.stored(), /\[workplace:: seminar\] \[work_min:: 60\]/);
});

test("cancelling a default change after registration action does not create the Workplace", async () => {
  const env = makeWorkApp();
  await registry.registerWorkplace(env.app, "composition");
  const previous = env.registryStored();
  const api = {
    inputPrompt: async () => "new",
    suggester: async (_labels, values) =>
      typeof values[0] === "boolean" ? null : values.find(value => value.type === "register")
  };
  assert.equal(await manageWorkplaces({ app: env.app, quickAddApi: api }), null);
  assert.equal(env.registryStored(), previous);
});

test("Templater desktop Work commands still use tp.user entrypoints", async () => {
  const sourcePaths = [
    ["98-System/00-command/add_work.md", "add_work"],
    ["98-System/00-command/manage_workplaces.md", "manage_workplaces"]
  ];
  for (const [file, userMethod] of sourcePaths) {
    const content = read(file);
    const block = content.match(/^<%\*\n([\s\S]*?)\n-%>\s*$/);
    assert.ok(block, "Templater block missing");
    const runner = new Function("tp", "return (async function () {\n" + block[1] + "\n})()");
    let called = 0;
    await runner({
      obsidian: { Platform: { isMobile: false } },
      user: { [userMethod]: async () => { called += 1; } }
    });
    assert.equal(called, 1);
  }
});

test("simultaneous first registrations converge on one user-owned settings file", async () => {
  const env = makeWorkApp();
  const results = await Promise.all([
    registry.registerWorkplace(env.app, "alpha"),
    registry.registerWorkplace(env.app, "beta"),
  ]);
  assert.equal(results.filter(result => result.created).length, 2);
  const stored = await registry.readRegistry(env.app);
  assert.deepEqual([...stored.workplaces].sort(), ["alpha", "beta"]);
  assert.ok(stored.workplaces.includes(stored.default_workplace));
  assert.equal(JSON.parse(env.registryStored()).schema_version, 1);
});

test("Workplace registry creates a 96-Global sibling without touching 00-subscription", async () => {
  const env = makeWorkApp();
  const subscriptionPath = "96-Global/00-subscription/Example.md";
  const originalSubscription = env.getDocument(subscriptionPath);
  assert.ok(originalSubscription);
  assert.equal(env.folderExists("96-Global"), true);
  assert.equal(env.folderExists("96-Global/00-subscription"), true);
  assert.equal(env.folderExists("96-Global/01-workplace"), false);

  await registry.registerWorkplace(env.app, "composition");
  assert.equal(env.folderExists("96-Global/01-workplace"), true);
  assert.deepEqual(JSON.parse(env.registryStored()), {
    schema_version: 1, workplaces: ["composition"], default_workplace: "composition"
  });
  assert.equal(env.getDocument(subscriptionPath), originalSubscription);
  assert.equal(env.getDocument("97-Settings/workplaces.json"), undefined);
  assert.equal(env.folderExists("97-Settings"), false);
});

test("an empty Vault can create the 96-Global/01-workplace folder chain", async () => {
  const env = makeWorkApp(undefined, { globalExists: false });
  assert.equal(env.folderExists("96-Global"), false);
  await registry.registerWorkplace(env.app, "lab");
  assert.equal(env.folderExists("96-Global"), true);
  assert.equal(env.folderExists("96-Global/01-workplace"), true);
  assert.equal((await registry.readRegistry(env.app)).default_workplace, "lab");
});
