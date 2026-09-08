import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const migrationPath = "98-System/01-script/migrate_task_dependency_controls.js";
const commandPath = "98-System/00-command/migrate_task_dependency_controls.md";
const manifestPath = "98-System/99-dev/setup/automation-manifest.json";
const embedTarget = "[[98-System/02-embed/01-button/task-dependency-controls|task-dependency-controls]]";
const migrationSource = fs.readFileSync(path.join(root, migrationPath), "utf8");

function makeFile(filePath) {
  const name = filePath.split("/").pop();
  const extension = name.includes(".") ? name.split(".").pop() : "";
  const basename = extension ? name.slice(0, -(extension.length + 1)) : name;
  return { path: filePath, basename, extension };
}

function makeEnv(entries) {
  const files = entries.map(entry => makeFile(entry.path));
  const fm = new Map(entries.map(entry => [entry.path, structuredClone(entry.fm ?? {})]));
  const contents = new Map(entries.map(entry => [entry.path, entry.content ?? ""]));
  const notices = [];

  const app = {
    vault: {
      getMarkdownFiles: () => files,
      read: async file => contents.get(file.path) ?? "",
      modify: async (file, content) => contents.set(file.path, content)
    },
    metadataCache: {
      getFileCache: file => ({ frontmatter: fm.get(file.path) ?? {} })
    }
  };

  const module = { exports: {} };
  new Function("module", "app", "Notice", "console", migrationSource)(
    module,
    app,
    function Notice(message) { notices.push(String(message)); },
    { log() {}, warn() {}, error() {} }
  );

  return {
    migrate: module.exports,
    notices,
    content: filePath => contents.get(filePath)
  };
}

test("dependency control migration replaces legacy fixed rows and preserves surrounding content", async () => {
  const twoButton = "02-Task/2026/09/Two.md";
  const threeButton = "02-Task/2026/09/Three.md";
  const embedded = "02-Task/2026/09/Embedded.md";
  const custom = "02-Task/2026/09/Custom.md";
  const nonTask = "02-Task/2026/09/Note.md";

  const env = makeEnv([
    {
      path: twoButton,
      fm: { type: "task" },
      content: "# Two\r\n## Dependency\r\n`BUTTON[task-add-dependency, task-remove-dependency]`\r\n## Memo\r\nkeep\r\n"
    },
    {
      path: threeButton,
      fm: { type: "task" },
      content: "# Three\n## Dependency\n`BUTTON[task-add-dependency, task-add-child, task-remove-dependency]`\n## Memo\nkeep\n"
    },
    {
      path: embedded,
      fm: { type: "task" },
      content: `# Embedded\n${embedTarget}\n`
    },
    {
      path: custom,
      fm: { type: "task" },
      content: "# Custom\n## Dependency\ncustom controls\n"
    },
    {
      path: nonTask,
      fm: { type: "project-note" },
      content: "`BUTTON[task-add-dependency, task-remove-dependency]`\n"
    }
  ]);

  const first = await env.migrate({});
  assert.deepEqual(first, { migrated: 2, alreadyEmbedded: 1, skipped: 2, failures: [] });

  assert.match(env.content(twoButton), /```meta-bind-embed\r\n\[\[98-System\/02-embed\/01-button\/task-dependency-controls\|task-dependency-controls\]\]\r\n```/);
  assert.match(env.content(twoButton), /## Memo\r\nkeep/);
  assert.match(env.content(threeButton), /```meta-bind-embed\n\[\[98-System\/02-embed\/01-button\/task-dependency-controls\|task-dependency-controls\]\]\n```/);
  assert.match(env.content(threeButton), /## Memo\nkeep/);
  assert.equal(env.content(custom), "# Custom\n## Dependency\ncustom controls\n");
  assert.equal(env.content(nonTask), "`BUTTON[task-add-dependency, task-remove-dependency]`\n");

  const second = await env.migrate({});
  assert.deepEqual(second, { migrated: 0, alreadyEmbedded: 3, skipped: 2, failures: [] });
  assert.match(env.notices.at(-1), /移行 0 \/ embed済み 3/);
});

test("dependency control migration also accepts the intermediate child button id", async () => {
  const filePath = "02-Task/2026/09/Intermediate.md";
  const env = makeEnv([
    {
      path: filePath,
      fm: { type: "task-pack" },
      content: "`BUTTON[task-add-dependency, task-add-child-dependency, task-remove-dependency]`\n"
    }
  ]);

  assert.deepEqual(await env.migrate({}), { migrated: 1, alreadyEmbedded: 0, skipped: 0, failures: [] });
  assert.match(env.content(filePath), new RegExp(embedTarget.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("migration command and maintenance manifest register the dedicated migration", () => {
  const command = fs.readFileSync(path.join(root, commandPath), "utf8");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, manifestPath), "utf8"));
  const entry = manifest.maintenance?.one_time_migrations?.find(item => item.script === migrationPath);

  assert.match(command, /tp\.user\.migrate_task_dependency_controls\(tp\)/);
  assert.ok(entry);
  assert.equal(entry.command, commandPath);
  assert.equal(fs.existsSync(path.join(root, entry.script)), true);
  assert.equal(fs.existsSync(path.join(root, entry.command)), true);
});
