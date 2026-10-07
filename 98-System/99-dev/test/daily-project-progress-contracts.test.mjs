import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const dailyTemplatePath =
  "98-System/03-template/01-note/daily-note-template.md";

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("Daily template exposes one exact Project Progress H1 boundary", () => {
  const template = read(dailyTemplatePath);
  const headings = template.match(/^# Project Progress[ \t]*$/gm) ?? [];

  assert.equal(headings.length, 1);

  const note = template.indexOf("# Note\n");
  const progress = template.indexOf("# Project Progress\n");
  const tasks = template.indexOf("# Tasks\n");

  assert.ok(note >= 0);
  assert.ok(progress > note);
  assert.ok(tasks > progress);
});

test("Project Progress ownership uses visible heading boundaries, not comments", () => {
  const template = read(dailyTemplatePath);

  assert.equal(template.includes("<!-- obsidian-daily-project-progress"), false);
  assert.equal(template.includes("<!-- project-progress"), false);
});
