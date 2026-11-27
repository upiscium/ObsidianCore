module.exports = async function discardProposal(tp) {
  const U = await loadExpression("98-System/01-script/proposal_idea_utils.js");
  const file = app.workspace?.getActiveFile?.();

  if (!file || file.extension !== "md") {
    new Notice("破棄: 対象Markdownノートが開かれていません。");
    return { status: "rejected", reason: "no-active-markdown" };
  }

  const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
  if (!U.isProposalNote(file.path, frontmatter)) {
    new Notice("破棄: 04-AI/Proposalsの提案ノートを開いてから実行してください。");
    return { status: "rejected", reason: "not-a-proposal" };
  }

  if (!tp?.system?.suggester) {
    new Notice("破棄: 確認UIを利用できません。");
    return { status: "rejected", reason: "confirmation-unavailable" };
  }

  const choice = await tp.system.suggester(
    [`破棄する: ${file.path}`, "キャンセル"],
    ["discard", "cancel"],
    false,
    "提案を破棄"
  );
  if (choice !== "discard") {
    new Notice("破棄をキャンセルしました。");
    return { status: "cancelled" };
  }

  const path = file.path;
  try {
    // Respect the user's deletion setting (system trash / .trash / permanent).
    if (typeof app.fileManager?.trashFile === "function") {
      await app.fileManager.trashFile(file);
    } else {
      await app.vault.trash(file, true);
    }
  } catch (error) {
    new Notice(`破棄に失敗しました: ${String(error?.message ?? error)}`);
    return { status: "failed", path, error: String(error?.message ?? error) };
  }

  new Notice(`提案を破棄しました: ${path}`);
  return { status: "discarded", path };

  async function loadExpression(utilityPath) {
    const utility = app.vault.getAbstractFileByPath(utilityPath);
    if (!utility || utility.extension !== "js") throw new Error(`Utilityが見つかりません: ${utilityPath}`);
    const source = await app.vault.read(utility);
    return new Function(`"use strict"; return (${source});`)();
  }
};
