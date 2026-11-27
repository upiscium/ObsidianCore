import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const utilityPath = "98-System/01-script/proposal_idea_utils.js";
const runtimePath = "98-System/01-script/keep_proposal_as_idea.js";
const utilitySource = read(utilityPath);
const runtimeSource = read(runtimePath);
const U = new Function(`"use strict"; return (${utilitySource});`)();

const SOURCE = "a".repeat(64);
const GENERATION = "b".repeat(64);
const PROV = `<!-- oa-proposal: {"v":1,"scope":"private-claude","source_sha256":"${SOURCE}","context_sha256":"${"c".repeat(64)}","generation_sha256":"${GENERATION}","model":"m"} -->`;
const PATH = "04-AI/Proposals/アイデアの種.md";

const proposal = `---
type: knowledge-proposal
status: proposed
category: manual
maturity: draft
source_type: web
---

\`\`\`meta-bind-embed
[[knowledge-proposal-meta]]
\`\`\`

# 見出し

本文です。

${PROV}
`;

const frontmatter = { type: "knowledge-proposal", status: "proposed" };

test("only a Markdown file directly inside 04-AI/Proposals of type knowledge-proposal qualifies", () => {
  assert.equal(U.isProposalPath("04-AI/Proposals/a.md"), true);
  for (const bad of [
    "04-AI/Proposals/sub/a.md", "04-AI/Proposals/a.txt", "04-AI/Proposals/.md",
    "04-AI/50-Review/a.md", "11-Knowledge/a.md", "05-Idea/a.md", "04-AI/Proposals", "", null,
  ]) assert.equal(U.isProposalPath(bad), false, String(bad));
  assert.equal(U.isProposalNote("04-AI/Proposals/a.md", frontmatter), true);
  assert.equal(U.isProposalNote("04-AI/Proposals/a.md", { type: "idea" }), false);
  assert.equal(U.isProposalNote("11-Knowledge/a.md", frontmatter), false);
  assert.equal(U.ideaTitleFromPath(PATH), "アイデアの種");
  assert.throws(() => U.ideaTitleFromPath("04-AI/Proposals/x/y.md"));
});

test("provenance is read from the trailing record and must carry both digests", () => {
  const parsed = U.parseProvenance(proposal);
  assert.equal(parsed.sourceSha256, SOURCE);
  assert.equal(parsed.generationSha256, GENERATION);
  assert.throws(() => U.parseProvenance(proposal.replace(PROV, "")), /出所の記録/);
  assert.throws(() => U.parseProvenance(proposal.replace(SOURCE, "z".repeat(64))), /source_sha256/);
  assert.throws(() => U.parseProvenance(proposal.replace(`"generation_sha256":"${GENERATION}",`, "")),
    /generation_sha256/);
  assert.throws(() => U.parseProvenance(proposal.replace(/\{.*\}/, "{not json}")), /読み取れません/);
  // a record that is not the last line is ignored (it could be quoted text)
  assert.throws(() => U.parseProvenance(`${PROV}\n\nlater text\n`), /出所の記録/);
});

test("the proposal envelope (frontmatter, approval embed, provenance) is removed, the body kept", () => {
  const body = U.stripProposalEnvelope(proposal);
  assert.equal(body, "# 見出し\n\n本文です。\n");
  assert.ok(!body.includes("knowledge-proposal-meta"));
  assert.ok(!body.includes("oa-proposal"));
  assert.throws(() => U.stripProposalEnvelope(proposal.replace("type: knowledge-proposal", "type: idea")),
    /knowledge-proposal/);
  assert.throws(() => U.stripProposalEnvelope(proposal.replace(/```meta-bind-embed[\s\S]*?```\n\n/, "")),
    /埋め込み/);
  assert.throws(() => U.stripProposalEnvelope(proposal.replace("# 見出し\n\n本文です。\n\n", "")), /本文が空/);
  assert.throws(() => U.stripProposalEnvelope(proposal.replace("---\ntype", "type")), /frontmatter/);
});

test("the Idea is a valid idea note with the proposal provenance", () => {
  const plan = U.planIdeaConversion({
    sourcePath: PATH, frontmatter, content: proposal, created: "2026-11-27",
    workspace: "[[03-Workspace/W|W]]", project: null,
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.title, "アイデアの種");
  const text = plan.content;
  assert.match(text, /^---\ntype: idea\n/);
  assert.match(text, /^title: "アイデアの種"$/m);
  assert.match(text, /^created: 2026-11-27$/m);
  assert.match(text, /^workspace: "\[\[03-Workspace\/W\|W\]\]"$/m);
  assert.match(text, /^project: $/m);
  assert.match(text, /^status: active$/m);
  assert.match(text, /^origin: ai-proposal$/m);
  assert.match(text, new RegExp(`^ai_proposal_source_sha256: ${SOURCE}$`, "m"));
  assert.match(text, new RegExp(`^ai_proposal_generation_sha256: ${GENERATION}$`, "m"));
  assert.match(text, /```meta-bind-embed\n\[\[idea-meta\]\]\n```/);
  assert.ok(text.endsWith("# 見出し\n\n本文です。\n"));
  assert.ok(!text.includes("knowledge-proposal"));

  const withProject = U.planIdeaConversion({
    sourcePath: PATH, frontmatter, content: proposal, created: "2026-11-27",
    workspace: "[[03-Workspace/W|W]]", project: "[[10-Project/P|P]]",
  });
  assert.match(withProject.content, /^project: "\[\[10-Project\/P\|P\]\]"$/m);
});

test("planning refuses anything that is not a complete proposal and never throws", () => {
  const base = { sourcePath: PATH, frontmatter, content: proposal, created: "2026-11-27", workspace: "[[W]]" };
  assert.equal(U.planIdeaConversion(base).ok, true);
  for (const broken of [
    { sourcePath: "05-Idea/x.md" },
    { frontmatter: { type: "idea" } },
    { content: proposal.replace(PROV, "") },
    { created: "27/11/2026" },
    { workspace: "" },
    { content: "" },
  ]) {
    const result = U.planIdeaConversion({ ...base, ...broken });
    assert.equal(result.ok, false, JSON.stringify(Object.keys(broken)));
    assert.equal(typeof result.error, "string");
  }
});

// ------------------------------------------------------------------- command

const utilPaths = {
  "98-System/01-script/reference_utils.js": "({})",
  "98-System/01-script/entity_meta_utils.js":
    "({ isWorkspaceActiveLifecycle: () => true, isProjectActiveStatus: () => true })",
  "98-System/01-script/entity_reference_utils.js": `((G) => ({
    findEntityNotes: (app, options) => options.folder === "03-Workspace"
      ? [{ displayName: "Work", path: "03-Workspace/Work.md", kind: "workspace" }]
      : [{ displayName: "Proj", path: "10-Project/Proj.md", workspace: "Work", kind: "project" }],
    entityMatchesReference: (reference, workspace) => reference === workspace.displayName,
    makeEntityLink: (app, entity) => entity ? "[[" + entity.path.replace(/\\.md$/, "") + "|" + entity.displayName + "]]" : "",
  }))`,
  [utilityPath]: utilitySource,
};

function makeFile(filePath) {
  const name = filePath.split("/").pop();
  const extension = name.includes(".") ? name.split(".").pop() : "";
  return { path: filePath, basename: extension ? name.slice(0, -(extension.length + 1)) : name, extension };
}

function makeEnv({
  sourcePath = PATH,
  content = proposal,
  fm = frontmatter,
  extra = [],
  workspaceChoice = 0,
  projectChoice = 1,
  modifyFails = false,
  folders = ["05-Idea"],
} = {}) {
  const source = makeFile(sourcePath);
  const files = new Map([[sourcePath, source]]);
  const contents = new Map([[sourcePath, content]]);
  const frontmatters = new Map([[sourcePath, structuredClone(fm)]]);
  for (const entry of extra) {
    files.set(entry.path, makeFile(entry.path));
    contents.set(entry.path, entry.content ?? "");
    frontmatters.set(entry.path, entry.fm ?? {});
  }
  const folderSet = new Set(folders);
  const notices = [];
  const opened = [];
  const mutations = [];
  const asked = [];
  let modifyFailuresLeft = modifyFails ? 1 : 0; // only the conversion fails; the rollback may write

  const app = {
    workspace: { getActiveFile: () => source, getLeaf: () => ({ openFile: async file => opened.push(file.path) }) },
    vault: {
      getAbstractFileByPath: requested => {
        if (utilPaths[requested] !== undefined) return { path: requested, extension: "js" };
        if (folderSet.has(requested)) return { path: requested, children: [] };
        return files.get(requested) ?? null;
      },
      getMarkdownFiles: () => [...files.values()].filter(file => file.extension === "md"),
      read: async file => utilPaths[file.path] ?? contents.get(file.path) ?? "",
      createFolder: async folder => { folderSet.add(folder); mutations.push(["createFolder", folder]); },
      rename: async (file, newPath) => {
        if (files.has(newPath)) throw new Error("collision");
        const oldPath = file.path;
        const oldContent = contents.get(oldPath);
        const oldFm = frontmatters.get(oldPath);
        files.delete(oldPath); contents.delete(oldPath); frontmatters.delete(oldPath);
        file.path = newPath;
        file.basename = newPath.split("/").pop().replace(/\.md$/, "");
        files.set(newPath, file); contents.set(newPath, oldContent); frontmatters.set(newPath, oldFm);
        mutations.push(["rename", oldPath, newPath]);
      },
      modify: async (file, next) => {
        if (modifyFailuresLeft > 0) { modifyFailuresLeft -= 1; throw new Error("injected modify failure"); }
        contents.set(file.path, next);
        mutations.push(["modify", file.path]);
      },
    },
    metadataCache: { getFileCache: file => ({ frontmatter: frontmatters.get(file.path) ?? {} }) },
  };
  const tp = {
    system: {
      suggester: async (labels, values, _throw, title) => {
        asked.push(title);
        if (title === "IdeaのWorkspaceを選択") return workspaceChoice === null ? null : values[workspaceChoice];
        return projectChoice === null ? null : values[projectChoice];
      },
    },
  };
  const window = { moment: () => ({ format: () => "2026-11-27" }) };

  function run() {
    const module = { exports: {} };
    new Function("module", "app", "Notice", "console", "window", runtimeSource)(
      module, app, function Notice(message) { notices.push(String(message)); },
      { log() {}, warn() {}, error() {} }, window);
    return module.exports(tp);
  }
  return { files, contents, notices, opened, mutations, asked, run };
}

test("keeping a proposal as an Idea moves it to 05-Idea and converts it (Workspace and Project chosen)", async () => {
  const env = makeEnv();
  const result = await env.run();
  assert.deepEqual(result, { status: "kept", sourcePath: PATH, ideaPath: "05-Idea/アイデアの種.md" });
  assert.equal(env.files.has(PATH), false, "the proposal no longer exists at its old path");
  const text = env.contents.get("05-Idea/アイデアの種.md");
  assert.match(text, /^type: idea$/m);
  assert.match(text, /^workspace: "\[\[03-Workspace\/Work\|Work\]\]"$/m);
  assert.match(text, /^project: "\[\[10-Project\/Proj\|Proj\]\]"$/m);
  assert.ok(!text.includes("knowledge-proposal"));
  assert.deepEqual(env.mutations.map(([kind]) => kind), ["rename", "modify"]);
  assert.deepEqual(env.opened, ["05-Idea/アイデアの種.md"]);
  assert.deepEqual(env.asked, ["IdeaのWorkspaceを選択", "IdeaのProjectを選択"]);
});

test("a Project is optional; a name collision gets a numeric suffix; a missing 05-Idea folder is created", async () => {
  const env = makeEnv({
    projectChoice: 0, folders: [],
    extra: [{ path: "05-Idea/アイデアの種.md", fm: { type: "idea" } }],
  });
  const result = await env.run();
  assert.equal(result.ideaPath, "05-Idea/アイデアの種-2.md");
  assert.match(env.contents.get(result.ideaPath), /^project: $/m);
  assert.deepEqual(env.mutations[0], ["createFolder", "05-Idea"]);
});

test("cancelling the Workspace choice changes nothing", async () => {
  const env = makeEnv({ workspaceChoice: null });
  assert.deepEqual(await env.run(), { status: "cancelled" });
  assert.deepEqual(env.mutations, []);
  assert.equal(env.contents.get(PATH), proposal);
});

test("anything that is not a proposal is refused before any question or change", async () => {
  for (const options of [
    { sourcePath: "11-Knowledge/a.md" },
    { fm: { type: "idea" } },
    { content: proposal.replace(PROV, "") },
    { content: proposal.replace(/```meta-bind-embed[\s\S]*?```\n\n/, "") },
  ]) {
    const env = makeEnv(options);
    const result = await env.run();
    assert.equal(result.status, "rejected", JSON.stringify(Object.keys(options)));
    assert.deepEqual(env.asked, []);
    assert.deepEqual(env.mutations, []);
  }
});

test("an Idea from the same proposal already existing blocks a duplicate and never deletes the proposal", async () => {
  const env = makeEnv({
    extra: [{ path: "05-Idea/既存.md", fm: {
      type: "idea", ai_proposal_source_sha256: SOURCE, ai_proposal_generation_sha256: GENERATION } }],
  });
  const result = await env.run();
  assert.deepEqual(result, { status: "rejected", reason: "idea-already-exists", ideaPath: "05-Idea/既存.md" });
  assert.equal(env.files.has(PATH), true);
  assert.deepEqual(env.mutations, []);

  const mismatch = makeEnv({
    extra: [{ path: "05-Idea/既存.md", fm: {
      type: "idea", ai_proposal_source_sha256: SOURCE, ai_proposal_generation_sha256: "e".repeat(64) } }],
  });
  assert.equal((await mismatch.run()).reason, "provenance-mismatch");
  assert.deepEqual(mismatch.mutations, []);
});

test("a failure after the move rolls the note back to its original path and bytes", async () => {
  const env = makeEnv({ modifyFails: true });
  const result = await env.run();
  assert.equal(result.status, "failed");
  assert.equal(result.rolledBack, true);
  assert.equal(env.files.has(PATH), true);
  assert.equal(env.files.has("05-Idea/アイデアの種.md"), false);
  assert.equal(env.contents.get(PATH), proposal);
});

test("the proposal note offers both decisions and the new command is registered", () => {
  const meta = read("98-System/02-embed/00-meta/knowledge-proposal-meta.md");
  assert.match(meta, /\[\[knowledge-promotion-button\]\]/);
  assert.match(meta, /\[\[proposal-idea-button\]\]/);
  const button = read("98-System/02-embed/01-button/proposal-idea-button.md");
  assert.match(button, /id: keep-proposal-as-idea/);
  assert.match(button, /templateFile: "98-System\/00-command\/keep_proposal_as_idea\.md"/);
  assert.match(read("98-System/00-command/keep_proposal_as_idea.md"), /tp\.user\.keep_proposal_as_idea\(tp\)/);
  const registry = JSON.parse(read("98-System/99-dev/setup/system-interfaces.json"));
  const registered = new Set(registry.groups.flatMap(group => group.paths ?? []));
  for (const entry of [
    "98-System/00-command/keep_proposal_as_idea.md",
    "98-System/02-embed/01-button/proposal-idea-button.md",
    "98-System/01-script/keep_proposal_as_idea.js",
  ]) assert.ok(registered.has(entry), entry);
});

test("AI HUB lists pending proposals and the Dashboard AI card shows the count", () => {
  assert.match(read("98-System/02-embed/hub/ai-hub.md"),
    /## 提案（承認待ち）\n```dvjs\nawait dv\.view\("98-System\/04-view\/ai\/proposal_table"/);
  assert.match(read("98-System/02-embed/dashboard/ai.md"),
    /proposal_table", \{ mode: "summary" \}/);
  const view = read("98-System/04-view/ai/proposal_table.js");
  assert.match(view, /String\(page\?\.type \?\? ""\)\.trim\(\) === "knowledge-proposal"/);
  assert.match(view, /String\(page\?\.file\?\.folder \?\? ""\) === ROOT/);
});
