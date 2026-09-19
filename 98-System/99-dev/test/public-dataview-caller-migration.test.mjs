import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

const migrations = new Map([
  ["98-System/04-view/entity_task_health", "98-System/04-view/projects/entity_task_health"],
  ["98-System/04-view/high_priority_project_table", "98-System/04-view/projects/high_priority_project_table"],
  ["98-System/04-view/note_table", "98-System/04-view/projects/note_table"],
  ["98-System/04-view/project_github_status", "98-System/04-view/projects/project_github_status"],
  ["98-System/04-view/project_table", "98-System/04-view/projects/project_table"],
  ["98-System/04-view/recurring_tasks", "98-System/04-view/tasks/recurring_tasks"],
  ["98-System/04-view/task_table", "98-System/04-view/tasks/task_table"],
  ["98-System/04-view/weekly_review", "98-System/04-view/tasks/weekly_review"],
  ["98-System/04-view/workspace_table", "98-System/04-view/projects/workspace_table"],
]);

function markdownFiles(directory) {
  const absolute = path.join(root, directory);
  const out = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const relative = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) out.push(...markdownFiles(relative));
    else if (entry.isFile() && entry.name.endsWith(".md")) out.push(relative);
  }
  return out;
}

test("public embed runtime no longer calls legacy exact Dataview paths", () => {
  const sources = markdownFiles("98-System/02-embed")
    .map(relativePath => [relativePath, read(relativePath)]);

  for (const [oldPath, organizedPath] of migrations) {
    const oldCallers = sources.filter(([, source]) => source.includes(oldPath));
    assert.deepEqual(
      oldCallers.map(([relativePath]) => relativePath),
      [],
      `${oldPath} must have no runtime callers under 02-embed`,
    );

    const newCallers = sources.filter(([, source]) => source.includes(organizedPath));
    assert.ok(newCallers.length > 0, `${organizedPath} must have at least one public runtime caller`);
  }
});

test("legacy Dataview wrappers remain available during the private-caller gate", () => {
  const registry = JSON.parse(read("98-System/99-dev/setup/system-interfaces.json"));
  const exact = new Set(
    registry.groups
      .filter(group => group.resolution === "exact")
      .flatMap(group => group.paths ?? []),
  );

  for (const [oldPath, organizedPath] of migrations) {
    const wrapperPath = `${oldPath}.js`;
    assert.equal(fs.existsSync(path.join(root, wrapperPath)), true);
    assert.match(read(wrapperPath), new RegExp(`dv\\.view\\("${organizedPath.replaceAll("/", "\\/")}`));
    assert.equal(exact.has(wrapperPath), true, `${wrapperPath} must remain protected until retirement`);
  }
});

test("organized Dataview targets exist", () => {
  for (const organizedPath of migrations.values()) {
    assert.equal(
      fs.existsSync(path.join(root, `${organizedPath}.js`)),
      true,
      `${organizedPath}.js must exist`,
    );
  }
});
