import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

const knowledgeMetaPath = "98-System/02-embed/00-meta/knowledge-meta.md";
const cssPath = ".obsidian/snippets/task-controls.css";

function buttonBlock(source, id) {
  const blocks = source.match(/```meta-bind-button\n[\s\S]*?```/g) ?? [];
  const block = blocks.find(item => item.includes(`id: ${id}\n`));
  assert.ok(block, `Missing Meta Bind button: ${id}`);
  return block;
}

test("Knowledge metadata UI exposes v2 status and maturity controls without mutating legacy values on open", () => {
  const controls = read(knowledgeMetaPath);

  assert.match(controls, /\*\*状態:\*\* `VIEW\[\{status\}\]\[text\]`/);
  assert.match(
    controls,
    /BUTTON\[knowledge-status-active, knowledge-status-outdated, knowledge-status-archived, knowledge-status-deleted\]/
  );
  assert.match(controls, /\*\*成熟度:\*\* `VIEW\[\{maturity\}\]\[text\]`/);
  assert.match(
    controls,
    /BUTTON\[knowledge-maturity-seed, knowledge-maturity-draft, knowledge-maturity-verified, knowledge-maturity-stable, knowledge-maturity-none\]/
  );

  assert.doesNotMatch(controls, /\[\[status-dropdown\]\]/);
  assert.doesNotMatch(controls, /\[\[knowledge-maturity-dropdown\]\]/);
  assert.match(controls, /\[\[knowledge-category-dropdown\]\]/);
  assert.match(controls, /\[\[knowledge-source-dropdown\]\]/);
});

test("Knowledge status buttons write only Knowledge v2 status values", () => {
  const controls = read(knowledgeMetaPath);
  const expected = {
    "knowledge-status-active": "active",
    "knowledge-status-outdated": "outdated",
    "knowledge-status-archived": "archived",
    "knowledge-status-deleted": "deleted"
  };

  for (const [id, value] of Object.entries(expected)) {
    const block = buttonBlock(controls, id);
    assert.match(block, /bindTarget: status/);
    assert.match(block, new RegExp(`value: ${value}(?:\\n|$)`));
    assert.match(block, /class: knowledge-status-button/);
  }
});

test("Knowledge maturity buttons write only Knowledge v2 maturity values", () => {
  const controls = read(knowledgeMetaPath);
  const expected = {
    "knowledge-maturity-seed": "seed",
    "knowledge-maturity-draft": "draft",
    "knowledge-maturity-verified": "verified",
    "knowledge-maturity-stable": "stable"
  };

  for (const [id, value] of Object.entries(expected)) {
    const block = buttonBlock(controls, id);
    assert.match(block, /bindTarget: maturity/);
    assert.match(block, new RegExp(`value: ${value}(?:\\n|$)`));
    assert.match(block, /class: knowledge-maturity-button/);
  }

  const none = buttonBlock(controls, "knowledge-maturity-none");
  assert.match(none, /bindTarget: maturity/);
  assert.match(none, /evaluate: true/);
  assert.match(none, /value: "null"/);
  assert.match(none, /class: knowledge-maturity-button/);
});

test("Knowledge controls use compact grid layouts", () => {
  const css = read(cssPath);

  assert.match(css, /\.knowledge-status-button/);
  assert.match(css, /\.knowledge-maturity-button/);
  assert.match(
    css,
    /\.mb-button-group:has\(> \.mb-button\.knowledge-status-button\)[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/
  );
  assert.match(
    css,
    /\.mb-button-group:has\(> \.mb-button\.knowledge-maturity-button\)[\s\S]*?grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);/
  );
});
