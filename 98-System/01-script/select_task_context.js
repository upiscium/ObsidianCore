module.exports = async function selectTaskContext(tp) {
  const R = await loadReferenceUtils();
  const activeFile = app.workspace.getActiveFile();

  if (!activeFile || activeFile.extension !== "md") {
    new Notice("Taskファイルを開いてから実行してください。");
    return;
  }

  const activeFm = app.metadataCache.getFileCache(activeFile)?.frontmatter ?? {};
  if (!R.isTaskType(activeFm.type)) {
    new Notice("現在のファイルはTaskではありません。");
    return;
  }

  const workspaces = R.findEntityNotes(app, {
    folder: "03-Workspace",
    types: ["workspace"]
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
    types: ["project"]
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

async function loadReferenceUtils() {
  const path = "98-System/01-script/task_reference_utils.js";
  const file = app.vault.getAbstractFileByPath(path);
  if (!file || file.extension !== "js") throw new Error(`Task reference utilityが見つかりません: ${path}`);
  const source = await app.vault.read(file);
  return new Function(`"use strict"; return (${source});`)();
}
