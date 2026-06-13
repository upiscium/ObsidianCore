module.exports = async (tp) => {
  const activeFile = app.workspace.getActiveFile();

  if (!activeFile) {
    new Notice("エラー: アクティブなファイルがありません。");
    return;
  }

  const cache = app.metadataCache.getFileCache(activeFile);
  const type = cache?.frontmatter?.type;

  if (type !== "workspace") {
    new Notice("エラー: Workspace Entry上で実行してください。");
    return;
  }

  const currentFolder = activeFile.parent;
  if (!currentFolder) {
    new Notice("エラー: 現在のフォルダを取得できません。");
    return;
  }

  const noteNameRaw = await tp.system.prompt("Workspace Note名を入力してください:");
  const noteName = sanitizeFileName(noteNameRaw);

  if (!noteName) {
    new Notice("Workspace Note作成をキャンセルしました。");
    return;
  }

  const templateName = "workspace-note-template";
  const templateFile = tp.file.find_tfile(templateName);

  if (!templateFile) {
    new Notice(`致命的なエラー: テンプレートファイル「${templateName}」が見つかりません。`);
    return;
  }

  const filePath = `${currentFolder.path}/${noteName}.md`;

  if (app.vault.getAbstractFileByPath(filePath)) {
    new Notice(`エラー: 既に ${filePath} が存在します。`);
    return;
  }

  await tp.file.create_new(templateFile, noteName, true, currentFolder);

  new Notice(`Workspace Note「${noteName}」を作成しました。`);
};

function sanitizeFileName(input) {
  if (!input) return "";

  const name = input
    .trim()
    .replace(/[\\/:*?"<>|#^\[\]]/g, "")
    .replace(/\s+/g, " ");

  if (name === "." || name === "..") return "";

  return name;
}
