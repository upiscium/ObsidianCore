import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { audit, checkInterfaces, codeReferences, extractReferences, inScope, loadTracked, readChecked, resolveReference, REGISTRY } from "../tools/system-reference-audit.mjs";

const P = "98-System/02-embed/00-meta/knowledge-meta.md";
const manifest = groups => ({ schema_version: 1, baseline_revision: "a".repeat(40), groups });
const contract = (target = P, resolution = "basename") => manifest([{ resolution, consumer: "fixture", paths: [target] }]);
const files = () => new Map([[P, "metadata controls"], ["Dashboard.md", "```meta-bind-embed\n[[knowledge-meta]]\n```\n"]]);
const ref = (target, kind = "wikilink_candidate") => ({ source: "Dashboard.md", line: 1, kind, target });

test("public scope excludes private data, plugin settings, fixtures and dev source", () => {
  for (const name of ["Dashboard.md", P, "98-System/05-lib/work/logic.js", ".obsidian/appearance.json", ".obsidian/snippets/work-time.css"]) assert.equal(inScope(name), true);
  for (const name of ["11-Knowledge/private.md", ".obsidian/plugins/quickadd/data.json", "98-System/99-dev/test/a.test.mjs", "98-System/99-dev/fixtures/a.md", ".git/config"]) assert.equal(inScope(name), false);
});

test("Meta Bind embeds preserve kind, alias, anchor and source line in blockquotes", () => {
  const refs = extractReferences("Dashboard.md", "> ```meta-bind-embed\n> [[knowledge-meta#Controls|Metadata]]\n> ```\n");
  assert.deepEqual(refs, [{ source: "Dashboard.md", line: 2, kind: "meta_bind_embed", target: "knowledge-meta#Controls|Metadata" }]);
  assert.equal(resolveReference(refs[0], files()).anchor_unchecked, true);
  assert.equal(resolveReference(refs[0], files()).resolution, "resolved_file");
});

test("ordinary code examples are not interpreted as live embeds or user calls", () => {
  assert.deepEqual(extractReferences("Dashboard.md", "````markdown\n```meta-bind-embed\n[[example]]\n```\n<% tp.user.fake() %>\n````\n"), []);
});

test("wikilinks outside code are static candidates, not permission to rewrite", () => {
  const refs = extractReferences("Dashboard.md", "[[knowledge-meta]] ![[11-Knowledge/private]]\n");
  assert.deepEqual(refs.map(r => r.kind), ["wikilink_candidate", "wikilink_candidate"]);
  assert.equal(resolveReference(refs[1], files()).resolution, "external_vault_unchecked");
});

test("unresolved short names and private targets remain unknown, not missing-system", () => {
  for (const target of ["private", "11-Knowledge/hub"]) assert.equal(resolveReference(ref(target), files()).resolution, "external_vault_unchecked");
  assert.equal(resolveReference(ref("98-System/missing.md"), files()).resolution, "missing_system");
});

test("short-name ambiguity includes both candidates and never chooses one", () => {
  const f = files(); f.set("98-System/02-embed/other/knowledge-meta.md", "other");
  assert.equal(resolveReference(ref("knowledge-meta"), f).resolution, "ambiguous");
  assert.equal(resolveReference(ref(P), f).resolution, "resolved_file");
});

test("unsafe paths, URLs, same-note anchors, and dynamic templates are distinct", () => {
  for (const value of ["../x", "/tmp/x", "a\\b", "98-System/../x"]) assert.equal(resolveReference(ref(value), files()).resolution, "unsafe_or_unsupported_path");
  assert.equal(resolveReference(ref("https://example.invalid"), files()).resolution, "external_url");
  assert.equal(resolveReference(ref("#Section"), files()).resolution, "same_file_anchor_unchecked");
  const [dynamic] = extractReferences("Dashboard.md", "[[<% tp.file.title %>]]");
  assert.equal(resolveReference(dynamic, files()).resolution, "dynamic_unchecked");
});

test("Templater and Dataview literal calls are read without executing code", () => {
  const source = "globalThis.AUDIT_EXECUTED = true;\n// tp.user.comment()\n/* dv.view('ignore') */\nconst s = 'tp.user.string()';\nawait dv.view('98-System/04-view/task_table', {});\nawait dv.io.load(\"98-System/01-script/helper.js\");\ntp.user.add_work(tp);";
  const refs = codeReferences("fixture.js", source);
  assert.equal(globalThis.AUDIT_EXECUTED, undefined);
  assert.deepEqual(refs.map(r => r.kind).sort(), ["dataview_load", "dataview_view", "templater_user"]);
  assert.equal(refs.find(r => r.kind === "templater_user").line, 7);
  assert.ok(refs.some(r => r.target === "98-System/01-script/add_work.js"));
});

test("variable, concatenated, escaped and interpolated calls are not guessed", () => {
  for (const code of ["dv.view(path)", "dv.view('a' + suffix)", "dv.view(`a/${name}`)", "dv.io.load('a\\x20b')"]) {
    const [r] = codeReferences("a.js", code); assert.equal(r.target, null);
  }
});

test("Dataview file and directory view forms resolve and missing view is explicit", () => {
  const f = files(); f.set("98-System/04-view/a.js", "// a"); f.set("98-System/04-view/b/view.js", "// b");
  for (const name of ["a", "b"]) assert.equal(resolveReference(ref(`98-System/04-view/${name}`, "dataview_view"), f).resolution, "resolved_file");
  assert.equal(resolveReference(ref("98-System/04-view/c", "dataview_view"), f).resolution, "missing_system");
});

test("dynamic Dataview inside a code fence retains original line", () => {
  const refs = extractReferences(P, "# Heading\n```dataviewjs\nawait dv.view(dynamic);\n```\n");
  assert.equal(refs[0].line, 3); assert.equal(refs[0].target, null);
});

test("multi-line Templater block is inspected without evaluation", () => {
  const refs = extractReferences(P, "<%*\nawait tp.user.add_work(tp);\n%>\n");
  assert.equal(refs[0].line, 2); assert.equal(refs[0].kind, "templater_user");
});

test("Meta Bind action/template paths and external navigation remain separate", () => {
  const refs = extractReferences(P, "```meta-bind-button\naction:\n  templateFile: \"98-System/00-command/add_work.md\"\n  link: \"11-Knowledge/hub\"\n```\n");
  assert.deepEqual(refs.map(r => r.kind), ["meta_bind_template", "meta_bind_open"]);
  assert.equal(refs[0].target, "98-System/00-command/add_work.md");
});

test("selected config paths and enabled snippets are inventoried, not arbitrary values", () => {
  const refs = extractReferences(".obsidian/appearance.json", JSON.stringify({ cssTheme: "Tokyo Night", enabledCssSnippets: ["work-time"] }));
  assert.deepEqual(refs.map(r => r.target), [".obsidian/snippets/work-time.css"]);
  const config = extractReferences("config.json", JSON.stringify({ script: "98-System/01-script/add_work.js", token: "PRIVATE_CANARY" }));
  assert.equal(JSON.stringify(config).includes("PRIVATE_CANARY"), false);
  assert.equal(config[0].pointer, "/script");
});

test("explicit directory references remain candidates, not proven loads", () => {
  const f = files();
  assert.equal(resolveReference(ref("98-System/02-embed", "config_path"), f).resolution, "directory_candidate");
});

test("public entrypoints catch deletion and rename even with no incoming references", () => {
  const f = files(); f.delete(P);
  assert.equal(checkInterfaces(f, contract()).errors[0].code, "public_interface_missing");
  f.set(P.replace("knowledge-meta", "renamed"), "controls");
  assert.equal(checkInterfaces(f, contract()).errors[0].code, "public_interface_missing");
});

test("public basename collisions are checked case-insensitively", () => {
  const f = files(); f.set("98-System/02-embed/else/KNOWLEDGE-META.md", "collision");
  assert.equal(checkInterfaces(f, contract()).errors[0].code, "public_interface_name_collision");
});

test("function-name collisions are confined to registered script root", () => {
  const p = "98-System/01-script/add_work.js"; const f = new Map([[p, "module.exports = () => {};"]]);
  f.set("98-System/05-lib/work/add_work.js", "logic");
  assert.equal(checkInterfaces(f, contract(p, "user_function")).errors.length, 0);
  f.set("98-System/01-script/other/add_work.js", "other");
  assert.equal(checkInterfaces(f, contract(p, "user_function")).errors.length, 1);
});

test("known empty command is explicit, unexpected empty public entrypoint fails", () => {
  const p = "98-System/00-command/create_subscription.md";
  const f = new Map([[p, ""]]);
  assert.equal(checkInterfaces(f, contract(p, "exact")).errors[0].code, "public_interface_empty");
  const c = contract(p, "exact"); c.groups[0].known_empty = [p];
  const result = checkInterfaces(f, c);
  assert.equal(result.errors.length, 0); assert.equal(result.notices[0].code, "known_empty_command");
});

test("malformed registry, duplicate interfaces and unsafe registrations fail closed", () => {
  for (const value of [null, {}, { ...contract(), schema_version: 2 }, { ...contract(), unknown: true }]) assert.throws(() => checkInterfaces(files(), value));
  for (const p of ["../escape.md", "11-Knowledge/private.md"]) assert.throws(() => checkInterfaces(files(), contract(p)));
  const duplicate = contract(); duplicate.groups[0].paths.push(P);
  assert.throws(() => checkInterfaces(files(), duplicate));
});

test("inventory is deterministic and explicitly forbids deletion inference", () => {
  const a = audit(files(), contract());
  const b = audit(new Map([...files()].reverse()), contract());
  assert.deepEqual(a, b); assert.equal(a.inspection_only, true);
  assert.equal(a.complete_dependency_graph, false); assert.equal(a.private_vault_checked, false);
  assert.equal(a.safe_to_delete_unreferenced, false);
});

test("missing candidate does not silently become a proven clean global gate", () => {
  const f = files(); f.set("Dashboard.md", "[[98-System/missing.md]]");
  const r = audit(f, contract());
  assert.equal(r.summary.resolutions.missing_system, 1);
  assert.equal(r.summary.interface_errors, 0);
  assert.equal(r.complete_dependency_graph, false);
});

function sandbox(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "core-reference-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
function write(root, name, content) {
  fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
  fs.writeFileSync(path.join(root, name), content);
}

test("collector sees tracked scoped files only and leaves bytes unchanged", t => {
  const root = sandbox(t);
  spawnSync("git", ["init", "-q"], { cwd: root });
  for (const [name, text] of files()) write(root, name, text);
  write(root, REGISTRY, JSON.stringify(contract()));
  write(root, "11-Knowledge/private.md", "PRIVATE_CANARY");
  write(root, ".obsidian/plugins/quickadd/data.json", '{"secret":"PRIVATE_CANARY"}');
  assert.equal(spawnSync("git", ["add", "."], { cwd: root }).status, 0);
  write(root, "98-System/02-embed/untracked.md", "not tracked");
  const before = fs.readFileSync(path.join(root, P));
  const input = loadTracked(root);
  assert.deepEqual([...input.files.keys()].sort(), [...files().keys()].sort());
  assert.equal(JSON.stringify(audit(input.files, input.registry)).includes("PRIVATE_CANARY"), false);
  assert.deepEqual(fs.readFileSync(path.join(root, P)), before);
});

test("filesystem collection rejects symlink leaf and parent and oversized files", t => {
  const root = sandbox(t);
  write(root, "real/file.md", "source");
  fs.symlinkSync("real/file.md", path.join(root, "leaf.md"));
  fs.symlinkSync("real", path.join(root, "parent"));
  assert.throws(() => readChecked(root, "leaf.md"));
  assert.throws(() => readChecked(root, "parent/file.md"));
  assert.throws(() => readChecked(root, "../outside"));
  write(root, "large.md", "x".repeat(2 * 1024 * 1024 + 1));
  assert.throws(() => readChecked(root, "large.md"));
});
