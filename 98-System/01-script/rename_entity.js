module.exports = async function renameEntity(tp, context = {}) {
  const runtimeApp = context.app ?? globalThis.app;
  const NoticeCtor = context.Notice ?? globalThis.Notice;

  if (!runtimeApp?.vault || !runtimeApp?.fileManager || !runtimeApp?.metadataCache) {
    throw new Error("Entity rename requires Obsidian Vault/FileManager/MetadataCache");
  }

  const U = context.utils ?? await loadRenameUtils(runtimeApp);
  const activeFile = runtimeApp.workspace?.getActiveFile?.();

  if (!activeFile || activeFile.extension !== "md") {
    return reject(NoticeCtor, "Rename: Project / Workspace Entryが開かれていません。", "no-active-entry");
  }

  const frontmatter = runtimeApp.metadataCache.getFileCache(activeFile)?.frontmatter ?? {};
  const type = String(frontmatter.type ?? "");
  if (!["project", "workspace"].includes(type)) {
    return reject(NoticeCtor, "Rename: Project / Workspace Entry上で実行してください。", "unsupported-type");
  }

  if (typeof tp?.system?.prompt !== "function" || typeof tp?.system?.suggester !== "function") {
    return reject(NoticeCtor, "Rename: Templaterのprompt / confirmation UIを利用できません。", "confirmation-unavailable");
  }

  const rawName = await tp.system.prompt(
    `${type === "project" ? "Project" : "Workspace"}の新しい名前を入力してください:`,
    activeFile.basename
  );

  if (rawName === null || rawName === undefined) {
    if (NoticeCtor) new NoticeCtor("Renameをキャンセルしました。");
    return { status: "cancelled" };
  }

  const plan = U.planRename({
    filePath: activeFile.path,
    fileBasename: activeFile.basename,
    type,
    frontmatter,
    rawName,
    pathExists: path => Boolean(runtimeApp.vault.getAbstractFileByPath(path))
  });

  if (!plan.ok) {
    return reject(
      NoticeCtor,
      renamePlanError(plan),
      plan.reason,
      { expectedPath: plan.expectedPath, destination: plan.newEntryPath }
    );
  }

  const oldFolder = runtimeApp.vault.getAbstractFileByPath(plan.oldFolderPath);
  if (!oldFolder || !Array.isArray(oldFolder.children)) {
    return reject(
      NoticeCtor,
      `Rename: 親フォルダが見つかりません: ${plan.oldFolderPath}`,
      "missing-source-folder"
    );
  }

  const relationSnapshots = discoverRelationSnapshots(runtimeApp, U, plan);
  const childCount = oldFolder.children.length;

  const choice = await tp.system.suggester(
    [
      `Rename: ${plan.oldName} → ${plan.newName}（relation ${relationSnapshots.length}件 / folder内 ${childCount} item）`,
      "キャンセル"
    ],
    ["rename", "cancel"],
    false,
    `${plan.label}をrename`
  );

  if (choice !== "rename") {
    if (NoticeCtor) new NoticeCtor("Renameをキャンセルしました。");
    return { status: "cancelled" };
  }

  const entitySnapshot = {
    title: cloneValue(frontmatter.title),
    hadTitle: Object.prototype.hasOwnProperty.call(frontmatter, "title"),
    aliases: cloneValue(frontmatter.aliases),
    hadAliases: Object.prototype.hasOwnProperty.call(frontmatter, "aliases")
  };

  const state = {
    fileRenamed: false,
    folderRenamed: false
  };

  try {
    await runtimeApp.vault.rename(
      activeFile,
      `${plan.oldFolderPath}/${plan.newName}.md`
    );
    state.fileRenamed = true;

    const sourceFolder = runtimeApp.vault.getAbstractFileByPath(plan.oldFolderPath);
    if (!sourceFolder || !Array.isArray(sourceFolder.children)) {
      throw new Error(`file rename後にsource folderを取得できません: ${plan.oldFolderPath}`);
    }

    await runtimeApp.vault.rename(sourceFolder, plan.newFolderPath);
    state.folderRenamed = true;

    const renamedEntry = runtimeApp.vault.getAbstractFileByPath(plan.newEntryPath);
    if (!renamedEntry || renamedEntry.extension !== "md") {
      throw new Error(`rename後のEntryを取得できません: ${plan.newEntryPath}`);
    }

    await runtimeApp.fileManager.processFrontMatter(renamedEntry, fm => {
      fm.title = plan.newName;
      fm.aliases = [...plan.nextAliases];
    });

    for (const snapshot of relationSnapshots) {
      const currentPath = U.mapPathAfterFolderRename(
        snapshot.path,
        plan.oldFolderPath,
        plan.newFolderPath
      );
      const file = runtimeApp.vault.getAbstractFileByPath(currentPath);
      if (!file || file.extension !== "md") {
        throw new Error(`relation callerを取得できません: ${currentPath}`);
      }

      const link = runtimeApp.fileManager.generateMarkdownLink(
        renamedEntry,
        file.path
      );

      await runtimeApp.fileManager.processFrontMatter(file, fm => {
        fm[plan.relationField] = link;
      });
    }

    try {
      await runtimeApp.workspace?.getLeaf?.(false)?.openFile?.(renamedEntry);
    } catch (openError) {
      console.warn("renamed Entityを開けませんでした", openError);
    }

    if (NoticeCtor) {
      new NoticeCtor(
        `${plan.label}をrenameしました: ${plan.oldName} → ${plan.newName}（relation ${relationSnapshots.length}件更新）`
      );
    }

    return {
      status: "renamed",
      type: plan.type,
      uid: plan.uid,
      oldName: plan.oldName,
      newName: plan.newName,
      oldEntryPath: plan.oldEntryPath,
      newEntryPath: plan.newEntryPath,
      relationUpdates: relationSnapshots.length
    };
  } catch (error) {
    const rollback = await rollbackRename({
      runtimeApp,
      U,
      plan,
      relationSnapshots,
      entitySnapshot,
      state
    });

    const detail = rollback.ok
      ? "元のEntityへロールバックしました。"
      : `ロールバックにも失敗しました: ${rollback.errors.join(" / ")}`;

    if (NoticeCtor) {
      new NoticeCtor(
        `Renameに失敗しました: ${String(error?.message ?? error)}. ${detail}`
      );
    }

    return {
      status: "failed",
      type: plan.type,
      uid: plan.uid,
      oldEntryPath: plan.oldEntryPath,
      newEntryPath: plan.newEntryPath,
      error: String(error?.message ?? error),
      rolledBack: rollback.ok,
      rollbackErrors: rollback.errors
    };
  }
};

async function loadRenameUtils(runtimeApp) {
  const path = "98-System/01-script/entity_rename_utils.js";
  const file = runtimeApp.vault.getAbstractFileByPath(path);
  if (!file || file.extension !== "js") {
    throw new Error(`Entity rename utilityが見つかりません: ${path}`);
  }
  const source = await runtimeApp.vault.read(file);
  return new Function(`"use strict"; return (${source});`)();
}

function discoverRelationSnapshots(runtimeApp, U, plan) {
  const snapshots = [];

  for (const file of runtimeApp.vault.getMarkdownFiles()) {
    const fm = runtimeApp.metadataCache.getFileCache(file)?.frontmatter ?? {};
    const value = fm[plan.relationField];
    if (!U.matchesEntityReference(value, plan.oldEntryPath, plan.oldName)) continue;

    snapshots.push({
      path: file.path,
      hadField: Object.prototype.hasOwnProperty.call(fm, plan.relationField),
      value: cloneValue(value)
    });
  }

  return snapshots.sort((a, b) => a.path.localeCompare(b.path));
}

async function rollbackRename({
  runtimeApp,
  U,
  plan,
  relationSnapshots,
  entitySnapshot,
  state
}) {
  const errors = [];

  const currentFolderPath = state.folderRenamed
    ? plan.newFolderPath
    : plan.oldFolderPath;
  const currentEntryPath = state.fileRenamed
    ? `${currentFolderPath}/${plan.newName}.md`
    : plan.oldEntryPath;

  const currentEntry = runtimeApp.vault.getAbstractFileByPath(currentEntryPath);
  if (currentEntry?.extension === "md") {
    try {
      await runtimeApp.fileManager.processFrontMatter(currentEntry, fm => {
        restoreProperty(fm, "title", entitySnapshot.hadTitle, entitySnapshot.title);
        restoreProperty(fm, "aliases", entitySnapshot.hadAliases, entitySnapshot.aliases);
      });
    } catch (error) {
      errors.push(`entity-frontmatter: ${String(error?.message ?? error)}`);
    }
  }

  for (const snapshot of relationSnapshots) {
    const currentPath = state.folderRenamed
      ? U.mapPathAfterFolderRename(snapshot.path, plan.oldFolderPath, plan.newFolderPath)
      : snapshot.path;
    const file = runtimeApp.vault.getAbstractFileByPath(currentPath);
    if (!file || file.extension !== "md") {
      errors.push(`relation-missing: ${currentPath}`);
      continue;
    }

    try {
      await runtimeApp.fileManager.processFrontMatter(file, fm => {
        restoreProperty(
          fm,
          plan.relationField,
          snapshot.hadField,
          snapshot.value
        );
      });
    } catch (error) {
      errors.push(`relation: ${currentPath}: ${String(error?.message ?? error)}`);
    }
  }

  if (state.fileRenamed) {
    const file = runtimeApp.vault.getAbstractFileByPath(currentEntryPath);
    if (file) {
      try {
        await runtimeApp.vault.rename(
          file,
          `${currentFolderPath}/${plan.oldName}.md`
        );
      } catch (error) {
        errors.push(`entry-rename: ${String(error?.message ?? error)}`);
      }
    } else {
      errors.push(`entry-missing: ${currentEntryPath}`);
    }
  }

  if (state.folderRenamed) {
    const folder = runtimeApp.vault.getAbstractFileByPath(plan.newFolderPath);
    if (folder) {
      try {
        await runtimeApp.vault.rename(folder, plan.oldFolderPath);
      } catch (error) {
        errors.push(`folder-rename: ${String(error?.message ?? error)}`);
      }
    } else {
      errors.push(`folder-missing: ${plan.newFolderPath}`);
    }
  }

  return {
    ok: errors.length === 0 &&
      Boolean(runtimeApp.vault.getAbstractFileByPath(plan.oldEntryPath)),
    errors
  };
}

function restoreProperty(target, key, hadValue, value) {
  if (hadValue) target[key] = cloneValue(value);
  else delete target[key];
}

function cloneValue(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {}
  }
  if (typeof value !== "object") return value;
  return JSON.parse(JSON.stringify(value));
}

function reject(NoticeCtor, message, reason, extra = {}) {
  if (NoticeCtor) new NoticeCtor(message);
  return { status: "rejected", reason, ...extra };
}

function renamePlanError(plan) {
  if (plan.reason === "noncanonical-entry") {
    return `Rename: canonical Entryではありません。期待: ${plan.expectedPath}`;
  }
  if (plan.reason === "missing-uid") {
    return "Rename: uidがないEntityはrenameできません。";
  }
  if (plan.reason === "invalid-name") {
    return "Rename: 新しい名前が不正です。";
  }
  if (plan.reason === "unchanged-name") {
    return "Rename: 名前が変更されていません。";
  }
  if (plan.reason === "case-only-rename") {
    return "Rename: 大文字/小文字だけの変更は同期先互換性のため未対応です。";
  }
  if (plan.reason === "destination-collision") {
    return `Rename: 移動先が既に存在します: ${plan.newFolderPath}`;
  }
  return `Renameを拒否しました: ${plan.reason}`;
}

module.exports.discoverRelationSnapshots = discoverRelationSnapshots;
module.exports.rollbackRename = rollbackRename;
