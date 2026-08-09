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

function readExpression(p) {
  const source = fs.readFileSync(path.join(root, p), "utf8");
  return new Function(`"use strict"; return (${source});`)();
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

function checkReferenceUtilityContract() {
  const genericPath = "98-System/01-script/reference_utils.js";
  const runtimePath = "98-System/01-script/reference_runtime_utils.js";
  const taskPath = "98-System/01-script/task_reference_utils.js";
  const entityPath = "98-System/01-script/entity_reference_utils.js";
  if (![genericPath, runtimePath, taskPath, entityPath].every(exists)) return;

  try {
    const G = readExpression(genericPath);
    const runtimeFactory = readExpression(runtimePath);
    const taskFactory = readExpression(taskPath);
    const entityFactory = readExpression(entityPath);
    if (typeof runtimeFactory !== "function") error(runtimePath, "Runtime reference utilityがfactoryではありません");
    if (typeof taskFactory !== "function") error(taskPath, "Task reference utilityがfactoryではありません");
    if (typeof entityFactory !== "function") error(entityPath, "Entity reference utilityがfactoryではありません");
    if ([runtimeFactory, taskFactory, entityFactory].some(factory => typeof factory !== "function")) return;

    const X = runtimeFactory(G);
    const R = taskFactory(G, X);
    const ER = entityFactory(G);

    for (const name of ["resolveLinkFile", "resolveDataviewPage", "dataviewReferenceDisplay"]) {
      if (typeof X?.[name] !== "function") error(runtimePath, `Runtime reference utility APIがありません: ${name}`);
    }

    for (const name of ["dependencyPages", "dependencyHasPathTo", "dependencyInfo"]) {
      if (typeof R?.[name] !== "function") error(taskPath, `Task dependency utility APIがありません: ${name}`);
    }

    for (const name of ["findEntityNotes", "entityMatchesReference", "makeEntityLink"]) {
      if (typeof ER?.[name] !== "function") error(entityPath, `Entity reference utility APIがありません: ${name}`);
      if (name in R) error(taskPath, `Entity reference APIがTask reference utilityへ混入しています: ${name}`);
    }

    if (G.normalizeLinkpath("[[03-Workspace/example|Alias]]") !== "03-Workspace/example") {
      error(genericPath, "generic reference utilityのnormalizeLinkpathが不正です");
    }

    for (const name of [
      "asArray",
      "normalizeLinkpath",
      "parseReference",
      "normalizeReferences",
      "referenceKeys",
      "matchesReference",
      "referenceLabel"
    ]) {
      if (name in X) error(runtimePath, `Generic reference APIがRuntime reference utilityへ再exportされています: ${name}`);
      if (name in R) error(taskPath, `Generic reference APIがTask reference utilityへ再exportされています: ${name}`);
      if (name in ER) error(entityPath, `Generic reference APIがEntity reference utilityへ再exportされています: ${name}`);
    }

    for (const name of ["resolveLinkFile", "resolveDataviewPage", "dataviewReferenceDisplay", "stripTaskTimestamp"]) {
      if (name in R) error(taskPath, `非dependency APIがTask reference utilityへ混入しています: ${name}`);
    }

    for (const name of ["isTaskType", "normalizeTaskStatus", "taskStatusLabel", "taskStatusOrder"]) {
      if (name in R) error(taskPath, `Task metadata APIがreference utilityへ混入しています: ${name}`);
    }
  } catch (e) {
    error("98-System/01-script", `Reference utility contractを評価できません: ${e.message}`);
  }
}

function checkRuntimeMetadataContract() {
  const taskPath = "98-System/01-script/task_meta_utils.js";
  const entityPath = "98-System/01-script/entity_meta_utils.js";
  if (!exists(taskPath) || !exists(entityPath)) return;

  try {
    const T = readExpression(taskPath);
    const E = readExpression(entityPath);

    if (T.normalizeTaskStatus("todo") !== "todo" || T.normalizeTaskStatus("running") !== null) {
      error(taskPath, "Task status runtime contractがcanonical-onlyではありません");
    }
    if (T.normalizeTaskPriority("high") !== "high" || T.normalizeTaskPriority("1") !== null) {
      error(taskPath, "Task priority runtime contractがcanonical-onlyではありません");
    }
    if (T.isTaskType("task") !== true || T.isTaskType("task-pack") !== false) {
      error(taskPath, "Task type runtime contractがcanonical-onlyではありません");
    }
    if (T.stripTaskTimestamp("20260809-123456-789-Example") !== "Example") {
      error(taskPath, "Task filename表示contractが不正です");
    }

    if (E.normalizeStatus("planning") !== "planning" || E.normalizeStatus("archived") !== null) {
      error(entityPath, "Entity status runtime contractがcanonical-onlyではありません");
    }
    if (E.normalizePriority("medium") !== "medium" || E.normalizePriority("2") !== null) {
      error(entityPath, "Entity priority runtime contractがcanonical-onlyではありません");
    }
  } catch (e) {
    error("98-System/01-script", `Runtime metadata contractを評価できません: ${e.message}`);
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
  "98-System/01-script/reference_runtime_utils.js",
  "98-System/01-script/note_meta_utils.js",
  "98-System/01-script/task_creation_utils.js",
  "98-System/01-script/task_reference_utils.js",
  "98-System/01-script/entity_reference_utils.js",
  "98-System/01-script/task_meta_utils.js",
  "98-System/01-script/entity_meta_utils.js"
]) {
  if (!exists(utilityPath)) error(utilityPath, "共通utilityが見つかりません");
}

for (const recoveryPath of manifest?.recovery?.migration_scripts ?? []) {
  if (!exists(recoveryPath)) error(manifestPath, `Recovery migrationが存在しません: ${recoveryPath}`);
}

if (dailyNotes?.template) {
  const p = dailyNotes.template.endsWith(".md") ? dailyNotes.template : `${dailyNotes.template}.md`;
  if (!exists(p)) error(".obsidian/daily-notes.json", `Daily Notes templateが存在しません: ${p}`);
}

for (const snippet of appearance?.enabledCssSnippets ?? []) {
  const p = `.obsidian/snippets/${snippet}.css`;
  if (!exists(p)) error(".obsidian/appearance.json", `有効化されたCSS snippetが存在しません: ${p}`);
}

checkConflictMarkers();
checkJavaScriptSyntax();
checkReferenceUtilityContract();
checkRuntimeMetadataContract();

const errors = issues.filter(x => x.severity === "error");
const warnings = issues.filter(x => x.severity === "warning");
if (issues.length) console.table(issues);
console.log(`ObsidianCore repo validation: error ${errors.length} / warning ${warnings.length}`);
if (errors.length) process.exitCode = 1;
