module.exports = async params => {
  const {
    app,
    quickAddApi,
    variables,
    obsidian
  } = params;

  const TASK_ROOT = "02-Task";
  const TASK_TEMPLATE_PATH =
    "98-System/03-template/01-note/task-note-template.md";

  const DAILY_ROOT = "00-DailyNote";
  const DAILY_TEMPLATE_PATH =
    "98-System/03-template/01-note/daily-note-template.md";
  const DAILY_TASK_HEADING = "# Tasks";

  const now = window.moment();

  let title = String(
    variables?.title ??
    variables?.value ??
    ""
  ).trim();

  if (!title) {
    title = String(
      await quickAddApi.inputPrompt(
        "Taskタイトル",
        "何をする？"
      )
    ).trim();
  }

  if (!title) {
    new Notice("Taskタイトルが空です。");
    return;
  }

  const dailyPath =
    `${DAILY_ROOT}/${now.format("YYYY")}/${now.format("MM")}/` +
    `${now.format("YYYY-MM-DD")}.md`;

  const taskFolder =
    `${TASK_ROOT}/${now.format("YYYY")}/${now.format("MM")}`;

  await ensureFolder(app, taskFolder);
  await ensureDailyNote({
    app,
    obsidian,
    dailyPath,
    templatePath: DAILY_TEMPLATE_PATH,
    date: now
  });

  const filename =
    `${now.format("YYYYMMDD-HHmmss-SSS")}-` +
    sanitizeFilename(title);

  const taskPath =
    await uniqueMarkdownPath(
      app,
      taskFolder,
      filename
    );

  const dailyFile =
    app.vault.getAbstractFileByPath(dailyPath);

  const sourceLink = dailyFile
    ? app.fileManager.generateMarkdownLink(
        dailyFile,
        taskPath,
        undefined,
        now.format("YYYY-MM-DD")
      )
    : `[[${dailyPath}|${now.format("YYYY-MM-DD")}]]`;

  const templateFile =
    app.vault.getAbstractFileByPath(TASK_TEMPLATE_PATH);

  if (!templateFile || templateFile.extension !== "md") {
    throw new Error(
      `Taskテンプレートが見つかりません: ${TASK_TEMPLATE_PATH}`
    );
  }

  const template = await app.vault.read(templateFile);
  const body = renderTaskTemplateBody(
    stripLeadingFrontmatter(template),
    {
      title,
      sourceLink: `- ${sourceLink}`
    }
  );

  const content = buildTaskContent({
    title,
    created: now.format("YYYY-MM-DD"),
    sourcePath: sourceLink,
    triaged: false,
    body
  });

  const taskFile =
    await app.vault.create(taskPath, content);

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

    variables.createdTaskPath = taskFile.path;
    return taskFile.path;
  }

  variables.createdTaskPath = taskFile.path;

  new Notice(`TaskをInboxへ追加しました: ${title}`);
  return taskFile.path;
};

// ==========================================================
// Task content
// ==========================================================

function buildTaskContent({
  title,
  created,
  sourcePath,
  triaged,
  body
}) {
  return [
    "---",
    "type: task",
    `title: ${yamlString(title)}`,
    "status: todo",
    "priority:",
    `created: ${created}`,
    "completed:",
    "scheduled:",
    "due:",
    "depends_on: []",
    `triaged: ${triaged ? "true" : "false"}`,
    "workspace:",
    "project:",
    `source_path: ${yamlString(sourcePath)}`,
    "tags:",
    "  - task",
    "---",
    body.trimStart()
  ].join("\n");
}

function renderTaskTemplateBody(templateBody, values) {
  return templateBody
    .replaceAll("__TITLE__", values.title)
    .replaceAll("__SOURCE_LINK__", values.sourceLink);
}

function stripLeadingFrontmatter(content) {
  return String(content).replace(
    /^---\r?\n[\s\S]*?\r?\n---\r?\n?/,
    ""
  );
}

// ==========================================================
// Daily Note
// ==========================================================

async function ensureDailyNote({
  app,
  obsidian,
  dailyPath,
  templatePath,
  date
}) {
  const existing =
    app.vault.getAbstractFileByPath(dailyPath);

  if (existing) {
    if (!(existing instanceof obsidian.TFile)) {
      throw new Error(
        `Daily Noteのパスがファイルではありません: ${dailyPath}`
      );
    }

    return existing;
  }

  const dailyFolder =
    dailyPath.split("/").slice(0, -1).join("/");

  await ensureFolder(app, dailyFolder);

  const templateFile =
    app.vault.getAbstractFileByPath(templatePath);

  let content;

  if (templateFile instanceof obsidian.TFile) {
    const template =
      await app.vault.read(templateFile);

    content =
      renderKnownDailyTemplate(template, date);
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
    .replace(
      /<%\s*tp\.file\.title\s*%>/g,
      day
    );
}

async function appendTaskLinkToDaily({
  app,
  dailyPath,
  taskFile,
  taskTitle,
  heading
}) {
  const dailyFile =
    app.vault.getAbstractFileByPath(dailyPath);

  if (!dailyFile || dailyFile.extension !== "md") {
    throw new Error(
      `Daily Noteが見つかりません: ${dailyPath}`
    );
  }

  const content =
    await app.vault.read(dailyFile);

  // Task名ではなく一意なファイル名で重複を判定する。
  if (content.includes(taskFile.basename)) {
    return;
  }

  const link =
    app.fileManager.generateMarkdownLink(
      taskFile,
      dailyPath,
      undefined,
      taskTitle
    );

  const line = `- ${link}`;
  const headingPattern =
    new RegExp(
      `(^${escapeRegExp(heading)}[ \\t]*\\r?\\n)`,
      "m"
    );

  let nextContent;

  if (headingPattern.test(content)) {
    nextContent =
      content.replace(
        headingPattern,
        `$1${line}\n`
      );
  } else {
    nextContent =
      `${content.trimEnd()}\n\n${heading}\n${line}\n`;
  }

  await app.vault.modify(
    dailyFile,
    nextContent
  );
}

// ==========================================================
// File helpers
// ==========================================================

async function ensureFolder(app, folderPath) {
  const parts =
    String(folderPath)
      .split("/")
      .filter(Boolean);

  let current = "";

  for (const part of parts) {
    current = current
      ? `${current}/${part}`
      : part;

    if (!app.vault.getAbstractFileByPath(current)) {
      await app.vault.createFolder(current);
    }
  }
}

async function uniqueMarkdownPath(
  app,
  folder,
  baseName
) {
  let candidate =
    `${folder}/${baseName}.md`;

  let counter = 2;

  while (app.vault.getAbstractFileByPath(candidate)) {
    candidate =
      `${folder}/${baseName}-${counter}.md`;
    counter += 1;
  }

  return candidate;
}

function sanitizeFilename(value) {
  const sanitized =
    String(value)
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
  return String(value)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
