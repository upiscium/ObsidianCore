import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const utilityPath = "98-System/01-script/knowledge_promotion_utils.js";
const runtimePath = "98-System/01-script/promote_to_knowledge.js";
const utilitySource = fs.readFileSync(path.join(root, utilityPath), "utf8");
const runtimeSource = fs.readFileSync(path.join(root, runtimePath), "utf8");
const U = new Function(`"use strict"; return (${utilitySource});`)();

const projectContent = `---
type: project-note
project: "[[10-Project/P|P]]"
workspace: "[[03-Workspace/W|W]]"
status: running
priority: high
category: memo
aliases:
  - Alias
custom_field: keep
---
\`\`\`meta-bind-embed
[[project-note-meta]]
\`\`\`
# Project note

Body stays.
`;

const workspaceContent = `---
type: workspace-note
workspace: "[[03-Workspace/W|W]]"
status: planning
priority: medium
category: document
tags:
  - keep
---
\`\`\`meta-bind-embed
[[workspace-note-meta]]
\`\`\`
# Workspace note
`;

function makeFile(filePath) {
  const name = filePath.split("/").pop();
  const extension = name.includes(".") ? name.split(".").pop() : "";
  const basename = extension ? name.slice(0, -(extension.length + 1)) : name;
  return { path: filePath, basename, extension };
}

function makeEnv({
  sourcePath = "10-Project/P/Note.md",
  fm = {
    type: "project-note",
    project: "[[10-Project/P|P]]",
    workspace: "[[03-Workspace/W|W]]",
    status: "running",
    priority: "high",
    category: "memo",
    aliases: ["Alias"],
    custom_field: "keep"
  },
  content = projectContent,
  knowledgeFolder = true,
  collision = false,
  processFrontMatterFails = false,
  confirm = "promote"
} = {}) {
  const source = makeFile(sourcePath);
  const files = new Map([[sourcePath, source]]);
  const contents = new Map([[sourcePath, content]]);
  const frontmatter = new Map([[sourcePath, structuredClone(fm)]]);
  const notices = [];
  const opened = [];
  const mutations = [];
  const utilFile = makeFile(utilityPath);
  const folder = knowledgeFolder ? { path: "11-Knowledge", children: [] } : null;

  if (collision) {
    const target = makeFile(`11-Knowledge/${source.basename}.md`);
    files.set(target.path, target);
    contents.set(target.path, "existing");
    frontmatter.set(target.path, { type: "knowledge-note", status: "active" });
  }

  const app = {
    workspace: {
      getActiveFile: () => source,
      getLeaf: () => ({ openFile: async file => opened.push(file.path) })
    },
    vault: {
      getAbstractFileByPath: requested => {
        if (requested === utilFile.path) return utilFile;
        if (requested === "11-Knowledge") return folder;
        return files.get(requested) ?? null;
      },
      read: async file => file.path === utilFile.path ? utilitySource : contents.get(file.path) ?? "",
      rename: async (file, newPath) => {
        if (files.has(newPath)) throw new Error("collision");
        const oldPath = file.path;
        const oldContent = contents.get(oldPath);
        const oldFm = frontmatter.get(oldPath);
        files.delete(oldPath);
        contents.delete(oldPath);
        frontmatter.delete(oldPath);
        file.path = newPath;
        file.basename = newPath.split("/").pop().replace(/\.md$/, "");
        files.set(newPath, file);
        contents.set(newPath, oldContent);
        frontmatter.set(newPath, oldFm);
        mutations.push(["rename", oldPath, newPath]);
      },
      modify: async (file, nextContent) => {
        contents.set(file.path, nextContent);
        mutations.push(["modify", file.path]);
      }
    },
    metadataCache: {
      getFileCache: file => ({ frontmatter: frontmatter.get(file.path) ?? {} })
    },
    fileManager: {
      processFrontMatter: async (file, mutator) => {
        if (processFrontMatterFails) throw new Error("injected processFrontMatter failure");
        mutator(frontmatter.get(file.path));
        mutations.push(["frontmatter", file.path]);
      }
    }
  };

  const tp = { system: { suggester: async () => confirm } };

  function loadRuntime() {
    const module = { exports: {} };
    const quietConsole = { log() {}, warn() {}, error() {} };
    new Function("module", "app", "Notice", "console", runtimeSource)(
      module,
      app,
      function Notice(message) { notices.push(String(message)); },
      quietConsole
    );
    return module.exports;
  }

  return {
    files,
    contents,
    frontmatter,
    notices,
    opened,
    mutations,
    run: () => loadRuntime()(tp)
  };
}

test("promotion utility converts owned metadata and preserves unknown fields", () => {
  const next = U.promotedFrontmatter({
    type: "project-note",
    project: "[[P]]",
    workspace: "[[W]]",
    status: "running",
    priority: "high",
    category: "memo",
    aliases: ["A"],
    tags: ["x"],
    custom: 1
  });

  assert.deepEqual(next, {
    type: "knowledge-note",
    status: "active",
    category: null,
    aliases: ["A"],
    tags: ["x"],
    custom: 1,
    maturity: "draft",
    source_type: "self"
  });
  assert.equal(U.destinationPath("10-Project/P/Notes/Foo.md"), "11-Knowledge/Foo.md");
});

test("managed embed transform changes only the expected repository-managed block", () => {
  const result = U.transformManagedEmbed(projectContent, "project-note");
  assert.equal(result.ok, true);
  assert.match(result.content, /\[\[knowledge-meta\]\]/);
  assert.doesNotMatch(result.content, /\[\[project-note-meta\]\]/);
  assert.match(result.content, /# Project note\n\nBody stays\./);
});

test("unsafe or ambiguous managed embeds are rejected", () => {
  assert.equal(U.transformManagedEmbed("# no embed", "project-note").ok, false);
  const duplicate = `${projectContent}\n\`\`\`meta-bind-embed\n[[project-note-meta]]\n\`\`\``;
  assert.equal(U.transformManagedEmbed(duplicate, "project-note").ok, false);
  const conflicting = `${projectContent}\n\`\`\`meta-bind-embed\n[[workspace-note-meta]]\n\`\`\``;
  assert.equal(U.transformManagedEmbed(conflicting, "project-note").ok, false);
});

test("real runtime promotes a Project Note and opens the Knowledge note", async () => {
  const env = makeEnv();
  const result = await env.run();
  const target = "11-Knowledge/Note.md";

  assert.equal(result.status, "promoted");
  assert.equal(env.files.has("10-Project/P/Note.md"), false);
  assert.equal(env.files.has(target), true);
  assert.deepEqual(env.frontmatter.get(target), {
    type: "knowledge-note",
    status: "active",
    category: null,
    aliases: ["Alias"],
    custom_field: "keep",
    maturity: "draft",
    source_type: "self"
  });
  assert.match(env.contents.get(target), /\[\[knowledge-meta\]\]/);
  assert.match(env.contents.get(target), /Body stays\./);
  assert.deepEqual(env.opened, [target]);
});

test("real runtime promotes a Workspace Note", async () => {
  const env = makeEnv({
    sourcePath: "03-Workspace/W/Note.md",
    fm: {
      type: "workspace-note",
      workspace: "[[03-Workspace/W|W]]",
      status: "planning",
      priority: "medium",
      category: "document",
      tags: ["keep"]
    },
    content: workspaceContent
  });

  const result = await env.run();
  assert.equal(result.status, "promoted");
  assert.deepEqual(env.frontmatter.get("11-Knowledge/Note.md"), {
    type: "knowledge-note",
    status: "active",
    category: null,
    tags: ["keep"],
    maturity: "draft",
    source_type: "self"
  });
});

test("collision, missing folder, unsafe source and already-Knowledge reject without mutation", async () => {
  for (const options of [
    { collision: true },
    { knowledgeFolder: false },
    { content: "# missing managed embed" },
    { fm: { type: "knowledge-note", status: "active" } }
  ]) {
    const env = makeEnv(options);
    const before = env.contents.get("10-Project/P/Note.md");
    const result = await env.run();
    assert.equal(result.status, "rejected");
    assert.equal(env.files.has("10-Project/P/Note.md"), true);
    assert.equal(env.contents.get("10-Project/P/Note.md"), before);
    assert.equal(env.mutations.length, 0);
  }
});

test("cancel rejects mutation after preflight", async () => {
  const env = makeEnv({ confirm: "cancel" });
  const result = await env.run();
  assert.equal(result.status, "cancelled");
  assert.equal(env.mutations.length, 0);
});

test("post-move metadata failure rolls path and content back", async () => {
  const env = makeEnv({ processFrontMatterFails: true });
  const original = env.contents.get("10-Project/P/Note.md");
  const result = await env.run();

  assert.equal(result.status, "failed");
  assert.equal(result.rolledBack, true);
  assert.equal(env.files.has("10-Project/P/Note.md"), true);
  assert.equal(env.files.has("11-Knowledge/Note.md"), false);
  assert.equal(env.contents.get("10-Project/P/Note.md"), original);
  assert.equal(env.frontmatter.get("10-Project/P/Note.md").type, "project-note");
});

test("Project and Workspace note metadata share the Knowledge promotion control", () => {
  const projectMeta = fs.readFileSync(path.join(root, "98-System/02-embed/00-meta/project-note-meta.md"), "utf8");
  const workspaceMeta = fs.readFileSync(path.join(root, "98-System/02-embed/00-meta/workspace-note-meta.md"), "utf8");
  const control = fs.readFileSync(path.join(root, "98-System/02-embed/01-button/knowledge-promotion-button.md"), "utf8");
  const command = fs.readFileSync(path.join(root, "98-System/00-command/promote_to_knowledge.md"), "utf8");

  assert.match(projectMeta, /\[\[knowledge-promotion-button\]\]/);
  assert.match(workspaceMeta, /\[\[knowledge-promotion-button\]\]/);
  assert.match(control, /id: promote-to-knowledge/);
  assert.match(control, /templateFile: "98-System\/00-command\/promote_to_knowledge\.md"/);
  assert.match(command, /tp\.user\.promote_to_knowledge\(tp\)/);
});
