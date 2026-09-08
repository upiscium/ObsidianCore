(() => {
  const GENERIC_REFERENCE_UTILS_PATH = "98-System/01-script/reference_utils.js";
  const RUNTIME_REFERENCE_UTILS_PATH = "98-System/01-script/reference_runtime_utils.js";
  const TASK_META_UTILS_PATH = "98-System/01-script/task_meta_utils.js";
  let cached = null;

  async function loadUtils(app) {
    if (cached) return cached;

    const genericFile = app.vault.getAbstractFileByPath(GENERIC_REFERENCE_UTILS_PATH);
    const runtimeFile = app.vault.getAbstractFileByPath(RUNTIME_REFERENCE_UTILS_PATH);
    const taskMetaFile = app.vault.getAbstractFileByPath(TASK_META_UTILS_PATH);
    if (!genericFile || genericFile.extension !== "js") throw new Error(`Reference utilityが見つかりません: ${GENERIC_REFERENCE_UTILS_PATH}`);
    if (!runtimeFile || runtimeFile.extension !== "js") throw new Error(`Runtime reference utilityが見つかりません: ${RUNTIME_REFERENCE_UTILS_PATH}`);
    if (!taskMetaFile || taskMetaFile.extension !== "js") throw new Error(`Task metadata utilityが見つかりません: ${TASK_META_UTILS_PATH}`);

    const genericSource = await app.vault.read(genericFile);
    const runtimeSource = await app.vault.read(runtimeFile);
    const taskMetaSource = await app.vault.read(taskMetaFile);
    const G = new Function(`"use strict"; return (${genericSource});`)();
    const runtimeFactory = new Function(`"use strict"; return (${runtimeSource});`)();
    const T = new Function(`"use strict"; return (${taskMetaSource});`)();
    cached = { G, X: runtimeFactory(G), T };
    return cached;
  }

  async function chooseDependencies({ app, quickAddApi }) {
    const { G, T } = await loadUtils(app);
    let candidates = app.vault
      .getMarkdownFiles()
      .filter(file => file.path.startsWith("02-Task/"))
      .map(file => {
        const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
        return {
          file,
          title: String(fm.title ?? "").trim() || T.stripTaskTimestamp(file.basename),
          status: T.normalizeTaskStatus(fm.status),
          project: G.referenceLabel(fm.project),
          type: fm.type
        };
      })
      .filter(task => T.isTaskType(task.type) && T.isTaskActionableStatus(task.status))
      .sort((a, b) => {
        const status = T.taskStatusOrder(a.status) - T.taskStatusOrder(b.status);
        return status !== 0 ? status : a.title.localeCompare(b.title, "ja");
      });

    if (candidates.length === 0) return { cancelled: false, tasks: [] };

    const selected = [];
    while (true) {
      const done = { kind: "done" };
      const doneLabel = selected.length === 0
        ? "▫️ 依存Taskを設定しない"
        : `✅ 選択完了 (${selected.length}件)`;
      const choice = await quickAddApi.suggester(
        [
          doneLabel,
          ...candidates.map(task => {
            const suffix = task.project ? ` — ${task.project}` : "";
            return `${T.taskStatusLabel(task.status)} | ${task.title}${suffix}`;
          })
        ],
        [done, ...candidates]
      );

      if (choice === null || choice === undefined) return { cancelled: true, tasks: [] };
      if (choice.kind === "done") return { cancelled: false, tasks: selected };

      selected.push(choice);
      candidates = candidates.filter(task => task.file.path !== choice.file.path);
      if (candidates.length === 0) return { cancelled: false, tasks: selected };
    }
  }

  async function applyDependencies({ app, taskFile, dependencies }) {
    if (!Array.isArray(dependencies) || dependencies.length === 0) return;
    const { G, X } = await loadUtils(app);
    const links = dependencies.map(task => ({
      path: task.file.path,
      link: app.fileManager.generateMarkdownLink(task.file, taskFile.path, undefined, task.title)
    }));

    await app.fileManager.processFrontMatter(taskFile, frontmatter => {
      const current = G.asArray(frontmatter.depends_on).map(value => String(value));
      const existingPaths = new Set(
        current
          .map(value => X.resolveLinkFile(app, value, taskFile.path)?.path)
          .filter(Boolean)
      );

      for (const dependency of links) {
        if (existingPaths.has(dependency.path)) continue;
        current.push(dependency.link);
        existingPaths.add(dependency.path);
      }
      frontmatter.depends_on = current;
    });
  }

  return {
    chooseDependencies,
    applyDependencies
  };
})()
