import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const buttonRoot = "98-System/02-embed/01-button";
const convergenceMarkerPath = "98-System/99-dev/design/core-promotion-convergence.json";
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const dashboard = read("Dashboard.md");
const convergence = fs.existsSync(path.join(root, convergenceMarkerPath))
  ? JSON.parse(read(convergenceMarkerPath))
  : null;
const convergencePaths = new Set(Object.keys(convergence?.observed_live_sha256 ?? {}));
const groups = [
  ["Tasks", "dashboard-task-buttons", ["open-task-backlog", "create-recurring-task", "generate-recurring-tasks"]],
  ["Periodic notes", "dashboard-periodic-buttons", ["open-daily-note", "open-monthly-note"]],
  ["Workspaces", "dashboard-workspace-buttons", ["create-workspace"]],
  ["📝 Recent knowledges", "dashboard-knowledge-buttons", ["create-knowledge", "open-knowledge-hub"]],
  ["Subscriptions", "dashboard-subscription-buttons", ["sync-subscriptions", "create-subscription"]],
  ["System", "dashboard-system-buttons", ["system-doctor-safe-fix"]],
];

function definitions(source) {
  return [...source.matchAll(/^```meta-bind-button\n([\s\S]*?)\n```$/gm)].map(match => {
    const id = match[1].match(/^id: "?([^"\n]+)"?$/m)?.[1];
    assert.ok(id, "every button definition has an ID");
    return { id, yaml: match[1] };
  });
}

function displayedIds(source) {
  return [...source.matchAll(/`BUTTON\[([^\]]+)\]`/g)]
    .flatMap(match => match[1].split(",").map(value => value.trim()));
}

function section(title) {
  const start = dashboard.indexOf(`# ${title}\n`);
  assert.notEqual(start, -1);
  const next = dashboard.indexOf("\n# ", start + 1);
  return dashboard.slice(start, next === -1 ? undefined : next);
}

function embedPath(name) {
  return `${buttonRoot}/${name}.md`;
}

function isConverging(name) {
  return convergencePaths.has(embedPath(name));
}

for (const [title, name, ids] of groups) {
  test(`${title}: button embed is self-contained like Add work`, () => {
    const source = read(embedPath(name));
    assert.ok(section(title).includes(`\`\`\`meta-bind-embed\n[[${name}]]\n\`\`\``));
    assert.equal(dashboard.split(`[[${name}]]`).length - 1, 1);
    assert.deepEqual(definitions(source).map(button => button.id), ids);
    assert.deepEqual(displayedIds(source), ids);
    assert.equal(new Set(ids).size, ids.length);
    for (const button of definitions(source)) {
      if (!isConverging(name)) {
        assert.match(button.yaml, /^style: primary$/m);
        assert.match(button.yaml, /^class: oc-action$/m);
      }
      assert.match(button.yaml, /^hidden: true$/m);
      assert.match(button.yaml, /^icon: .+$/m);
      assert.match(button.yaml, /^label: .+$/m);
      assert.equal([...button.yaml.matchAll(/^actions?:/gm)].length, 1);
    }
    // No cross-file button registration, new script engine, or nested embeds.
    assert.doesNotMatch(source, /meta-bind-embed|inlineJS|type: (?:js|commandPalette)/);
  });
}

test("new embeds preserve every legacy action, ID, label, and icon outside explicit convergence paths", () => {
  const legacy = definitions(read(`${buttonRoot}/dashboard-buttons.md`));
  const oldById = new Map(legacy.map(button => [button.id, button.yaml]));
  const currentIds = [];
  for (const [, name] of groups) {
    const current = definitions(read(embedPath(name)));
    currentIds.push(...current.map(button => button.id));
    if (isConverging(name)) continue;
    for (const button of current) {
      assert.match(button.yaml, /^class: oc-action$/m);
      assert.equal(button.yaml.replace(/^class: oc-action\n/m, ""), oldById.get(button.id).replace(/^style: default$/m, "style: primary"));
    }
  }
  assert.equal(legacy.length, 11);
  assert.equal(currentIds.length, 11);
  assert.deepEqual(currentIds.sort(), legacy.map(button => button.id).sort());
});

test("temporary promotion convergence files equal the exact human-observed Live SHA-256 values", () => {
  if (!convergence) return;
  assert.equal(convergence.mode, "live-vault-promotion-convergence");
  for (const [relativePath, expected] of Object.entries(convergence.observed_live_sha256)) {
    const actual = crypto.createHash("sha256").update(fs.readFileSync(path.join(root, relativePath))).digest("hex");
    assert.equal(actual, expected, relativePath);
  }
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

test("Add work keeps its existing renderer and Templater command", () => {
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
