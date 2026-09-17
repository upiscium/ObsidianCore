import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const buttonRoot = "98-System/02-embed/01-button";
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const dashboard = read("Dashboard.md");
const groups = [
  ["Tasks", "dashboard-task-buttons", ["open-task-backlog", "create-recurring-task", "generate-recurring-tasks"]],
  ["Periodic notes", "dashboard-periodic-buttons", ["open-daily-note", "open-monthly-note"]],
  ["Workspaces", "dashboard-workspace-buttons", ["create-workspace"]],
  ["📝 Recent knowledges", "dashboard-knowledge-buttons", ["create-knowledge", "open-knowledge-hub"]],
  ["Subscriptions", "dashboard-subscription-buttons", ["sync-subscriptions", "create-subscription"]],
  ["System", "dashboard-system-buttons", ["system-doctor-safe-fix"]],
];
const expectedStyles = new Map([
  ["open-task-backlog", "default"],
  ["create-recurring-task", "primary"],
  ["generate-recurring-tasks", "primary"],
  ["open-daily-note", "default"],
  ["open-monthly-note", "default"],
  ["create-workspace", "primary"],
  ["create-knowledge", "primary"],
  ["open-knowledge-hub", "default"],
  ["sync-subscriptions", "primary"],
  ["create-subscription", "primary"],
  ["system-doctor-safe-fix", "default"],
]);

function definitions(source) {
  return [...source.matchAll(/^```meta-bind-button\n([\s\S]*?)\n```$/gm)].map(match => {
    const id = match[1].match(/^id: "?([^"\n]+)"?$/m)?.[1];
    assert.ok(id, "every button definition has an ID");
    return { id, yaml: match[1] };
  });
}

function displayGroups(source) {
  return [...source.matchAll(/`BUTTON\[([^\]]+)\]`/g)]
    .map(match => match[1].split(",").map(value => value.trim()));
}

function displayedIds(source) {
  return displayGroups(source).flat();
}

function section(title) {
  const start = dashboard.indexOf(`# ${title}\n`);
  assert.notEqual(start, -1);
  const next = dashboard.indexOf("\n# ", start + 1);
  return dashboard.slice(start, next === -1 ? undefined : next);
}

function stripPresentation(yaml) {
  return yaml
    .replace(/^style: .+\n/m, "")
    .replace(/^class: oc-action\n/m, "");
}

for (const [title, name, ids] of groups) {
  test(`${title}: button embed is self-contained and uses the reviewed action hierarchy`, () => {
    const source = read(`${buttonRoot}/${name}.md`);
    assert.ok(section(title).includes(`\`\`\`meta-bind-embed\n[[${name}]]\n\`\`\``));
    assert.equal(dashboard.split(`[[${name}]]`).length - 1, 1);
    assert.deepEqual(definitions(source).map(button => button.id), ids);
    assert.deepEqual(displayedIds(source), ids);
    assert.equal(new Set(ids).size, ids.length);
    for (const button of definitions(source)) {
      assert.match(button.yaml, new RegExp(`^style: ${expectedStyles.get(button.id)}$`, "m"));
      assert.match(button.yaml, /^class: oc-action$/m);
      assert.match(button.yaml, /^hidden: true$/m);
      assert.match(button.yaml, /^icon: .+$/m);
      assert.match(button.yaml, /^label: .+$/m);
      assert.equal([...button.yaml.matchAll(/^actions?:/gm)].length, 1);
    }
    assert.doesNotMatch(source, /meta-bind-embed|inlineJS|type: (?:js|commandPalette)/);
  });
}

test("paired Dashboard controls render as single Meta Bind button groups", () => {
  const expectedPairs = [
    ["dashboard-task-buttons", ["create-recurring-task", "generate-recurring-tasks"]],
    ["dashboard-periodic-buttons", ["open-daily-note", "open-monthly-note"]],
    ["dashboard-knowledge-buttons", ["create-knowledge", "open-knowledge-hub"]],
    ["dashboard-subscription-buttons", ["sync-subscriptions", "create-subscription"]],
  ];

  for (const [name, pair] of expectedPairs) {
    const renderedGroups = displayGroups(read(`${buttonRoot}/${name}.md`));
    assert.ok(
      renderedGroups.some(group => group.length === pair.length && group.every((id, index) => id === pair[index])),
      `${name} must render ${pair.join(", ")} as one BUTTON group`,
    );
  }
});

test("reviewed style hierarchy changes presentation only, not legacy actions or targets", () => {
  const legacy = definitions(read(`${buttonRoot}/dashboard-buttons.md`));
  const current = groups.flatMap(([, name]) => definitions(read(`${buttonRoot}/${name}.md`)));
  assert.equal(legacy.length, 11);
  assert.equal(current.length, 11);
  const oldById = new Map(legacy.map(button => [button.id, button.yaml]));
  for (const button of current) {
    assert.equal(stripPresentation(button.yaml), stripPresentation(oldById.get(button.id)));
  }
  assert.deepEqual(current.map(button => button.id).sort(), legacy.map(button => button.id).sort());
});

test("Dashboard no longer loads legacy definitions or direct inline BUTTON references", () => {
  assert.doesNotMatch(dashboard, /\[\[dashboard-buttons(?:\||\]\])/);
  assert.doesNotMatch(dashboard, /`BUTTON\[/);
  assert.doesNotMatch(dashboard, /^```meta-bind-button$/m);
});

test("all section controls including Add work appear exactly once and in the existing order", () => {
  const names = [...dashboard.matchAll(/^\[\[(dashboard-[a-z-]+-buttons|work-buttons)\]\]$/gm)]
    .map(match => match[1]);
  const ids = names.flatMap(name => displayedIds(read(`${buttonRoot}/${name}.md`)));
  assert.deepEqual(ids, [
    "open-task-backlog", "create-recurring-task", "generate-recurring-tasks",
    "open-daily-note", "open-monthly-note", "add-work", "create-workspace",
    "create-knowledge", "open-knowledge-hub", "sync-subscriptions", "create-subscription",
    "system-doctor-safe-fix",
  ]);
  assert.equal(new Set(ids).size, 12);
});

test("Add work keeps its existing primary action and Templater command", () => {
  const work = read(`${buttonRoot}/work-buttons.md`);
  assert.deepEqual(displayedIds(work), ["add-work"]);
  assert.equal(definitions(work).length, 1);
  assert.match(work, /^style: primary$/m);
  assert.match(work, /^class: oc-action$/m);
  assert.match(work, /^  templateFile: "98-System\/00-command\/add_work\.md"$/m);
  assert.ok(section("Work").includes("[[work-buttons]]"));
  assert.ok(section("Work").includes("[[work-summary]]"));
});

test("Dashboard keeps its existing sections and non-button views without new metadata", () => {
  assert.deepEqual([...dashboard.matchAll(/^# (.+)$/gm)].map(match => match[1]), [
    "Tasks", "Periodic notes", "Work", "Workspaces", "🔥 High Priority Projects",
    "📝 Recent knowledges", "💸 Budgets", "Subscriptions", "System",
  ]);
  const buttonNames = new Set([...groups.map(([, name]) => name), "work-buttons"]);
  const viewLinks = [...dashboard.matchAll(/^\[\[(.+)\]\]$/gm)]
    .map(match => match[1]).filter(link => !buttonNames.has(link));
  assert.deepEqual(viewLinks, [
    "98-System/02-embed/05-task/dashboard-tasks|dashboard-tasks", "work-summary",
    "workspace-table", "high-priority-project-table", "updated-knowledge-table",
    "budget-visualiser", "subscription-table",
  ]);
  assert.ok(dashboard.startsWith("# Tasks\n"));
});
