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

  const workspaceName = activeFile.basename;

  const projectNameRaw = await tp.system.prompt("Workspaceに所属するProject名を入力してください:");
  const projectName = sanitizeFileName(projectNameRaw);

  if (!projectName) {
    new Notice("Project作成をキャンセルしました。");
    return;
  }

  const basePath = "10-Project";
  const folderPath = `${basePath}/${projectName}`;
  const templateName = "project-entry-template";

  const templateFile = tp.file.find_tfile(templateName);
  if (!templateFile) {
    new Notice(`致命的なエラー: テンプレートファイル「${templateName}」が見つかりません。`);
    return;
  }

  const baseFolder = app.vault.getAbstractFileByPath(basePath);
  if (!baseFolder) {
    new Notice(`エラー: 親フォルダ「${basePath}」が存在しません。`);
    return;
  }

  let targetFolder = app.vault.getAbstractFileByPath(folderPath);
  if (!targetFolder) {
    targetFolder = await app.vault.createFolder(folderPath);
  }

  const newFileName = `${projectName}`;
  const filePath = `${folderPath}/${newFileName}.md`;

  if (app.vault.getAbstractFileByPath(filePath)) {
    new Notice(`エラー: 既に ${filePath} が存在します。`);
    return;
  }

  const createdFile = await tp.file.create_new(templateFile, newFileName, true, targetFolder);

  if (!createdFile) {
    new Notice("致命的なエラー: Projectファイルの作成に失敗しました。");
    return;
  }

  const ok = await setWorkspaceInFrontmatter(createdFile, workspaceName);

  if (!ok) {
    new Notice("致命的なエラー: workspaceの自動設定に失敗しました。作成されたProjectを確認してください。");
    return;
  }

  new Notice(`Workspace「${workspaceName}」にProject「${projectName}」を作成しました。`);
};

async function setWorkspaceInFrontmatter(file, workspaceName) {
  let content = await app.vault.read(file);

  if (!content.startsWith("---")) {
    content = `---\ntype: project\nworkspace: ${workspaceName}\nstatus: ▫️\npriority: ▫️\n---\n` + content;
    await app.vault.modify(file, content);
    return true;
  }

  const frontmatterEnd = content.indexOf("\n---", 3);

  if (frontmatterEnd === -1) {
    return false;
  }

  const before = content.slice(0, frontmatterEnd);
  const after = content.slice(frontmatterEnd);

  let updatedBefore = before;

  if (/^type\s*:/m.test(updatedBefore)) {
    updatedBefore = updatedBefore.replace(/^type\s*:.*$/m, "type: project");
  } else {
    updatedBefore += "\ntype: project";
  }

  if (/^workspace\s*:/m.test(updatedBefore)) {
    updatedBefore = updatedBefore.replace(/^workspace\s*:.*$/m, `workspace: ${workspaceName}`);
  } else {
    updatedBefore += `\nworkspace: ${workspaceName}`;
  }

  if (!/^status\s*:/m.test(updatedBefore)) {
    updatedBefore += "\nstatus: ▫️";
  }

  if (!/^priority\s*:/m.test(updatedBefore)) {
    updatedBefore += "\npriority: ▫️";
  }

  await app.vault.modify(file, updatedBefore + after);
  return true;
}

function sanitizeFileName(input) {
  if (!input) return "";

  const name = input
    .trim()
    .replace(/[\\/:*?"<>|#^\[\]]/g, "")
    .replace(/\s+/g, " ");

  if (name === "." || name === "..") return "";

  return name;
}
