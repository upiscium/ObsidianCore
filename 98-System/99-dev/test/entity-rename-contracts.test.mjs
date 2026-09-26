import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = process.cwd();
const utils = new Function(
  `"use strict"; return (${fs.readFileSync(path.join(root, "98-System/01-script/entity_rename_utils.js"), "utf8")});`
)();
const renameEntity = require(path.join(root, "98-System/01-script/rename_entity.js"));

function fmClone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function makeVault({
  entityType,
  oldName,
  uid,
  relationEntries = [],
  collision = false,
  failOnceOn = null,
  lookupMisses = [],
  lookupMissAfterRename = []
}) {
  const rootPath = entityType === "project" ? "10-Project" : "03-Workspace";
  const relationField = entityType === "project" ? "project" : "workspace";
  const oldFolderPath = `${rootPath}/${oldName}`;
  const oldEntryPath = `${oldFolderPath}/${oldName}.md`;

  const objects = new Map();
  const frontmatter = new Map();
  const notices = [];
  let renameCalls = 0;
  let failed = false;
  const lookupMissSet = new Set(lookupMisses);
  const postRenameLookupMissSet = new Set(lookupMissAfterRename);

  const rootFolder = { path: rootPath, children: [] };
  const entityFolder = { path: oldFolderPath, children: [], parent: rootFolder };
  rootFolder.children.push(entityFolder);
  objects.set(rootPath, rootFolder);
  objects.set(oldFolderPath, entityFolder);

  function addFile(filePath, fm) {
    const parts = filePath.split("/");
    const name = parts.at(-1);
    const extension = name.includes(".") ? name.split(".").at(-1) : "";
    const basename = extension ? name.slice(0, -(extension.length + 1)) : name;
    const parentPath = parts.slice(0, -1).join("/");
    let parent = objects.get(parentPath);
    if (!parent) {
      parent = { path: parentPath, children: [] };
      objects.set(parentPath, parent);
    }
    const file = { path: filePath, name, basename, extension, parent };
    parent.children.push(file);
    objects.set(filePath, file);
    frontmatter.set(file, structuredClone(fm));
    return file;
  }

  const entity = addFile(oldEntryPath, {
    type: entityType,
    uid,
    title: oldName,
    aliases: [],
    ...(entityType === "project" ? { status: "running", workspace: "[[03-Workspace/W/W|W]]" } : { lifecycle: "active" })
  });

  const child = addFile(`${oldFolderPath}/Child.md`, {
    type: entityType === "project" ? "project-note" : "workspace-note",
    [relationField]: `[[${oldName}]]`
  });

  const relationFiles = relationEntries.map((entry, index) => addFile(
    entry.path ?? `02-Task/R${index}.md`,
    {
      type: entry.type ?? "task",
      ...entry.fm,
      [relationField]: entry.reference ?? `[[${oldEntryPath.replace(/\.md$/, "")}|${oldName}]]`
    }
  ));

  if (collision) {
    const targetName = "Taken";
    const target = { path: `${rootPath}/${targetName}`, children: [], parent: rootFolder };
    rootFolder.children.push(target);
    objects.set(target.path, target);
  }

  function reindexFolder(folder, oldPath, newPath) {
    objects.delete(oldPath);
    folder.path = newPath;
    objects.set(newPath, folder);

    for (const childObject of folder.children) {
      const oldChildPath = childObject.path;
      const newChildPath = `${newPath}${oldChildPath.slice(oldPath.length)}`;
      objects.delete(oldChildPath);
      childObject.path = newChildPath;
      if (childObject.extension) {
        childObject.name = newChildPath.split("/").at(-1);
        childObject.basename = childObject.name.replace(/\.[^.]+$/, "");
      }
      objects.set(newChildPath, childObject);
      if (Array.isArray(childObject.children)) {
        reindexFolder(childObject, oldChildPath, newChildPath);
      }
    }
  }

  const app = {
    workspace: {
      getActiveFile: () => entity,
      getLeaf: () => ({ openFile: async () => {} })
    },
    vault: {
      getAbstractFileByPath: requested => {
        if (lookupMissSet.has(requested)) return null;
        if (renameCalls > 0 && postRenameLookupMissSet.has(requested)) return null;
        return objects.get(requested) ?? null;
      },
      getMarkdownFiles: () => [...frontmatter.keys()].filter(file => file.extension === "md"),
      read: async () => "",
      rename: async (target, newPath) => {
        renameCalls += 1;
        if (objects.has(newPath)) throw new Error(`collision: ${newPath}`);

        const oldPath = target.path;
        if (Array.isArray(target.children)) {
          reindexFolder(target, oldPath, newPath);
          return;
        }

        objects.delete(oldPath);
        target.path = newPath;
        target.name = newPath.split("/").at(-1);
        target.basename = target.name.replace(/\.[^.]+$/, "");
        objects.set(newPath, target);
      }
    },
    metadataCache: {
      getFileCache: file => ({ frontmatter: frontmatter.get(file) ?? {} })
    },
    fileManager: {
      generateMarkdownLink: target => `[[${target.path.replace(/\.md$/, "")}|${target.basename}]]`,
      processFrontMatter: async (file, mutator) => {
        if (failOnceOn && file.path === failOnceOn && !failed) {
          failed = true;
          throw new Error("injected-frontmatter-failure");
        }
        mutator(frontmatter.get(file));
      }
    }
  };

  class Notice {
    constructor(message) {
      notices.push(String(message));
    }
  }

  return {
    app,
    Notice,
    entity,
    child,
    relationFiles,
    notices,
    frontmatterOf: file => frontmatter.get(file),
    exists: filePath => objects.has(filePath),
    renameCalls: () => renameCalls
  };
}

function tpFor(name, action = "rename") {
  return {
    system: {
      prompt: async () => name,
      suggester: async () => action
    }
  };
}

test("rename planner enforces canonical Entity paths and preserves old names as aliases", () => {
  const plan = utils.planRename({
    filePath: "10-Project/Old/Old.md",
    fileBasename: "Old",
    type: "project",
    frontmatter: { uid: "prj_1", title: "Old title", aliases: ["Legacy"] },
    rawName: "New",
    pathExists: () => false
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.oldFolderPath, "10-Project/Old");
  assert.equal(plan.newFolderPath, "10-Project/New");
  assert.equal(plan.newEntryPath, "10-Project/New/New.md");
  assert.equal(plan.relationField, "project");
  assert.deepEqual(plan.nextAliases, ["Legacy", "Old title", "Old"]);

  assert.equal(utils.planRename({
    filePath: "10-Project/Old.md",
    fileBasename: "Old",
    type: "project",
    frontmatter: { uid: "prj_1" },
    rawName: "New"
  }).reason, "noncanonical-entry");

  assert.equal(utils.planRename({
    filePath: "03-Workspace/Old/Old.md",
    fileBasename: "Old",
    type: "workspace",
    frontmatter: { uid: "ws_1" },
    rawName: "old"
  }).reason, "case-only-rename");
});

test("Entity reference matching accepts canonical and basename links without fuzzy matching", () => {
  assert.equal(utils.matchesEntityReference("[[10-Project/Old/Old|Old]]", "10-Project/Old/Old.md", "Old"), true);
  assert.equal(utils.matchesEntityReference("[[Old]]", "10-Project/Old/Old.md", "Old"), true);
  assert.equal(utils.matchesEntityReference({ path: "10-Project/Old/Old.md" }, "10-Project/Old/Old.md", "Old"), true);
  assert.equal(utils.matchesEntityReference("[[Older]]", "10-Project/Old/Old.md", "Old"), false);
  assert.equal(utils.matchesEntityReference("[[Other/Old]]", "10-Project/Old/Old.md", "Old"), false);
});

test("Project rename moves folder and Entry while updating project relations", async () => {
  const env = makeVault({
    entityType: "project",
    oldName: "Old",
    uid: "prj_keep",
    relationEntries: [
      { path: "02-Task/T.md", reference: "[[10-Project/Old/Old|Old]]" }
    ]
  });

  const result = await renameEntity(tpFor("New"), {
    app: env.app,
    Notice: env.Notice,
    utils
  });

  assert.equal(result.status, "renamed");
  assert.equal(result.uid, "prj_keep");
  assert.equal(result.relationUpdates, 2);
  assert.equal(env.exists("10-Project/Old/Old.md"), false);
  assert.equal(env.exists("10-Project/New/New.md"), true);
  assert.equal(env.child.path, "10-Project/New/Child.md");
  assert.equal(env.frontmatterOf(env.entity).uid, "prj_keep");
  assert.equal(env.frontmatterOf(env.entity).title, "New");
  assert.deepEqual(env.frontmatterOf(env.entity).aliases, ["Old"]);
  assert.match(env.frontmatterOf(env.child).project, /10-Project\/New\/New/);
  assert.match(env.frontmatterOf(env.relationFiles[0]).project, /10-Project\/New\/New/);
});


test("Project rename retains relation caller handles across a transient path-index miss", async () => {
  const env = makeVault({
    entityType: "project",
    oldName: "Old",
    uid: "prj_keep",
    relationEntries: [
      { path: "02-Task/T.md", reference: "[[10-Project/Old/Old|Old]]" }
    ],
    lookupMisses: ["10-Project/New/Child.md"]
  });

  const result = await renameEntity(tpFor("New"), {
    app: env.app,
    Notice: env.Notice,
    utils
  });

  assert.equal(result.status, "renamed");
  assert.equal(result.relationUpdates, 2);
  assert.equal(env.child.path, "10-Project/New/Child.md");
  assert.match(env.frontmatterOf(env.child).project, /10-Project\/New\/New/);
  assert.match(env.frontmatterOf(env.relationFiles[0]).project, /10-Project\/New\/New/);
});

test("Workspace rename updates Workspace Note, Project and Task relations", async () => {
  const env = makeVault({
    entityType: "workspace",
    oldName: "Alpha",
    uid: "ws_keep",
    relationEntries: [
      {
        path: "10-Project/P/P.md",
        type: "project",
        fm: { uid: "prj_p", title: "P", status: "running" },
        reference: "[[Alpha]]"
      },
      {
        path: "02-Task/T.md",
        reference: "[[03-Workspace/Alpha/Alpha|Alpha]]"
      }
    ]
  });

  const result = await renameEntity(tpFor("Beta"), {
    app: env.app,
    Notice: env.Notice,
    utils
  });

  assert.equal(result.status, "renamed");
  assert.equal(result.relationUpdates, 3);
  assert.equal(env.exists("03-Workspace/Beta/Beta.md"), true);
  assert.equal(env.child.path, "03-Workspace/Beta/Child.md");
  assert.equal(env.frontmatterOf(env.entity).uid, "ws_keep");
  assert.deepEqual(env.frontmatterOf(env.entity).aliases, ["Alpha"]);
  for (const file of [env.child, ...env.relationFiles]) {
    assert.match(env.frontmatterOf(file).workspace, /03-Workspace\/Beta\/Beta/);
  }
});

test("destination collision rejects before any rename", async () => {
  const env = makeVault({
    entityType: "project",
    oldName: "Old",
    uid: "prj_keep",
    collision: true
  });

  const result = await renameEntity(tpFor("Taken"), {
    app: env.app,
    Notice: env.Notice,
    utils
  });

  assert.equal(result.status, "rejected");
  assert.equal(result.reason, "destination-collision");
  assert.equal(env.renameCalls(), 0);
  assert.equal(env.exists("10-Project/Old/Old.md"), true);
});

test("frontmatter failure rolls file/folder paths and relation values back", async () => {
  const env = makeVault({
    entityType: "project",
    oldName: "Old",
    uid: "prj_keep",
    relationEntries: [
      { path: "02-Task/T.md", reference: "[[Old]]" }
    ],
    failOnceOn: "02-Task/T.md"
  });

  const originalChildRef = fmClone(env.frontmatterOf(env.child).project);
  const originalTaskRef = fmClone(env.frontmatterOf(env.relationFiles[0]).project);

  const result = await renameEntity(tpFor("New"), {
    app: env.app,
    Notice: env.Notice,
    utils
  });

  assert.equal(result.status, "failed");
  assert.equal(result.rolledBack, true);
  assert.equal(env.exists("10-Project/Old/Old.md"), true);
  assert.equal(env.exists("10-Project/New/New.md"), false);
  assert.equal(env.child.path, "10-Project/Old/Child.md");
  assert.equal(env.frontmatterOf(env.entity).title, "Old");
  assert.deepEqual(env.frontmatterOf(env.entity).aliases, []);
  assert.equal(env.frontmatterOf(env.child).project, originalChildRef);
  assert.equal(env.frontmatterOf(env.relationFiles[0]).project, originalTaskRef);
});



test("rollback restores Entity handles even when post-rename path lookup is stale", async () => {
  const env = makeVault({
    entityType: "project",
    oldName: "Old",
    uid: "prj_keep",
    relationEntries: [
      { path: "02-Task/T.md", reference: "[[Old]]" }
    ],
    failOnceOn: "02-Task/T.md",
    lookupMissAfterRename: [
      "10-Project/New/New.md",
      "10-Project/New",
      "10-Project/New/Child.md"
    ]
  });

  const originalChildRef = fmClone(env.frontmatterOf(env.child).project);
  const originalTaskRef = fmClone(env.frontmatterOf(env.relationFiles[0]).project);

  const result = await renameEntity(tpFor("New"), {
    app: env.app,
    Notice: env.Notice,
    utils
  });

  assert.equal(result.status, "failed");
  assert.equal(result.rolledBack, true);
  assert.equal(env.entity.path, "10-Project/Old/Old.md");
  assert.equal(env.child.path, "10-Project/Old/Child.md");
  assert.equal(env.frontmatterOf(env.child).project, originalChildRef);
  assert.equal(env.frontmatterOf(env.relationFiles[0]).project, originalTaskRef);
});

test("Project and Workspace Entries end with a collapsed System Zone rename control", () => {
  const project = fs.readFileSync(
    path.join(root, "98-System/02-embed/projects/project-entry-content.md"),
    "utf8"
  );
  const workspace = fs.readFileSync(
    path.join(root, "98-System/02-embed/projects/workspace-entry-content.md"),
    "utf8"
  );

  for (const [source, buttonPath] of [
    [project, "98-System/02-embed/01-button/project-system-buttons|project-system-buttons"],
    [workspace, "98-System/02-embed/01-button/workspace-system-buttons|workspace-system-buttons"]
  ]) {
    assert.match(source, /# System Zone\n> \[!warning\]- Rename/);
    assert.ok(source.includes(`[[${buttonPath}]]`));
    assert.equal(source.trimEnd().endsWith("> ```"), true);
  }

  const projectButtons = fs.readFileSync(
    path.join(root, "98-System/02-embed/01-button/project-system-buttons.md"),
    "utf8"
  );
  const workspaceButtons = fs.readFileSync(
    path.join(root, "98-System/02-embed/01-button/workspace-system-buttons.md"),
    "utf8"
  );

  assert.match(projectButtons, /id: rename-project/);
  assert.match(projectButtons, /templateFile: "98-System\/00-command\/rename_entity\.md"/);
  assert.match(workspaceButtons, /id: rename-workspace/);
  assert.match(workspaceButtons, /templateFile: "98-System\/00-command\/rename_entity\.md"/);
});

test("Vault config keeps Obsidian automatic internal-link updates enabled", () => {
  const appConfig = JSON.parse(
    fs.readFileSync(path.join(root, ".obsidian/app.json"), "utf8")
  );
  assert.equal(appConfig.alwaysUpdateLinks, true);
});
