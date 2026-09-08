import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const helperPath = "98-System/01-script/task_dependency_creation_utils.js";
const genericPath = "98-System/01-script/reference_utils.js";
const runtimePath = "98-System/01-script/reference_runtime_utils.js";
const metadataPath = "98-System/01-script/task_meta_utils.js";

function makeFile(filePath) {
  const name = filePath.split("/").pop();
  const extension = name.includes(".") ? name.split(".").pop() : "";
  const basename = extension ? name.slice(0, -(extension.length + 1)) : name;
  return { path: filePath, basename, extension };
}

function loadSource(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function loadExpression(relativePath) {
  return new Function(`"use strict"; return (${loadSource(relativePath)});`)();
}

function makeApp() {
  const open = makeFile("02-Task/Open.md");
  const done = makeFile("02-Task/Done.md");
  const legacy = makeFile("02-Task/Legacy.md");
  const created = makeFile("02-Task/New.md");
  const frontmatter = new Map([
    [open.path, { type: "task", title: "Open", status: "todo", project: "[[10-Project/P|P]]", depends_on: [] }],
    [done.path, { type: "task", title: "Done", status: "done", depends_on: [] }],
    [legacy.path, { type: "task-pack", title: "Legacy", status: "todo", depends_on: [] }],
    [created.path, { type: "task", title: "New", status: "todo", depends_on: [] }]
  ]);
  const utilitySources = new Map([
    [genericPath, loadSource(genericPath)],
    [runtimePath, loadSource(runtimePath)],
    [metadataPath, loadSource(metadataPath)]
  ]);
  const utilityFiles = new Map([...utilitySources.keys()].map(p => [p, makeFile(p)]));
  const taskFiles = [open, done, legacy];

  function resolve(linkpath) {
    const normalized = String(linkpath ?? "").replace(/\.md$/, "");
    return [open, done, legacy, created].find(file =>
      file.path.replace(/\.md$/, "") === normalized || file.basename === normalized.split("/").pop()
    ) ?? null;
  }

  return {
    files: { open, done, legacy, created },
    frontmatter,
    app: {
      vault: {
        getMarkdownFiles: () => taskFiles,
        getAbstractFileByPath: requested => utilityFiles.get(requested) ?? [open, done, legacy, created].find(file => file.path === requested) ?? null,
        read: async file => utilitySources.get(file.path) ?? ""
      },
      metadataCache: {
        getFileCache: file => ({ frontmatter: frontmatter.get(file.path) ?? {} }),
        getFirstLinkpathDest: linkpath => resolve(linkpath)
      },
      fileManager: {
        generateMarkdownLink: (file, _sourcePath, _subpath, alias) => `[[${file.path.replace(/\.md$/, "")}|${alias}]]`,
        processFrontMatter: async (file, callback) => callback(frontmatter.get(file.path))
      }
    }
  };
}

test("creation dependency chooser offers actionable canonical tasks and applies them", async () => {
  const H = loadExpression(helperPath);
  const { app, files, frontmatter } = makeApp();
  let calls = 0;
  const quickAddApi = {
    suggester: async (_labels, values) => {
      calls += 1;
      return calls === 1 ? values[1] : values[0];
    }
  };

  const choice = await H.chooseDependencies({ app, quickAddApi });
  assert.equal(choice.cancelled, false);
  assert.deepEqual(choice.tasks.map(task => task.file.path), [files.open.path]);

  await H.applyDependencies({ app, taskFile: files.created, dependencies: choice.tasks });
  assert.deepEqual(frontmatter.get(files.created.path).depends_on, ["[[02-Task/Open|Open]]"]);
});

test("creation dependency chooser can skip dependencies", async () => {
  const H = loadExpression(helperPath);
  const { app } = makeApp();
  const quickAddApi = { suggester: async (_labels, values) => values[0] };
  const choice = await H.chooseDependencies({ app, quickAddApi });
  assert.equal(choice.cancelled, false);
  assert.deepEqual(choice.tasks, []);
});
