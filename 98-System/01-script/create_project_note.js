module.exports = async (tp) => {
  const activeFile = app.workspace.getActiveFile();

  if (!activeFile) {
    new Notice("エラー: アクティブなファイルがありません。");
    return;
  }

  const currentFolder = activeFile.parent;
  if (!currentFolder) {
    new Notice("エラー: 現在のフォルダを取得できません。");
    return;
  }

  const cache = app.metadataCache.getFileCache(activeFile);
  const frontmatter = cache?.frontmatter ?? {};
  const type = frontmatter.type;

  if (type !== "project") {
    new Notice("エラー: Project Entry上で実行してください。");
    return;
  }

  const noteNameRaw = await tp.system.prompt("Project Note名を入力してください:");
  const noteName = sanitizeFileName(noteNameRaw);

  if (!noteName) {
    new Notice("Project Note作成をキャンセルしました。");
    return;
  }

  const templateName = "project-note-template";
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

  const createdFile = app.vault.getAbstractFileByPath(filePath);

  if (!createdFile) {
    new Notice("エラー: 作成したファイルを取得できませんでした。");
    return;
  }

  await app.fileManager.processFrontMatter(createdFile, (fm) => {
    fm.type = "project-note";

    // Project Entry のファイル名を Project 名として保存
    fm.project = activeFile.basename;

    // Project Entry に workspace があればコピー
    if (frontmatter.workspace) {
      fm.workspace = frontmatter.workspace;
    }
  });

  new Notice(`Project Note「${noteName}」を作成しました。`);
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