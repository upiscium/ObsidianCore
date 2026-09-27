module.exports = async function selectIdeaContext(tp) {
  const { ER, E } = await loadIdeaContextUtils();
  const activeFile = app.workspace.getActiveFile();

  if (!activeFile || activeFile.extension !== "md") {
    new Notice("Ideaを開いてから実行してください。");
    return;
  }

  const fm = app.metadataCache.getFileCache(activeFile)?.frontmatter ?? {};
  if (fm.type !== "idea" || !activeFile.path.startsWith("05-Idea/")) {
    new Notice("現在のファイルはIdeaではありません。");
    return;
  }

  const workspaces = ER.findEntityNotes(app, {
    folder: "03-Workspace",
    types: ["workspace"],
    isEligible: entity => E.isWorkspaceActiveLifecycle(entity.lifecycle)
  });
  if (workspaces.length === 0) {
    new Notice("Active Workspaceがありません。");
    return;
  }

  const workspace = await tp.system.suggester(
    workspaces.map(entity => entity.displayName),
    workspaces,
    false,
    "Workspaceを選択"
  );
  if (!workspace) return;

  const projects = ER.findEntityNotes(app, {
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

  const workspaceLink = ER.makeEntityLink(app, workspace, activeFile.path);
  const projectLink = ER.makeEntityLink(app, project, activeFile.path);
  await app.fileManager.processFrontMatter(activeFile, frontmatter => {
    frontmatter.workspace = workspaceLink;
    frontmatter.project = projectLink;
  });

  new Notice("IdeaのWorkspace / Projectを更新しました。");
  return { status: "updated", workspace: workspaceLink, project: projectLink };
};

async function loadIdeaContextUtils() {
  const genericPath = "98-System/01-script/reference_utils.js";
  const referencePath = "98-System/01-script/entity_reference_utils.js";
  const metadataPath = "98-System/01-script/entity_meta_utils.js";
  const genericFile = app.vault.getAbstractFileByPath(genericPath);
  const referenceFile = app.vault.getAbstractFileByPath(referencePath);
  const metadataFile = app.vault.getAbstractFileByPath(metadataPath);
  if (!genericFile || genericFile.extension !== "js") throw new Error(`Reference utilityが見つかりません: ${genericPath}`);
  if (!referenceFile || referenceFile.extension !== "js") throw new Error(`Entity reference utilityが見つかりません: ${referencePath}`);
  if (!metadataFile || metadataFile.extension !== "js") throw new Error(`Entity metadata utilityが見つかりません: ${metadataPath}`);
  const G = new Function(`"use strict"; return (${await app.vault.read(genericFile)});`)();
  const factory = new Function(`"use strict"; return (${await app.vault.read(referenceFile)});`)();
  const E = new Function(`"use strict"; return (${await app.vault.read(metadataFile)});`)();
  return { ER: factory(G), E };
}
