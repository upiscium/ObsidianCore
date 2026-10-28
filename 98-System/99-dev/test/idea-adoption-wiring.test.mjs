import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const commandPaths = [
  ["98-System/00-command/adopt_idea.md", "adopt"],
  ["98-System/00-command/cancel_idea_adoption.md", "revoke"],
  ["98-System/00-command/archive_idea.md", "archive"]
];

async function runCommand(commandPath, { mobile = false, userFn, source = "module.exports = async (tp, action) => ({ action });", failRead = false } = {}) {
  const notices = [];
  const calls = [];
  const app = { vault: {
    getAbstractFileByPath: p => p === "98-System/01-script/transition_idea.js" ? { path: p, extension: "js" } : null,
    read: async () => { if (failRead) throw new Error("untrusted secret"); return source; }
  } };
  const tp = { app, obsidian: { Platform: { isMobile: mobile }, Notice: function Notice(message) { notices.push(message); } }, user: userFn ? { transition_idea: async (...args) => { calls.push(args); return userFn(...args); } } : {} };
  const text = read(commandPath).replace(/^<%\*\s*/, "").replace(/\s*-%>\s*$/, "");
  await new AsyncFunction("tp", "app", "globalThis", text)(tp, app, globalThis);
  return { calls, notices };
}

test("command loaders invoke desktop user function and mobile/fallback fixed-path module", async () => {
  for (const [file, action] of commandPaths) {
    const desktop = await runCommand(file, { userFn: async () => "ok" });
    assert.equal(desktop.calls.length, 1);
    assert.equal(desktop.calls[0][1], action);
    assert.deepEqual(desktop.notices, []);

    for (const options of [{ mobile: true }, {}]) {
      const result = await runCommand(file, options);
      assert.deepEqual(result.notices, []);
    }
    const fallback = await runCommand(file, { source: "module.exports = async (tp, action) => { globalThis.__ideaTestAction = action; };" });
    assert.deepEqual(fallback.notices, []);
    assert.equal(globalThis.__ideaTestAction, action);
    delete globalThis.__ideaTestAction;
  }
});

test("command loader failures are swallowed and notices do not expose error text", async () => {
  for (const options of [
    { mobile: true, failRead: true },
    { source: "module.exports = {};" },
    { source: "throw new Error('untrusted secret');" },
    { source: "" },
    { userFn: async () => { throw new Error("untrusted secret"); } }
  ]) {
    const result = await runCommand(commandPaths[0][0], options);
    assert.equal(result.notices.length, 1);
    assert.doesNotMatch(result.notices[0], /untrusted secret/);
  }
  const mobile = await runCommand(commandPaths[0][0], { mobile: true, userFn: async () => { throw new Error("desktop function must not run"); } });
  assert.equal(mobile.calls.length, 0); assert.deepEqual(mobile.notices, []);
});

test("command wrappers handle missing Templater, app and fixed script with only a safe Notice", async () => {
  for (const [file] of commandPaths) for (const missing of ["tp", "app", "script"]) {
    const notices = [];
    const Notice = function (message) { notices.push(message); };
    const app = missing === "script" ? { vault: { getAbstractFileByPath: () => null } } : undefined;
    const tp = missing === "tp" ? undefined : { app, obsidian: { Notice, Platform: { isMobile: true } } };
    const text = read(file).replace(/^<%\*\s*/, "").replace(/\s*-%>\s*$/, "");
    await new AsyncFunction("tp", "globalThis", text)(tp, { Notice });
    assert.equal(notices.length, 1, `${file}: ${missing}`);
    assert.doesNotMatch(notices[0], /Error|undefined|script unavailable/);
  }
});

test("Idea UI uses command transitions, read-only adoption fields and no status-only writes", () => {
  const ui = read("98-System/02-embed/00-meta/idea-meta.md");
  assert.doesNotMatch(ui, /idea-status-active|type: updateMetadata/);
  assert.match(ui, /label: Adopt \(Project\)/);
  assert.match(ui, /label: Cancel Adoption/);
  const exposed = [...ui.matchAll(/BUTTON\[([^\]]+)\]/g)].flatMap(match => match[1].split(",").map(id => id.trim()));
  for (const id of ["idea-status-adopted", "idea-cancel-adoption", "idea-status-archived"]) {
    assert.ok(exposed.includes(id), `${id} is exposed, not merely a hidden definition`);
  }
  assert.match(ui, /VIEW\[\{adopted_project\}\]\[text\]/);
  assert.match(ui, /VIEW\[\{adopted_at\}\]\[text\]/);
  assert.match(ui, /idea-adoption#Legacy metadata repair/);
  for (const [file] of commandPaths) assert.match(ui, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(read("98-System/02-embed/01-button/idea-buttons.md"), /bindTarget: status|value: adopted/);
});

function makeContextHarness(frontmatter, { adoptionDuringChooser = false } = {}) {
  let mutations = 0;
  const notices = [];
  const activeFile = { path: "05-Idea/test.md", extension: "md" };
  const app = {
    workspace: { getActiveFile: () => activeFile },
    metadataCache: { getFileCache: () => ({ frontmatter }) },
    fileManager: { processFrontMatter: async (_file, callback) => { mutations++; callback(frontmatter); } },
    vault: {
      getAbstractFileByPath: p => ({ path: p, extension: "js" }),
      read: async file => file.path === "98-System/01-script/reference_utils.js"
        ? "({})"
        : file.path.endsWith("entity_reference_utils.js")
          ? "G => ({ findEntityNotes: (_app, options) => options.folder === '03-Workspace' ? [{ displayName: 'W', lifecycle: 'active' }] : [{ displayName: 'P', status: 'active', workspace: 'W' }], entityMatchesReference: () => true, makeEntityLink: (_app, entity) => entity?.displayName ?? '' })"
          : "({ isWorkspaceActiveLifecycle: x => x === 'active', isProjectActiveStatus: x => x === 'active' })"
    }
  };
  const tp = { app, obsidian: { Notice: function Notice(message) { notices.push(message); } }, system: { suggester: async (_labels, choices) => {
    if (adoptionDuringChooser) frontmatter.adopted_at = "historical";
    return choices[0];
  } } };
  return { app, tp, notices, get mutations() { return mutations; } };
}

test("context guard refuses adopted, legacy-pair and historical-field records at entry without mutation", async () => {
  const selectModule = { exports: {} };
  const select = new Function("module", "exports", read("98-System/01-script/select_idea_context.js") + "\nreturn module.exports;")(selectModule, selectModule.exports);
  for (const fm of [
    { type: "idea", status: "adopted" },
    { type: "idea", status: "active", adopted_project: "[[Project]]", adopted_at: "2026-01-01" },
    { type: "idea", status: "archived", adopted_at: "old" },
    { type: "idea", status: "active", adopted_at: " " },
    { type: "idea", status: "active", adopted_project: [] }
  ]) {
    const h = makeContextHarness(fm);
    await select(h.tp);
    assert.equal(h.mutations, 0);
    assert.match(h.notices[0], /採用取消|履歴/);
  }
});

test("context guard checks again after chooser and within callback before any write", async () => {
  const selectModule = { exports: {} };
  const select = new Function("module", "exports", read("98-System/01-script/select_idea_context.js") + "\nreturn module.exports;")(selectModule, selectModule.exports);
  const h = makeContextHarness({ type: "idea", status: "active" }, { adoptionDuringChooser: true });
  await select(h.tp);
  assert.equal(h.mutations, 0);
  assert.match(h.notices.at(-1), /選択中/);

  const race = makeContextHarness({ type: "idea", status: "active" });
  let callbacks = 0;
  race.app.fileManager.processFrontMatter = async (_file, callback) => {
    callbacks++;
    // Adoption arrives after the preflight read but before the atomic callback.
    const fm = race.app.metadataCache.getFileCache().frontmatter;
    fm.status = "adopted";
    callback(fm);
  };
  await select(race.tp);
  assert.equal(callbacks, 1);
  assert.equal(race.app.metadataCache.getFileCache().frontmatter.workspace, undefined);
});
