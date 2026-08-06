module.exports = async (tp) => {
  const activeFile = app.workspace.getActiveFile();
  if (!activeFile) {
    new Notice("エラー: アクティブなファイルがありません。");
    return;
  }

  const currentFolder = activeFile.parent;
  const cache = app.metadataCache.getFileCache(activeFile);
  const frontmatter = cache?.frontmatter ?? {};
  if (!currentFolder || frontmatter.type !== "project") {
    new Notice("エラー: Project Entry上で実行してください。");
    return;
  }

  const noteName = sanitizeFileName(await tp.system.prompt("Project Note名を入力してください:"));
  if (!noteName) {
    new Notice("Project Note作成をキャンセルしました。");
    return;
  }

  const templateFile = tp.file.find_tfile("project-note-template");
  if (!templateFile) {
    new Notice("致命的なエラー: project-note-template が見つかりません。");
    return;
  }

  const filePath = `${currentFolder.path}/${noteName}.md`;
  if (app.vault.getAbstractFileByPath(filePath)) {
    new Notice(`エラー: 既に ${filePath} が存在します。`);
    return;
  }

  const createdFile = await tp.file.create_new(templateFile, noteName, true, currentFolder);
  if (!createdFile) {
    new Notice("Project Noteの作成に失敗しました。");
    return;
  }

  const projectLink = app.fileManager.generateMarkdownLink(activeFile, createdFile.path);
  await app.fileManager.processFrontMatter(createdFile, (fm) => {
    fm.type = "project-note";
    fm.project = projectLink;
    fm.workspace = frontmatter.workspace || null;
  });

  new Notice(`Project Note「${noteName}」を作成しました。`);
};

function sanitizeFileName(input) {
  if (!input) return "";
  const name = input.trim().replace(/[\\/:*?"<>|#^\[\]]/g, "").replace(/\s+/g, " ");
  if (name === "." || name === "..") return "";
  return name;
}
