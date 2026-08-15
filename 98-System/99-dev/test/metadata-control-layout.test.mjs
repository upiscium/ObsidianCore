import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const cssPath = ".obsidian/snippets/task-controls.css";
const css = fs.readFileSync(path.join(root, cssPath), "utf8");

test("metadata control grids keep explicit two through five column layouts", () => {
  assert.match(css, /note-lifecycle-button\) \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /workspace-lifecycle-button\) \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /task-status-button[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /knowledge-maturity-button\) \{[\s\S]*?grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
});

test("metadata button labels stay inside their grid cells", () => {
  assert.doesNotMatch(css, /white-space:\s*nowrap/);
  assert.match(css, /font-size:\s*0\.9em/);
  assert.match(css, /white-space:\s*normal/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /overflow:\s*hidden/);
  assert.match(css, /height:\s*auto/);
  assert.match(css, /min-height:\s*2rem/);
});

test("overflow protection applies to every horizontal metadata button class", () => {
  for (const className of [
    "note-lifecycle-button",
    "workspace-lifecycle-button",
    "task-status-button",
    "task-priority-button",
    "entity-priority-button",
    "project-status-button",
    "knowledge-status-button",
    "knowledge-maturity-button"
  ]) {
    assert.match(css, new RegExp(`\\.${className}`));
  }
  assert.doesNotMatch(css, /\.entity-status-button/);
});
