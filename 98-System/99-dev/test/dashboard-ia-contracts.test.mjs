import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const dashboard = read("Dashboard.md");
const taskDashboard = read("98-System/02-embed/05-task/dashboard-tasks.md");

function section(title) {
  const start = dashboard.indexOf(`# ${title}\n`);
  assert.notEqual(start, -1, `missing Dashboard section: ${title}`);
  const next = dashboard.indexOf("\n# ", start + 1);
  return dashboard.slice(start, next === -1 ? undefined : next);
}

test("Dashboard top-level IA follows daily action -> tasks -> work/finance -> entities -> system", () => {
  assert.deepEqual([...dashboard.matchAll(/^# (.+)$/gm)].map(match => match[1]), [
    "Today",
    "Tasks",
    "Work & Finance",
    "🔥 High Priority Projects",
    "Workspaces",
    "📝 Recent knowledges",
  ]);

  const indexes = [
    dashboard.indexOf("# Today"),
    dashboard.indexOf("# Tasks"),
    dashboard.indexOf("# Work & Finance"),
    dashboard.indexOf("# 🔥 High Priority Projects"),
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

test("Task IA keeps actionable Focus before lower-urgency Planning", () => {
  const tasks = section("Tasks");
  assert.match(tasks, /\[\[98-System\/02-embed\/05-task\/dashboard-tasks\|dashboard-tasks\]\]/);
  assert.match(tasks, /\[\[dashboard-task-buttons\]\]/);

  const focus = taskDashboard.indexOf("## Focus");
  const planning = taskDashboard.indexOf("## Planning");
  assert.ok(focus >= 0);
  assert.ok(planning > focus);

  const focusSource = taskDashboard.slice(focus, planning);
  for (const embed of ["overdue", "today", "primary"]) {
    assert.match(focusSource, new RegExp(`\\[\\[${embed}\\]\\]`));
  }

  const planningSource = taskDashboard.slice(planning);
  const expected = [
    "next-7-days",
    "next-30-days",
    "later",
    "inbox",
    "weekly-review",
    "recurring-tasks",
  ];
  let previous = -1;
  for (const embed of expected) {
    const index = planningSource.indexOf(`[[${embed}]]`);
    assert.ok(index > previous, `${embed} must remain in Planning order`);
    previous = index;
  }
});

test("Work & Finance keeps work, budget, and subscriptions adjacent", () => {
  const finance = section("Work & Finance");
  const expected = [
    "[[work-summary]]",
    "[[budget-visualiser]]",
    "[[dashboard-subscription-buttons]]",
    "[[subscription-table]]",
  ];
  let previous = -1;
  for (const embed of expected) {
    const index = finance.indexOf(embed);
    assert.ok(index > previous, `${embed} must remain in Work & Finance order`);
    previous = index;
  }
});

test("System is de-emphasized as the final collapsed Dashboard block", () => {
  assert.doesNotMatch(dashboard, /^# System$/m);
  assert.match(dashboard, /> \[!info\]- System\n> ```meta-bind-embed\n> \[\[dashboard-system-buttons\]\]\n> ```\s*$/);
});
