import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { LEGACY_SNIPPETS, SOURCES, OUTPUT, buildCss, checkBundle, checkActivation, readSource } from "../tools/build-styles.mjs";
const root = process.cwd();
const read = p => fs.readFileSync(path.join(root, p), "utf8");

test("committed bundle is current and legacy inputs are not also enabled", () => {
  assert.equal(checkBundle(root), true); checkActivation(root);
  const css = read(OUTPUT);
  for (const source of SOURCES) assert.ok(css.includes(readSource(root, source)));
  for (const name of LEGACY_SNIPPETS) assert.ok(css.includes(`SOURCE: .obsidian/snippets/${name}.css`));
});
test("existing metadata column counts and containment survive bundling", () => {
  const css = buildCss(root);
  for (const count of [2, 3, 4, 5]) assert.ok(css.includes(`repeat(${count}, minmax(0, 1fr))`));
  assert.match(css, /white-space: normal/); assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /\.household-stacked-segment/); assert.match(css, /\.work-time-table/);
});
test("design modules use scoped selectors, no remote assets or global prose typography", () => {
  const css = ["tokens", "components", "adapters"].map(name => read(`98-System/99-dev/styles/${name}.css`)).join("\n");
  assert.match(css, /body\.theme-dark/); assert.match(css, /--oc-surface: var\(--background-secondary/);
  assert.match(css, /:focus-visible/); assert.match(css, /:disabled/);
  assert.match(css, /prefers-reduced-motion: reduce/); assert.match(css, /pointer: coarse/);
  assert.doesNotMatch(css, /@import|url\(|@font-face|position:\s*fixed/);
  assert.doesNotMatch(css, /(?:^|\n)(?:button|table|input|\*)\s*\{/);
  const adapters = read("98-System/99-dev/styles/adapters.css");
  assert.doesNotMatch(adapters, /\.household-stacked-segment\s*\{/);
});
test("Dashboard actions opt into common styling without replacing their commands", () => {
  const files = ["dashboard-task-buttons", "dashboard-periodic-buttons", "dashboard-workspace-buttons", "dashboard-knowledge-buttons", "dashboard-subscription-buttons", "dashboard-system-buttons", "work-buttons"];
  let count = 0;
  for (const name of files) {
    const source = read(`98-System/02-embed/01-button/${name}.md`);
    for (const match of source.matchAll(/^```meta-bind-button\n([\s\S]*?)\n```$/gm)) {
      assert.match(match[1], /^class: oc-action$/m); count += 1;
    }
  }
  assert.equal(count, 13);
});
function luminance(hex) {
  const channels = hex.match(/[a-f0-9]{2}/gi).map(x => parseInt(x, 16) / 255)
    .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a, b) { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); }
test("all repository-owned action buttons opt into the shared Core button contract", () => {
  const contracts = [
    ["98-System/02-embed/00-meta/task-note-meta.md", ["task-select-context", "task-reschedule", "task-add-dependency", "task-add-child", "task-remove-dependency"]],
    ["98-System/02-embed/01-button/project-buttons.md", ["create-project-note"]],
    ["98-System/02-embed/01-button/task-note-button.md", ["task-add-dependency"]],
    ["98-System/02-embed/01-button/workspace-buttons.md", ["create-workspace-note", "open-project-hub", "create-workspace-project"]],
    ["98-System/02-embed/01-button/task-group-button.md", ["task-select-context"]],
    ["98-System/02-embed/01-button/project-system-buttons.md", ["rename-project"]],
    ["98-System/02-embed/01-button/workspace-system-buttons.md", ["rename-workspace"]],
    ["98-System/02-embed/01-button/knowledge-promotion-button.md", ["promote-to-knowledge"]],
  ];
  for (const [relative, ids] of contracts) {
    const source = read(relative);
    const blocks = [...source.matchAll(/^```meta-bind-button\n([\s\S]*?)\n```$/gm)].map(match => match[1]);
    for (const id of ids) {
      const block = blocks.find(candidate => new RegExp("^id: [\\\"\']?" + id + "[\\\"\']?$", "m").test(candidate));
      assert.ok(block, "missing button contract for " + id + " in " + relative);
      assert.match(block, /^class: oc-action$/m);
    }
  }
  const daily = read("98-System/03-template/01-note/daily-note-template.md");
  const monthlyButton = [...daily.matchAll(/^```meta-bind-button\n([\s\S]*?)\n```$/gm)]
    .map(match => match[1]).find(block => /^label: ["\']?Monthly note["\']?$/m.test(block));
  assert.ok(monthlyButton);
  assert.match(monthlyButton, /^class: oc-action$/m);
});
test("dynamic view buttons use Core primitives and Meta Bind variants remain semantic", () => {
  const components = read("98-System/99-dev/styles/components.css");
  assert.match(components, /\.mb-button\.oc-action > button\.mod-cta/);
  assert.match(components, /\.mb-button\.oc-action > button\.mod-warning/);
  assert.match(components, /\.mb-button\.oc-action > button\.mod-plain/);
  assert.doesNotMatch(components, /\.oc-button--primary,\s*\n\.mb-button\.oc-action > button\s*\{/);
  const tasks = read("98-System/04-view/tasks/task_table.js");
  assert.match(tasks, /button\.classList\.add\("oc-button"\)/);
  const finance = read("98-System/04-view/finance/budget_visualiser.js");
  assert.match(finance, /cls: "oc-button"/);
  assert.match(finance, /cls: "household-open-note-button oc-button oc-button--primary"/);
});
test("fixed dark token text/accent pairs meet the configured 4.5 contrast target", () => {
  const tokens = read("98-System/99-dev/styles/tokens.css");
  for (const [front, back] of [["c0caf5", "24283b"], ["a9b1d6", "24283b"], ["1a1b26", "7aa2f7"]]) {
    assert.ok(tokens.includes(`#${front}`) && tokens.includes(`#${back}`)); assert.ok(contrast(front, back) >= 4.5);
  }
});
