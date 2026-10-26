"use strict";

// Trash the canonical Project / Workspace folder and all its descendants.
// Links and entities outside the folder are not deleted or rewritten.
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
  const folderPath = base + "/" + file.basename;
  const entryPath = folderPath + "/" + file.basename + ".md";
  if (file.path !== entryPath) {
    return reject("noncanonical-path", "削除: 正規のEntity Entryパスではありません。");
  }

  if (typeof runtimeApp?.vault?.trash !== "function" ||
      typeof runtimeApp.vault.getAbstractFileByPath !== "function" ||
      typeof tp?.system?.prompt !== "function") {
    return reject("missing-api", "削除: 必須のVault / Templater APIがありません。");
  }

  const vault = runtimeApp.vault;
  const parent = vault.getAbstractFileByPath(base);
  const folder = vault.getAbstractFileByPath(folderPath);
  if (!isCanonicalFolder(parent, folder, file, folderPath)) {
    return reject("invalid-folder", "削除: Entityフォルダの構造を確認できません。");
  }

  const before = subtreeSnapshot(folder, folderPath);
  if (!before) {
    return reject("invalid-subtree", "削除: 配下のファイル構成を確認できません。");
  }

  const files = before.filter(row => !row.isFolder).length;
  const subfolders = before.filter(row => row.isFolder).length - 1;
  const warning = type === "workspace"
    ? "別フォルダにある関連Project・Task・Noteは削除されず、リンクも変更されません。"
    : "別フォルダにある関連Task・Noteは削除されず、リンクも変更されません。";
  const token = "DELETE " + file.basename;
  const message =
    (type === "project" ? "Project" : "Workspace") + "「" + file.basename + "」のフォルダ全体（" +
    folderPath + "）をObsidianのゴミ箱に移動します。\n" +
    "このフォルダに含まれる全" + files + "ファイル・" + subfolders +
    "サブフォルダ（Entry・Noteを含む）が対象です。\n" +
    warning + "\n確認するには「" + token + "」を入力してください。";
  const answer = await tp.system.prompt(message);
  if (answer !== token) {
    return reject("cancelled", "Entity削除をキャンセルしました。");
  }

  // Do not trash newly added, removed or renamed contents, or a different
  // folder, after the confirmation. Check the recursive descendant set.
  if (runtimeApp.workspace?.getActiveFile?.() !== file ||
      runtimeApp.metadataCache?.getFileCache?.(file)?.frontmatter?.type !== type ||
      file.path !== entryPath ||
      vault.getAbstractFileByPath(entryPath) !== file ||
      vault.getAbstractFileByPath(base) !== parent ||
      vault.getAbstractFileByPath(folderPath) !== folder ||
      !isCanonicalFolder(parent, folder, file, folderPath) ||
      !sameSnapshot(before, subtreeSnapshot(folder, folderPath))) {
    return reject("changed-since-confirmation", "削除: 確認中にフォルダ内容が変更されたため中止しました。");
  }

  try {
    // false = local Obsidian Vault trash (.trash), not permanent deletion.
    await vault.trash(folder, false);
  } catch (_) {
    return reject("trash-failed", "削除: ゴミ箱への移動結果を確認できません。Vaultとゴミ箱を確認してください。");
  }

  if (typeof NoticeCtor === "function") {
    new NoticeCtor((type === "project" ? "Project" : "Workspace") +
      "「" + file.basename + "」のフォルダ全体をゴミ箱へ移動しました。");
  }
  return { ok: true, path: folderPath, files, subfolders };
};

function isCanonicalFolder(parent, folder, file, folderPath) {
  return Boolean(
    parent && Array.isArray(parent.children) &&
    folder && folder.path === folderPath && Array.isArray(folder.children) &&
    folder.parent === parent && parent.children.includes(folder) &&
    file.parent === folder && folder.children.includes(file)
  );
}

function subtreeSnapshot(folder, folderPath) {
  const rows = [];
  const visited = new Set();
  const pending = [folder];
  while (pending.length) {
    if (rows.length >= 10000) return null;
    const item = pending.pop();
    if (!item || visited.has(item) || typeof item.path !== "string" ||
        (item.path !== folderPath && !item.path.startsWith(folderPath + "/"))) {
      return null;
    }
    visited.add(item);
    const isFolder = Array.isArray(item.children);
    rows.push({
      item, path: item.path, isFolder,
      mtime: item.stat?.mtime ?? null,
      size: item.stat?.size ?? null
    });
    if (isFolder) {
      for (const child of item.children) {
        if (child?.parent !== item) return null;
        pending.push(child);
      }
    }
  }
  rows.sort((a, b) => a.path.localeCompare(b.path));
  for (let i = 1; i < rows.length; i++) {
    if (rows[i - 1].path === rows[i].path) return null;
  }
  return rows;
}

function sameSnapshot(before, after) {
  if (!after || before.length !== after.length) return false;
  return before.every((row, i) =>
    row.item === after[i].item &&
    row.path === after[i].path &&
    row.isFolder === after[i].isFolder &&
    row.mtime === after[i].mtime &&
    row.size === after[i].size
  );
}
