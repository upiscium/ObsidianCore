module.exports = async (params) => {
  const { app, quickAddApi } = params;

  // =========================================================
  // 設定
  // =========================================================

  const TASK_ROOT = "02-Task";
  const TEMPLATE_PATH = "98-System/03-template/01-note/task-note-template.md";
  const USE_MONTHLY_FOLDER = true;

  // {YYYY} など、{} の中だけ日付変換される
  const DAILY_NOTE_PATH_TEMPLATE = "00-DailyNote/{YYYY}/{MM}/{YYYY-MM-DD}.md";
  const DAILY_INSERT_HEADING = "# Tasks";
  const CREATE_DAILY_NOTE_IF_MISSING = false;

  const WORKSPACE_FOLDER = "03-Workspace";
  const PROJECT_FOLDER = "10-Project";

  const WORKSPACE_TYPE = "workspace";
  const PROJECT_TYPE = "project";

  // アクティブ扱いする status を複数指定できる
  // Meta Bind の表示名ではなく、frontmatter に保存される実際の値を書く
  const ACTIVE_STATUSES = [
    "not-yet-running",
    "planning",
    "running",
    "stopped",
  ];

  // =========================================================
  // 基本情報
  // =========================================================

  const now = window.moment();
  const activeFile = app.workspace.getActiveFile();
  const sourcePath = activeFile?.path ?? "";

  const templateFile = app.vault.getAbstractFileByPath(TEMPLATE_PATH);

  if (!templateFile) {
    new Notice(`[エラー] テンプレートが見つかりません: ${TEMPLATE_PATH}`);
    return;
  }

  // =========================================================
  // 入力
  // =========================================================

  const titleRaw = await quickAddApi.inputPrompt(
    "Taskタイトルを入力",
    "例: Obsidian Task管理を改善する"
  );

  if (!titleRaw) return;

  const title = titleRaw.trim();

  if (!title) {
    new Notice("[エラー] Taskタイトルが空です。");
    return;
  }

  const startDate = await getDateStr(quickAddApi, "開始日 🛫");
  const scheduledDate = await getDateStr(quickAddApi, "予定日 ⏳");
  const dueDate = await getDateStr(quickAddApi, "期限 📅");

  // =========================================================
  // Workspace / Project 選択
  // =========================================================

  const activeWorkspaces = findNotesByTypeAndStatus({
    app,
    folder: WORKSPACE_FOLDER,
    type: WORKSPACE_TYPE,
    statuses: ACTIVE_STATUSES,
  });

  const selectedWorkspace = await chooseNoteOrNone({
    quickAddApi,
    label: "所属Workspaceを選択",
    notes: sortNotes(activeWorkspaces),
  });

  const activeProjects = findNotesByTypeAndStatus({
    app,
    folder: PROJECT_FOLDER,
    type: PROJECT_TYPE,
    statuses: ACTIVE_STATUSES,
  });

  const matchedProjects = selectedWorkspace
    ? activeProjects.filter(project =>
        projectMatchesWorkspace(project, selectedWorkspace)
      )
    : activeProjects;

  // Workspaceを選んだのにProjectが1件も引っかからない場合、
  // 「設定ミスで何も選べない」を避けるため、全進行中Projectを候補に戻す。
  const projectCandidates =
    selectedWorkspace && matchedProjects.length === 0
      ? activeProjects
      : matchedProjects;

  if (selectedWorkspace && matchedProjects.length === 0 && activeProjects.length > 0) {
    new Notice("選択Workspaceに紐づくProjectが見つからないため、全進行中Projectを表示します。");
  }

  const selectedProject = await chooseNoteOrNone({
    quickAddApi,
    label: selectedWorkspace
      ? `所属Projectを選択: ${selectedWorkspace.displayName}`
      : "所属Projectを選択",
    notes: sortNotes(projectCandidates),
  });

  // =========================================================
  // Task Pack ファイル作成
  // =========================================================

  const taskFolder = USE_MONTHLY_FOLDER
    ? `${TASK_ROOT}/${now.format("YYYY")}/${now.format("MM")}`
    : TASK_ROOT;

  await ensureFolder(app, taskFolder);

  const fileBaseName = await makeUniqueFileName(app, taskFolder, title, now);
  const taskPath = `${taskFolder}/${fileBaseName}.md`;

  const template = await app.vault.read(templateFile);

  const workspaceValue = selectedWorkspace?.displayName ?? null;
  const projectValue = selectedProject?.displayName ?? null;

  const sourceLink = activeFile
    ? `- ${app.fileManager.generateMarkdownLink(
        activeFile,
        taskPath,
        undefined,
        activeFile.basename
      )}`
    : "- ";

  const rendered = renderTemplate(template, {
    "__TITLE__": title,
    "__TITLE_YAML__": yamlValue(title),

    "__CREATED_YAML__": yamlValue(now.format("YYYY-MM-DD")),
    "__CREATED_AT__": now.format("YYYY-MM-DD HH:mm"),

    "__START_YAML__": yamlValue(startDate),
    "__SCHEDULED_YAML__": yamlValue(scheduledDate),
    "__DUE_YAML__": yamlValue(dueDate),

    "__WORKSPACE_YAML__": yamlValue(workspaceValue),
    "__PROJECT_YAML__": yamlValue(projectValue),

    "__SOURCE_PATH_YAML__": yamlValue(sourcePath),
    "__SOURCE_LINK__": sourceLink,
  });

  const taskFile = await app.vault.create(taskPath, rendered);

  const taskLink = app.fileManager.generateMarkdownLink(
    taskFile,
    sourcePath,
    undefined,
    title
  );

  const linkLine = `- ${taskLink}`;

  // =========================================================
  // リンク挿入先
  // =========================================================

  const insertTarget = await quickAddApi.suggester(
    [
      "カーソル位置にリンクを挿入",
      "Dailyノートにリンクを挿入",
    ],
    [
      "cursor",
      "daily",
    ]
  );

  // キャンセル時はデフォルトでカーソル位置
  const target = insertTarget || "cursor";

  if (target === "cursor") {
    const ok = await insertLinkAtCursor(app, activeFile, linkLine);

    if (ok) {
      new Notice(`Taskを作成し、カーソル位置にリンクを挿入しました: ${title}`);
    } else {
      new Notice(`Taskは作成しましたが、リンク挿入に失敗しました: ${title}`);
    }

    return;
  }

  if (target === "daily") {
    const ok = await appendLinkToDailyNote({
      app,
      linkLine,
      dailyPathTemplate: DAILY_NOTE_PATH_TEMPLATE,
      heading: DAILY_INSERT_HEADING,
      createIfMissing: CREATE_DAILY_NOTE_IF_MISSING,
    });

    if (ok) {
      new Notice(`Taskを作成し、Dailyノートにリンクを挿入しました: ${title}`);
    } else {
      new Notice(`Taskは作成しましたが、Dailyノートへのリンク挿入に失敗しました: ${title}`);
    }

    return;
  }
};

// =========================================================
// 日付入力
// =========================================================

async function getDateStr(quickAddApi, promptMsg) {
  const baseOptions = [
    "設定しない",
    "今日",
    "明日",
    "明後日",
    "3日後",
    "今週の土曜日",
    "今週の日曜日",
    "1週間後",
    "1ヶ月後",
    "自由入力 (YYYY-MM-DD)",
  ];

  const displayOptions = baseOptions.map(opt => `【${promptMsg}】 ${opt}`);

  const choice = await quickAddApi.suggester(displayOptions, baseOptions);

  if (!choice || choice === "設定しない") return null;

  let targetDate = window.moment();

  switch (choice) {
    case "今日":
      break;

    case "明日":
      targetDate.add(1, "days");
      break;

    case "明後日":
      targetDate.add(2, "days");
      break;

    case "3日後":
      targetDate.add(3, "days");
      break;

    case "今週の土曜日":
      targetDate.day(6);
      if (targetDate.isBefore(window.moment(), "day")) {
        targetDate.add(7, "days");
      }
      break;

    case "今週の日曜日":
      targetDate.day(0);
      if (
        targetDate.isBefore(window.moment(), "day") ||
        targetDate.isSame(window.moment(), "day")
      ) {
        targetDate.add(7, "days");
      }
      break;

    case "1週間後":
      targetDate.add(1, "weeks");
      break;

    case "1ヶ月後":
      targetDate.add(1, "months");
      break;

    case "自由入力 (YYYY-MM-DD)": {
      const custom = await quickAddApi.inputPrompt(
        `【${promptMsg}】を自由入力`,
        "例: 2026-06-15"
      );

      if (!custom) return null;

      const trimmed = custom.trim();

      if (window.moment(trimmed, "YYYY-MM-DD", true).isValid()) {
        return trimmed;
      }

      new Notice(`[エラー] 無効な日付です。${promptMsg}は設定されません。`);
      return null;
    }
  }

  return targetDate.format("YYYY-MM-DD");
}

// =========================================================
// Workspace / Project 検索
// =========================================================

function findNotesByTypeAndStatus({ app, folder, type, statuses }) {
  const allowedStatuses = normalizeValues(statuses);

  return app.vault.getMarkdownFiles()
    .filter(file => file.path.startsWith(`${folder}/`))
    .map(file => {
      const cache = app.metadataCache.getFileCache(file);
      const fm = cache?.frontmatter ?? {};

      return {
        file,
        fm,
        path: file.path,
        displayName: fm.title || file.basename,
      };
    })
    .filter(note => {
      const noteType = normalizeValue(note.fm.type);
      const expectedType = normalizeValue(type);
      const noteStatuses = normalizeValues(note.fm.status);

      return noteType === expectedType
        && noteStatuses.some(status => allowedStatuses.includes(status));
    });
}

function projectMatchesWorkspace(project, workspace) {
  const raw = project.fm.workspace;

  if (!raw) return false;

  const value = normalizeValue(raw);
  const workspacePathNoExt = workspace.path.replace(/\.md$/, "");

  const candidates = [
    workspace.displayName,
    workspace.file.basename,
    workspace.path,
    workspacePathNoExt,
    `[[${workspace.file.basename}]]`,
    `[[${workspacePathNoExt}]]`,
  ].map(normalizeValue);

  return candidates.includes(value);
}

async function chooseNoteOrNone({ quickAddApi, label, notes }) {
  const displayOptions = [
    `【${label}】設定しない`,
    ...notes.map(note => `【${label}】 ${note.displayName}`),
  ];

  const valueOptions = [
    null,
    ...notes,
  ];

  const selected = await quickAddApi.suggester(displayOptions, valueOptions);
  return selected ?? null;
}

function sortNotes(notes) {
  return [...notes].sort((a, b) => {
    return a.displayName.localeCompare(b.displayName, "ja");
  });
}

// =========================================================
// リンク挿入
// =========================================================

async function insertLinkAtCursor(app, activeFile, linkLine) {
  const editor = app.workspace.activeLeaf?.view?.editor;

  if (!activeFile || !editor) {
    new Notice("[警告] アクティブなMarkdownエディタがありません。");
    return false;
  }

  const cursor = editor.getCursor();
  const currentLine = editor.getLine(cursor.line);

  if (currentLine.trim() === "") {
    editor.replaceRange(`${linkLine}\n`, { line: cursor.line, ch: 0 });
  } else {
    editor.replaceRange(`\n${linkLine}`, {
      line: cursor.line,
      ch: currentLine.length,
    });
  }

  return true;
}

async function appendLinkToDailyNote({
  app,
  linkLine,
  dailyPathTemplate,
  heading,
  createIfMissing,
}) {
  const dailyPath = resolveDatePath(dailyPathTemplate, window.moment());

  let file = app.vault.getAbstractFileByPath(dailyPath);

  if (!file) {
    if (!createIfMissing) {
      new Notice(`[エラー] Dailyノートが見つかりません: ${dailyPath}`);
      return false;
    }

    await ensureFolder(app, parentFolderOf(dailyPath));

    const initialContent = `# ${window.moment().format("YYYY-MM-DD")}

${heading}

${linkLine}
`;

    await app.vault.create(dailyPath, initialContent);
    return true;
  }

  if (file.extension !== "md") {
    new Notice(`[エラー] DailyノートのパスがMarkdownファイルではありません: ${dailyPath}`);
    return false;
  }

  const content = await app.vault.read(file);
  const updated = appendUnderHeading(content, heading, linkLine);

  await app.vault.modify(file, updated);
  return true;
}

function appendUnderHeading(content, heading, lineToAppend) {
  const lines = content.split("\n");
  const targetHeading = heading.trim();

  const headingIndex = lines.findIndex(line => {
    return line.trim() === targetHeading;
  });

  if (headingIndex === -1) {
    const suffix = content.endsWith("\n") ? "" : "\n";
    return `${content}${suffix}\n${targetHeading}\n\n${lineToAppend}\n`;
  }

  const targetLevel = headingLevel(targetHeading);
  let insertIndex = lines.length;

  for (let i = headingIndex + 1; i < lines.length; i++) {
    const line = lines[i];

    if (isHeading(line) && headingLevel(line) <= targetLevel) {
      insertIndex = i;
      break;
    }
  }

  const before = lines.slice(0, insertIndex);
  const after = lines.slice(insertIndex);

  while (before.length > 0 && before[before.length - 1].trim() === "") {
    before.pop();
  }

  return [
    ...before,
    lineToAppend,
    "",
    ...after,
  ].join("\n");
}

function isHeading(line) {
  return /^#{1,6}\s+/.test(line);
}

function headingLevel(line) {
  const match = line.match(/^(#{1,6})\s+/);
  return match ? match[1].length : 999;
}

// =========================================================
// 日付パス解決
// =========================================================

function resolveDatePath(template, m) {
  return template.replace(/\{([^{}]+)\}/g, (_, format) => {
    return m.format(format);
  });
}

// =========================================================
// 汎用
// =========================================================

async function ensureFolder(app, folderPath) {
  if (!folderPath) return;

  const parts = folderPath.split("/").filter(Boolean);
  let current = "";

  for (const part of parts) {
    current = current ? `${current}/${part}` : part;

    const exists = app.vault.getAbstractFileByPath(current);

    if (!exists) {
      await app.vault.createFolder(current);
    }
  }
}

async function makeUniqueFileName(app, folder, title, now) {
  const prefix = now.format("YYYYMMDD-HHmm");
  const slug = sanitizeFileName(title).slice(0, 60) || "untitled-task";

  const baseName = `${prefix}-${slug}`;

  let candidate = baseName;
  let index = 2;

  while (app.vault.getAbstractFileByPath(`${folder}/${candidate}.md`)) {
    candidate = `${baseName}-${index}`;
    index++;
  }

  return candidate;
}

function sanitizeFileName(name) {
  return name
    .replace(/[\\/:*?"<>|#^[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function yamlValue(value) {
  if (value === null || value === undefined || value === "") {
    return "null";
  }

  return JSON.stringify(value);
}

function renderTemplate(template, replacements) {
  let result = template;

  for (const [token, value] of Object.entries(replacements)) {
    result = result.split(token).join(value ?? "");
  }

  return result;
}

function normalizeValue(value) {
  if (value === null || value === undefined) return "";

  if (Array.isArray(value)) {
    return value.join(",").trim();
  }

  return String(value).trim();
}

function normalizeValues(value) {
  if (value === null || value === undefined) return [];

  if (Array.isArray(value)) {
    return value
      .map(v => normalizeValue(v))
      .filter(Boolean);
  }

  return [normalizeValue(value)].filter(Boolean);
}

function parentFolderOf(path) {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}
