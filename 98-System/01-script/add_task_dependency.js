module.exports = async function addTaskDependency(tp) {
  const { G, X, T, D } = await loadTaskUtils();
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

  const existingPaths = resolvedDependencyPaths(activeFile);
  const candidates = taskCandidates().filter(task =>
    task.file.path !== activeFile.path &&
    T.isTaskActionableStatus(task.status) &&
    !existingPaths.has(task.file.path) &&
    !D.wouldCreateCycle(activeFile.path, task.file.path, dependencyOutgoing)
  );

  if (candidates.length === 0) {
    new Notice("追加できる親タスクがありません。");
    return;
  }

  const selected = await chooseTask(candidates, "親タスクを選択");
  if (!selected) return;

  const link = app.fileManager.generateMarkdownLink(
    selected.file,
    activeFile.path,
    undefined,
    selected.title
  );

  await app.fileManager.processFrontMatter(activeFile, frontmatter => {
    const current = G.asArray(frontmatter.depends_on).map(value => String(value));
    if (!current.includes(link)) current.push(link);
    frontmatter.depends_on = current;
  });

  new Notice(`親タスクを追加しました: ${selected.title}`);

  function taskCandidates() {
    return app.vault
      .getMarkdownFiles()
      .filter(file => file.path.startsWith("02-Task/"))
      .map(file => {
        const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
        return {
          file,
          fm,
          title: taskTitle(file, fm),
          status: T.normalizeTaskStatus(fm.status),
          project: G.referenceLabel(fm.project)
        };
      })
      .filter(task => T.isTaskType(task.fm.type) && task.status !== null)
      .sort((a, b) => {
        const status = T.taskStatusOrder(a.status) - T.taskStatusOrder(b.status);
        return status !== 0 ? status : a.title.localeCompare(b.title, "ja");
      });
  }

  function taskTitle(file, fm) {
    return String(fm.title ?? "").trim() || T.stripTaskTimestamp(file.basename);
  }

  async function chooseTask(candidates, prompt) {
    return tp.system.suggester(
      candidates.map(task => {
        const suffix = task.project ? ` — ${task.project}` : "";
        return `${T.taskStatusLabel(task.status)} | ${task.title}${suffix}`;
      }),
      candidates,
      false,
      prompt
    );
  }

  function resolvedDependencyPaths(file) {
    const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    return new Set(
      G.asArray(fm.depends_on)
        .map(value => X.resolveLinkFile(app, value, file.path)?.path)
        .filter(Boolean)
    );
  }

  function dependencyOutgoing(path) {
    const file = app.vault.getAbstractFileByPath(path);
    if (!file || file.extension !== "md") return [];
    return [...resolvedDependencyPaths(file)];
  }
};

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
