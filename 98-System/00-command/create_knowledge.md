<%*
// 1. プロジェクト名の入力
const knowledgeName = await tp.system.prompt("新規ノート名を入力してください:");

if (!knowledgeName) {
    new Notice("ノート作成をキャンセルしました。");
    return;
}

const basePath = "11-Knowledge";
const templateName = "knowledge-note-template"; 

// 2. 依存関係の検証
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

// 4. ファイル名の定義と競合確認
const newFileName = `${knowledgeName}`;
const filePath = `${basePath}/${newFileName}.md`;

if (app.vault.getAbstractFileByPath(filePath)) {
    new Notice(`エラー: 既に ${filePath} が存在します。`);
    return;
}

// 5. 外部テンプレートを利用してノートを生成し、開く
await tp.file.create_new(templateFile, newFileName, true, basePath);
new Notice(`「${knowledgeName}」ノートを生成しました。`);
%>