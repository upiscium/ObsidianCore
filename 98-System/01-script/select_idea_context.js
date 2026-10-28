module.exports = async function selectIdeaContext(tp) {
  const safeNotice = tp?.obsidian?.Notice ?? globalThis.Notice;
  const notify = message => { if (typeof safeNotice === "function") new safeNotice(message); };
  try {
    const appRef = tp?.app ?? globalThis.app;
    if (!tp || !appRef?.workspace || !appRef?.metadataCache || !appRef?.fileManager) {
      notify("IdeaのContextを更新できません。ObsidianとTemplaterを確認してください。");
      return;
    }
    const { ER, E } = await loadIdeaContextUtils(appRef);
    const activeFile = appRef.workspace.getActiveFile();

    if (!activeFile || activeFile.extension !== "md") {
      notify("Ideaを開いてから実行してください。");
      return;
    }

    const fm = appRef.metadataCache.getFileCache(activeFile)?.frontmatter ?? {};
    if (fm.type !== "idea" || !activeFile.path.startsWith("05-Idea/")) {
      notify("現在のファイルはIdeaではありません。");
      return;
    }

    if (isAdoptionLocked(fm)) {
      notify("採用中または採用履歴のあるIdeaのWorkspace / Projectは変更できません。先に採用取消または履歴を修復してください。");
      return;
    }

    const workspaces = ER.findEntityNotes(appRef, {
      folder: "03-Workspace",
      types: ["workspace"],
      isEligible: entity => E.isWorkspaceActiveLifecycle(entity.lifecycle)
    });
    if (workspaces.length === 0) {
      notify("Active Workspaceがありません。");
      return;
    }

    const workspace = await tp.system.suggester(
      workspaces.map(entity => entity.displayName),
      workspaces,
      false,
      "Workspaceを選択"
    );
    if (!workspace) return;

    const projects = ER.findEntityNotes(appRef, {
      folder: "10-Project",
      types: ["project"],
      isEligible: entity => E.isProjectActiveStatus(entity.status)
    }).filter(project => ER.entityMatchesReference(project.workspace, workspace));

    let project = null;
    if (projects.length > 0) {
      const none = { kind: "none" };
      const selected = await tp.system.suggester(
        ["▫️ Projectを設定しない", ...projects.map(entity => entity.displayName)],
        [none, ...projects],
        false,
        "Projectを選択"
      );
      if (!selected) return;
      if (selected.kind !== "none") project = selected;
    }

    // Re-read frontmatter immediately before committing: adoption may have changed
    // while either chooser was open.
    if (isAdoptionLocked(appRef.metadataCache.getFileCache(activeFile)?.frontmatter ?? {})) {
      notify("選択中にIdeaが採用または履歴化されたため、Contextを変更しませんでした。先に採用取消または履歴を修復してください。");
      return;
    }

    const workspaceLink = ER.makeEntityLink(appRef, workspace, activeFile.path);
    const projectLink = ER.makeEntityLink(appRef, project, activeFile.path);
    await appRef.fileManager.processFrontMatter(activeFile, frontmatter => {
      if (isAdoptionLocked(frontmatter)) throw new Error("locked");
      frontmatter.workspace = workspaceLink;
      frontmatter.project = projectLink;
    });

    notify("IdeaのWorkspace / Projectを更新しました。");
    return { status: "updated", workspace: workspaceLink, project: projectLink };
  } catch {
    notify("IdeaのContextを更新できませんでした。設定と対象Ideaを確認してください。");
    return;
  }
};

function isAdoptionLocked(frontmatter) {
  // Match idea_meta_utils.hasAdoptionValue: malformed arrays/whitespace are
  // history-bearing, not an invitation to silently move the Workspace (#235).
  const nonempty = value => value !== null && value !== undefined && value !== "";
  return frontmatter.status === "adopted" || nonempty(frontmatter.adopted_project) || nonempty(frontmatter.adopted_at);
}

async function loadIdeaContextUtils(appRef) {
  const genericPath = "98-System/01-script/reference_utils.js";
  const referencePath = "98-System/01-script/entity_reference_utils.js";
  const metadataPath = "98-System/01-script/entity_meta_utils.js";
  const genericFile = appRef.vault.getAbstractFileByPath(genericPath);
  const referenceFile = appRef.vault.getAbstractFileByPath(referencePath);
  const metadataFile = appRef.vault.getAbstractFileByPath(metadataPath);
  if (!genericFile || genericFile.extension !== "js") throw new Error(`Reference utilityが見つかりません: ${genericPath}`);
  if (!referenceFile || referenceFile.extension !== "js") throw new Error(`Entity reference utilityが見つかりません: ${referencePath}`);
  if (!metadataFile || metadataFile.extension !== "js") throw new Error(`Entity metadata utilityが見つかりません: ${metadataPath}`);
  const G = new Function(`"use strict"; return (${await appRef.vault.read(genericFile)});`)();
  const factory = new Function(`"use strict"; return (${await appRef.vault.read(referenceFile)});`)();
  const E = new Function(`"use strict"; return (${await appRef.vault.read(metadataFile)});`)();
  return { ER: factory(G), E };
}
