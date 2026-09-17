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
  assert.equal(count, 12);
});
function luminance(hex) {
  const channels = hex.match(/[a-f0-9]{2}/gi).map(x => parseInt(x, 16) / 255)
    .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a, b) { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); }
test("fixed dark token text/accent pairs meet the configured 4.5 contrast target", () => {
  const tokens = read("98-System/99-dev/styles/tokens.css");
  for (const [front, back] of [["c0caf5", "24283b"], ["a9b1d6", "24283b"], ["1a1b26", "7aa2f7"]]) {
    assert.ok(tokens.includes(`#${front}`) && tokens.includes(`#${back}`)); assert.ok(contrast(front, back) >= 4.5);
  }
});
