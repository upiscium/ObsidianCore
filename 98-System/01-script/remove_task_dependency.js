module.exports = async function removeTaskDependency(tp) {
  const activeFile = app.workspace.getActiveFile();

  if (!activeFile || activeFile.extension !== "md") {
    new Notice("Taskファイルを開いてから実行してください。");
    return;
  }

  const fm = app.metadataCache.getFileCache(activeFile)?.frontmatter ?? {};

  if (String(fm.type ?? "") !== "task") {
    new Notice("現在のファイルはTaskではありません。");
    return;
  }

  const dependencies = asArray(fm.depends_on).map(value => String(value));

  if (dependencies.length === 0) {
    new Notice("削除できる依存Taskがありません。");
    return;
  }

  const candidates = dependencies.map((value, index) => {
    const file = resolveLinkFile(value, activeFile.path);
    const targetFm = file
      ? app.metadataCache.getFileCache(file)?.frontmatter ?? {}
      : {};

    return {
      index,
      value,
      file,
      title: file
        ? String(targetFm.title ?? "").trim() || stripTaskTimestamp(file.basename)
        : referenceLabel(value),
      status: file ? normalizeTaskStatus(targetFm.status) : null
    };
  });

  const selected = await tp.system.suggester(
    candidates.map(candidate =>
      candidate.file
        ? `${statusLabel(candidate.status)} | ${candidate.title}`
        : `⚠️ 参照不明 | ${candidate.title || candidate.value}`
    ),
    candidates,
    false,
    "削除する依存Taskを選択"
  );

  if (!selected) return;

  await app.fileManager.processFrontMatter(activeFile, frontmatter => {
    const current = asArray(frontmatter.depends_on).map(value => String(value));
    current.splice(selected.index, 1);
    frontmatter.depends_on = current;
  });

  new Notice(`依存Taskを削除しました: ${selected.title || selected.value}`);
};

function asArray(value) {
  if (value === null || value === undefined || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeLinkpath(value) {
  if (value && typeof value === "object" && value.path) {
    return String(value.path).replace(/\.md$/, "");
  }

  return String(value ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^\[\[/, "")
    .replace(/\]\]$/, "")
    .split("|")[0]
    .replace(/\.md$/, "");
}

function resolveLinkFile(value, sourcePath) {
  const linkpath = normalizeLinkpath(value);
  if (!linkpath) return null;
  return app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath);
}

function referenceLabel(value) {
  const raw = String(value ?? "").trim();
  const alias = raw.match(/\|([^\]]+)\]\]$/)?.[1];
  if (alias) return alias;
  return normalizeLinkpath(value).split("/").pop();
}

function normalizeTaskStatus(value) {
  return ["todo", "doing", "done", "cancelled"].includes(String(value ?? ""))
    ? String(value)
    : "todo";
}

function statusLabel(value) {
  return {
    todo: "⬜ 未着手",
    doing: "🏃 進行中",
    done: "✅ 完了",
    cancelled: "🚫 キャンセル"
  }[normalizeTaskStatus(value)];
}

function stripTaskTimestamp(name) {
  return String(name)
    .replace(/^\d{8}-\d{6}-\d{3}-/, "")
    .replace(/^\d{8}-\d{4}-/, "")
    .trim();
}
