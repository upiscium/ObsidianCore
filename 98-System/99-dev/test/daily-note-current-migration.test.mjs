import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = process.cwd();
const migrationPath = "98-System/01-script/migrate_daily_notes_current.js";
const migrate = require(path.join(root, migrationPath));

function file(filePath) {
  const name = filePath.split("/").pop();
  return {
    path: filePath,
    basename: name.replace(/\.md$/, ""),
    extension: "md"
  };
}

function makeEnv(entries) {
  const files = entries.map(entry => file(entry.path));
  const frontmatter = new Map(entries.map(entry => [entry.path, structuredClone(entry.fm ?? {})]));
  const contents = new Map(entries.map(entry => [entry.path, entry.content ?? ""]));
  const notices = [];

  globalThis.app = {
    vault: {
      getMarkdownFiles: () => files,
      read: async target => contents.get(target.path) ?? "",
      modify: async (target, content) => contents.set(target.path, content)
    },
    metadataCache: {
      getFileCache: target => ({ frontmatter: frontmatter.get(target.path) ?? {} })
    },
    fileManager: {
      processFrontMatter: async (target, mutator) => mutator(frontmatter.get(target.path))
    }
  };
  globalThis.Notice = class Notice {
    constructor(message) { notices.push(String(message)); }
  };

  return {
    frontmatter,
    notices,
    content: filePath => contents.get(filePath),
    cleanup() {
      delete globalThis.app;
      delete globalThis.Notice;
    }
  };
}

test("Daily Note migration adds mood and current Work embeds without replacing note content", async () => {
  const oldDaily = "00-DailyNote/2026/09/2026-09-01.md";
  const partialDaily = "00-DailyNote/2026/09/2026-09-02.md";
  const currentDaily = "00-DailyNote/2026/09/2026-09-03.md";
  const other = "00-DailyNote/2026/09/Reference.md";

  const env = makeEnv([
    {
      path: oldDaily,
      fm: { type: "daily-review" },
      content: "---\r\ntype: daily-review\r\n---\r\n```meta-bind-embed\r\n[[daily-meta]]\r\n```\r\n# Note\r\nkeep me\r\n# Tasks\r\n"
    },
    {
      path: partialDaily,
      fm: { type: "daily-review", mood: 3 },
      content: "# Work\n```meta-bind-embed\n[[work-buttons]]\n```\n# Note\npartial\n"
    },
    {
      path: currentDaily,
      fm: { type: "daily-review", mood: 4 },
      content: "# Work\n```meta-bind-embed\n[[work-buttons]]\n```\n```meta-bind-embed\n[[daily-work]]\n```\n# Note\ncurrent\n"
    },
    {
      path: other,
      fm: { type: "note" },
      content: "# Reference\n"
    }
  ]);

  try {
    const first = await migrate({});
    assert.deepEqual(first, {
      updated: 2,
      unchanged: 1,
      skipped: 1,
      moodAdded: 1,
      workUpdated: 2,
      failures: []
    });

    assert.equal(Object.prototype.hasOwnProperty.call(env.frontmatter.get(oldDaily), "mood"), true);
    assert.match(env.content(oldDaily), /# Work\r\n```meta-bind-embed\r\n\[\[work-buttons\]\]\r\n```\r\n```meta-bind-embed\r\n\[\[daily-work\]\]\r\n```\r\n\r\n# Note/);
    assert.match(env.content(oldDaily), /# Note\r\nkeep me\r\n# Tasks/);
    assert.match(env.content(partialDaily), /\[\[daily-work\]\]/);
    assert.equal(env.content(currentDaily).match(/\[\[daily-work\]\]/g)?.length, 1);
    assert.equal(env.content(other), "# Reference\n");

    const second = await migrate({});
    assert.deepEqual(second, {
      updated: 0,
      unchanged: 3,
      skipped: 1,
      moodAdded: 0,
      workUpdated: 0,
      failures: []
    });
  } finally {
    env.cleanup();
  }
});

test("Daily Note migration helper only accepts canonical dated Daily Notes", () => {
  assert.equal(migrate.isDailyNote(file("00-DailyNote/2026/09/2026-09-16.md"), { type: "daily-review" }), true);
  assert.equal(migrate.isDailyNote(file("00-DailyNote/2026/09/Reference.md"), { type: "daily-review" }), false);
  assert.equal(migrate.isDailyNote(file("11-Knowledge/2026-09-16.md"), { type: "daily-review" }), false);
  assert.equal(migrate.isDailyNote(file("00-DailyNote/2026/09/2026-09-16.md"), { type: "note" }), false);
});
