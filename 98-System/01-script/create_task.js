module.exports = async (params) => {
  const { app, quickAddApi } = params;

  // =========================================================
  // 設定
  // =========================================================

  const TASK_ROOT = "02-Task";
  const TEMPLATE_PATH =
    "98-System/03-template/01-note/task-note-template.md";
  const USE_MONTHLY_FOLDER = true;

  const DAILY_NOTE_PATH_TEMPLATE =
    "00-DailyNote/{YYYY}/{MM}/{YYYY-MM-DD}.md";
  const DAILY_INSERT_HEADING = "# Tasks";
  const CREATE_DAILY_NOTE_IF_MISSING = false;

  const WORKSPACE_FOLDER = "03-Workspace";
  const PROJECT_FOLDER = "10-Project";

  const WORKSPACE_TYPE = "workspace";
  const PROJECT_TYPE = "project";
  const ACTIVE_STATUS = "🏃 進行中";

  // =========================================================
  // 基本情報
  // =========================================================

  const now = window.moment();
  const activeFile = app.workspace.getActiveFile();
  const activeEditor =
    app.workspace.activeLeaf?.view?.editor ?? null;
  const sourcePath = activeFile?.path ?? "";

  const templateFile =
    app.vault.getAbstractFileByPath(TEMPLATE_PATH);

  if (!templateFile || templateFile.extension !== "md") {
    new Notice(
      `[エラー] テンプレートが見つかりません: ${TEMPLATE_PATH}`
    );
    return;
  }

  // =========================================================
  // タイトル入力
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

  // =========================================================
  // 日付入力
  // =========================================================

  const startDate = await getDateStr(
    quickAddApi,
    "開始日 🛫"
  );

  const scheduledDate = await getDateStr(
    quickAddApi,
    "予定日 ⏳"
  );

  const dueDate = await getDateStr(
    quickAddApi,
    "期限 📅"
  );

  // =========================================================
  // Workspace選択
  // =========================================================

  const activeWorkspaces = findNotesByTypeAndStatus({
    app,
    folder: WORKSPACE_FOLDER,
    type: WORKSPACE_TYPE,
    status: ACTIVE_STATUS,
  });

  const selectedWorkspace = await chooseNoteOrNone({
    quickAddApi,
    label: "所属Workspaceを選択",
    notes: sortNotes(activeWorkspaces),
  });

  // =========================================================
  // Project選択
  // =========================================================

  const activeProjects = findNotesByTypeAndStatus({
    app,
    folder: PROJECT_FOLDER,
    type: PROJECT_TYPE,
    status: ACTIVE_STATUS,
  });

  const matchedProjects = selectedWorkspace
    ? activeProjects.filter((project) =>
        projectMatchesWorkspace(
          project,
          selectedWorkspace
        )
      )
    : activeProjects;

  /*
   * Workspaceとの紐付けが取得できなかった場合、
   * Projectを選べなくなるのを避けるため、
   * 全進行中Projectを候補として表示する。
   */
  const projectCandidates =
    selectedWorkspace &&
    matchedProjects.length === 0
      ? activeProjects
      : matchedProjects;

  if (
    selectedWorkspace &&
    matchedProjects.length === 0 &&
    activeProjects.length > 0
  ) {
    new Notice(
      "選択したWorkspaceに紐づくProjectが見つからないため、" +
        "全進行中Projectを表示します。"
    );
  }

  const selectedProject = await chooseNoteOrNone({
    quickAddApi,
    label: selectedWorkspace
      ? `所属Projectを選択: ${selectedWorkspace.displayName}`
      : "所属Projectを選択",
    notes: sortNotes(projectCandidates),
  });

  /*
   * Workspace未選択かつProject選択済みの場合、
   * Project側のworkspace属性からWorkspaceを補完する。
   */
  const resolvedWorkspace =
    selectedWorkspace ??
    findWorkspaceForProject(
      selectedProject,
      activeWorkspaces
    ) ??
    null;

  // =========================================================
  // リンク挿入先選択
  // =========================================================

  const insertTargetChoice =
    await quickAddApi.suggester(
      [
        "カーソル位置にリンクを挿入",
        "Dailyノートにリンクを挿入",
      ],
      ["cursor", "daily"]
    );

  /*
   * 選択モーダルを閉じた場合も、
   * デフォルトはカーソル位置とする。
   */
  const insertTarget =
    insertTargetChoice || "cursor";

  let dailyPath = null;

  if (insertTarget === "cursor") {
    if (!activeFile || !activeEditor) {
      new Notice(
        "[エラー] アクティブなMarkdownエディタがないため、" +
          "カーソル位置へ挿入できません。"
      );
      return;
    }
  }

  if (insertTarget === "daily") {
    dailyPath = resolveDatePath(
      DAILY_NOTE_PATH_TEMPLATE,
      now
    );

    const dailyFile =
      app.vault.getAbstractFileByPath(dailyPath);

    if (
      !dailyFile &&
      !CREATE_DAILY_NOTE_IF_MISSING
    ) {
      new Notice(
        `[エラー] Dailyノートが見つかりません: ${dailyPath}`
      );
      return;
    }

    if (
      dailyFile &&
      dailyFile.extension !== "md"
    ) {
      new Notice(
        "[エラー] Dailyノートのパスが" +
          `Markdownファイルではありません: ${dailyPath}`
      );
      return;
    }
  }

  // =========================================================
  // Taskファイルのパス生成
  // =========================================================

  const taskFolder = USE_MONTHLY_FOLDER
    ? `${TASK_ROOT}/${now.format("YYYY")}/${now.format("MM")}`
    : TASK_ROOT;

  await ensureFolder(app, taskFolder);

  const fileBaseName =
    await makeUniqueFileName(
      app,
      taskFolder,
      title,
      now
    );

  const taskPath =
    `${taskFolder}/${fileBaseName}.md`;

  // =========================================================
  // テンプレート読み込み
  // =========================================================

  const template =
    await app.vault.read(templateFile);

  /*
   * テンプレート先頭にfrontmatterがあっても除去する。
   * 生成ファイルのfrontmatterはJS側で作り直す。
   */
  const templateBody =
    stripLeadingFrontmatter(template);

  const sourceLink = activeFile
    ? `- ${app.fileManager.generateMarkdownLink(
        activeFile,
        taskPath,
        undefined,
        activeFile.basename
      )}`
    : "- ";

  const renderedBody = renderTemplate(
    templateBody,
    {
      "__TITLE__": title,
      "__CREATED_AT__":
        now.format("YYYY-MM-DD HH:mm"),
      "__SOURCE_LINK__": sourceLink,
    }
  );

  /*
   * 最初から有効なYAMLを持つTaskファイルを生成する。
   */
  const initialContent =
    buildInitialTaskContent(renderedBody);

  // =========================================================
  // Taskファイル作成・frontmatter設定
  // =========================================================

  let taskFile;

  try {
    taskFile = await app.vault.create(
      taskPath,
      initialContent
    );

    await app.fileManager.processFrontMatter(
      taskFile,
      (frontmatter) => {
        frontmatter.type = "task-pack";
        frontmatter.title = title;

        frontmatter.status = "todo";
        frontmatter.priority = "normal";

        frontmatter.created =
          now.format("YYYY-MM-DD");
        frontmatter.updated = null;
        frontmatter.reviewed = null;

        frontmatter.start =
          startDate ?? null;
        frontmatter.scheduled =
          scheduledDate ?? null;
        frontmatter.due =
          dueDate ?? null;
        frontmatter.completed = null;

        frontmatter.workspace =
          resolvedWorkspace?.displayName ?? null;

        frontmatter.project =
          selectedProject?.displayName ?? null;

        frontmatter.source_path =
          sourcePath || null;

        const currentTags =
          normalizeTags(frontmatter.tags);

        frontmatter.tags = [
          ...new Set([
            ...currentTags,
            "task",
          ]),
        ];
      }
    );
  } catch (error) {
    console.error(
      "Taskファイル作成エラー:",
      error
    );

    new Notice(
      "[エラー] Taskファイルの作成に失敗しました: " +
        `${error.message}`
    );

    return;
  }

  // =========================================================
  // カーソル位置へリンク挿入
  // =========================================================

  if (insertTarget === "cursor") {
    const taskLink =
      app.fileManager.generateMarkdownLink(
        taskFile,
        activeFile.path,
        undefined,
        title
      );

    const success = insertLinkAtCursor(
      activeEditor,
      `- ${taskLink}`
    );

    if (!success) {
      new Notice(
        "Taskは作成しましたが、" +
          "カーソル位置へのリンク挿入に失敗しました: " +
          title
      );
      return;
    }

    new Notice(
      "Taskを作成し、" +
        `カーソル位置にリンクを挿入しました: ${title}`
    );

    return;
  }

  // =========================================================
  // Dailyノートへリンク挿入
  // =========================================================

  if (insertTarget === "daily") {
    /*
     * DailyノートをsourcePathとしてリンクを生成する。
     * 相対リンク設定でも正しいリンクになるようにする。
     */
    const taskLink =
      app.fileManager.generateMarkdownLink(
        taskFile,
        dailyPath,
        undefined,
        title
      );

    const success =
      await appendLinkToDailyNote({
        app,
        linkLine: `- ${taskLink}`,
        dailyPath,
        heading: DAILY_INSERT_HEADING,
        createIfMissing:
          CREATE_DAILY_NOTE_IF_MISSING,
      });

    if (!success) {
      new Notice(
        "Taskは作成しましたが、" +
          "Dailyノートへのリンク挿入に失敗しました: " +
          title
      );
      return;
    }

    new Notice(
      "Taskを作成し、" +
        `Dailyノートにリンクを挿入しました: ${title}`
    );
  }
};

// =========================================================
// 日付入力
// =========================================================

async function getDateStr(
  quickAddApi,
  promptMsg
) {
  const baseOptions = [
    "設定しない (None)",
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

  const displayOptions =
    baseOptions.map(
      (option) =>
        `【${promptMsg}】 ${option}`
    );

  const choice =
    await quickAddApi.suggester(
      displayOptions,
      baseOptions
    );

  if (
    !choice ||
    choice === "設定しない (None)"
  ) {
    return null;
  }

  const targetDate = window.moment();

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

      if (
        targetDate.isBefore(
          window.moment(),
          "day"
        )
      ) {
        targetDate.add(7, "days");
      }
      break;

    case "今週の日曜日":
      targetDate.day(0);

      if (
        targetDate.isBefore(
          window.moment(),
          "day"
        ) ||
        targetDate.isSame(
          window.moment(),
          "day"
        )
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
      const custom =
        await quickAddApi.inputPrompt(
          `【${promptMsg}】を自由入力`,
          "例: 2026-06-15"
        );

      if (!custom) return null;

      const trimmed = custom.trim();

      if (
        window.moment(
          trimmed,
          "YYYY-MM-DD",
          true
        ).isValid()
      ) {
        return trimmed;
      }

      new Notice(
        "[エラー] 無効な日付形式です。" +
          `${promptMsg}は設定されません。`
      );

      return null;
    }
  }

  return targetDate.format("YYYY-MM-DD");
}

// =========================================================
// Workspace / Project検索
// =========================================================

function findNotesByTypeAndStatus({
  app,
  folder,
  type,
  status,
}) {
  return app.vault
    .getMarkdownFiles()
    .filter((file) =>
      file.path.startsWith(`${folder}/`)
    )
    .map((file) => {
      const cache =
        app.metadataCache.getFileCache(file);

      const frontmatter =
        cache?.frontmatter ?? {};

      return {
        file,
        frontmatter,
        path: file.path,
        displayName:
          frontmatter.title ||
          file.basename,
      };
    })
    .filter((note) => {
      return (
        normalizeValue(
          note.frontmatter.type
        ) === normalizeValue(type) &&
        normalizeValue(
          note.frontmatter.status
        ) === normalizeValue(status)
      );
    });
}

function projectMatchesWorkspace(
  project,
  workspace
) {
  const projectWorkspace =
    normalizeReference(
      project.frontmatter.workspace
    );

  if (!projectWorkspace) {
    return false;
  }

  const workspaceCandidates = [
    workspace.displayName,
    workspace.file.basename,
    workspace.path,
    workspace.path.replace(
      /\.md$/i,
      ""
    ),
  ].map(normalizeReference);

  return workspaceCandidates.includes(
    projectWorkspace
  );
}

function findWorkspaceForProject(
  project,
  workspaces
) {
  if (!project) return null;

  return (
    workspaces.find((workspace) =>
      projectMatchesWorkspace(
        project,
        workspace
      )
    ) ?? null
  );
}

async function chooseNoteOrNone({
  quickAddApi,
  label,
  notes,
}) {
  const displayOptions = [
    `【${label}】設定しない`,
    ...notes.map(
      (note) =>
        `【${label}】 ${note.displayName}`
    ),
  ];

  const valueOptions = [
    null,
    ...notes,
  ];

  const selected =
    await quickAddApi.suggester(
      displayOptions,
      valueOptions
    );

  return selected ?? null;
}

function sortNotes(notes) {
  return [...notes].sort((a, b) =>
    a.displayName.localeCompare(
      b.displayName,
      "ja"
    )
  );
}

// =========================================================
// カーソル位置へのリンク挿入
// =========================================================

function insertLinkAtCursor(
  editor,
  linkLine
) {
  if (!editor) return false;

  const cursor = editor.getCursor();
  const currentLine =
    editor.getLine(cursor.line);

  if (currentLine.trim() === "") {
    editor.replaceRange(
      `${linkLine}\n`,
      {
        line: cursor.line,
        ch: 0,
      }
    );
  } else {
    editor.replaceRange(
      `\n${linkLine}`,
      {
        line: cursor.line,
        ch: currentLine.length,
      }
    );
  }

  return true;
}

// =========================================================
// Dailyノートへのリンク挿入
// =========================================================

async function appendLinkToDailyNote({
  app,
  linkLine,
  dailyPath,
  heading,
  createIfMissing,
}) {
  let dailyFile =
    app.vault.getAbstractFileByPath(
      dailyPath
    );

  if (!dailyFile) {
    if (!createIfMissing) {
      new Notice(
        `[エラー] Dailyノートが見つかりません: ${dailyPath}`
      );
      return false;
    }

    await ensureFolder(
      app,
      parentFolderOf(dailyPath)
    );

    const initialContent =
      `# ${window.moment().format("YYYY-MM-DD")}\n\n` +
      `${heading}\n\n` +
      `${linkLine}\n`;

    dailyFile =
      await app.vault.create(
        dailyPath,
        initialContent
      );

    return Boolean(dailyFile);
  }

  if (dailyFile.extension !== "md") {
    new Notice(
      "[エラー] Dailyノートのパスが" +
        `Markdownファイルではありません: ${dailyPath}`
    );
    return false;
  }

  const content =
    await app.vault.read(dailyFile);

  const updated =
    appendUnderHeading(
      content,
      heading,
      linkLine
    );

  await app.vault.modify(
    dailyFile,
    updated
  );

  return true;
}

function appendUnderHeading(
  content,
  heading,
  lineToAppend
) {
  const lines = content.split("\n");
  const targetHeading = heading.trim();

  const headingIndex =
    lines.findIndex(
      (line) =>
        line.trim() === targetHeading
    );

  /*
   * 指定見出しがなければ、
   * ノート末尾に見出しとリンクを追加する。
   */
  if (headingIndex === -1) {
    const separator =
      content.endsWith("\n")
        ? ""
        : "\n";

    return (
      `${content}${separator}\n` +
      `${targetHeading}\n\n` +
      `${lineToAppend}\n`
    );
  }

  const targetLevel =
    headingLevel(targetHeading);

  let sectionEnd = lines.length;

  /*
   * 同階層または上位階層の
   * 次の見出しまでを対象セクションとする。
   */
  for (
    let index = headingIndex + 1;
    index < lines.length;
    index++
  ) {
    if (
      isHeading(lines[index]) &&
      headingLevel(lines[index]) <=
        targetLevel
    ) {
      sectionEnd = index;
      break;
    }
  }

  let insertIndex = sectionEnd;

  /*
   * セクション末尾の空行より前に挿入する。
   */
  while (
    insertIndex > headingIndex + 1 &&
    lines[insertIndex - 1].trim() === ""
  ) {
    insertIndex--;
  }

  lines.splice(
    insertIndex,
    0,
    lineToAppend
  );

  return lines.join("\n");
}

function isHeading(line) {
  return /^#{1,6}\s+/.test(line);
}

function headingLevel(line) {
  const match =
    line.match(/^(#{1,6})\s+/);

  return match
    ? match[1].length
    : Number.POSITIVE_INFINITY;
}

// =========================================================
// Dailyノートの日付パス変換
// =========================================================

function resolveDatePath(
  template,
  momentValue
) {
  return template.replace(
    /\{([^{}]+)\}/g,
    (_, format) =>
      momentValue.format(format)
  );
}

// =========================================================
// フォルダ作成
// =========================================================

async function ensureFolder(
  app,
  folderPath
) {
  if (!folderPath) return;

  const parts =
    folderPath
      .split("/")
      .filter(Boolean);

  let currentPath = "";

  for (const part of parts) {
    currentPath = currentPath
      ? `${currentPath}/${part}`
      : part;

    const existing =
      app.vault.getAbstractFileByPath(
        currentPath
      );

    if (!existing) {
      await app.vault.createFolder(
        currentPath
      );
    }
  }
}

// =========================================================
// ファイル名生成
// =========================================================

async function makeUniqueFileName(
  app,
  folder,
  title,
  now
) {
  const prefix =
    now.format("YYYYMMDD-HHmm");

  const safeTitle =
    sanitizeFileName(title)
      .slice(0, 60) ||
    "untitled-task";

  const baseName =
    `${prefix}-${safeTitle}`;

  let candidate = baseName;
  let suffix = 2;

  while (
    app.vault.getAbstractFileByPath(
      `${folder}/${candidate}.md`
    )
  ) {
    candidate =
      `${baseName}-${suffix}`;

    suffix++;
  }

  return candidate;
}

function sanitizeFileName(value) {
  return value
    .replace(
      /[\\/:*?"<>|#^[\]]/g,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

// =========================================================
// テンプレートfrontmatter除去
// =========================================================

function stripLeadingFrontmatter(
  content
) {
  const normalized =
    content.replace(/^\uFEFF/, "");

  const match = normalized.match(
    /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n)?/
  );

  return match
    ? normalized.slice(match[0].length)
    : normalized;
}

// =========================================================
// 初期frontmatter生成
// =========================================================

function buildInitialTaskContent(body) {
  const frontmatter = `---
type: task-pack
title: null
status: todo
priority: normal
created: null
updated: null
reviewed: null
start: null
scheduled: null
due: null
completed: null
workspace: null
project: null
source_path: null
tags:
  - task
---`;

  return (
    `${frontmatter}\n\n` +
    body.trimStart()
  );
}

// =========================================================
// テンプレート置換
// =========================================================

function renderTemplate(
  template,
  replacements
) {
  let result = template;

  for (
    const [token, value]
    of Object.entries(replacements)
  ) {
    result = result
      .split(token)
      .join(value ?? "");
  }

  return result;
}

// =========================================================
// 値の正規化
// =========================================================

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags
      .map((tag) =>
        String(tag).trim()
      )
      .filter(Boolean);
  }

  if (
    typeof tags === "string" &&
    tags.trim()
  ) {
    return tags
      .split(/[ ,]+/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeValue(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  if (Array.isArray(value)) {
    return value
      .map(normalizeValue)
      .join(",");
  }

  if (
    typeof value === "object" &&
    value.path
  ) {
    return String(
      value.path
    ).trim();
  }

  return String(value).trim();
}

function normalizeReference(value) {
  let normalized =
    normalizeValue(value);

  if (!normalized) return "";

  normalized = normalized
    .replace(/^['"]|['"]$/g, "")
    .trim();

  const wikiLinkMatch =
    normalized.match(
      /^\[\[([^\]]+)\]\]$/
    );

  if (wikiLinkMatch) {
    normalized =
      wikiLinkMatch[1]
        .split("|")[0]
        .trim();
  }

  return normalized
    .replace(/\.md$/i, "")
    .replace(/\\/g, "/")
    .toLowerCase();
}

function parentFolderOf(path) {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}
