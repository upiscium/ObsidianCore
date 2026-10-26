"use strict";

// Trash only the canonical Entity entry. Notes, Projects, tasks and links are
// intentionally not deleted; the operator must review those separately.
module.exports = async function deleteEntity(tp, context = {}) {
  const runtimeApp = context.app ?? globalThis.app;
  const NoticeCtor = context.Notice ?? globalThis.Notice;
  const reject = (reason, message) => {
    if (typeof NoticeCtor === "function") new NoticeCtor(message);
    return { ok: false, reason };
  };

  const file = runtimeApp?.workspace?.getActiveFile?.();
  if (!file || file.extension !== "md") {
    return reject("no-active-entry", "削除: Project / Workspace Entryを開いてください。");
  }

  const type = runtimeApp?.metadataCache?.getFileCache?.(file)?.frontmatter?.type;
  if (type !== "project" && type !== "workspace") {
    return reject("unsupported-type", "削除: Project / Workspace Entry以外は削除できません。");
  }

  const base = type === "project" ? "10-Project" : "03-Workspace";
  const expectedPath = `${base}/${file.basename}/${file.basename}.md`;
  if (file.path !== expectedPath) {
    return reject("noncanonical-path", "削除: 正規のEntity Entryパスではありません。");
  }

  if (typeof runtimeApp?.vault?.trash !== "function" ||
      typeof runtimeApp.vault.getAbstractFileByPath !== "function" ||
      typeof tp?.system?.prompt !== "function") {
    return reject("missing-api", "削除: 必須のVault / Templater APIがありません。");
  }

  const folder = runtimeApp.vault.getAbstractFileByPath(`${base}/${file.basename}`);
  if (!folder || !Array.isArray(folder.children) || !folder.children.includes(file)) {
    return reject("invalid-folder", "削除: Entryの親フォルダを確認できません。");
  }

  const otherCount = folder.children.filter(child => child !== file).length;
  const extra = otherCount
    ? `
※ 同じフォルダにある他の ${otherCount} 件は残ります。`
    : "";
  const warning = type === "workspace"
    ? `
※ 紐付くProject / Task / Noteは削除・再割当てされません。`
    : `
※ 紐付くTask / Noteは削除・再割当てされません。`;
  const token = `DELETE ${file.basename}`;
  const answer = await tp.system.prompt(
    `${type === "project" ? "Project" : "Workspace"}「${file.basename}」のEntryファイルのみをObsidianのゴミ箱に移動します。${extra}${warning}
確認するには「${token}」を入力してください。`
  );
  if (answer !== token) {
    return reject("cancelled", "Entity削除をキャンセルしました。");
  }

  // A rename or a different active note during the prompt must not redirect
  // this destructive action to another Vault file.
  if (runtimeApp.workspace.getActiveFile() !== file ||
      runtimeApp.vault.getAbstractFileByPath(expectedPath) !== file ||
      runtimeApp.metadataCache?.getFileCache?.(file)?.frontmatter?.type !== type ||
      file.path !== expectedPath) {
    return reject("changed-since-confirmation", "削除: 確認中にEntityが変更されたため中止しました。");
  }

  // false = Obsidian Vault trash (.trash), not permanent/system deletion.
  await runtimeApp.vault.trash(file, false);
  if (typeof NoticeCtor === "function") {
    new NoticeCtor(`${type === "project" ? "Project" : "Workspace"}「${file.basename}」のEntryをゴミ箱へ移動しました。`);
  }
  return { ok: true, path: expectedPath };
};
