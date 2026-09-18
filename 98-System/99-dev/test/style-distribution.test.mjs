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
const MOBILE = `${syncCoreStyle.MOBILE_HEADER}\n.oc-mobile-test { white-space: nowrap; }\n`;
const DEFAULT_APPEARANCE = Object.freeze({
  theme: "obsidian",
  cssTheme: "Tokyo Night",
  enabledCssSnippets: [...syncCoreStyle.CANONICAL_SNIPPETS],
});

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

function desiredFor(style) {
  return style.id === "base" ? GENERATED : MOBILE;
}

class FakeAdapter {
  constructor({
    configDir = ".obsidian",
    sources = {},
    targets = {},
    appearance = DEFAULT_APPEARANCE,
    corruptWrites = false,
    appearanceRace = false,
  } = {}) {
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
    this.appearancePath = `${configDir}/${syncCoreStyle.APPEARANCE_NAME}`;
    this.appearanceReadCount = 0;
    this.appearanceRace = appearanceRace;

    if (appearance !== null) {
      const text = typeof appearance === "string" ? appearance : JSON.stringify(appearance);
      this.files.set(this.appearancePath, buffer(text));
    }

    for (const style of syncCoreStyle.STYLE_FILES) {
      const configured = Object.prototype.hasOwnProperty.call(sources, style.id)
        ? sources[style.id]
        : desiredFor(style);
      if (configured !== null) this.files.set(style.sourcePath, buffer(configured));
    }

    if (Object.keys(targets).length) this.folders.add(`${configDir}/snippets`);
    for (const style of syncCoreStyle.STYLE_FILES) {
      if (!Object.prototype.hasOwnProperty.call(targets, style.id)) continue;
      this.files.set(`${configDir}/snippets/${style.targetName}`, buffer(targets[style.id]));
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
    if (pathValue === this.appearancePath) {
      this.appearanceReadCount += 1;
      if (this.appearanceRace && this.appearanceReadCount === 2) {
        const value = JSON.parse(new TextDecoder().decode(this.files.get(pathValue)));
        value.enabledCssSnippets = ["private-race", ...syncCoreStyle.LEGACY_SNIPPETS];
        this.files.set(pathValue, buffer(JSON.stringify(value)));
      }
    }
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

function fakeApp(adapter, configDir = ".obsidian", customCss = null) {
  return {
    vault: { adapter, configDir },
    ...(customCss ? { customCss } : {}),
  };
}

function resultById(result, id) {
  return result.styles.find(style => style.id === id);
}

async function readAppearance(adapter) {
  return JSON.parse(new TextDecoder().decode(await adapter.readBinary(adapter.appearancePath)));
}

test("installer has no Node/fs dependency and does not hard-code .obsidian", () => {
  const source = fs.readFileSync(path.join(root, scriptPath), "utf8");
  assert.doesNotMatch(source, /require\s*\(|node:|\bfs\.|\bpath\.|\.obsidian/);
  assert.match(source, /vault\.configDir/);
  assert.match(source, /adapter\.readBinary/);
  assert.match(source, /adapter\.writeBinary/);
});

test("style contract contains base/mobile files and one canonical managed activation order", () => {
  assert.deepEqual(syncCoreStyle.STYLE_FILES.map(style => style.id), ["base", "mobile"]);
  assert.deepEqual(syncCoreStyle.CANONICAL_SNIPPETS, ["obsidian-core", "obsidian-core-mobile"]);
  assert.equal(syncCoreStyle.LEGACY_SNIPPETS.length, 8);
  assert.equal(new Set(syncCoreStyle.MANAGED_SNIPPETS).size, 10);
  assert.equal(syncCoreStyle.SOURCE_PATH, "98-System/90-config/styles/obsidian-core.css");
  assert.equal(syncCoreStyle.TARGET_NAME, "obsidian-core.css");
  assert.equal(syncCoreStyle.MOBILE_SOURCE_PATH, "98-System/90-config/styles/obsidian-core-mobile.css");
  assert.equal(syncCoreStyle.MOBILE_TARGET_NAME, "obsidian-core-mobile.css");
});

test("safe configDir accepts nested relative paths and rejects traversal/absolute paths", () => {
  assert.equal(syncCoreStyle.safeVaultRelativePath(".obsidian", "x"), ".obsidian");
  assert.equal(syncCoreStyle.safeVaultRelativePath("config/mobile/", "x"), "config/mobile");
  for (const value of ["", "/abs", "../escape", "a/../b", "a//b", "C:\\vault", "a\0b"]) {
    assert.throws(() => syncCoreStyle.safeVaultRelativePath(value, "x"));
  }
});

test("missing snippets directory and both targets are created with exact canonical bytes", async () => {
  const adapter = new FakeAdapter();
  const result = await syncCoreStyle({}, fakeApp(adapter));
  assert.equal(result.status, "created");
  assert.equal(adapter.mkdirCount, 1);
  assert.equal(adapter.writeCount, 2);
  assert.deepEqual(result.styles.map(style => style.status), ["created", "created"]);
  assert.equal(result.appearance.status, "unchanged");
  assert.equal(new TextDecoder().decode(await adapter.readBinary(resultById(result, "base").targetPath)), GENERATED);
  assert.equal(new TextDecoder().decode(await adapter.readBinary(resultById(result, "mobile").targetPath)), MOBILE);
});

test("exact existing targets and canonical appearance are a no-op", async () => {
  const adapter = new FakeAdapter({ targets: { base: GENERATED, mobile: MOBILE } });
  const result = await syncCoreStyle({}, fakeApp(adapter));
  assert.equal(result.status, "unchanged");
  assert.equal(adapter.writeCount, 0);
  assert.equal(adapter.mkdirCount, 0);
  assert.ok(result.styles.every(style => style.status === "unchanged"));
  assert.equal(result.appearance.status, "unchanged");
});

test("recognized stale managed target is replaced without rewriting the current sibling", async () => {
  const oldBase = `${syncCoreStyle.GENERATED_HEADER}\n.old { color: blue; }\n`;
  const adapter = new FakeAdapter({ targets: { base: oldBase, mobile: MOBILE } });
  const result = await syncCoreStyle({}, fakeApp(adapter));
  assert.equal(result.status, "updated");
  assert.equal(adapter.writeCount, 1);
  assert.equal(resultById(result, "base").status, "updated");
  assert.equal(resultById(result, "mobile").status, "unchanged");
});

test("unrecognized local target fails during preflight before either style is written", async () => {
  const oldBase = `${syncCoreStyle.GENERATED_HEADER}\n.old { color: blue; }\n`;
  const adapter = new FakeAdapter({
    targets: { base: oldBase, mobile: "/* my local CSS */\nbody {}\n" },
  });
  await assert.rejects(() => syncCoreStyle({}, fakeApp(adapter)), /Refusing to overwrite an unrecognized local file/);
  assert.equal(adapter.writeCount, 0);
});

test("custom configDir is used for styles and appearance", async () => {
  const configDir = "config/mobile";
  const adapter = new FakeAdapter({ configDir });
  adapter.folders.add("config");
  const result = await syncCoreStyle({}, fakeApp(adapter, configDir));
  assert.equal(resultById(result, "base").targetPath, "config/mobile/snippets/obsidian-core.css");
  assert.equal(resultById(result, "mobile").targetPath, "config/mobile/snippets/obsidian-core-mobile.css");
  assert.equal(result.appearance.targetPath, "config/mobile/appearance.json");
  assert.equal(adapter.writeCount, 2);
});

test("legacy managed activation is replaced while unrelated snippets and unknown keys are preserved", async () => {
  const adapter = new FakeAdapter({
    targets: { base: GENERATED, mobile: MOBILE },
    appearance: {
      theme: "obsidian",
      cssTheme: "Tokyo Night",
      accentColor: "#123456",
      enabledCssSnippets: ["private-before", "work-time", "task-status", "private-after"],
    },
  });
  const result = await syncCoreStyle({}, fakeApp(adapter));
  const appearance = await readAppearance(adapter);

  assert.equal(result.status, "updated");
  assert.equal(result.appearance.status, "updated");
  assert.deepEqual(appearance.enabledCssSnippets, [
    "private-before",
    "obsidian-core",
    "obsidian-core-mobile",
    "private-after",
  ]);
  assert.equal(appearance.accentColor, "#123456");
  assert.equal(appearance.theme, "obsidian");
  assert.equal(appearance.cssTheme, "Tokyo Night");
  assert.equal(adapter.writeCount, 1);
  assert.equal(result.runtimeActivation.status, "reload_required");
});

test("canonical managed activation with unrelated snippets is an appearance no-op", async () => {
  const adapter = new FakeAdapter({
    targets: { base: GENERATED, mobile: MOBILE },
    appearance: {
      theme: "obsidian",
      cssTheme: "Tokyo Night",
      enabledCssSnippets: ["private-before", "obsidian-core", "obsidian-core-mobile", "private-after"],
    },
  });
  const result = await syncCoreStyle({}, fakeApp(adapter));

  assert.equal(result.status, "unchanged");
  assert.equal(result.appearance.status, "unchanged");
  assert.equal(adapter.writeCount, 0);
});

test("managed activation is appended when no managed snippet is currently enabled", async () => {
  const adapter = new FakeAdapter({
    targets: { base: GENERATED, mobile: MOBILE },
    appearance: {
      theme: "obsidian",
      cssTheme: "Tokyo Night",
      enabledCssSnippets: ["private-a", "private-b"],
    },
  });
  await syncCoreStyle({}, fakeApp(adapter));
  const appearance = await readAppearance(adapter);
  assert.deepEqual(appearance.enabledCssSnippets, [
    "private-a", "private-b", "obsidian-core", "obsidian-core-mobile",
  ]);
});

test("appearance repair uses the optional runtime CSS API only as a verified best-effort fast path", async () => {
  const adapter = new FakeAdapter({
    targets: { base: GENERATED, mobile: MOBILE },
    appearance: {
      theme: "obsidian",
      cssTheme: "Tokyo Night",
      enabledCssSnippets: ["private", ...syncCoreStyle.LEGACY_SNIPPETS],
    },
  });
  const enabledSnippets = new Set(["private", ...syncCoreStyle.LEGACY_SNIPPETS]);
  const customCss = {
    enabledSnippets,
    setCssEnabledStatus(name, enabled) {
      if (enabled) enabledSnippets.add(name);
      else enabledSnippets.delete(name);
    },
  };

  const result = await syncCoreStyle({}, fakeApp(adapter, ".obsidian", customCss));
  assert.equal(result.runtimeActivation.status, "updated");
  assert.deepEqual(
    [...enabledSnippets].filter(name => syncCoreStyle.MANAGED_SNIPPETS.includes(name)),
    syncCoreStyle.CANONICAL_SNIPPETS,
  );
  assert.equal(enabledSnippets.has("private"), true);
});

test("malformed, duplicate, or missing appearance config fails before style mutation", async () => {
  const cases = [
    "{not-json",
    { theme: "obsidian", cssTheme: "Tokyo Night", enabledCssSnippets: ["obsidian-core", "obsidian-core"] },
    { theme: "obsidian", cssTheme: "Tokyo Night", enabledCssSnippets: ["ok", 3] },
    null,
  ];

  for (const appearance of cases) {
    const adapter = new FakeAdapter({ appearance });
    await assert.rejects(
      () => syncCoreStyle({}, fakeApp(adapter)),
      /appearance|duplicates|valid JSON|list of strings/i,
    );
    assert.equal(adapter.writeCount, 0);
    assert.equal(adapter.mkdirCount, 0);
  }
});

test("appearance race is detected before any style write begins", async () => {
  const adapter = new FakeAdapter({
    appearance: {
      theme: "obsidian",
      cssTheme: "Tokyo Night",
      enabledCssSnippets: syncCoreStyle.LEGACY_SNIPPETS,
    },
    appearanceRace: true,
  });

  await assert.rejects(
    () => syncCoreStyle({}, fakeApp(adapter)),
    /changed during startup repair/,
  );
  assert.equal(adapter.writeCount, 0);
  assert.equal(adapter.mkdirCount, 0);
});

test("each distribution source must exist and carry its managed header", async () => {
  for (const id of ["base", "mobile"]) {
    const missing = new FakeAdapter({ sources: { [id]: null } });
    await assert.rejects(() => syncCoreStyle({}, fakeApp(missing)), /distribution source/);

    const unrecognized = new FakeAdapter({ sources: { [id]: "body {}\n" } });
    await assert.rejects(() => syncCoreStyle({}, fakeApp(unrecognized)), /source is not recognized/);
  }
});

test("target parent and target type mismatches fail closed", async () => {
  const parentFile = new FakeAdapter();
  parentFile.files.set(".obsidian/snippets", buffer("not a folder"));
  await assert.rejects(() => syncCoreStyle({}, fakeApp(parentFile)), /target parent is not a folder/);

  const targetFolder = new FakeAdapter();
  targetFolder.folders.add(".obsidian/snippets");
  targetFolder.folders.add(".obsidian/snippets/obsidian-core-mobile.css");
  await assert.rejects(() => syncCoreStyle({}, fakeApp(targetFolder)), /target \(mobile\) is not a file/);
});

test("post-write byte verification catches an adapter that does not persist desired bytes", async () => {
  const adapter = new FakeAdapter({ corruptWrites: true });
  await assert.rejects(() => syncCoreStyle({}, fakeApp(adapter)), /verification failed after write/);
  assert.equal(adapter.writeCount, 1);
});

test("missing app/Vault adapter fails without touching any global filesystem API", async () => {
  await assert.rejects(() => syncCoreStyle({}, null), /Vault adapter is required/);
});
