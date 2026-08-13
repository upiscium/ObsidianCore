module.exports = async function promoteToKnowledge(tp) {
  const U = await loadPromotionUtils();
  const sourceFile = app.workspace?.getActiveFile?.();

  if (!sourceFile || sourceFile.extension !== "md") {
    new Notice("Knowledge昇格: 対象Markdownノートが開かれていません。");
    return { status: "rejected", reason: "no-active-markdown" };
  }

  const frontmatter = app.metadataCache.getFileCache(sourceFile)?.frontmatter ?? {};
  if (!U.isPromotableType(frontmatter.type)) {
    new Notice(`Knowledge昇格: 対象外のtypeです: ${String(frontmatter.type ?? "")}`);
    return { status: "rejected", reason: "unsupported-type" };
  }

  const originalContent = await app.vault.read(sourceFile);
  const plan = U.planPromotion({
    sourcePath: sourceFile.path,
    frontmatter,
    content: originalContent
  });

  if (!plan.ok) {
    new Notice(`Knowledge昇格: ${plan.error}`);
    return { status: "rejected", reason: "unsafe-source", error: plan.error };
  }

  const knowledgeFolder = app.vault.getAbstractFileByPath(U.KNOWLEDGE_ROOT);
  if (!knowledgeFolder || !Array.isArray(knowledgeFolder.children)) {
    new Notice(`Knowledge昇格: ${U.KNOWLEDGE_ROOT} フォルダが見つかりません。`);
    return { status: "rejected", reason: "missing-knowledge-folder" };
  }

  if (app.vault.getAbstractFileByPath(plan.destinationPath)) {
    new Notice(`Knowledge昇格: 移動先が既に存在します: ${plan.destinationPath}`);
    return { status: "rejected", reason: "destination-collision" };
  }

  if (!tp?.system?.suggester) {
    new Notice("Knowledge昇格: confirmation UIを利用できません。");
    return { status: "rejected", reason: "confirmation-unavailable" };
  }

  const choice = await tp.system.suggester(
    [
      `昇格する: ${sourceFile.path} → ${plan.destinationPath}`,
      "キャンセル"
    ],
    ["promote", "cancel"],
    false,
    "Knowledgeに昇格"
  );

  if (choice !== "promote") {
    new Notice("Knowledge昇格をキャンセルしました。");
    return { status: "cancelled" };
  }

  const sourcePath = sourceFile.path;

  try {
    await app.vault.rename(sourceFile, plan.destinationPath);

    const destinationFile = app.vault.getAbstractFileByPath(plan.destinationPath);
    if (!destinationFile || destinationFile.extension !== "md") {
      throw new Error(`移動後のファイルを取得できません: ${plan.destinationPath}`);
    }

    await app.vault.modify(destinationFile, plan.content);
    await app.fileManager.processFrontMatter(destinationFile, fm => {
      U.applyPromotedFrontmatter(fm);
    });

    try {
      await app.workspace?.getLeaf?.(false)?.openFile?.(destinationFile);
    } catch (openError) {
      console.warn("Promoted Knowledgeを開けませんでした", openError);
    }

    new Notice(`Knowledgeへ昇格しました: ${plan.destinationPath}`);
    return {
      status: "promoted",
      sourcePath,
      destinationPath: plan.destinationPath
    };
  } catch (error) {
    const rollback = await rollbackPromotion({
      sourcePath,
      destinationPath: plan.destinationPath,
      originalContent
    });

    const suffix = rollback.ok
      ? "元のノートへロールバックしました。"
      : `ロールバックにも失敗しました: ${rollback.errors.join(" / ")}`;

    new Notice(`Knowledge昇格に失敗しました: ${error.message}. ${suffix}`);
    return {
      status: "failed",
      sourcePath,
      destinationPath: plan.destinationPath,
      rolledBack: rollback.ok,
      error: String(error?.message ?? error),
      rollbackErrors: rollback.errors
    };
  }
};

async function loadPromotionUtils() {
  const path = "98-System/01-script/knowledge_promotion_utils.js";
  const file = app.vault.getAbstractFileByPath(path);
  if (!file || file.extension !== "js") {
    throw new Error(`Knowledge promotion utilityが見つかりません: ${path}`);
  }
  const source = await app.vault.read(file);
  return new Function(`"use strict"; return (${source});`)();
}

async function rollbackPromotion({ sourcePath, destinationPath, originalContent }) {
  const errors = [];

  let destination = app.vault.getAbstractFileByPath(destinationPath);
  if (destination) {
    try {
      await app.vault.rename(destination, sourcePath);
    } catch (error) {
      errors.push(`rename: ${String(error?.message ?? error)}`);
    }
  }

  const restored = app.vault.getAbstractFileByPath(sourcePath);
  if (restored) {
    try {
      await app.vault.modify(restored, originalContent);
    } catch (error) {
      errors.push(`content: ${String(error?.message ?? error)}`);
    }
  } else {
    destination = app.vault.getAbstractFileByPath(destinationPath);
    if (destination) {
      try {
        await app.vault.modify(destination, originalContent);
      } catch (error) {
        errors.push(`destination-content: ${String(error?.message ?? error)}`);
      }
    } else {
      errors.push("file: source/destinationの両方が見つかりません");
    }
  }

  return { ok: errors.length === 0 && Boolean(app.vault.getAbstractFileByPath(sourcePath)), errors };
}
