import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = process.cwd();
const scriptPath = "98-System/01-script/sync_core_style.js";
const syncCoreStyle = require(path.join(root, scriptPath));
const GENERATED = `${syncCoreStyle.GENERATED_HEADER}\n.oc-test { color: red; }\n`;

function buffer(text) {
  return new TextEncoder().encode(text).buffer;
}

function clone(value) {
  if (value instanceof ArrayBuffer) return value.slice(0);
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
}

function parent(pathValue) {
  const index = pathValue.lastIndexOf("/");
  return index === -1 ? "" : pathValue.slice(0, index);
}

class FakeAdapter {
  constructor({ configDir = ".obsidian", source = GENERATED, target, corruptWrites = false } = {}) {
    this.files = new Map();
    this.folders = new Set([
      "98-System",
      "98-System/90-config",
      "98-System/90-config/styles",
      configDir,
    ]);
    this.writeCount = 0;
    this.mkdirCount = 0;
    this.corruptWrites = corruptWrites;
    if (source !== null) this.files.set(syncCoreStyle.SOURCE_PATH, buffer(source));
    if (target !== undefined) {
      const targetDir = `${configDir}/snippets`;
      this.folders.add(targetDir);
      this.files.set(`${targetDir}/${syncCoreStyle.TARGET_NAME}`, buffer(target));
    }
  }

  async stat(pathValue) {
    if (this.files.has(pathValue)) {
      return { type: "file", size: this.files.get(pathValue).byteLength };
    }
    if (this.folders.has(pathValue)) return { type: "folder", size: 0 };
    return null;
  }

  async readBinary(pathValue) {
    if (!this.files.has(pathValue)) throw new Error(`missing fake file: ${pathValue}`);
    return clone(this.files.get(pathValue));
  }

  async writeBinary(pathValue, data) {
    if (!this.folders.has(parent(pathValue))) throw new Error(`missing fake parent: ${parent(pathValue)}`);
    this.writeCount += 1;
    const bytes = clone(data);
    this.files.set(pathValue, this.corruptWrites ? buffer("corrupted") : bytes);
  }

  async mkdir(pathValue) {
    if (this.files.has(pathValue) || this.folders.has(pathValue)) throw new Error(`fake path exists: ${pathValue}`);
    if (!this.folders.has(parent(pathValue))) throw new Error(`missing fake parent: ${parent(pathValue)}`);
    this.mkdirCount += 1;
    this.folders.add(pathValue);
  }
}

function fakeApp(adapter, configDir = ".obsidian") {
  return { vault: { adapter, configDir } };
}

test("installer has no Node/fs dependency and does not hard-code .obsidian", () => {
  const source = fs.readFileSync(path.join(root, scriptPath), "utf8");
  assert.doesNotMatch(source, /require\s*\(|node:|\bfs\.|\bpath\.|\.obsidian/);
  assert.match(source, /vault\.configDir/);
  assert.match(source, /adapter\.readBinary/);
  assert.match(source, /adapter\.writeBinary/);
});

test("safe configDir accepts nested relative paths and rejects traversal/absolute paths", () => {
  assert.equal(syncCoreStyle.safeVaultRelativePath(".obsidian", "x"), ".obsidian");
  assert.equal(syncCoreStyle.safeVaultRelativePath("config/mobile/", "x"), "config/mobile");
  for (const value of ["", "/abs", "../escape", "a/../b", "a//b", "C:\\vault", "a\0b"]) {
    assert.throws(() => syncCoreStyle.safeVaultRelativePath(value, "x"));
  }
});

test("missing snippets directory and target are created with exact canonical bytes", async () => {
  const adapter = new FakeAdapter();
  const result = await syncCoreStyle({}, fakeApp(adapter));
  assert.equal(result.status, "created");
  assert.equal(result.targetPath, ".obsidian/snippets/obsidian-core.css");
  assert.equal(adapter.mkdirCount, 1);
  assert.equal(adapter.writeCount, 1);
  assert.equal(new TextDecoder().decode(await adapter.readBinary(result.targetPath)), GENERATED);
});

test("exact existing target is a no-op", async () => {
  const adapter = new FakeAdapter({ target: GENERATED });
  const result = await syncCoreStyle({}, fakeApp(adapter));
  assert.equal(result.status, "unchanged");
  assert.equal(adapter.writeCount, 0);
  assert.equal(adapter.mkdirCount, 0);
});

test("recognized stale generated target is replaced and verified", async () => {
  const old = `${syncCoreStyle.GENERATED_HEADER}\n.old { color: blue; }\n`;
  const adapter = new FakeAdapter({ target: old });
  const result = await syncCoreStyle({}, fakeApp(adapter));
  assert.equal(result.status, "updated");
  assert.equal(adapter.writeCount, 1);
  assert.equal(new TextDecoder().decode(await adapter.readBinary(result.targetPath)), GENERATED);
});

test("unrecognized local file with the managed target name is never overwritten", async () => {
  const adapter = new FakeAdapter({ target: "/* my local CSS */\nbody {}\n" });
  await assert.rejects(() => syncCoreStyle({}, fakeApp(adapter)), /Refusing to overwrite an unrecognized local file/);
  assert.equal(adapter.writeCount, 0);
});

test("custom configDir is used instead of assuming .obsidian", async () => {
  const configDir = "config/mobile";
  const adapter = new FakeAdapter({ configDir });
  adapter.folders.add("config");
  const result = await syncCoreStyle({}, fakeApp(adapter, configDir));
  assert.equal(result.targetPath, "config/mobile/snippets/obsidian-core.css");
  assert.equal(adapter.writeCount, 1);
});

test("source must exist and must be a generated bundle", async () => {
  const missing = new FakeAdapter({ source: null });
  await assert.rejects(() => syncCoreStyle({}, fakeApp(missing)), /distribution source must exist/);
  const unrecognized = new FakeAdapter({ source: "body {}\n" });
  await assert.rejects(() => syncCoreStyle({}, fakeApp(unrecognized)), /not a generated bundle/);
});

test("target parent and target type mismatches fail closed", async () => {
  const parentFile = new FakeAdapter();
  parentFile.files.set(".obsidian/snippets", buffer("not a folder"));
  await assert.rejects(() => syncCoreStyle({}, fakeApp(parentFile)), /target parent is not a folder/);

  const targetFolder = new FakeAdapter();
  targetFolder.folders.add(".obsidian/snippets");
  targetFolder.folders.add(".obsidian/snippets/obsidian-core.css");
  await assert.rejects(() => syncCoreStyle({}, fakeApp(targetFolder)), /target is not a file/);
});

test("post-write byte verification catches an adapter that does not persist desired bytes", async () => {
  const adapter = new FakeAdapter({ corruptWrites: true });
  await assert.rejects(() => syncCoreStyle({}, fakeApp(adapter)), /verification failed after write/);
  assert.equal(adapter.writeCount, 1);
});

test("missing app/Vault adapter fails without touching any global filesystem API", async () => {
  await assert.rejects(() => syncCoreStyle({}, null), /Vault adapter is required/);
});
