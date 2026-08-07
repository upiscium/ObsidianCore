module.exports = async function selectTaskContext(tp) {
  const WORKSPACE_FOLDER = "03-Workspace";
  const PROJECT_FOLDER = "10-Project";

  const activeFile = app.workspace.getActiveFile();

  if (!activeFile || activeFile.extension !== "md") {
    new Notice("Taskファイルを開いてから実行してください。");
    return;
  }

  const activeFm =
    app.metadataCache.getFileCache(activeFile)?.frontmatter ?? {};

  if (!isTaskType(activeFm.type)) {
    new Notice("現在のファイルはTaskではありません。");
    return;
  }

  const workspaces = findEntityNotes({
    folder: WORKSPACE_FOLDER,
<<<<<<< HEAD
    types: ["workspace", "workspace-note"]
=======
    types: ["workspace"]
>>>>>>> 2d7fdc96c305b880f1de1e4888c749cfcb3c3f4d
  });

  const workspaceNone = { kind: "none" };
  const selectedWorkspace = await tp.system.suggester(
    [
      "▫️ Workspaceを設定しない",
      ...workspaces.map(entity => entity.displayName)
    ],
    [workspaceNone, ...workspaces],
    false,
    "Workspaceを選択"
  );

  if (!selectedWorkspace) return;

  if (selectedWorkspace.kind === "none") {
    await updateContext(activeFile, null, null);
    new Notice("WorkspaceとProjectを未設定にしました。");
    return;
  }

  const projects = findEntityNotes({
    folder: PROJECT_FOLDER,
<<<<<<< HEAD
    types: ["project", "project-note"]
=======
    types: ["project"]
>>>>>>> 2d7fdc96c305b880f1de1e4888c749cfcb3c3f4d
  }).filter(project =>
    entityMatchesReference(
      project.workspace,
      selectedWorkspace
    )
  );

  let selectedProject = null;

  if (projects.length > 0) {
    const projectNone = { kind: "none" };

    selectedProject = await tp.system.suggester(
      [
        "▫️ Projectを設定しない",
        ...projects.map(entity => entity.displayName)
      ],
      [projectNone, ...projects],
      false,
      "Projectを選択"
    );

    if (!selectedProject) return;

    if (selectedProject.kind === "none") {
      selectedProject = null;
    }
  }

  await updateContext(
    activeFile,
    selectedWorkspace,
    selectedProject
  );

  if (projects.length === 0) {
    new Notice(
      `Workspaceを設定しました。所属ProjectがないためProjectは未設定です: ${selectedWorkspace.displayName}`
    );
  } else {
    new Notice("Workspace / Projectを更新しました。");
  }
};

function isTaskType(value) {
  return ["task", "task-pack"].includes(String(value ?? ""));
}

function findEntityNotes({ folder, types }) {
  return app.vault
    .getMarkdownFiles()
    .filter(file => file.path.startsWith(`${folder}/`))
    .map(file => {
      const fm =
        app.metadataCache.getFileCache(file)?.frontmatter ?? {};

      return {
        file,
        type: String(fm.type ?? "").trim(),
        status: String(fm.status ?? "").trim(),
        displayName: String(
          fm.title ?? fm.project ?? fm.workspace ?? file.basename
        ).trim(),
        workspace: fm.workspace ?? null
      };
    })
    .filter(entity =>
      types.includes(entity.type) &&
      !["done", "archived", "deleted", "cancelled"].includes(
        entity.status
      )
    )
    .sort((a, b) =>
      a.displayName.localeCompare(b.displayName, "ja")
    );
}

function entityMatchesReference(value, entity) {
  const targets = new Set([
    entity.displayName,
    entity.file.basename,
    entity.file.path,
    entity.file.path.replace(/\.md$/, "")
  ]);

  return normalizeReferences(value).some(reference =>
    targets.has(reference) ||
    targets.has(reference.split("/").pop())
  );
}

function normalizeReferences(value) {
  const values = Array.isArray(value)
    ? value
    : value
      ? [value]
      : [];

  return values.map(item => {
    if (item && typeof item === "object" && item.path) {
      return String(item.path).replace(/\.md$/, "");
    }

    return String(item)
      .trim()
      .replace(/^["']|["']$/g, "")
      .replace(/^\[\[/, "")
      .replace(/\]\]$/, "")
      .split("|")[0]
      .replace(/\.md$/, "");
  });
}

async function updateContext(file, workspace, project) {
  const workspaceLink = workspace
    ? app.fileManager.generateMarkdownLink(
        workspace.file,
        file.path,
        undefined,
        workspace.displayName
      )
    : null;

  const projectLink = project
    ? app.fileManager.generateMarkdownLink(
        project.file,
        file.path,
        undefined,
        project.displayName
      )
    : null;

  await app.fileManager.processFrontMatter(
    file,
    frontmatter => {
      frontmatter.workspace = workspaceLink;
      frontmatter.project = projectLink;
    }
  );
}
