import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const dashboardRoot = read("Dashboard.md");
const fragmentPaths = [
  "98-System/02-embed/dashboard/today.md",
  "98-System/02-embed/dashboard/tasks.md",
  "98-System/02-embed/dashboard/work-finance.md",
  "98-System/02-embed/dashboard/workspaces.md",
  "98-System/02-embed/dashboard/recent-knowledge.md",
  "98-System/02-embed/dashboard/system.md",
];
const dashboard = fragmentPaths.map(read).join("\n");
const taskDashboard = read("98-System/02-embed/dashboard/task-focus-planning.md");

function section(title) {
  const start = dashboard.indexOf(`# ${title}\n`);
  assert.notEqual(start, -1, `missing Dashboard section: ${title}`);
  const next = dashboard.indexOf("\n# ", start + 1);
  return dashboard.slice(start, next === -1 ? undefined : next);
}

test("Dashboard root is a thin ordered composition of focused fragments", () => {
  const targets = [...dashboardRoot.matchAll(/\[\[([^\]]+)\]\]/g)].map(match => match[1]);
  assert.deepEqual(targets, [
    "98-System/02-embed/dashboard/today|dashboard-today",
    "98-System/02-embed/dashboard/tasks|dashboard-tasks-section",
    "98-System/02-embed/dashboard/work-finance|dashboard-work-finance",
    "98-System/02-embed/dashboard/workspaces|dashboard-workspaces",
    "98-System/02-embed/dashboard/recent-knowledge|dashboard-recent-knowledge",
    "98-System/02-embed/dashboard/system|dashboard-system",
  ]);
  assert.equal((dashboardRoot.match(/```meta-bind-embed/g) ?? []).length, 6);
  assert.doesNotMatch(dashboardRoot, /^# /m);
  assert.doesNotMatch(dashboardRoot, /high-priority-projects/);
});

test("Dashboard top-level IA follows Today -> Tasks -> Work/Finance -> Workspaces -> Knowledge -> System", () => {
  assert.deepEqual([...dashboard.matchAll(/^# (.+)$/gm)].map(match => match[1]), [
    "Today",
    "Tasks",
    "Work & Finance",
    "Workspaces",
    "📝 Recent knowledges",
  ]);

  const indexes = [
    dashboard.indexOf("# Today"),
    dashboard.indexOf("# Tasks"),
    dashboard.indexOf("# Work & Finance"),
    dashboard.indexOf("# Workspaces"),
    dashboard.indexOf("# 📝 Recent knowledges"),
    dashboard.indexOf("> [!info]- System"),
  ];
  assert.ok(indexes.every((value, index) => index === 0 || value > indexes[index - 1]));
});

test("Today surfaces the current date and frequent Daily/Monthly/Work actions", () => {
  const today = section("Today");
  assert.match(today, /dateformat\(date\(today\),\s*"yyyy-MM-dd ccc"\)/);
  assert.match(today, /\[\[dashboard-periodic-buttons\]\]/);
  assert.match(today, /\[\[work-buttons\]\]/);
});

test("Task Dashboard keeps only actionable Focus and navigation/actions", () => {
  const tasks = section("Tasks");
  assert.match(tasks, /98-System\/02-embed\/dashboard\/task-focus-planning/);
  assert.match(tasks, /\[\[dashboard-task-buttons\]\]/);

  assert.match(taskDashboard, /^## Focus$/m);
  for (const embed of ["overdue", "today", "primary"]) {
    assert.match(taskDashboard, new RegExp(`\\[\\[${embed}\\]\\]`));
  }

  assert.doesNotMatch(taskDashboard, /^## Planning$/m);
  for (const detail of [
    "next-7-days",
    "next-30-days",
    "later",
    "inbox",
    "weekly-review",
    "recurring-tasks",
  ]) {
    assert.doesNotMatch(taskDashboard, new RegExp(`\\[\\[${detail}\\]\\]`));
  }
});

test("Work & Finance keeps summaries and actions but omits Subscription detail table", () => {
  const finance = section("Work & Finance");
  const expected = [
    "[[work-summary]]",
    "[[budget-visualiser]]",
    "[[dashboard-subscription-buttons]]",
  ];
  let previous = -1;
  for (const embed of expected) {
    const index = finance.indexOf(embed);
    assert.ok(index > previous, `${embed} must remain in Work & Finance order`);
    previous = index;
  }
  assert.doesNotMatch(finance, /\[\[subscription-table\]\]/);
});

test("Dashboard omits detail-heavy High Priority and planning surfaces", () => {
  assert.doesNotMatch(dashboardRoot, /high-priority-projects/);
  assert.equal(
    fs.existsSync(path.join(root, "98-System/02-embed/dashboard/high-priority-projects.md")),
    false
  );
  assert.doesNotMatch(dashboard, /\[\[high-priority-project-table\]\]/);
  assert.doesNotMatch(dashboard, /\[\[subscription-table\]\]/);
});

test("System is de-emphasized as the final collapsed Dashboard block", () => {
  assert.doesNotMatch(dashboard, /^# System$/m);
  assert.match(dashboard, /> \[!info\]- System\n> \`\`\`meta-bind-embed\n> \[\[dashboard-system-buttons\]\]\n> \`\`\`\s*$/);
});
