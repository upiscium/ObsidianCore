module.exports = async (tp) => {
  const activeFile = app.workspace.getActiveFile();
  if (!activeFile) {
    new Notice("エラー: アクティブなファイルがありません。");
    return;
  }

  const cache = app.metadataCache.getFileCache(activeFile);
  if (cache?.frontmatter?.type !== "workspace") {
    new Notice("エラー: Workspace Entry上で実行してください。");
    return;
  }
  if (cache.frontmatter.lifecycle !== "active") {
    new Notice("エラー: Projectは有効なWorkspaceでのみ作成できます。");
    return;
  }

  const projectNameRaw = await tp.system.prompt("Workspaceに所属するProject名を入力してください:");
  const projectName = sanitizeFileName(projectNameRaw);
  if (!projectName) {
    new Notice("Project作成をキャンセルしました。");
    return;
  }

  const basePath = "10-Project";
  const folderPath = `${basePath}/${projectName}`;
  const templateFile = tp.file.find_tfile("project-entry-template");
  if (!templateFile) {
    new Notice("致命的なエラー: project-entry-template が見つかりません。");
    return;
  }

  let targetFolder = app.vault.getAbstractFileByPath(folderPath);
  if (!targetFolder) targetFolder = await app.vault.createFolder(folderPath);

  const filePath = `${folderPath}/${projectName}.md`;
  if (app.vault.getAbstractFileByPath(filePath)) {
    new Notice(`エラー: 既に ${filePath} が存在します。`);
    return;
  }

  const createdFile = await tp.file.create_new(templateFile, projectName, true, targetFolder);
  if (!createdFile) {
    new Notice("Projectファイルの作成に失敗しました。");
    return;
  }

  const workspaceLink = app.fileManager.generateMarkdownLink(activeFile, createdFile.path);
  await app.fileManager.processFrontMatter(createdFile, (fm) => {
    fm.type = "project";
    fm.uid = fm.uid || `prj_${crypto.randomUUID()}`;
    fm.title = projectName;
    fm.aliases = Array.isArray(fm.aliases) ? fm.aliases : [];
    fm.workspace = workspaceLink;
  });

  new Notice(`Workspace「${activeFile.basename}」にProject「${projectName}」を作成しました。`);
};

function sanitizeFileName(input) {
  if (!input) return "";
  const name = input.trim().replace(/[\\/:*?"<>|#^\[\]]/g, "").replace(/\s+/g, " ");
  if (name === "." || name === "..") return "";
  return name;
}
