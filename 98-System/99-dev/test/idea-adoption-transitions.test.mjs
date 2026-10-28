import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const sourceCode = read("98-System/01-script/transition_idea.js");
const loadTransition = (text = sourceCode, windowMock = { moment: () => ({ format: () => "2026-10-28" }) }) => {
  const module = { exports: {} };
  new Function("module", "exports", "window", text)(module, module.exports, windowMock);
  return module.exports;
};
const yaml = fm => JSON.stringify(fm, null, 2);
const encode = (fm, body = "Body preserved\n") => `---\n${yaml(fm)}\n---\n${body}`;
function parse(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) throw Error("bad yaml");
  return JSON.parse(match[1]);
}

function harness({ idea = {}, workspace = {}, projects = [], confirm = true, choose = 0, moment = "2026-10-28", missing = [], parseThrows = false, onChooser, beforeCallback, callbackMutation, cacheOverride } = {}) {
  const files = new Map();
  let writes = 0, callbackCalls = 0;
  const notices = [];
  const make = (p, fm, body = "Body preserved\n", extension = p.split(".").at(-1)) => {
    const file = { path: p, basename: p.split("/").at(-1).replace(/\.[^.]+$/, ""), extension, stat: { mtime: 1, size: 1 }, raw: encode(fm, body), body };
    files.set(p, file); file.stat.size = file.raw.length;
    return file;
  };
  const ws = make("03-Workspace/Studio.md", { type: "workspace", lifecycle: "active", ...workspace });
  const ideaFile = make("05-Idea/Idea.md", { type: "idea", status: "active", workspace: "[[03-Workspace/Studio]]", custom: "keep", ...idea }, "Idea body\n");
  const projectFiles = projects.map((p, i) => make(p.path ?? `10-Project/Project${i + 1}.md`, { type: "project", status: "planning", workspace: "[[03-Workspace/Studio]]", ...p.fm }));
  const get = p => files.get(p) ?? null;
  const app = {
    workspace: { getActiveFile: () => ideaFile },
    vault: {
      getAbstractFileByPath: get,
      getMarkdownFiles: () => [...files.values()].filter(f => f.extension === "md"),
      read: async file => { if (!file) throw Error("missing"); return file.raw; }
    },
    metadataCache: { getFileCache: file => ({ frontmatter: cacheOverride?.(file) ?? parse(file.raw) }) },
    fileManager: { processFrontMatter: async (file, callback) => {
      beforeCallback?.(file);
      const current = parse(file.raw), draft = structuredClone(current);
      callbackCalls++;
      callbackMutation?.(draft, file);
      callback(draft);
      const body = file.raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/)?.[1] ?? "";
      file.raw = encode(draft, body); file.stat.mtime++; file.stat.size = file.raw.length; writes++;
    } }
  };
  const tp = {
    app, obsidian: { parseYaml: text => { if (parseThrows) throw Error("untrusted parser detail"); return JSON.parse(text); }, Notice: function Notice(message) { notices.push(message); } },
    system: { suggester: async (_labels, choices, _multiple, prompt) => {
      const targetChoices = choices.some?.(x => x?.file && x?.fm);
      if (targetChoices) { await onChooser?.({ choices, prompt, files, app }); return choices[choose] ?? null; }
      return confirm;
    } }
  };
  app.vault.getAbstractFileByPath = p => {
    if (missing.includes(p)) return null;
    if (p.startsWith("98-System/01-script/")) return { path: p, extension: "js" };
    return get(p);
  };
  app.vault.read = async file => file.path.startsWith("98-System/01-script/") ? read(file.path) : file.raw;
  return { tp, app, ideaFile, ws, projectFiles, files, make, notices, get writes() { return writes; }, get callbackCalls() { return callbackCalls; }, fm: file => parse(file.raw), transition: loadTransition(undefined, { moment: () => ({ format: pattern => { assert.equal(pattern, "YYYY-MM-DD"); return moment; } }) }) };
}

test("adopt writes exact qualified target and local date while preserving custom metadata and body", async () => {
  const h = harness({ idea: { project: "[[10-Project/Related]]", custom: { retained: true } }, projects: [{ path: "10-Project/Related.md" }, { path: "10-Project/Chosen.md" }], choose: 1 });
  const result = await h.transition(h.tp, "adopt");
  assert.equal(result.status, "adopted");
  assert.deepEqual([h.fm(h.ideaFile).status, h.fm(h.ideaFile).adopted_project, h.fm(h.ideaFile).adopted_at], ["adopted", "[[10-Project/Chosen]]", "2026-10-28"]);
  assert.deepEqual(h.fm(h.ideaFile).custom, { retained: true });
  assert.match(h.ideaFile.raw, /Idea body\n$/);
  assert.equal(h.writes, 1);
});

test("chooser and confirmation cancellation do not write; repeated same target is idempotent", async () => {
  let h = harness({ projects: [{}], confirm: false });
  assert.equal((await h.transition(h.tp, "adopt")).status, "cancelled"); assert.equal(h.writes, 0);
  h = harness({ idea: { status: "adopted", adopted_project: "[[10-Project/Project1]]", adopted_at: "2026-02-28" }, projects: [{}] });
  assert.equal((await h.transition(h.tp, "adopt")).status, "unchanged");
  assert.equal(h.writes, 0); assert.equal(h.fm(h.ideaFile).adopted_at, "2026-02-28");
});

test("different project cannot overwrite, revoke clears only adoption pair, archive keeps it", async () => {
  const fm = { status: "adopted", adopted_project: "[[10-Project/Project1]]", adopted_at: "2026-02-28" };
  let h = harness({ idea: fm, projects: [{}, { path: "10-Project/Second.md" }] });
  h.tp.system.suggester = async (_l, choices) => choices.some?.(x => x?.file && x?.fm) ? choices[1] : true;
  assert.equal((await h.transition(h.tp, "adopt")).status, "refused"); assert.equal(h.writes, 0);
  h = harness({ idea: fm, projects: [{}] });
  assert.equal((await h.transition(h.tp, "revoke")).status, "revoked");
  assert.equal(h.fm(h.ideaFile).status, "active"); assert.equal("adopted_project" in h.fm(h.ideaFile), false); assert.equal("adopted_at" in h.fm(h.ideaFile), false);
  h = harness({ idea: fm, projects: [{}] });
  assert.equal((await h.transition(h.tp, "archive")).status, "archived");
  assert.equal(h.fm(h.ideaFile).adopted_project, fm.adopted_project); assert.equal(h.fm(h.ideaFile).adopted_at, fm.adopted_at);
  assert.equal((await h.transition(h.tp, "adopt")).status, "refused");
});

test("legacy and partial adoption histories are never guessed or changed", async () => {
  for (const idea of [{ status: "adopted" }, { status: "active", adopted_project: "[[10-Project/X]]" }, { status: "active", adopted_at: "2026-01-01" }, { status: "adopted", adopted_project: "[[10-Project/X]]", adopted_at: "2026-02-30" }]) {
    const h = harness({ idea }); const before = h.ideaFile.raw;
    assert.equal((await h.transition(h.tp, "revoke")).status, "refused"); assert.equal(h.writes, 0); assert.equal(h.ideaFile.raw, before);
  }
});

test("candidate eligibility is restricted to same active Workspace planning/running Projects", async () => {
  const statuses = ["planning", "running", "stopped", "stable", "done", "cancelled"];
  for (const status of statuses) {
    const h = harness({ projects: [{ fm: { status } }] });
    const result = await h.transition(h.tp, "adopt");
    assert.equal(result.status, ["planning", "running"].includes(status) ? "adopted" : "refused", status);
  }
  const h = harness({ workspace: { lifecycle: "inactive" }, projects: [{}] });
  assert.equal((await h.transition(h.tp, "adopt")).status, "refused"); assert.equal(h.writes, 0);
});

test("invalid local dates are refused; strict calendar and leap-year rules are honored", async () => {
  for (const [date, expected] of [["2026-02-29", "refused"], ["1900-02-29", "refused"], ["2026-13-01", "refused"], ["not-a-date", "refused"],
    ["0000-01-01", "refused"], ["2026-1-01", "refused"], ["2026-01-01T00:00:00Z", "refused"], [" 2026-01-01", "refused"], [null, "refused"],
    ["2024-02-29", "adopted"], ["2000-02-29", "adopted"]]) {
    const h = harness({ projects: [{}], moment: date });
    assert.equal((await h.transition(h.tp, "adopt")).status, expected, date);
    assert.equal(h.writes, expected === "adopted" ? 1 : 0);
  }
});

test("core dependencies, parser failures and callback failures fail safely without leaked errors", async () => {
  for (const [options, expected] of [[{ missing: ["98-System/01-script/idea_meta_utils.js"] }, "refused"], [{ parseThrows: true }, "error"]]) {
    const h = harness({ projects: [{}], ...options });
    assert.equal((await h.transition(h.tp, "adopt")).status, expected); assert.equal(h.writes, 0);
    assert.doesNotMatch(h.notices.join(" "), /untrusted|parser detail/);
  }
  const h = harness({ projects: [{}] });
  h.app.fileManager.processFrontMatter = async (_file, callback) => { callback(parse(h.ideaFile.raw)); throw Error("private error"); };
  assert.equal((await h.transition(h.tp, "adopt")).status, "error");
  assert.doesNotMatch(h.notices.join(" "), /private error/);
});

function replaceFrontmatter(file, patch) {
  const fm = parse(file.raw); Object.assign(fm, patch);
  const body = file.raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/)?.[1] ?? "";
  file.raw = encode(fm, body); file.stat.mtime++; file.stat.size = file.raw.length;
}
function assertNoWrite(h, original) {
  assert.equal(h.writes, 0); assert.equal(h.ideaFile.raw, original);
}

test("adopt rerun is stable; revoke then explicit re-adoption preserves unrelated metadata", async () => {
  const h = harness({ idea: { project: "[[10-Project/Project1]]", ai_note: "keep", custom: { x: 1 } }, projects: [{}], moment: "2026-04-30" });
  assert.equal((await h.transition(h.tp, "adopt")).status, "adopted");
  assert.equal((await h.transition(h.tp, "adopt")).status, "unchanged");
  assert.equal(h.writes, 1); assert.equal(h.fm(h.ideaFile).adopted_at, "2026-04-30");
  assert.equal((await h.transition(h.tp, "revoke")).status, "revoked");
  assert.equal(h.fm(h.ideaFile).project, "[[10-Project/Project1]]"); assert.equal(h.fm(h.ideaFile).ai_note, "keep");
  assert.deepEqual(h.fm(h.ideaFile).custom, { x: 1 });
  assert.equal((await h.transition(h.tp, "adopt")).status, "adopted");
  assert.equal(h.fm(h.ideaFile).adopted_at, "2026-04-30"); assert.equal(h.writes, 3);
});

test("historical revoke permits inactive Workspace and completed adopted Project", async () => {
  const h = harness({ workspace: { lifecycle: "inactive" }, idea: { status: "adopted", adopted_project: "[[10-Project/Project1]]", adopted_at: "2024-02-29" }, projects: [{ fm: { status: "done" } }] });
  assert.equal((await h.transition(h.tp, "revoke")).status, "revoked"); assert.equal(h.writes, 1);
});

test("chooser cancellation/interruption never mutates", async () => {
  let h = harness({ projects: [{}], choose: -1 }); let original = h.ideaFile.raw;
  assert.equal((await h.transition(h.tp, "adopt")).status, "cancelled"); assertNoWrite(h, original);
  h = harness({ projects: [{}], onChooser: () => { throw Error("private chooser exception"); } }); original = h.ideaFile.raw;
  assert.equal((await h.transition(h.tp, "adopt")).status, "error"); assertNoWrite(h, original);
  assert.doesNotMatch(h.notices.join(" "), /private chooser exception/);
});

test("source changes during chooser and stale/cross-workspace references are refused", async () => {
  for (const mutate of [
    h => replaceFrontmatter(h.ideaFile, { status: "archived" }),
    h => replaceFrontmatter(h.ideaFile, { workspace: "[[03-Workspace/Other]]" })
  ]) {
    let h, expected; h = harness({ projects: [{}], onChooser: () => { mutate(h); expected = h.ideaFile.raw; } });
    assert.equal((await h.transition(h.tp, "adopt")).status, "refused"); assertNoWrite(h, expected);
  }
  for (const idea of [{ workspace: ["[[Studio]]"] }, { workspace: "[[03-Workspace/Missing]]" }, { workspace: "[[03-Workspace/Studio]]", project: "[[10-Project/Other]]" }]) {
    const h = harness({ idea, projects: [{}] }); const before = h.ideaFile.raw;
    assert.equal((await h.transition(h.tp, "adopt")).status, "refused"); assertNoWrite(h, before);
  }
});

test("dependency status, ownership and lifecycle changes during chooser/callback abort atomically", async () => {
  for (const phase of ["chooser", "callback"]) for (const mutate of [
    h => replaceFrontmatter(h.projectFiles[0], { status: "done" }),
    h => replaceFrontmatter(h.projectFiles[0], { workspace: "[[03-Workspace/Other]]" }),
    h => replaceFrontmatter(h.ws, { lifecycle: "inactive" })
  ]) {
    let h; h = harness({ projects: [{}], onChooser: phase === "chooser" ? () => mutate(h) : null, beforeCallback: phase === "callback" ? () => mutate(h) : null });
    const before = h.ideaFile.raw;
    assert.equal((await h.transition(h.tp, "adopt")).status, "refused", phase);
    assertNoWrite(h, before);
  }
});

test("critical callback edits abort, while concurrent custom/body edits survive", async () => {
  let h = harness({ projects: [{}], callbackMutation: fm => { fm.status = "archived"; } });
  let before = h.ideaFile.raw;
  assert.equal((await h.transition(h.tp, "adopt")).status, "refused"); assertNoWrite(h, before); assert.equal(h.callbackCalls, 1);
  h = harness({ projects: [{}], beforeCallback: file => {
    replaceFrontmatter(file, { custom: "concurrent edit" });
    file.raw = file.raw.replace("Idea body", "Concurrent body"); file.stat.mtime++; file.stat.size = file.raw.length;
  } });
  assert.equal((await h.transition(h.tp, "adopt")).status, "adopted");
  assert.equal(h.fm(h.ideaFile).custom, "concurrent edit"); assert.match(h.ideaFile.raw, /Concurrent body/);
});

test("callback-time target status/owner/type changes and missing/recreated/renamed targets abort", async () => {
  const mutations = [
    h => replaceFrontmatter(h.projectFiles[0], { status: "running" }),
    h => replaceFrontmatter(h.projectFiles[0], { status: "done" }),
    h => replaceFrontmatter(h.projectFiles[0], { workspace: "[[03-Workspace/Other]]" }),
    h => replaceFrontmatter(h.projectFiles[0], { type: "note" }),
    h => h.files.delete(h.projectFiles[0].path),
    h => { const old = h.projectFiles[0]; h.files.set(old.path, { ...old }); },
    h => { const old = h.projectFiles[0]; h.files.delete(old.path); old.path = "10-Project/Renamed.md"; h.files.set(old.path, old); }
  ];
  for (const mutate of mutations) {
    let h; h = harness({ projects: [{}], beforeCallback: () => mutate(h) }); const before = h.ideaFile.raw;
    assert.equal((await h.transition(h.tp, "adopt")).status, "refused"); assertNoWrite(h, before);
  }
});

test("stale cache and newly ambiguous external basename are refused without writes", async () => {
  let cached;
  let h; h = harness({ projects: [{}], cacheOverride: file => file === h?.ideaFile && cached ? cached : undefined });
  cached = h.fm(h.ideaFile);
  h.tp.system.suggester = async (_labels, choices) => {
    if (choices.some?.(x => x?.file && x?.fm)) { replaceFrontmatter(h.ideaFile, { status: "archived" }); return choices[0]; }
    return true;
  };
  assert.equal((await h.transition(h.tp, "adopt")).status, "refused");
  assert.equal(h.writes, 0); assert.equal(h.fm(h.ideaFile).status, "archived"); assert.equal(h.fm(h.ideaFile).adopted_project, undefined);

  h = harness({ idea: { project: "[[Project1]]" }, projects: [{}] });
  h.files.set("Other/Project1.md", { ...h.projectFiles[0], path: "Other/Project1.md" }); const before = h.ideaFile.raw;
  assert.equal((await h.transition(h.tp, "adopt")).status, "refused"); assertNoWrite(h, before);
});

test("chooser exposes only verified same-Workspace planning/running Projects", async () => {
  let offered;
  const h = harness({ projects: [
    { path: "10-Project/Plan.md" },
    { path: "10-Project/Run.md", fm: { status: "running" } },
    ...["stopped", "stable", "done", "cancelled"].map(status => ({ path: `10-Project/${status}.md`, fm: { status } })),
    { path: "10-Project/Foreign.md", fm: { workspace: "[[03-Workspace/Other]]" } },
    { path: "10-Project/Stale.md", fm: { workspace: "[[Old/Studio]]" } },
    { path: "10-Project/WrongType.md", fm: { type: "note" } }
  ], onChooser: ({ choices }) => { offered = choices.map(item => item.path); } });
  h.make("03-Workspace/Other.md", { type: "workspace", lifecycle: "active" });
  h.make("Elsewhere/Project.md", { type: "project", status: "planning", workspace: "[[Studio]]" });
  assert.equal((await h.transition(h.tp, "adopt")).status, "adopted");
  assert.deepEqual(offered, ["10-Project/Plan.md", "10-Project/Run.md"]);
});

test("strict source references reject arrays, fragments, multiple links, stale qualified paths and wrong types", async () => {
  for (const workspace of [null, [], ["[[Studio]]"], "[[Old/Studio]]", "[[Studio#Header]]", "[[Studio]][[Studio]]",
    "[[../03-Workspace/Studio]]", "[[/03-Workspace/Studio]]", "[[10-Project/Project1]]"]) {
    const h = harness({ idea: { workspace }, projects: [{}] }); const before = h.ideaFile.raw;
    assert.equal((await h.transition(h.tp, "adopt")).status, "refused", JSON.stringify(workspace));
    assertNoWrite(h, before);
  }
});

test("unambiguous short and alias refs resolve but new adoption always stores a full target path", async () => {
  const h = harness({ idea: { workspace: "[[Studio|Home]]", project: "[[Project1]]" }, projects: [{ fm: { workspace: "Studio" } }] });
  assert.equal((await h.transition(h.tp, "adopt")).status, "adopted");
  assert.equal(h.fm(h.ideaFile).adopted_project, "[[10-Project/Project1]]");
  assert.equal(h.fm(h.ideaFile).workspace, "[[Studio|Home]]");
  assert.equal(h.fm(h.ideaFile).project, "[[Project1]]");
});

test("cross-Workspace related or historical adoption links cannot pass through a transition", async () => {
  for (const idea of [
    { project: "[[10-Project/Foreign]]" },
    { status: "adopted", adopted_project: "[[10-Project/Foreign]]", adopted_at: "2024-02-29" }
  ]) for (const action of ["adopt", "revoke", "archive"]) {
    const h = harness({ idea, projects: [{}, { path: "10-Project/Foreign.md", fm: { workspace: "[[03-Workspace/Other]]" } }] });
    h.make("03-Workspace/Other.md", { type: "workspace", lifecycle: "active" });
    const before = h.ideaFile.raw;
    assert.equal((await h.transition(h.tp, action)).status, "refused"); assertNoWrite(h, before);
  }
});

test("all callback-supplied source critical fields are revalidated, not overwritten from preflight", async () => {
  for (const patch of [{ type: "note" }, { status: "adopted" }, { workspace: "[[Other]]" },
    { project: "[[Other]]" }, { adopted_project: "[[Other]]" }, { adopted_at: "2024-02-29" }]) {
    const h = harness({ projects: [{}], callbackMutation: fm => Object.assign(fm, patch) });
    const before = h.ideaFile.raw;
    assert.equal((await h.transition(h.tp, "adopt")).status, "refused"); assertNoWrite(h, before);
    assert.equal(h.callbackCalls, 1);
  }
});

test("source identity, location and active file changes are refused at the callback boundary", async () => {
  for (const mutate of [
    h => { h.app.workspace.getActiveFile = () => h.projectFiles[0]; },
    h => { h.files.set(h.ideaFile.path, { ...h.ideaFile }); },
    h => { h.files.delete(h.ideaFile.path); },
    h => { const file = h.ideaFile; h.files.delete(file.path); file.path = "Elsewhere/Idea.md"; h.files.set(file.path, file); }
  ]) {
    let h; h = harness({ projects: [{}], beforeCallback: () => mutate(h) });
    const before = h.ideaFile.raw;
    assert.equal((await h.transition(h.tp, "adopt")).status, "refused"); assertNoWrite(h, before);
  }
});

test("new basename ambiguity during chooser or callback is checked against the fresh entire Vault", async () => {
  for (const phase of ["chooser", "callback"]) for (const reference of ["workspace", "project"]) {
    let h;
    const collide = () => h.make(reference === "workspace" ? "Elsewhere/Studio.md" : "Elsewhere/Project1.md", { type: "note" });
    h = harness({ idea: { workspace: "[[Studio]]", project: "[[Project1]]" }, projects: [{}],
      onChooser: phase === "chooser" ? collide : null, beforeCallback: phase === "callback" ? collide : null });
    const before = h.ideaFile.raw;
    assert.equal((await h.transition(h.tp, "adopt")).status, "refused"); assertNoWrite(h, before);
  }
});

test("fresh target YAML and cache agreement are mandatory; a lagging or missing cache cannot authorize adoption", async () => {
  let h = harness({ projects: [{}] });
  const cached = h.fm(h.projectFiles[0]);
  replaceFrontmatter(h.projectFiles[0], { status: "cancelled" });
  const originalCache = h.app.metadataCache.getFileCache;
  h.app.metadataCache.getFileCache = file => file === h.projectFiles[0] ? { frontmatter: cached } : originalCache(file);
  const before = h.ideaFile.raw;
  assert.equal((await h.transition(h.tp, "adopt")).status, "refused"); assertNoWrite(h, before);
  h = harness({ projects: [{}] }); h.app.metadataCache.getFileCache = () => null;
  assert.equal((await h.transition(h.tp, "adopt")).status, "refused"); assert.equal(h.writes, 0);
});

test("dependency mutations during a fresh disk read abort before the atomic writer", async () => {
  const h = harness({ projects: [{}] });
  const originalRead = h.app.vault.read; let reads = 0;
  h.app.vault.read = async file => {
    const raw = await originalRead(file);
    if (file === h.projectFiles[0] && ++reads === 2) replaceFrontmatter(file, { status: "cancelled" });
    return raw;
  };
  const before = h.ideaFile.raw;
  assert.equal((await h.transition(h.tp, "adopt")).status, "refused"); assertNoWrite(h, before);
  assert.equal(h.callbackCalls, 0);
});

test("an eligible-to-eligible target status change still invalidates the human selection", async () => {
  let h; h = harness({ projects: [{}], onChooser: () => replaceFrontmatter(h.projectFiles[0], { status: "running" }) });
  const before = h.ideaFile.raw;
  assert.equal((await h.transition(h.tp, "adopt")).status, "refused"); assertNoWrite(h, before);
});

test("missing active note, wrong Idea type/location, missing Templater/parser/app and unknown actions are safe", async () => {
  for (const mutate of [
    h => { h.app.workspace.getActiveFile = () => null; },
    h => { h.app.workspace.getActiveFile = () => h.projectFiles[0]; },
    h => replaceFrontmatter(h.ideaFile, { type: "note" }),
    h => { h.tp.system = undefined; },
    h => { h.tp.obsidian.parseYaml = undefined; },
    h => { h.tp.app = undefined; },
    h => { h.app.fileManager = undefined; }
  ]) {
    const h = harness({ projects: [{}] }); const before = h.ideaFile.raw; mutate(h);
    assert.equal((await h.transition(h.tp, "adopt")).status, "refused");
    assert.equal(h.writes, 0); assert.ok(h.notices.length);
    if (h.fm(h.ideaFile).type === "idea") assert.equal(h.ideaFile.raw, before);
  }
  const h = harness({ projects: [{}] });
  assert.equal((await h.transition(undefined, "adopt")).status, "refused");
  assert.equal((await h.transition(h.tp, "status-only")).status, "refused"); assert.equal(h.writes, 0);
});

test("legacy, partial and malformed history is untouched by every automatic transition", async () => {
  for (const idea of [
    { status: "adopted" }, { status: "adopted", project: "[[10-Project/Project1]]" },
    { status: "adopted", adopted_at: "2024-02-29" },
    { status: "archived", adopted_project: "[[10-Project/Project1]]" },
    { status: "active", adopted_project: [] }, { status: "active", adopted_at: " " },
    { status: "adopted", adopted_project: "[[10-Project/Project1]]", adopted_at: "2026-02-30" }
  ]) for (const action of ["adopt", "revoke", "archive"]) {
    const h = harness({ idea, projects: [{}] }); const before = h.ideaFile.raw;
    assert.equal((await h.transition(h.tp, action)).status, "refused"); assertNoWrite(h, before);
    assert.equal(h.callbackCalls, 0);
  }
});

test("explicit cancellation of revoke/archive and active/archived non-applicable actions never write", async () => {
  for (const action of ["revoke", "archive"]) {
    const h = harness({ idea: { status: "adopted", adopted_project: "[[10-Project/Project1]]", adopted_at: "2024-02-29" }, projects: [{}], confirm: false });
    const before = h.ideaFile.raw;
    assert.equal((await h.transition(h.tp, action)).status, "cancelled"); assertNoWrite(h, before);
  }
  for (const [status, action, expected] of [["active", "revoke", "refused"], ["archived", "archive", "unchanged"], ["archived", "adopt", "refused"]]) {
    const h = harness({ idea: { status }, projects: [{}] }); const before = h.ideaFile.raw;
    assert.equal((await h.transition(h.tp, action)).status, expected); assertNoWrite(h, before);
  }
});

test("all three commands execute the actual canonical transition on desktop and mobile", async () => {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  for (const mobile of [false, true]) for (const [command, action, expected] of [
    ["adopt_idea", "adopt", "adopted"], ["cancel_idea_adoption", "revoke", "active"], ["archive_idea", "archive", "archived"]
  ]) {
    const adopted = action !== "adopt";
    const h = harness({ projects: [{}], idea: adopted ? { status: "adopted", adopted_project: "[[10-Project/Project1]]", adopted_at: "2024-02-29" } : {} });
    h.tp.obsidian.Platform = { isMobile: mobile };
    h.tp.user = mobile ? undefined : { transition_idea: h.transition };
    const commandSource = read(`98-System/00-command/${command}.md`).replace(/^<%\*\s*/, "").replace(/\s*-%>\s*$/, "");
    const fakeGlobal = { window: { moment: () => ({ format: () => "2026-10-28" }) } };
    await new AsyncFunction("tp", "globalThis", commandSource)(h.tp, fakeGlobal);
    assert.equal(h.fm(h.ideaFile).status, expected, `${command} mobile=${mobile}`);
    assert.equal(h.writes, 1);
    if (action === "archive") assert.equal(h.fm(h.ideaFile).adopted_at, "2024-02-29");
  }
});

test("every transition preserves the full body, linking, user metadata and actual AI provenance keys", async () => {
  const body = "```meta-bind-embed\n[[idea-meta]]\n```\n\n# Human title\n\n---\nBody [[Link|alias]]\n";
  const metadata = {
    title: "User title", created: "2026-01-01", aliases: ["Alias"], tags: ["custom/tag"],
    project: "[[10-Project/Related|Related Project]]", origin: "ai-pipeline",
    ai_case_id: "a".repeat(64), ai_source_proposal_sha256: "b".repeat(64),
    ai_source_evaluation_sha256: "c".repeat(64), ai_source_mutation_sha256: "d".repeat(64),
    custom: { nested: ["text", 42, { approved_by: "human" }] }
  };
  for (const action of ["adopt", "revoke", "archive"]) {
    const h = harness({ idea: { ...metadata, ...(action === "adopt" ? {} : {
      status: "adopted", adopted_project: "[[10-Project/Chosen]]", adopted_at: "2024-02-29"
    }) }, projects: [{ path: "10-Project/Chosen.md" }, { path: "10-Project/Related.md" }] });
    h.ideaFile.raw = encode(h.fm(h.ideaFile), body); h.ideaFile.stat.size = h.ideaFile.raw.length;
    const before = h.fm(h.ideaFile);
    assert.equal((await h.transition(h.tp, action)).status, action === "adopt" ? "adopted" : action === "revoke" ? "revoked" : "archived");
    const after = h.fm(h.ideaFile);
    for (const key of ["status", "adopted_project", "adopted_at"]) { delete before[key]; delete after[key]; }
    assert.deepEqual(after, before);
    assert.equal(h.ideaFile.raw.slice(h.ideaFile.raw.indexOf("\n---\n") + 5), body);
    assert.equal(h.callbackCalls, 1); assert.equal(h.writes, 1);
  }
});

test("active archive preserves optional empty adoption fields and has no adoption side effect", async () => {
  const h = harness({ idea: { adopted_project: null, adopted_at: "" } });
  assert.equal((await h.transition(h.tp, "archive")).status, "archived");
  assert.equal(h.fm(h.ideaFile).adopted_project, null); assert.equal(h.fm(h.ideaFile).adopted_at, "");
  assert.equal(h.writes, 1);
});
