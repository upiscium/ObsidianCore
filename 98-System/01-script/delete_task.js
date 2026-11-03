"use strict";

// Delete only one Task note by moving it to the local Obsidian trash.
// No external references, recurring definitions, or sibling files are changed.
module.exports = async function deleteTask(tp, context = {}) {
  const runtimeApp = context.app ?? tp?.app ?? globalThis.app;
  const NoticeCtor = context.Notice ?? tp?.obsidian?.Notice ?? globalThis.Notice;
  const reject = (reason, message) => {
    if (typeof NoticeCtor === "function") new NoticeCtor(message);
    return { ok: false, reason };
  };

  const fromActive = context.file == null;
  const file = context.file ?? runtimeApp?.workspace?.getActiveFile?.();
  if (!file || file.extension !== "md" || !isTaskPath(file.path) ||
      file.basename !== file.path.split("/").at(-1).slice(0, -3)) {
    return reject("invalid-target", "削除: 02-Task内のTaskノートを指定してください。");
  }

  const vault = runtimeApp?.vault;
  const metadataCache = runtimeApp?.metadataCache;
  if (typeof vault?.trash !== "function" ||
      typeof vault?.getAbstractFileByPath !== "function" ||
      typeof metadataCache?.getFileCache !== "function" ||
      (typeof context.confirm !== "function" && typeof tp?.system?.prompt !== "function")) {
    return reject("missing-api", "削除: 必要なObsidian / Templater APIがありません。");
  }

  if (vault.getAbstractFileByPath(file.path) !== file ||
      (fromActive && runtimeApp?.workspace?.getActiveFile?.() !== file)) {
    return reject("stale-target", "削除: 対象Taskを確認できません。");
  }

  const initialMeta = metadataCache.getFileCache(file)?.frontmatter;
  if (initialMeta?.type !== "task") {
    return reject("unsupported-type", "削除: Task以外のノートは削除できません。");
  }
  if (context.completedOnly === true && initialMeta.status !== "done") {
    return reject("not-completed", "削除: 完了済みTaskのみ削除できます。");
  }

  const path = file.path;
  const snapshot = {
    mtime: file.stat?.mtime ?? null,
    size: file.stat?.size ?? null,
    metadata: JSON.stringify(initialMeta)
  };
  const token = "DELETE";
  let answer;
  try {
    answer = typeof context.confirm === "function"
      ? await context.confirm({ file, path, title: String(initialMeta.title || file.basename), token })
      : await tp.system.prompt("Type " + token);
  } catch (error) {
    return reject("confirmation-failed", "削除: 確認ダイアログを開けませんでした。");
  }
  if (answer !== token) return reject("cancelled", "Task削除をキャンセルしました。");

  // The user may have edited/replaced the Task while the prompt was open.
  const currentMeta = metadataCache.getFileCache(file)?.frontmatter;
  if (file.path !== path || vault.getAbstractFileByPath(path) !== file ||
      (fromActive && runtimeApp?.workspace?.getActiveFile?.() !== file) ||
      currentMeta?.type !== "task" ||
      (context.completedOnly === true && currentMeta.status !== "done") ||
      (file.stat?.mtime ?? null) !== snapshot.mtime ||
      (file.stat?.size ?? null) !== snapshot.size ||
      JSON.stringify(currentMeta) !== snapshot.metadata) {
    return reject("changed-since-confirmation", "削除: 確認中にTaskが変更されたため中止しました。");
  }

  try {
    // false = local .trash, not system trash or permanent deletion.
    await vault.trash(file, false);
  } catch (error) {
    return reject("trash-failed", "削除: ゴミ箱への移動結果が不明です。Vaultを確認してください。");
  }
  if (typeof NoticeCtor === "function") {
    new NoticeCtor("Task「" + String(initialMeta.title || file.basename) + "」をゴミ箱へ移動しました。");
  }
  return { ok: true, path };
};

function isTaskPath(path) {
  if (typeof path !== "string" || !path.startsWith("02-Task/") || !path.endsWith(".md")) return false;
  const segments = path.split("/");
  return segments.length >= 2 && segments.every(segment =>
    segment.length > 0 && segment !== "." && segment !== ".."
  );
}
