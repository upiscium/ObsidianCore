module.exports = async function removeTaskDependency(tp) {
  const { G, X, T } = await loadTaskUtils();
  const activeFile = app.workspace.getActiveFile();

  if (!activeFile || activeFile.extension !== "md") {
    new Notice("Taskファイルを開いてから実行してください。");
    return;
  }

  const fm = app.metadataCache.getFileCache(activeFile)?.frontmatter ?? {};
  if (!T.isTaskType(fm.type)) {
    new Notice("現在のファイルはTaskではありません。");
    return;
  }

  const candidates = [
    ...parentCandidates(),
    ...childCandidates()
  ];

  if (candidates.length === 0) {
    new Notice("削除できる依存関係がありません。");
    return;
  }

  const selected = await tp.system.suggester(
    candidates.map(candidate => {
      const relation = candidate.kind === "parent" ? "親" : "子";
      if (!candidate.file) {
        return `${relation} | ⚠️ 参照不明 | ${candidate.title || candidate.value}`;
      }
      return `${relation} | ${T.taskStatusLabel(candidate.status)} | ${candidate.title}`;
    }),
    candidates,
    false,
    "削除する依存関係を選択"
  );

  if (!selected) return;

  if (selected.kind === "parent") {
    await removeParentDependency(selected);
  } else {
    await removeChildDependency(selected);
  }

  new Notice(`依存関係を削除しました: ${selected.title || selected.value}`);

  function parentCandidates() {
    return G.asArray(fm.depends_on).map(value => {
      const raw = String(value);
      const file = X.resolveLinkFile(app, raw, activeFile.path);
      const targetFm = file
        ? app.metadataCache.getFileCache(file)?.frontmatter ?? {}
        : {};
      return {
        kind: "parent",
        value: raw,
        file,
        title: file
          ? taskTitle(file, targetFm)
          : G.referenceLabel(raw),
        status: file ? T.normalizeTaskStatus(targetFm.status) : null
      };
    });
  }

  function childCandidates() {
    return app.vault
      .getMarkdownFiles()
      .filter(file => file.path.startsWith("02-Task/") && file.path !== activeFile.path)
      .map(file => {
        const childFm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
        return { file, fm: childFm };
      })
      .filter(item => T.isTaskType(item.fm.type))
      .filter(item => G.asArray(item.fm.depends_on).some(value =>
        X.resolveLinkFile(app, value, item.file.path)?.path === activeFile.path
      ))
      .map(item => ({
        kind: "child",
        value: null,
        file: item.file,
        title: taskTitle(item.file, item.fm),
        status: T.normalizeTaskStatus(item.fm.status)
      }));
  }

  async function removeParentDependency(candidate) {
    await app.fileManager.processFrontMatter(activeFile, frontmatter => {
      const current = G.asArray(frontmatter.depends_on).map(value => String(value));
      const index = current.indexOf(candidate.value);
      if (index >= 0) current.splice(index, 1);
      frontmatter.depends_on = current;
    });
  }

  async function removeChildDependency(candidate) {
    await app.fileManager.processFrontMatter(candidate.file, frontmatter => {
      const current = G.asArray(frontmatter.depends_on).map(value => String(value));
      const index = current.findIndex(value =>
        X.resolveLinkFile(app, value, candidate.file.path)?.path === activeFile.path
      );
      if (index >= 0) current.splice(index, 1);
      frontmatter.depends_on = current;
    });
  }

  function taskTitle(file, frontmatter) {
    return String(frontmatter.title ?? "").trim() || T.stripTaskTimestamp(file.basename);
  }
};

async function loadTaskUtils() {
  const genericPath = "98-System/01-script/reference_utils.js";
  const runtimePath = "98-System/01-script/reference_runtime_utils.js";
  const metadataPath = "98-System/01-script/task_meta_utils.js";
  const genericFile = app.vault.getAbstractFileByPath(genericPath);
  const runtimeFile = app.vault.getAbstractFileByPath(runtimePath);
  const metadataFile = app.vault.getAbstractFileByPath(metadataPath);
  if (!genericFile || genericFile.extension !== "js") throw new Error(`Reference utilityが見つかりません: ${genericPath}`);
  if (!runtimeFile || runtimeFile.extension !== "js") throw new Error(`Runtime reference utilityが見つかりません: ${runtimePath}`);
  if (!metadataFile || metadataFile.extension !== "js") throw new Error(`Task metadata utilityが見つかりません: ${metadataPath}`);
  const genericSource = await app.vault.read(genericFile);
  const runtimeSource = await app.vault.read(runtimeFile);
  const metadataSource = await app.vault.read(metadataFile);
  const G = new Function(`"use strict"; return (${genericSource});`)();
  const runtimeFactory = new Function(`"use strict"; return (${runtimeSource});`)();
  const T = new Function(`"use strict"; return (${metadataSource});`)();
  return { G, X: runtimeFactory(G), T };
}
