module.exports = async function removeTaskDependency(tp) {
  const { G, R, T } = await loadTaskUtils();
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

  const dependencies = G.asArray(fm.depends_on).map(value => String(value));
  if (dependencies.length === 0) {
    new Notice("削除できる依存Taskがありません。");
    return;
  }

  const candidates = dependencies.map((value, index) => {
    const file = R.resolveLinkFile(app, value, activeFile.path);
    const targetFm = file
      ? app.metadataCache.getFileCache(file)?.frontmatter ?? {}
      : {};

    return {
      index,
      value,
      file,
      title: file
        ? String(targetFm.title ?? "").trim() || R.stripTaskTimestamp(file.basename)
        : G.referenceLabel(value),
      status: file ? T.normalizeTaskStatus(targetFm.status) : null
    };
  });

  const selected = await tp.system.suggester(
    candidates.map(candidate =>
      candidate.file
        ? `${T.taskStatusLabel(candidate.status)} | ${candidate.title}`
        : `⚠️ 参照不明 | ${candidate.title || candidate.value}`
    ),
    candidates,
    false,
    "削除する依存Taskを選択"
  );

  if (!selected) return;

  await app.fileManager.processFrontMatter(activeFile, frontmatter => {
    const current = G.asArray(frontmatter.depends_on).map(value => String(value));
    current.splice(selected.index, 1);
    frontmatter.depends_on = current;
  });

  new Notice(`依存Taskを削除しました: ${selected.title || selected.value}`);
};

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
  return { G, R: factory(G), T };
}
