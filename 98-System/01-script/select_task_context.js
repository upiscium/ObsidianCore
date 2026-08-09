module.exports = async function selectTaskContext(tp) {
  const { R, T, E } = await loadTaskUtils();
  const activeFile = app.workspace.getActiveFile();

  if (!activeFile || activeFile.extension !== "md") {
    new Notice("Taskファイルを開いてから実行してください。");
    return;
  }

  const activeFm = app.metadataCache.getFileCache(activeFile)?.frontmatter ?? {};
  if (!T.isTaskType(activeFm.type)) {
    new Notice("現在のファイルはTaskではありません。");
    return;
  }

  const workspaces = R.findEntityNotes(app, {
    folder: "03-Workspace",
    types: ["workspace"],
    isActiveStatus: E.isActiveStatus
  });

  const workspaceNone = { kind: "none" };
  const selectedWorkspace = await tp.system.suggester(
    ["▫️ Workspaceを設定しない", ...workspaces.map(entity => entity.displayName)],
    [workspaceNone, ...workspaces],
    false,
    "Workspaceを選択"
  );

  if (!selectedWorkspace) return;
  if (selectedWorkspace.kind === "none") {
    await updateContext(R, activeFile, null, null);
    new Notice("WorkspaceとProjectを未設定にしました。");
    return;
  }

  const projects = R.findEntityNotes(app, {
    folder: "10-Project",
    types: ["project"],
    isActiveStatus: E.isActiveStatus
  }).filter(project => R.entityMatchesReference(project.workspace, selectedWorkspace));

  let selectedProject = null;
  if (projects.length > 0) {
    const projectNone = { kind: "none" };
    selectedProject = await tp.system.suggester(
      ["▫️ Projectを設定しない", ...projects.map(entity => entity.displayName)],
      [projectNone, ...projects],
      false,
      "Projectを選択"
    );
    if (!selectedProject) return;
    if (selectedProject.kind === "none") selectedProject = null;
  }

  await updateContext(R, activeFile, selectedWorkspace, selectedProject);

  if (projects.length === 0) {
    new Notice(`Workspaceを設定しました。所属ProjectがないためProjectは未設定です: ${selectedWorkspace.displayName}`);
  } else {
    new Notice("Workspace / Projectを更新しました。");
  }
};

async function updateContext(R, file, workspace, project) {
  const workspaceLink = R.makeEntityLink(app, workspace, file.path);
  const projectLink = R.makeEntityLink(app, project, file.path);
  await app.fileManager.processFrontMatter(file, frontmatter => {
    frontmatter.workspace = workspaceLink;
    frontmatter.project = projectLink;
  });
}

async function loadTaskUtils() {
  const genericPath = "98-System/01-script/reference_utils.js";
  const referencePath = "98-System/01-script/task_reference_utils.js";
  const taskMetadataPath = "98-System/01-script/task_meta_utils.js";
  const entityMetadataPath = "98-System/01-script/entity_meta_utils.js";
  const genericFile = app.vault.getAbstractFileByPath(genericPath);
  const referenceFile = app.vault.getAbstractFileByPath(referencePath);
  const taskMetadataFile = app.vault.getAbstractFileByPath(taskMetadataPath);
  const entityMetadataFile = app.vault.getAbstractFileByPath(entityMetadataPath);
  if (!genericFile || genericFile.extension !== "js") throw new Error(`Reference utilityが見つかりません: ${genericPath}`);
  if (!referenceFile || referenceFile.extension !== "js") throw new Error(`Task reference utilityが見つかりません: ${referencePath}`);
  if (!taskMetadataFile || taskMetadataFile.extension !== "js") throw new Error(`Task metadata utilityが見つかりません: ${taskMetadataPath}`);
  if (!entityMetadataFile || entityMetadataFile.extension !== "js") throw new Error(`Entity metadata utilityが見つかりません: ${entityMetadataPath}`);
  const genericSource = await app.vault.read(genericFile);
  const referenceSource = await app.vault.read(referenceFile);
  const taskMetadataSource = await app.vault.read(taskMetadataFile);
  const entityMetadataSource = await app.vault.read(entityMetadataFile);
  const G = new Function(`"use strict"; return (${genericSource});`)();
  const factory = new Function(`"use strict"; return (${referenceSource});`)();
  const T = new Function(`"use strict"; return (${taskMetadataSource});`)();
  const E = new Function(`"use strict"; return (${entityMetadataSource});`)();
  return { R: factory(G), T, E };
}
