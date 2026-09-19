import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const exists = relativePath => fs.existsSync(path.join(root, relativePath));

test("audited dead System assets stay removed", () => {
  for (const relativePath of [
    "98-System/01-script/quick_create_task.js",
    "98-System/02-embed/06-dropdown/knowledge-maturity-dropdown.md",
    "98-System/02-embed/06-dropdown/task-priority-dropdown.md",
  ]) {
    assert.equal(exists(relativePath), false, relativePath);
  }
});

test("device-local QuickAdd finance scripts remain until their registered callers are retired", () => {
  for (const relativePath of [
    "98-System/01-script/add_expense.js",
    "98-System/01-script/add_income.js",
  ]) {
    assert.equal(exists(relativePath), true, relativePath);
  }
});

test("legacy Task dropdowns remain only until Task metadata UI migration acceptance", () => {
  for (const relativePath of [
    "98-System/02-embed/06-dropdown/priority-dropdown.md",
    "98-System/02-embed/06-dropdown/status-dropdown.md",
    "98-System/02-embed/06-dropdown/task-status-dropdown.md",
  ]) {
    assert.equal(exists(relativePath), true, relativePath);
  }
});
