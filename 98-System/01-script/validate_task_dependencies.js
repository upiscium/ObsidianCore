module.exports = async function validateTaskDependencies(tp) {
  const { G, X, T, D } = await loadTaskUtils();
  const tasks = app.vault
    .getMarkdownFiles()
    .filter(file => file.path.startsWith("02-Task/"))
    .map(file => ({ file, fm: app.metadataCache.getFileCache(file)?.frontmatter ?? {} }))
    .filter(task => T.isTaskType(task.fm.type));

  const taskPaths = new Set(tasks.map(task => task.file.path));
  const issues = [];

  for (const task of tasks) {
    validateTask(task);
  }

  const cycles = D.cycleMembers([...taskPaths], dependencyOutgoing);
  for (const path of cycles) {
    issues.push(issue("error", path, "depends_on", "依存Taskグラフに循環があります"));
  }

  const summary = {
    errors: issues.filter(item => item.severity === "error").length,
    warnings: issues.filter(item => item.severity === "warning").length,
    tasks: tasks.length,
    cycleTasks: cycles.size
  };

  console.log("ObsidianCore Task Dependency Validation", { summary, issues });
  if (issues.length > 0) console.table(issues);

  new Notice(
    `Task Dependency Validation: error ${summary.errors} / warning ${summary.warnings} / ` +
    `cycle ${summary.cycleTasks}. 詳細は開発者コンソールを確認してください。`
  );

  return { summary, issues };

  function validateTask(task) {
    const raw = task.fm.depends_on;
    const values = G.asArray(raw);
    if (raw !== null && raw !== undefined && raw !== "" && !Array.isArray(raw)) {
      issues.push(issue("warning", task.file.path, "depends_on", "depends_onは配列で管理してください"));
    }

    const seenPaths = new Set();
    for (const value of values) {
      if (!G.looksLikeLink(value)) {
        issues.push(issue("warning", task.file.path, "depends_on", `Wiki Link形式ではない依存Task参照です: ${String(value)}`));
      }

      const dependency = X.resolveLinkFile(app, value, task.file.path);
      if (!dependency || !taskPaths.has(dependency.path)) {
        issues.push(issue("error", task.file.path, "depends_on", `依存Taskを解決できません: ${String(value)}`));
        continue;
      }

      if (dependency.path === task.file.path) {
        issues.push(issue("error", task.file.path, "depends_on", "Task自身には依存できません"));
      }

      if (seenPaths.has(dependency.path)) {
        issues.push(issue("error", task.file.path, "depends_on", `依存Taskが重複しています: ${dependency.basename}`));
      }
      seenPaths.add(dependency.path);
    }
  }

  function dependencyOutgoing(path) {
    const file = app.vault.getAbstractFileByPath(path);
    if (!file || file.extension !== "md") return [];
    const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    return G.asArray(fm.depends_on)
      .map(value => X.resolveLinkFile(app, value, file.path)?.path)
      .filter(path => path && taskPaths.has(path));
  }
};

function issue(severity, path, field, message) {
  return { severity, path, field, message };
}

async function loadTaskUtils() {
  const genericPath = "98-System/01-script/reference_utils.js";
  const runtimePath = "98-System/01-script/reference_runtime_utils.js";
  const metadataPath = "98-System/01-script/task_meta_utils.js";
  const dependencyPath = "98-System/01-script/task_dependency_utils.js";
  const genericFile = app.vault.getAbstractFileByPath(genericPath);
  const runtimeFile = app.vault.getAbstractFileByPath(runtimePath);
  const metadataFile = app.vault.getAbstractFileByPath(metadataPath);
  const dependencyFile = app.vault.getAbstractFileByPath(dependencyPath);
  if (!genericFile || genericFile.extension !== "js") throw new Error(`Reference utilityが見つかりません: ${genericPath}`);
  if (!runtimeFile || runtimeFile.extension !== "js") throw new Error(`Runtime reference utilityが見つかりません: ${runtimePath}`);
  if (!metadataFile || metadataFile.extension !== "js") throw new Error(`Task metadata utilityが見つかりません: ${metadataPath}`);
  if (!dependencyFile || dependencyFile.extension !== "js") throw new Error(`Task dependency utilityが見つかりません: ${dependencyPath}`);
  const genericSource = await app.vault.read(genericFile);
  const runtimeSource = await app.vault.read(runtimeFile);
  const metadataSource = await app.vault.read(metadataFile);
  const dependencySource = await app.vault.read(dependencyFile);
  const G = new Function(`"use strict"; return (${genericSource});`)();
  const runtimeFactory = new Function(`"use strict"; return (${runtimeSource});`)();
  const T = new Function(`"use strict"; return (${metadataSource});`)();
  const D = new Function(`"use strict"; return (${dependencySource});`)();
  return { G, X: runtimeFactory(G), T, D };
}
