module.exports = async params => {
  const { app, quickAddApi, variables = {} } = params;

  const TASK_ROOT = "02-Task";
  const TASK_TEMPLATE_PATH =
    "98-System/03-template/01-note/task-note-template.md";

  const DAILY_ROOT = "00-DailyNote";
  const DAILY_TEMPLATE_PATH =
    "98-System/03-template/01-note/daily-note-template.md";
  const DAILY_TASK_HEADING = "# Tasks";

  const WORKSPACE_FOLDER = "03-Workspace";
  const PROJECT_FOLDER = "10-Project";

  const now = window.moment();
  const activeFile = app.workspace.getActiveFile();

  const titleResult = await readRequiredText({
    quickAddApi,
    initialValue: variables.title,
    prompt: "Taskタイトル",
    placeholder: "例: レポートを提出する"
  });

  if (titleResult.cancelled) return;
  const title = titleResult.value;

  const priorityResult = await choosePriority(quickAddApi);
  if (priorityResult.cancelled) return;

  const startResult = await chooseOptionalDate(
    quickAddApi,
    "取り掛かる予定日"
  );

  if (startResult.cancelled) return;

  const dueResult = await chooseRequiredDate({
    quickAddApi,
    initialValue: variables.due,
    label: "期限"
  });

  if (dueResult.cancelled) return;

  if (
    startResult.value &&
    window.moment(startResult.value).isAfter(
      window.moment(dueResult.value),
      "day"
    )
  ) {
    new Notice("StartはDue以前の日付にしてください。");
    return;
  }

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
      entityMatchesReference(
        project.workspace,
        selectedWorkspace
      )
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

  const dailyPath = buildDailyPath(DAILY_ROOT, now);
  const taskFolder =
    `${TASK_ROOT}/${now.format("YYYY")}/${now.format("MM")}`;

  await ensureFolder(app, taskFolder);
  await ensureDailyNote({
    app,
    dailyPath,
    templatePath: DAILY_TEMPLATE_PATH,
    date: now
  });

  const filename =
    `${now.format("YYYYMMDD-HHmmss-SSS")}-` +
    sanitizeFilename(title);

  const taskPath = await uniqueMarkdownPath(
    app,
    taskFolder,
    filename
  );

  const dailyFile = app.vault.getAbstractFileByPath(dailyPath);
  const sourceFile =
    activeFile?.extension === "md"
      ? activeFile
      : dailyFile;

  const sourceLink = sourceFile
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
    start: startResult.value,
    due: dueResult.value,
    workspace: workspaceLink,
    project: projectLink,
    priority: priorityResult.value,
    triaged: true,
    body
  });

  const taskFile = await app.vault.create(taskPath, content);

  try {
    await appendTaskLinkToDaily({
      app,
      dailyPath,
      taskFile,
      taskTitle: title,
      heading: DAILY_TASK_HEADING
    });
  } catch (error) {
    console.error("Daily Noteへのリンク追加に失敗:", error);
    new Notice(
      "Taskは作成しましたが、Daily Noteへのリンク追加に失敗しました。"
    );
    return taskFile.path;
  }

  variables.createdTaskPath = taskFile.path;
  new Notice(`Taskを作成しました: ${title}`);
  return taskFile.path;
};

async function readRequiredText({
  quickAddApi,
  initialValue,
  prompt,
  placeholder
}) {
  const supplied = String(initialValue ?? "").trim();

  if (supplied) {
    return { cancelled: false, value: supplied };
  }

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

async function chooseOptionalDate(quickAddApi, label) {
  const options = [
    "設定しない",
    "今日",
    "明日",
    "明後日",
    "3日後",
    "1週間後",
    "1ヶ月後",
    "自由入力"
  ];

  const selected = await quickAddApi.suggester(
    options.map(value => `【${label}】${value}`),
    options
  );

  if (selected === null || selected === undefined) {
    return { cancelled: true, value: null };
  }

  if (selected === "設定しない") {
    return { cancelled: false, value: null };
  }

  const date = window.moment();

  switch (selected) {
    case "今日":
      return { cancelled: false, value: date.format("YYYY-MM-DD") };
    case "明日":
      return {
        cancelled: false,
        value: date.add(1, "day").format("YYYY-MM-DD")
      };
    case "明後日":
      return {
        cancelled: false,
        value: date.add(2, "days").format("YYYY-MM-DD")
      };
    case "3日後":
      return {
        cancelled: false,
        value: date.add(3, "days").format("YYYY-MM-DD")
      };
    case "1週間後":
      return {
        cancelled: false,
        value: date.add(1, "week").format("YYYY-MM-DD")
      };
    case "1ヶ月後":
      return {
        cancelled: false,
        value: date.add(1, "month").format("YYYY-MM-DD")
      };
    case "自由入力":
      return readOptionalDateInput(quickAddApi, label);
    default:
      return { cancelled: true, value: null };
  }
}

async function readOptionalDateInput(quickAddApi, label) {
  const raw = await quickAddApi.inputPrompt(
    `${label}を入力`,
    "YYYY-MM-DD"
  );

  if (raw === null || raw === undefined) {
    return { cancelled: true, value: null };
  }

  const value = String(raw).trim();

  if (!value) {
    return { cancelled: false, value: null };
  }

  const parsed = window.moment(value, "YYYY-MM-DD", true);

  if (!parsed.isValid()) {
    new Notice(`${label}はYYYY-MM-DD形式で入力してください。`);
    return { cancelled: true, value: null };
  }

  return { cancelled: false, value: parsed.format("YYYY-MM-DD") };
}

async function chooseRequiredDate({
  quickAddApi,
  initialValue,
  label
}) {
  const supplied = String(initialValue ?? "").trim();

  if (supplied) {
    return parseRequiredDate(supplied, label, "指定");
  }

  const options = [
    "今日",
    "明日",
    "明後日",
    "3日後",
    "1週間後",
    "1ヶ月後",
    "自由入力"
  ];

  const selected = await quickAddApi.suggester(
    options.map(value => `【${label}】${value}`),
    options
  );

  if (selected === null || selected === undefined) {
    return { cancelled: true, value: null };
  }

  const date = window.moment();

  switch (selected) {
    case "今日":
      return { cancelled: false, value: date.format("YYYY-MM-DD") };
    case "明日":
      return {
        cancelled: false,
        value: date.add(1, "day").format("YYYY-MM-DD")
      };
    case "明後日":
      return {
        cancelled: false,
        value: date.add(2, "days").format("YYYY-MM-DD")
      };
    case "3日後":
      return {
        cancelled: false,
        value: date.add(3, "days").format("YYYY-MM-DD")
      };
    case "1週間後":
      return {
        cancelled: false,
        value: date.add(1, "week").format("YYYY-MM-DD")
      };
    case "1ヶ月後":
      return {
        cancelled: false,
        value: date.add(1, "month").format("YYYY-MM-DD")
      };
    case "自由入力": {
      const raw = await quickAddApi.inputPrompt(
        `${label}を入力`,
        "YYYY-MM-DD"
      );

      if (raw === null || raw === undefined) {
        return { cancelled: true, value: null };
      }

      return parseRequiredDate(String(raw).trim(), label, "入力");
    }
    default:
      return { cancelled: true, value: null };
  }
}

function parseRequiredDate(value, label, action) {
  const parsed = window.moment(value, "YYYY-MM-DD", true);

  if (!parsed.isValid()) {
    new Notice(`${label}はYYYY-MM-DD形式で${action}してください。`);
    return { cancelled: true, value: null };
  }

  return {
    cancelled: false,
    value: parsed.format("YYYY-MM-DD")
  };
}

function findEntityNotes({ app, folder, types }) {
  return app.vault
    .getMarkdownFiles()
    .filter(file => file.path.startsWith(`${folder}/`))
    .map(file => {
      const cache = app.metadataCache.getFileCache(file);
      const fm = cache?.frontmatter ?? {};

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
  start,
  due,
  workspace,
  project,
  priority,
  triaged,
  body
}) {
  return [
    "---",
    "type: task",
    `title: ${yamlString(title)}`,
    `source: ${yamlString(source)}`,
    `created: ${created}`,
    "completed:",
    `start: ${start ?? ""}`,
    `due: ${due}`,
    `workspace: ${workspace ? yamlString(workspace) : ""}`,
    `project: ${project ? yamlString(project) : ""}`,
    "status: todo",
    `priority: ${priority ?? ""}`,
    `triaged: ${triaged ? "true" : "false"}`,
    "backlog: false",
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

async function ensureDailyNote({
  app,
  dailyPath,
  templatePath,
  date
}) {
  const existing = app.vault.getAbstractFileByPath(dailyPath);

  if (existing) {
    if (existing.extension !== "md") {
      throw new Error(
        `Daily NoteのパスがMarkdownファイルではありません: ${dailyPath}`
      );
    }

    return existing;
  }

  const folder = dailyPath.split("/").slice(0, -1).join("/");
  await ensureFolder(app, folder);

  const templateFile = app.vault.getAbstractFileByPath(templatePath);
  let content;

  if (templateFile?.extension === "md") {
    const template = await app.vault.read(templateFile);
    content = renderKnownDailyTemplate(template, date);
  } else {
    content = [
      "---",
      "type: daily-review",
      "---",
      "# Note",
      "- ",
      "# Tasks",
      "",
      "# Related",
      ""
    ].join("\n");
  }

  return app.vault.create(dailyPath, content);
}

function renderKnownDailyTemplate(template, date) {
  const year = date.format("YYYY");
  const month = date.format("YYYY-MM");
  const day = date.format("YYYY-MM-DD");

  return String(template)
    .replace(
      /<%\s*moment\(tp\.file\.title,\s*['"]YYYY-MM-DD['"]\)\.format\(['"]YYYY['"]\)\s*%>/g,
      year
    )
    .replace(
      /<%\s*moment\(tp\.file\.title,\s*['"]YYYY-MM-DD['"]\)\.format\(['"]YYYY-MM['"]\)\s*%>/g,
      month
    )
    .replace(/<%\s*tp\.file\.title\s*%>/g, day);
}

async function appendTaskLinkToDaily({
  app,
  dailyPath,
  taskFile,
  taskTitle,
  heading
}) {
  const dailyFile = app.vault.getAbstractFileByPath(dailyPath);

  if (!dailyFile || dailyFile.extension !== "md") {
    throw new Error(`Daily Noteが見つかりません: ${dailyPath}`);
  }

  const content = await app.vault.read(dailyFile);

  if (content.includes(taskFile.basename)) {
    return;
  }

  const link = app.fileManager.generateMarkdownLink(
    taskFile,
    dailyPath,
    undefined,
    taskTitle
  );

  const line = `- ${link}`;
  const headingPattern = new RegExp(
    `(^${escapeRegExp(heading)}[ \\t]*\\r?\\n)`,
    "m"
  );

  const nextContent = headingPattern.test(content)
    ? content.replace(headingPattern, `$1${line}\n`)
    : `${content.trimEnd()}\n\n${heading}\n${line}\n`;

  await app.vault.modify(dailyFile, nextContent);
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
