module.exports = async function addTaskDependency(tp) {
  const { R, T } = await loadTaskUtils();
  const activeFile = app.workspace.getActiveFile();

  if (!activeFile || activeFile.extension !== "md") {
    new Notice("Taskファイルを開いてから実行してください。");
    return;
  }

  const activeFm = app.metadataCache.getFileCache(activeFile)?.frontmatter ?? {};
  if (!T.isTaskType(activeFm.type)) {
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
        status: T.normalizeTaskStatus(fm.status),
        project: R.referenceLabel(fm.project)
      };
    })
    .filter(task =>
      T.isTaskType(task.fm.type) &&
      T.isTaskActionableStatus(task.status) &&
      !existingPaths.has(task.file.path) &&
      !dependsTransitivelyOn(R, task.file, activeFile.path, new Set())
    )
    .sort((a, b) => {
      const status = T.taskStatusOrder(a.status) - T.taskStatusOrder(b.status);
      return status !== 0 ? status : a.title.localeCompare(b.title, "ja");
    });

  if (candidates.length === 0) {
    new Notice("追加できる依存Taskがありません。");
    return;
  }

  const selected = await tp.system.suggester(
    candidates.map(task => {
      const suffix = task.project ? ` — ${task.project}` : "";
      return `${T.taskStatusLabel(task.status)} | ${task.title}${suffix}`;
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

async function loadTaskUtils() {
  const genericPath = "98-System/01-script/reference_utils.js";
  const referencePath = "98-System/01-script/task_reference_utils.js";
  const metadataPath = "98-System/01-script/task_meta_utils.js";
  const genericFile = app.vault.getAbstractFileByPath(genericPath);
  const referenceFile = app.vault.getAbstractFileByPath(referencePath);
  const metadataFile = app.vault.getAbstractFileByPath(metadataPath);
  if (!genericFile || genericFile.extension !== "js") throw new Error(`Reference utilityが見つかりません: ${genericPath}`);
  if (!referenceFile || referenceFile.extension !== "js") throw new Error(`Task reference utilityが見つかりません: ${referencePath}`);
  if (!metadataFile || metadataFile.extension !== "js") throw new Error(`Task metadata utilityが見つかりません: ${metadataPath}`);
  const genericSource = await app.vault.read(genericFile);
  const referenceSource = await app.vault.read(referenceFile);
  const metadataSource = await app.vault.read(metadataFile);
  const G = new Function(`"use strict"; return (${genericSource});`)();
  const factory = new Function(`"use strict"; return (${referenceSource});`)();
  const T = new Function(`"use strict"; return (${metadataSource});`)();
  return { R: factory(G), T };
}
