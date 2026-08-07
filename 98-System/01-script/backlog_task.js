module.exports = async params => {
  const { app, quickAddApi, variables = {} } = params;

  const TASK_ROOT = "02-Task";
  const TASK_TEMPLATE_PATH =
    "98-System/03-template/01-note/task-note-template.md";
  const DAILY_ROOT = "00-DailyNote";
  const WORKSPACE_FOLDER = "03-Workspace";
  const PROJECT_FOLDER = "10-Project";

  const now = window.moment();
  const activeFile = app.workspace.getActiveFile();

  const titleResult = await readRequiredText({
    quickAddApi,
    initialValue: variables.title ?? variables.value,
    prompt: "Backlogタイトル",
    placeholder: "いつかやりたいこと"
  });

  if (titleResult.cancelled) return;
  const title = titleResult.value;

  const priorityResult = await choosePriority(quickAddApi);
  if (priorityResult.cancelled) return;

  const workspaces = findEntityNotes({
    app,
    folder: WORKSPACE_FOLDER,
    types: ["workspace"]
  });

  const workspaceResult = await chooseEntityOrNone({
    quickAddApi,
    label: "Workspace",
    entities: workspaces
  });

  if (workspaceResult.cancelled) return;
  const selectedWorkspace = workspaceResult.value;

  let selectedProject = null;

  if (selectedWorkspace) {
    const projects = findEntityNotes({
      app,
      folder: PROJECT_FOLDER,
      types: ["project"]
    });

    const projectCandidates = projects.filter(project =>
      entityMatchesReference(project.workspace, selectedWorkspace)
    );

    if (projectCandidates.length > 0) {
      const projectResult = await chooseEntityOrNone({
        quickAddApi,
        label: "Project",
        entities: projectCandidates
      });

      if (projectResult.cancelled) return;
      selectedProject = projectResult.value;
    }
  }

  const taskFolder =
    `${TASK_ROOT}/${now.format("YYYY")}/${now.format("MM")}`;
  await ensureFolder(app, taskFolder);

  const filename =
    `${now.format("YYYYMMDD-HHmmss-SSS")}-` +
    sanitizeFilename(title);
  const taskPath = await uniqueMarkdownPath(
    app,
    taskFolder,
    filename
  );

  const dailyPath = buildDailyPath(DAILY_ROOT, now);
  const sourceFile = activeFile?.extension === "md"
    ? activeFile
    : app.vault.getAbstractFileByPath(dailyPath);

  const sourceLink = sourceFile?.extension === "md"
    ? app.fileManager.generateMarkdownLink(
        sourceFile,
        taskPath,
        undefined,
        sourceFile.basename
      )
    : `[[${dailyPath.replace(/\.md$/, "")}|${now.format("YYYY-MM-DD")}]]`;

  const workspaceLink = selectedWorkspace
    ? app.fileManager.generateMarkdownLink(
        selectedWorkspace.file,
        taskPath,
        undefined,
        selectedWorkspace.displayName
      )
    : null;

  const projectLink = selectedProject
    ? app.fileManager.generateMarkdownLink(
        selectedProject.file,
        taskPath,
        undefined,
        selectedProject.displayName
      )
    : null;

  const templateFile = app.vault.getAbstractFileByPath(
    TASK_TEMPLATE_PATH
  );

  if (!templateFile || templateFile.extension !== "md") {
    throw new Error(
      `Taskテンプレートが見つかりません: ${TASK_TEMPLATE_PATH}`
    );
  }

  const template = await app.vault.read(templateFile);
  const body = stripLeadingFrontmatter(template)
    .replaceAll("__TITLE__", title);

  const content = buildTaskContent({
    title,
    source: sourceLink,
    created: now.format("YYYY-MM-DD"),
    workspace: workspaceLink,
    project: projectLink,
    priority: priorityResult.value,
    body
  });

  const taskFile = await app.vault.create(taskPath, content);
  variables.createdTaskPath = taskFile.path;

  new Notice(`Backlogへ追加しました: ${title}`);
  return taskFile.path;
};

async function readRequiredText({
  quickAddApi,
  initialValue,
  prompt,
  placeholder
}) {
  const supplied = String(initialValue ?? "").trim();
  if (supplied) return { cancelled: false, value: supplied };

  const raw = await quickAddApi.inputPrompt(prompt, placeholder);
  if (raw === null || raw === undefined) {
    return { cancelled: true, value: null };
  }

  const value = String(raw).trim();
  if (!value) {
    new Notice(`${prompt}が空です。`);
    return { cancelled: true, value: null };
  }

  return { cancelled: false, value };
}

async function choosePriority(quickAddApi) {
  const selected = await quickAddApi.suggester(
    ["🔴 高", "🟡 中", "🟢 低", "▫️ 無"],
    ["high", "medium", "low", "none"]
  );

  if (selected === null || selected === undefined) {
    return { cancelled: true, value: null };
  }

  return {
    cancelled: false,
    value: selected === "none" ? null : selected
  };
}

function findEntityNotes({ app, folder, types }) {
  return app.vault
    .getMarkdownFiles()
    .filter(file => file.path.startsWith(`${folder}/`))
    .map(file => {
      const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
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

async function chooseEntityOrNone({
  quickAddApi,
  label,
  entities
}) {
  const none = { kind: "none" };
  const selected = await quickAddApi.suggester(
    [
      `▫️ ${label}を設定しない`,
      ...entities.map(entity => entity.displayName)
    ],
    [none, ...entities]
  );

  if (selected === null || selected === undefined) {
    return { cancelled: true, value: null };
  }

  return {
    cancelled: false,
    value: selected.kind === "none" ? null : selected
  };
}

function entityMatchesReference(value, entity) {
  if (!entity) return false;

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

function buildTaskContent({
  title,
  source,
  created,
  workspace,
  project,
  priority,
  body
}) {
  return [
    "---",
    "type: task",
    `title: ${yamlString(title)}`,
    `source: ${yamlString(source)}`,
    `created: ${created}`,
    "completed:",
    "start:",
    "due:",
    `workspace: ${workspace ? yamlString(workspace) : ""}`,
    `project: ${project ? yamlString(project) : ""}`,
    "status: todo",
    `priority: ${priority ?? ""}`,
    "triaged: true",
    "backlog: true",
    "depends_on: []",
    "---",
    body.trimStart()
  ].join("\n");
}

function stripLeadingFrontmatter(content) {
  return String(content).replace(
    /^---\r?\n[\s\S]*?\r?\n---\r?\n?/,
    ""
  );
}

function buildDailyPath(root, date) {
  return (
    `${root}/${date.format("YYYY")}/${date.format("MM")}/` +
    `${date.format("YYYY-MM-DD")}.md`
  );
}

async function ensureFolder(app, folderPath) {
  const parts = String(folderPath).split("/").filter(Boolean);
  let current = "";

  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!app.vault.getAbstractFileByPath(current)) {
      await app.vault.createFolder(current);
    }
  }
}

async function uniqueMarkdownPath(app, folder, baseName) {
  let candidate = `${folder}/${baseName}.md`;
  let counter = 2;

  while (app.vault.getAbstractFileByPath(candidate)) {
    candidate = `${folder}/${baseName}-${counter}.md`;
    counter += 1;
  }

  return candidate;
}

function sanitizeFilename(value) {
  const sanitized = String(value)
    .replace(/[\\/:*?"<>|#^\[\]]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 100);

  return sanitized || "Task";
}

function yamlString(value) {
  return JSON.stringify(String(value ?? ""));
}
