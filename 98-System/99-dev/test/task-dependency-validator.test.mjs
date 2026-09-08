import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const validatorPath = "98-System/01-script/validate_task_dependencies.js";
const genericPath = "98-System/01-script/reference_utils.js";
const runtimePath = "98-System/01-script/reference_runtime_utils.js";
const metadataPath = "98-System/01-script/task_meta_utils.js";
const dependencyPath = "98-System/01-script/task_dependency_utils.js";

function makeFile(filePath) {
  const name = filePath.split("/").pop();
  const extension = name.includes(".") ? name.split(".").pop() : "";
  const basename = extension ? name.slice(0, -(extension.length + 1)) : name;
  return { path: filePath, basename, extension };
}

function loadSource(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function makeApp(entries) {
  const taskFiles = entries.map(entry => makeFile(entry.path));
  const frontmatter = new Map(entries.map(entry => [entry.path, entry.fm]));
  const utilitySources = new Map([
    [genericPath, loadSource(genericPath)],
    [runtimePath, loadSource(runtimePath)],
    [metadataPath, loadSource(metadataPath)],
    [dependencyPath, loadSource(dependencyPath)]
  ]);
  const utilityFiles = new Map([...utilitySources.keys()].map(p => [p, makeFile(p)]));

  function resolve(linkpath) {
    const normalized = String(linkpath ?? "").replace(/\.md$/, "");
    return taskFiles.find(file =>
      file.path.replace(/\.md$/, "") === normalized || file.basename === normalized.split("/").pop()
    ) ?? null;
  }

  return {
    vault: {
      getMarkdownFiles: () => taskFiles,
      getAbstractFileByPath: requested => utilityFiles.get(requested) ?? taskFiles.find(file => file.path === requested) ?? null,
      read: async file => utilitySources.get(file.path) ?? ""
    },
    metadataCache: {
      getFileCache: file => ({ frontmatter: frontmatter.get(file.path) ?? {} }),
      getFirstLinkpathDest: linkpath => resolve(linkpath)
    }
  };
}

async function runValidator(entries) {
  const app = makeApp(entries);
  const notices = [];
  const Notice = function Notice(message) { notices.push(String(message)); };
  const module = { exports: {} };
  const quietConsole = { log() {}, table() {}, error() {} };
  const source = loadSource(validatorPath);
  new Function("module", "app", "Notice", "console", source)(module, app, Notice, quietConsole);
  const result = await module.exports({});
  return { ...result, notices };
}

function task(name, depends_on = []) {
  return {
    path: `02-Task/${name}.md`,
    fm: { type: "task", title: name, status: "todo", depends_on }
  };
}

test("dependency validator accepts an acyclic graph", async () => {
  const result = await runValidator([
    task("A", ["[[02-Task/B|B]]"]),
    task("B")
  ]);
  assert.equal(result.summary.errors, 0);
  assert.equal(result.summary.cycleTasks, 0);
});

test("dependency validator reports every task in a cycle", async () => {
  const result = await runValidator([
    task("A", ["[[02-Task/B]]"]),
    task("B", ["[[02-Task/C]]"]),
    task("C", ["[[02-Task/A]]"])
  ]);
  assert.equal(result.summary.cycleTasks, 3);
  const cyclePaths = result.issues
    .filter(issue => /循環/.test(issue.message))
    .map(issue => issue.path)
    .sort();
  assert.deepEqual(cyclePaths, ["02-Task/A.md", "02-Task/B.md", "02-Task/C.md"]);
});

test("dependency validator catches self, duplicate, unresolved, and scalar references", async () => {
  const result = await runValidator([
    task("A", ["[[02-Task/A]]", "[[02-Task/A|Self]]", "[[02-Task/Missing]]"]),
    { path: "02-Task/B.md", fm: { type: "task", title: "B", status: "todo", depends_on: "[[02-Task/A]]" } }
  ]);
  assert.ok(result.issues.some(issue => /Task自身/.test(issue.message)));
  assert.ok(result.issues.some(issue => /重複/.test(issue.message)));
  assert.ok(result.issues.some(issue => /解決できません/.test(issue.message)));
  assert.ok(result.issues.some(issue => issue.severity === "warning" && /配列/.test(issue.message)));
});
