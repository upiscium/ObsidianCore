module.exports = async (tp) => {
  const workspaceNameRaw = await tp.system.prompt("新規Workspace名を入力してください:");
  const workspaceName = sanitizeFileName(workspaceNameRaw);

  if (!workspaceName) {
    new Notice("Workspace作成をキャンセルしました。");
    return;
  }

  const basePath = "03-Workspace";
  const folderPath = `${basePath}/${workspaceName}`;
  const templateName = "workspace-entry-template";

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

  const filePath = `${folderPath}/${workspaceName}.md`;

  if (app.vault.getAbstractFileByPath(filePath)) {
    new Notice(`エラー: 既に ${filePath} が存在します。`);
    return;
  }

  await tp.file.create_new(templateFile, workspaceName, true, targetFolder);

  new Notice(`Workspace「${workspaceName}」を生成しました。`);
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
