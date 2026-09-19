import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const exists = relativePath => fs.existsSync(path.join(root, relativePath));
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

const retiredPaths = [
  "98-System/00-command/migrate_entity_metadata_v2.md",
  "98-System/00-command/migrate_entity_relations.md",
  "98-System/00-command/migrate_knowledge_metadata_v2.md",
  "98-System/00-command/migrate_note_metadata_v2.md",
  "98-System/00-command/migrate_task_dependency_controls.md",
  "98-System/00-command/retire_legacy_system_hubs.md",
  "98-System/00-command/migrate_daily_notes_current.md",
  "98-System/00-command/migrate_task_metadata_ui_current.md",

  "98-System/01-script/migrate_tasks_v3.js",
  "98-System/01-script/migrate_entity_relations.js",
  "98-System/01-script/migrate_entity_metadata_v2.js",
  "98-System/01-script/migrate_knowledge_metadata_v2.js",
  "98-System/01-script/migrate_note_metadata_v2.js",
  "98-System/01-script/migrate_task_dependency_controls.js",
  "98-System/01-script/retire_legacy_system_hubs.js",
  "98-System/01-script/migrate_daily_notes_current.js",
  "98-System/01-script/migrate_task_metadata_ui_current.js",
  "98-System/01-script/quick_create_task.js",
  "98-System/01-script/weekly_review_utils.js",
  "98-System/02-embed/05-task/weekly-review.md",
  "98-System/04-view/tasks/weekly_review.js",
  "98-System/99-dev/test/weekly-review-contracts.test.mjs",

  "98-System/02-embed/06-dropdown/knowledge-maturity-dropdown.md",
  "98-System/02-embed/06-dropdown/task-priority-dropdown.md",
  "98-System/02-embed/06-dropdown/status-dropdown.md",
  "98-System/02-embed/06-dropdown/priority-dropdown.md",
  "98-System/02-embed/06-dropdown/task-status-dropdown.md",

  "98-System/99-dev/test/recovery-entity-metadata-migration.test.mjs",
  "98-System/99-dev/test/recovery-knowledge-metadata-migration.test.mjs",
  "98-System/99-dev/test/recovery-note-metadata-migration.test.mjs",
  "98-System/99-dev/test/recovery-relation-migration.test.mjs",
  "98-System/99-dev/test/recovery-task-v3-migration.test.mjs",
  "98-System/99-dev/test/task-dependency-controls-migration.test.mjs",
  "98-System/99-dev/test/legacy-system-hub-retirement.test.mjs",
  "98-System/99-dev/test/daily-note-current-migration.test.mjs",
  "98-System/99-dev/test/task-metadata-ui-current-migration.test.mjs"
];

test("completed migration and dead System assets stay retired", () => {
  for (const relativePath of retiredPaths) {
    assert.equal(exists(relativePath), false, `${relativePath} must stay retired`);
  }
});

test("automation manifest has no active maintenance migration registry", () => {
  const manifest = JSON.parse(read("98-System/99-dev/setup/automation-manifest.json"));
  assert.equal("recovery" in manifest, false);
  assert.equal("maintenance" in manifest, false);
});

test("retired migration commands are absent from the public interface registry", () => {
  const registry = JSON.parse(read("98-System/99-dev/setup/system-interfaces.json"));
  const paths = new Set(registry.groups.flatMap(group => group.paths ?? []));

  for (const retired of [
    "98-System/00-command/migrate_daily_notes_current.md",
    "98-System/00-command/migrate_task_metadata_ui_current.md"
  ]) {
    assert.equal(paths.has(retired), false, retired);
  }
});

test("device-local QuickAdd finance scripts remain because active callers were observed", () => {
  for (const relativePath of [
    "98-System/01-script/add_expense.js",
    "98-System/01-script/add_income.js"
  ]) {
    assert.equal(exists(relativePath), true, relativePath);
  }
});
