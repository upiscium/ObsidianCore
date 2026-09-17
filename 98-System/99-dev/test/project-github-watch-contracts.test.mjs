import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

const templatePath = "98-System/03-template/00-entry/project-entry-template.md";
const controlsPath = "98-System/02-embed/00-meta/project-github-controls.md";
const metaPath = "98-System/02-embed/00-meta/project-meta.md";


test("new Project entries opt out of GitHub watching by default", () => {
  const template = read(templatePath);
  const frontmatter = template.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";

  assert.match(frontmatter, /^type: project$/m);
  assert.match(frontmatter, /^github_repo:\s*$/m);
  assert.match(frontmatter, /^github_watch: false$/m);
});


test("Project metadata UI exposes GitHub repository and watcher opt-in", () => {
  const controls = read(controlsPath);
  const meta = read(metaPath);

  assert.match(controls, /INPUT\[text\(placeholder\(upiscium\/Terreate\)\):github_repo\]/);
  assert.match(controls, /INPUT\[toggle:github_watch\]/);
  assert.match(meta, /> \[\[project-github-controls\]\]/);
});


test("GitHub watcher metadata remains Project-specific", () => {
  const workspaceTemplate = read("98-System/03-template/00-entry/workspace-entry-template.md");
  const taskTemplate = read("98-System/03-template/01-note/task-note-template.md");

  assert.doesNotMatch(workspaceTemplate, /github_repo|github_watch/);
  assert.doesNotMatch(taskTemplate, /github_repo|github_watch/);
});
