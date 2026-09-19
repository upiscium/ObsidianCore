import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const interfaces = JSON.parse(
  fs.readFileSync(path.join(root, "98-System/99-dev/setup/system-interfaces.json"), "utf8")
);
const knownEmpty = new Set(
  interfaces.groups.flatMap(group => group.known_empty ?? [])
);

const wrappers = [
  {
    path: "98-System/00-command/create_recurring_task.md",
    pattern: /tp\.user\.create_recurring_task\(tp\)/
  },
  {
    path: "98-System/00-command/reschedule_task.md",
    pattern: /tp\.user\.reschedule_task\(tp\)/
  },
  {
    path: "98-System/00-command/migrate_daily_notes_current.md",
    pattern: /tp\.user\.migrate_daily_notes_current\(tp\)/
  },
  {
    path: "98-System/00-command/retire_legacy_system_hubs.md",
    pattern: /tp\.user\.retire_legacy_system_hubs\(tp\)/
  },
  {
    path: "98-System/00-command/promote_to_knowledge.md",
    pattern: /tp\.user\.promote_to_knowledge\(tp\)/
  },
  {
    path: "98-System/03-template/99-startup/generate-recurring-tasks.md",
    pattern: /tp\.user\.generate_recurring_tasks\(tp\)/
  }
];

test("repository-managed Templater execution files are not truncated", () => {
  for (const entry of wrappers) {
    const content = fs.readFileSync(path.join(root, entry.path), "utf8");
    if (knownEmpty.has(entry.path)) {
      assert.equal(content, "", `${entry.path} must be exactly empty while declared known_empty`);
      continue;
    }
    assert.ok(content.trim().length > 0, `${entry.path} must not be empty`);
    assert.match(content, entry.pattern, `${entry.path} must call its user script`);
  }
});
