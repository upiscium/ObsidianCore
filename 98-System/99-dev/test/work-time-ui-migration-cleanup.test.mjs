import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { ACTIVATION_CONVERGENCE_MARKER } from "../tools/build-styles.mjs";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const convergence = fs.existsSync(path.join(root, ACTIVATION_CONVERGENCE_MARKER));

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
  "98-System/99-dev/test/task-dependency-controls-migration.test.mjs",
  "98-System/00-command/retire_legacy_system_hubs.md",
  "98-System/01-script/retire_legacy_system_hubs.js",
  "98-System/99-dev/test/legacy-system-hub-retirement.test.mjs"
];

test("work-time CSS is delivered by the enabled Core bundle", () => {
  const appearance = JSON.parse(read(".obsidian/appearance.json"));
  const css = read(".obsidian/snippets/obsidian-core.css");

  if (convergence) {
    assert.equal(appearance.enabledCssSnippets.includes("obsidian-core"), false);
    assert.equal(appearance.enabledCssSnippets.includes("work-time"), true);
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

test("only current reviewed one-time migrations remain registered", () => {
  const manifest = JSON.parse(read("98-System/99-dev/setup/automation-manifest.json"));
  const migrations = manifest.maintenance?.one_time_migrations ?? [];

  assert.equal("recovery" in manifest, false);
  assert.deepEqual(
    migrations.map(({ script, command }) => ({ script, command })),
    [
      {
        script: "98-System/01-script/migrate_daily_notes_current.js",
        command: "98-System/00-command/migrate_daily_notes_current.md"
      },
      {
        script: "98-System/01-script/migrate_task_metadata_ui_current.js",
        command: "98-System/00-command/migrate_task_metadata_ui_current.md"
      }
    ]
  );
});

test("completed migration assets are removed from the runtime tree", () => {
  for (const relativePath of retiredMigrationPaths) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), false, `${relativePath} should be removed`);
  }
});
