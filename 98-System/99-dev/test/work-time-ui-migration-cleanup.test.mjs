import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const convergenceMarkerPath = "98-System/99-dev/design/core-promotion-convergence.json";
const legacySnippets = [
  "callout-colors",
  "expense-dashboard-lite",
  "mobile-home-buttons",
  "monthly-expanse",
  "task-button",
  "task-controls",
  "task-status",
  "work-time",
];

const retiredMigrationPaths = [
  "98-System/00-command/migrate_entity_metadata_v2.md",
  "98-System/00-command/migrate_entity_relations.md",
  "98-System/00-command/migrate_knowledge_metadata_v2.md",
  "98-System/00-command/migrate_note_metadata_v2.md",
  "98-System/00-command/migrate_task_dependency_controls.md",
  "98-System/01-script/migrate_tasks_v3.js",
  "98-System/01-script/migrate_entity_relations.js",
  "98-System/01-script/migrate_entity_metadata_v2.js",
  "98-System/01-script/migrate_knowledge_metadata_v2.js",
  "98-System/01-script/migrate_note_metadata_v2.js",
  "98-System/01-script/migrate_task_dependency_controls.js",
  "98-System/99-dev/test/recovery-entity-metadata-migration.test.mjs",
  "98-System/99-dev/test/recovery-knowledge-metadata-migration.test.mjs",
  "98-System/99-dev/test/recovery-note-metadata-migration.test.mjs",
  "98-System/99-dev/test/recovery-relation-migration.test.mjs",
  "98-System/99-dev/test/recovery-task-v3-migration.test.mjs",
  "98-System/99-dev/test/task-dependency-controls-migration.test.mjs"
];

test("work-time CSS is delivered by the Core bundle while activation respects explicit convergence", () => {
  const appearance = JSON.parse(read(".obsidian/appearance.json"));
  const css = read(".obsidian/snippets/obsidian-core.css");
  const converging = fs.existsSync(path.join(root, convergenceMarkerPath));

  if (converging) {
    assert.deepEqual(appearance.enabledCssSnippets, legacySnippets);
    assert.equal(appearance.enabledCssSnippets.includes("obsidian-core"), false);
  } else {
    assert.ok(appearance.enabledCssSnippets.includes("obsidian-core"));
    assert.equal(appearance.enabledCssSnippets.includes("work-time"), false);
  }
  assert.match(css, /\.work-time-daily/);
  assert.match(css, /\.work-time-monthly/);
  assert.match(css, /\.work-time-dashboard/);
  assert.match(css, /\.work-time-table/);
  assert.match(css, /@media \(max-width: 600px\)/);
});

test("only the current Daily Note one-time migration remains registered", () => {
  const manifest = JSON.parse(read("98-System/99-dev/setup/automation-manifest.json"));
  const migrations = manifest.maintenance?.one_time_migrations ?? [];

  assert.equal("recovery" in manifest, false);
  assert.equal(migrations.length, 1);
  assert.equal(migrations[0].script, "98-System/01-script/migrate_daily_notes_current.js");
  assert.equal(migrations[0].command, "98-System/00-command/migrate_daily_notes_current.md");
});

test("completed migration assets are removed from the runtime tree", () => {
  for (const relativePath of retiredMigrationPaths) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), false, `${relativePath} should be removed`);
  }
});
