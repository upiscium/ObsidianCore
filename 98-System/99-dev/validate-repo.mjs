import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const issues = [];

function readJson(relativePath) {
  const absolutePath = path.join(root, relativePath);
  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch (error) {
    issues.push({ severity: "error", path: relativePath, message: `JSONを読めません: ${error.message}` });
    return null;
  }
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function error(relativePath, message) {
  issues.push({ severity: "error", path: relativePath, message });
}

function warning(relativePath, message) {
  issues.push({ severity: "warning", path: relativePath, message });
}

function walkFiles(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) return [];

  const entries = fs.readdirSync(absolutePath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const child = path.posix.join(relativePath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(child));
    } else if (entry.isFile()) {
      files.push(child);
    }
  }

  return files;
}

function checkConflictMarkers() {
  const extensions = new Set([
    ".js", ".mjs", ".json", ".md", ".css", ".yml", ".yaml"
  ]);
  const roots = ["98-System", ".obsidian", ".github"];
  const marker = /^(<<<<<<<|=======|>>>>>>>)(?:\s|$)/m;

  for (const searchRoot of roots) {
    for (const relativePath of walkFiles(searchRoot)) {
      if (!extensions.has(path.extname(relativePath))) continue;

      const content = fs.readFileSync(path.join(root, relativePath), "utf8");
      if (marker.test(content)) {
        error(relativePath, "Git競合マーカーが残っています");
      }
    }
  }
}

const manifestPath = "98-System/99-dev/setup/automation-manifest.json";
const manifest = readJson(manifestPath);
const plugins = readJson(".obsidian/community-plugins.json");
const dailyNotes = readJson(".obsidian/daily-notes.json");
const appearance = readJson(".obsidian/appearance.json");

if (manifest) {
  for (const plugin of manifest.required_plugins ?? []) {
    if (!Array.isArray(plugins) || !plugins.includes(plugin)) {
      error(".obsidian/community-plugins.json", `必須プラグインがありません: ${plugin}`);
    }
  }

  const templater = manifest.templater ?? {};
  for (const folder of [templater.templates_folder, templater.user_scripts_folder].filter(Boolean)) {
    if (!exists(folder)) error(manifestPath, `Templater用パスが存在しません: ${folder}`);
  }

  for (const choice of manifest.quickadd?.required_choices ?? []) {
    if (!choice.name) error(manifestPath, "QuickAdd Choiceにnameがありません");
    if (!choice.script || !exists(choice.script)) {
      error(manifestPath, `QuickAdd Choiceのscriptが存在しません: ${choice.name} -> ${choice.script ?? "(missing)"}`);
    }
  }
}

if (dailyNotes?.template) {
  const templatePath = dailyNotes.template.endsWith(".md")
    ? dailyNotes.template
    : `${dailyNotes.template}.md`;
  if (!exists(templatePath)) {
    error(".obsidian/daily-notes.json", `Daily Notes templateが存在しません: ${templatePath}`);
  }
}

for (const snippet of appearance?.enabledCssSnippets ?? []) {
  const snippetPath = `.obsidian/snippets/${snippet}.css`;
  if (!exists(snippetPath)) {
    error(".obsidian/appearance.json", `有効化されたCSS snippetが存在しません: ${snippetPath}`);
  }
}

const legacyTaskFiles = [
  "98-System/02-embed/00-meta/dashboard-meta.md",
  "98-System/02-embed/03-table/not-listed-task-table.md",
  "98-System/02-embed/03-table/out-of-date-task-table.md",
  "98-System/02-embed/03-table/todays-task-table.md",
  "98-System/02-embed/03-table/under-running-task-table.md",
  "98-System/02-embed/03-table/upcoming-task-table.md"
];
for (const legacyPath of legacyTaskFiles) {
  if (exists(legacyPath)) warning(legacyPath, "Task v2 legacy viewが残っています");
}

const migrationFiles = [
  "98-System/01-script/migrate_tasks_v3.js",
  "98-System/01-script/migrate_entity_relations.js"
];
for (const migrationPath of migrationFiles) {
  if (!exists(migrationPath)) warning(migrationPath, "Migration recovery scriptが見つかりません");
}

checkConflictMarkers();

const errors = issues.filter(item => item.severity === "error");
const warnings = issues.filter(item => item.severity === "warning");

if (issues.length > 0) console.table(issues);
console.log(`ObsidianCore repo validation: error ${errors.length} / warning ${warnings.length}`);

if (errors.length > 0) process.exitCode = 1;
