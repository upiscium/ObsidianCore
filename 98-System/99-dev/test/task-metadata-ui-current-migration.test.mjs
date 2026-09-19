import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = process.cwd();
const migrate = require(path.join(root, "98-System/01-script/migrate_task_metadata_ui_current.js"));

const legacyDirect = migrate.LEGACY_BLOCKS[0];
const legacyTask = migrate.LEGACY_BLOCKS[1];
const legacyObservedHybrid = migrate.LEGACY_BLOCKS[2];

function file(filePath, type = "task") {
  return {
    path: filePath,
    basename: filePath.split("/").pop().replace(/\.md$/, ""),
    extension: "md",
    type
  };
}

function makeEnv(entries) {
  const files = entries.map(entry => file(entry.path));
  const contents = new Map(entries.map(entry => [entry.path, entry.content]));
  const frontmatter = new Map(entries.map(entry => [entry.path, { type: entry.type ?? "task" }]));
  const writes = [];
  const notices = [];

  const app = {
    vault: {
      getMarkdownFiles: () => files,
      read: async target => contents.get(target.path),
      modify: async (target, content) => {
        writes.push(target.path);
        contents.set(target.path, content);
      }
    },
    metadataCache: {
      getFileCache: target => ({ frontmatter: frontmatter.get(target.path) ?? {} })
    }
  };

  class Notice {
    constructor(message) { notices.push(String(message)); }
  }

  return {
    app,
    Notice,
    writes,
    notices,
    content: filePath => contents.get(filePath)
  };
}

test("known duplicate legacy Task metadata callouts converge to one canonical embed", () => {
  const source = [
    "---",
    "type: task",
    "---",
    legacyDirect,
    "",
    legacyTask,
    "",
    "# Task",
    "keep me"
  ].join("\n");

  const result = migrate.migrateContent(source);

  assert.equal(result.changed, true);
  assert.equal(result.legacyBlocks, 2);
  assert.equal(result.unknownBlocks.length, 0);
  assert.equal(result.residualLegacy, false);
  assert.equal((result.content.match(/task-note-meta\|task-note-meta/g) ?? []).length, 1);
  for (const token of migrate.LEGACY_TOKENS) assert.equal(result.content.includes(token), false);
  assert.match(result.content, /# Task\nkeep me/);
});

test("observed Live Vault transitional callout is accepted", () => {
  const source = [
    "---",
    "type: task",
    "---",
    legacyObservedHybrid,
    "",
    "# Task"
  ].join("\n");

  const result = migrate.migrateContent(source);

  assert.equal(result.changed, true);
  assert.equal(result.legacyBlocks, 1);
  assert.equal(result.unknownBlocks.length, 0);
  assert.equal(result.residualLegacy, false);
  assert.equal((result.content.match(/task-note-meta\\|task-note-meta/g) ?? []).length, 1);
});

test("existing canonical Task metadata embed is not duplicated", () => {
  const source = [
    "---",
    "type: task",
    "---",
    migrate.CANONICAL_META_EMBED,
    "",
    legacyTask,
    "",
    "# Task"
  ].join("\n");

  const result = migrate.migrateContent(source);
  assert.equal(result.changed, true);
  assert.equal((result.content.match(/task-note-meta\|task-note-meta/g) ?? []).length, 1);
  assert.equal(result.residualLegacy, false);
});

test("unknown legacy callout remains refused", () => {
  const source = [
    "---",
    "type: task",
    "---",
    "> [!info] 管理",
    "> custom user content",
    "> [[priority-dropdown]]",
    "# Task"
  ].join("\n");

  const result = migrate.migrateContent(source);
  assert.equal(result.changed, false);
  assert.equal(result.unknownBlocks.length, 1);
  assert.equal(result.residualLegacy, true);
});

test("migration preflights every matching Task and aborts all writes on unknown form", async () => {
  const env = makeEnv([
    {
      path: "02-Task/2026/06/known.md",
      content: ["---", "type: task", "---", legacyDirect, "# Known"].join("\n")
    },
    {
      path: "02-Task/2026/06/unknown.md",
      content: [
        "---", "type: task", "---",
        "> [!info] 管理",
        "> custom",
        "> [[status-dropdown]]",
        "# Unknown"
      ].join("\n")
    }
  ]);

  let confirmations = 0;
  const result = await migrate({}, {
    app: env.app,
    Notice: env.Notice,
    confirm: async () => {
      confirmations += 1;
      return true;
    }
  });

  assert.equal(result.updated, 0);
  assert.equal(result.refused.length, 1);
  assert.equal(env.writes.length, 0);
  assert.equal(confirmations, 0);
  assert.match(env.notices.at(-1), /中止/);
});

test("migration updates known legacy Task notes and is idempotent", async () => {
  const taskPath = "02-Task/2026/06/known.md";
  const env = makeEnv([
    {
      path: taskPath,
      content: ["---", "type: task", "---", legacyDirect, "", legacyTask, "", "# Known"].join("\n")
    },
    {
      path: "02-Task/2026/06/current.md",
      content: ["---", "type: task", "---", migrate.CANONICAL_META_EMBED, "", "# Current"].join("\n")
    },
    {
      path: "11-Knowledge/not-task.md",
      content: legacyDirect,
      type: "knowledge-note"
    }
  ]);

  const first = await migrate({}, {
    app: env.app,
    Notice: env.Notice,
    confirm: async paths => {
      assert.deepEqual(paths, [taskPath]);
      return true;
    }
  });

  assert.equal(first.updated, 1);
  assert.equal(first.legacyBlocks, 2);
  assert.deepEqual(first.failures, []);
  assert.equal(env.writes.length, 1);

  const second = await migrate({}, {
    app: env.app,
    Notice: env.Notice,
    confirm: async () => { throw new Error("must not confirm on no-op"); }
  });

  assert.equal(second.updated, 0);
  assert.equal(second.matched, 0);
  assert.equal(env.writes.length, 1);
});

test("legacy references in a non-task under Task root fail closed", async () => {
  const env = makeEnv([
    {
      path: "02-Task/2026/06/not-task.md",
      content: ["---", "type: note", "---", legacyDirect].join("\n"),
      type: "note"
    }
  ]);

  const result = await migrate({}, {
    app: env.app,
    Notice: env.Notice,
    confirm: async () => true
  });

  assert.equal(result.updated, 0);
  assert.deepEqual(result.refused, [
    { path: "02-Task/2026/06/not-task.md", reason: "legacy-reference-in-non-task" }
  ]);
  assert.equal(env.writes.length, 0);
});
