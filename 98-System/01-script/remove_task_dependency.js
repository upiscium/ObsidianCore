module.exports = async function removeTaskDependency(tp) {
  const R = await loadReferenceUtils();
  const activeFile = app.workspace.getActiveFile();

  if (!activeFile || activeFile.extension !== "md") {
    new Notice("Taskファイルを開いてから実行してください。");
    return;
  }

  const fm = app.metadataCache.getFileCache(activeFile)?.frontmatter ?? {};
  if (!R.isTaskType(fm.type)) {
    new Notice("現在のファイルはTaskではありません。");
    return;
  }

  const dependencies = R.asArray(fm.depends_on).map(value => String(value));
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
        : R.referenceLabel(value),
      status: file ? R.normalizeTaskStatus(targetFm.status) : null
    };
  });

  const selected = await tp.system.suggester(
    candidates.map(candidate =>
      candidate.file
        ? `${R.taskStatusLabel(candidate.status)} | ${candidate.title}`
        : `⚠️ 参照不明 | ${candidate.title || candidate.value}`
    ),
    candidates,
    false,
    "削除する依存Taskを選択"
  );

  if (!selected) return;

  await app.fileManager.processFrontMatter(activeFile, frontmatter => {
    const current = R.asArray(frontmatter.depends_on).map(value => String(value));
    current.splice(selected.index, 1);
    frontmatter.depends_on = current;
  });

  new Notice(`依存Taskを削除しました: ${selected.title || selected.value}`);
};

async function loadReferenceUtils() {
  const path = "98-System/01-script/task_reference_utils.js";
  const file = app.vault.getAbstractFileByPath(path);
  if (!file || file.extension !== "js") throw new Error(`Task reference utilityが見つかりません: ${path}`);
  const source = await app.vault.read(file);
  return new Function(`"use strict"; return (${source});`)();
}
