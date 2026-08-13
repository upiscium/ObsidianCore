import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const utilityPath = "98-System/01-script/knowledge_meta_utils.js";
const templatePath = "98-System/03-template/01-note/knowledge-note-template.md";
const source = fs.readFileSync(path.join(root, utilityPath), "utf8");
const K = new Function(`"use strict"; return (${source});`)();

test("Knowledge v2 utility accepts only canonical statuses", () => {
  for (const status of ["active", "outdated", "archived", "deleted"]) {
    assert.equal(K.normalizeStatus(status), status);
  }
  for (const legacy of ["not-yet-running", "planning", "running", "done", "cancelled", ""]) {
    assert.equal(K.normalizeStatus(legacy), null);
  }
});

test("Knowledge v2 utility validates optional category, maturity and source type", () => {
  for (const category of ["explanation", "manual", "troubleshooting", "spec", "reference", "summary"]) {
    assert.equal(K.normalizeCategory(category), category);
  }
  for (const maturity of ["seed", "draft", "verified", "stable"]) {
    assert.equal(K.normalizeMaturity(maturity), maturity);
  }
  for (const sourceType of ["self", "official", "paper", "book", "web", "other"]) {
    assert.equal(K.normalizeSourceType(sourceType), sourceType);
  }

  assert.equal(K.normalizeCategory(null), "none");
  assert.equal(K.normalizeMaturity(""), "none");
  assert.equal(K.normalizeSourceType(undefined), "none");
  assert.equal(K.normalizeMaturity("outdated"), null);
  assert.equal(K.normalizeCategory("memo"), null);
  assert.equal(K.normalizeSourceType("chat"), null);
});

test("Knowledge v2 lifecycle helpers separate visible, archived and deleted notes", () => {
  assert.equal(K.isVisibleStatus("active"), true);
  assert.equal(K.isVisibleStatus("outdated"), true);
  assert.equal(K.isVisibleStatus("archived"), false);
  assert.equal(K.isArchivedStatus("archived"), true);
  assert.equal(K.isHiddenStatus("deleted"), true);
});

test("Knowledge template creates the canonical v2 defaults", () => {
  const template = fs.readFileSync(path.join(root, templatePath), "utf8");
  assert.match(template, /^---\ntype: knowledge-note\nstatus: active\ncategory:\nmaturity: draft\nsource_type: self\n---/);
  assert.match(template, /\[\[knowledge-meta\]\]/);
  assert.doesNotMatch(template, /not-yet-running|maturity:\s*outdated/);
});
