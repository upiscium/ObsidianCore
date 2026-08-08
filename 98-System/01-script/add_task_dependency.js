module.exports = async function addTaskDependency(tp) {
  const R = await loadReferenceUtils();
  const activeFile = app.workspace.getActiveFile();

  if (!activeFile || activeFile.extension !== "md") {
    new Notice("Taskファイルを開いてから実行してください。");
    return;
  }

  const activeFm = app.metadataCache.getFileCache(activeFile)?.frontmatter ?? {};
  if (!R.isTaskType(activeFm.type)) {
    new Notice("現在のファイルはTaskではありません。");
    return;
  }

  const existingPaths = new Set(
    R.asArray(activeFm.depends_on)
      .map(value => R.resolveLinkFile(app, value, activeFile.path)?.path)
      .filter(Boolean)
  );

  const candidates = app.vault
    .getMarkdownFiles()
    .filter(file => file.path.startsWith("02-Task/") && file.path !== activeFile.path)
    .map(file => {
      const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
      return {
        file,
        fm,
        title: String(fm.title ?? "").trim() || R.stripTaskTimestamp(file.basename),
        status: R.normalizeTaskStatus(fm.status),
        project: R.referenceLabel(fm.project)
      };
    })
    .filter(task =>
      R.isTaskType(task.fm.type) &&
      !["done", "cancelled"].includes(task.status) &&
      !existingPaths.has(task.file.path) &&
      !dependsTransitivelyOn(R, task.file, activeFile.path, new Set())
    )
    .sort((a, b) => {
      const status = R.taskStatusOrder(a.status) - R.taskStatusOrder(b.status);
      return status !== 0 ? status : a.title.localeCompare(b.title, "ja");
    });

  if (candidates.length === 0) {
    new Notice("追加できる依存Taskがありません。");
    return;
  }

  const selected = await tp.system.suggester(
    candidates.map(task => {
      const suffix = task.project ? ` — ${task.project}` : "";
      return `${R.taskStatusLabel(task.status)} | ${task.title}${suffix}`;
    }),
    candidates,
    false,
    "依存するTaskを選択"
  );

  if (!selected) return;

  const link = app.fileManager.generateMarkdownLink(
    selected.file,
    activeFile.path,
    undefined,
    selected.title
  );

  await app.fileManager.processFrontMatter(activeFile, frontmatter => {
    const current = R.asArray(frontmatter.depends_on).map(value => String(value));
    if (!current.includes(link)) current.push(link);
    frontmatter.depends_on = current;
  });

  new Notice(`依存Taskを追加しました: ${selected.title}`);
};

function dependsTransitivelyOn(R, file, targetPath, visited) {
  if (!file || visited.has(file.path)) return false;
  if (file.path === targetPath) return true;

  visited.add(file.path);
  const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
  return R.asArray(fm.depends_on).some(value => {
    const dependency = R.resolveLinkFile(app, value, file.path);
    return dependency ? dependsTransitivelyOn(R, dependency, targetPath, visited) : false;
  });
}

async function loadReferenceUtils() {
  const genericPath = "98-System/01-script/reference_utils.js";
  const taskPath = "98-System/01-script/task_reference_utils.js";
  const genericFile = app.vault.getAbstractFileByPath(genericPath);
  const taskFile = app.vault.getAbstractFileByPath(taskPath);
  if (!genericFile || genericFile.extension !== "js") throw new Error(`Reference utilityが見つかりません: ${genericPath}`);
  if (!taskFile || taskFile.extension !== "js") throw new Error(`Task reference utilityが見つかりません: ${taskPath}`);
  const genericSource = await app.vault.read(genericFile);
  const taskSource = await app.vault.read(taskFile);
  const G = new Function(`"use strict"; return (${genericSource});`)();
  const factory = new Function(`"use strict"; return (${taskSource});`)();
  return factory(G);
}
