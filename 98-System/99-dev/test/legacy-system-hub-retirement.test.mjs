import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = process.cwd();
const retire = require(path.join(root, "98-System/01-script/retire_legacy_system_hubs.js"));

function file(filePath) {
  return {
    path: filePath,
    extension: "md",
    basename: filePath.split("/").pop().replace(/\.md$/, "")
  };
}

function makeEnv(entries) {
  const files = new Map(entries.map(entry => [entry.path, file(entry.path)]));
  const contents = new Map(entries.map(entry => [entry.path, entry.content]));
  const trashed = [];
  const notices = [];

  const app = {
    vault: {
      getAbstractFileByPath: filePath => files.get(filePath) ?? null,
      read: async target => contents.get(target.path)
    },
    fileManager: {
      trashFile: async target => {
        trashed.push(target.path);
        files.delete(target.path);
        contents.delete(target.path);
      }
    }
  };

  class Notice {
    constructor(message) { notices.push(String(message)); }
  }

  return { app, Notice, trashed, notices };
}

test("legacy Hub retirement trashes only audited exact-content files and is idempotent", async () => {
  const env = makeEnv(retire.LEGACY_FILES.map(spec => ({ path: spec.path, content: spec.expected })));

  const first = await retire({}, {
    app: env.app,
    Notice: env.Notice,
    confirm: async paths => {
      assert.deepEqual(paths.sort(), retire.LEGACY_FILES.map(spec => spec.path).sort());
      return true;
    }
  });

  assert.equal(first.retired, 3);
  assert.deepEqual(first.refused, []);
  assert.deepEqual(first.failures, []);
  assert.equal(env.trashed.length, 3);

  const second = await retire({}, {
    app: env.app,
    Notice: env.Notice,
    confirm: async () => { throw new Error("confirmation must not run when already retired"); }
  });

  assert.equal(second.retired, 0);
  assert.equal(second.missing.length, 3);
  assert.equal(second.cancelled, false);
});

test("legacy Hub retirement fails closed before deleting anything when audited content changed", async () => {
  const changed = retire.LEGACY_FILES.map(spec => ({
    path: spec.path,
    content: spec.path === "10-Project/hub.md" ? spec.expected + "\nuser note" : spec.expected
  }));
  const env = makeEnv(changed);
  let confirmationCalls = 0;

  const result = await retire({}, {
    app: env.app,
    Notice: env.Notice,
    confirm: async () => {
      confirmationCalls += 1;
      return true;
    }
  });

  assert.equal(result.retired, 0);
  assert.deepEqual(result.refused, [{ path: "10-Project/hub.md", reason: "content-mismatch" }]);
  assert.equal(env.trashed.length, 0);
  assert.equal(confirmationCalls, 0);
  assert.match(env.notices.at(-1), /監査済み本文と一致しません/);
});

test("legacy Hub retirement cancellation leaves every eligible file untouched", async () => {
  const first = retire.LEGACY_FILES[0];
  const env = makeEnv([{ path: first.path, content: first.expected }]);

  const result = await retire({}, {
    app: env.app,
    Notice: env.Notice,
    confirm: async () => false
  });

  assert.equal(result.retired, 0);
  assert.equal(result.cancelled, true);
  assert.equal(env.trashed.length, 0);
  assert.match(env.notices.at(-1), /キャンセル/);
});

test("legacy Hub audited-content comparator normalizes line endings only", () => {
  const sample = "a\nb\n";
  assert.equal(retire.matchesAuditedLegacyContent("a\r\nb\r\n", sample), true);
  assert.equal(retire.matchesAuditedLegacyContent("a\nb changed\n", sample), false);
});
