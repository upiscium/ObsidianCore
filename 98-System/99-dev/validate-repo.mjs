import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const issues = [];
const error = (p, m) => issues.push({ severity: "error", path: p, message: m });
const warning = (p, m) => issues.push({ severity: "warning", path: p, message: m });
const exists = p => fs.existsSync(path.join(root, p));

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(path.join(root, p), "utf8")); }
  catch (e) { error(p, `JSONを読めません: ${e.message}`); return null; }
}

function walk(p) {
  const abs = path.join(root, p);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap(entry => {
    const child = path.posix.join(p, entry.name);
    return entry.isDirectory() ? walk(child) : entry.isFile() ? [child] : [];
  });
}

function checkConflictMarkers() {
  const extensions = new Set([".js", ".mjs", ".json", ".md", ".css", ".yml", ".yaml"]);
  const marker = /^(<<<<<<<|=======|>>>>>>>)(?:\s|$)/m;
  for (const base of ["98-System", ".obsidian", ".github"]) {
    for (const p of walk(base)) {
      if (!extensions.has(path.extname(p))) continue;
      if (marker.test(fs.readFileSync(path.join(root, p), "utf8"))) error(p, "Git競合マーカーが残っています");
    }
  }
}

function checkJavaScriptSyntax() {
  for (const p of walk("98-System/01-script").filter(item => item.endsWith(".js"))) {
    const result = spawnSync(process.execPath, ["--check", path.join(root, p)], { encoding: "utf8" });
    if (result.status !== 0) {
      const message = String(result.stderr || result.stdout || "Syntax error").trim().split("\n").slice(-3).join(" | ");
      error(p, `JavaScript構文エラー: ${message}`);
    }
  }
}

const manifestPath = "98-System/99-dev/setup/automation-manifest.json";
const manifest = readJson(manifestPath);
const plugins = readJson(".obsidian/community-plugins.json");
const dailyNotes = readJson(".obsidian/daily-notes.json");
const appearance = readJson(".obsidian/appearance.json");

for (const plugin of manifest?.required_plugins ?? []) {
  if (!Array.isArray(plugins) || !plugins.includes(plugin)) error(".obsidian/community-plugins.json", `必須プラグインがありません: ${plugin}`);
}

for (const folder of [manifest?.templater?.templates_folder, manifest?.templater?.user_scripts_folder].filter(Boolean)) {
  if (!exists(folder)) error(manifestPath, `Templater用パスが存在しません: ${folder}`);
}

for (const choice of manifest?.quickadd?.required_choices ?? []) {
  if (!choice.name) error(manifestPath, "QuickAdd Choiceにnameがありません");
  if (!choice.script || !exists(choice.script)) error(manifestPath, `QuickAdd Choiceのscriptが存在しません: ${choice.name} -> ${choice.script ?? "(missing)"}`);
}

for (const utilityPath of [
  "98-System/01-script/reference_utils.js",
  "98-System/01-script/task_creation_utils.js",
  "98-System/01-script/task_reference_utils.js",
  "98-System/01-script/task_meta_utils.js",
  "98-System/01-script/entity_meta_utils.js"
]) {
  if (!exists(utilityPath)) error(utilityPath, "共通utilityが見つかりません");
}

if (dailyNotes?.template) {
  const p = dailyNotes.template.endsWith(".md") ? dailyNotes.template : `${dailyNotes.template}.md`;
  if (!exists(p)) error(".obsidian/daily-notes.json", `Daily Notes templateが存在しません: ${p}`);
}

for (const snippet of appearance?.enabledCssSnippets ?? []) {
  const p = `.obsidian/snippets/${snippet}.css`;
  if (!exists(p)) error(".obsidian/appearance.json", `有効化されたCSS snippetが存在しません: ${p}`);
}

for (const p of ["98-System/01-script/migrate_tasks_v3.js", "98-System/01-script/migrate_entity_relations.js"]) {
  if (!exists(p)) warning(p, "Migration recovery scriptが見つかりません");
}

checkConflictMarkers();
checkJavaScriptSyntax();

const errors = issues.filter(x => x.severity === "error");
const warnings = issues.filter(x => x.severity === "warning");
if (issues.length) console.table(issues);
console.log(`ObsidianCore repo validation: error ${errors.length} / warning ${warnings.length}`);
if (errors.length) process.exitCode = 1;
