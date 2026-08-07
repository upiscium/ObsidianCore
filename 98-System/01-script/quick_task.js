module.exports = async params => {
  const { app, quickAddApi, variables = {} } = params;

  const TASK_ROOT = "02-Task";
  const TASK_TEMPLATE_PATH =
    "98-System/03-template/01-note/task-note-template.md";

  const DAILY_ROOT = "00-DailyNote";
  const DAILY_TEMPLATE_PATH =
    "98-System/03-template/01-note/daily-note-template.md";
  const DAILY_TASK_HEADING = "# Tasks";

  const now = window.moment();

  const titleResult = await readRequiredText({
    quickAddApi,
    initialValue: variables.title ?? variables.value,
    prompt: "Taskタイトル",
    placeholder: "何をする？"
  });

  if (titleResult.cancelled) return;

  const dueResult = await chooseRequiredDate({
    quickAddApi,
    initialValue: variables.due,
    label: "期限"
  });

  if (dueResult.cancelled) return;

  const title = titleResult.value;
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

  const sourceLink = dailyFile
    ? app.fileManager.generateMarkdownLink(
        dailyFile,
        taskPath,
        undefined,
        now.format("YYYY-MM-DD")
      )
    : `[[${dailyPath.replace(/\.md$/, "")}|${now.format("YYYY-MM-DD")}]]`;

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
    due: dueResult.value,
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
    variables.createdTaskPath = taskFile.path;
    return taskFile.path;
  }

  variables.createdTaskPath = taskFile.path;
  new Notice(`TaskをInboxへ追加しました: ${title}`);
  return taskFile.path;
};

async function readRequiredText({
  quickAddApi,
  initialValue,
  prompt,
  placeholder
}) {
  const supplied = String(initialValue ?? "").trim();
<<<<<<< HEAD

  if (supplied) {
    return { cancelled: false, value: supplied };
  }

  const raw = await quickAddApi.inputPrompt(prompt, placeholder);

  if (raw === null || raw === undefined) {
    return { cancelled: true, value: null };
  }

  const value = String(raw).trim();

=======
  if (supplied) return { cancelled: false, value: supplied };

  const raw = await quickAddApi.inputPrompt(prompt, placeholder);
  if (raw === null || raw === undefined) return { cancelled: true, value: null };

  const value = String(raw).trim();
>>>>>>> 2d7fdc96c305b880f1de1e4888c749cfcb3c3f4d
  if (!value) {
    new Notice(`${prompt}が空です。`);
    return { cancelled: true, value: null };
  }
<<<<<<< HEAD

  return { cancelled: false, value };
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

=======
  return { cancelled: false, value };
}

async function chooseRequiredDate({ quickAddApi, initialValue, label }) {
  const supplied = String(initialValue ?? "").trim();
  if (supplied) return parseRequiredDate(supplied, label, "指定");

  const options = ["今日", "明日", "明後日", "3日後", "1週間後", "1ヶ月後", "自由入力"];
>>>>>>> 2d7fdc96c305b880f1de1e4888c749cfcb3c3f4d
  const selected = await quickAddApi.suggester(
    options.map(value => `【${label}】${value}`),
    options
  );

<<<<<<< HEAD
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
=======
  if (selected === null || selected === undefined) return { cancelled: true, value: null };

  const date = window.moment();
  switch (selected) {
    case "今日": return { cancelled: false, value: date.format("YYYY-MM-DD") };
    case "明日": return { cancelled: false, value: date.add(1, "day").format("YYYY-MM-DD") };
    case "明後日": return { cancelled: false, value: date.add(2, "days").format("YYYY-MM-DD") };
    case "3日後": return { cancelled: false, value: date.add(3, "days").format("YYYY-MM-DD") };
    case "1週間後": return { cancelled: false, value: date.add(1, "week").format("YYYY-MM-DD") };
    case "1ヶ月後": return { cancelled: false, value: date.add(1, "month").format("YYYY-MM-DD") };
    case "自由入力": {
      const raw = await quickAddApi.inputPrompt(`${label}を入力`, "YYYY-MM-DD");
      if (raw === null || raw === undefined) return { cancelled: true, value: null };
      return parseRequiredDate(String(raw).trim(), label, "入力");
    }
    default: return { cancelled: true, value: null };
>>>>>>> 2d7fdc96c305b880f1de1e4888c749cfcb3c3f4d
  }
}

function parseRequiredDate(value, label, action) {
  const parsed = window.moment(value, "YYYY-MM-DD", true);
<<<<<<< HEAD

=======
>>>>>>> 2d7fdc96c305b880f1de1e4888c749cfcb3c3f4d
  if (!parsed.isValid()) {
    new Notice(`${label}はYYYY-MM-DD形式で${action}してください。`);
    return { cancelled: true, value: null };
  }
<<<<<<< HEAD

  return {
    cancelled: false,
    value: parsed.format("YYYY-MM-DD")
  };
}

function buildTaskContent({
  title,
  source,
  created,
  due,
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
    `due: ${due}`,
    "workspace:",
    "project:",
    "status: todo",
    "priority:",
    "triaged: false",
    "depends_on: []",
    "---",
=======
  return { cancelled: false, value: parsed.format("YYYY-MM-DD") };
}

function buildTaskContent({ title, source, created, due, body }) {
  return [
    "---", "type: task", `title: ${yamlString(title)}`, `source: ${yamlString(source)}`,
    `created: ${created}`, "completed:", "start:", `due: ${due}`, "workspace:", "project:",
    "status: todo", "priority:", "triaged: false", "backlog: false", "depends_on: []", "---",
>>>>>>> 2d7fdc96c305b880f1de1e4888c749cfcb3c3f4d
    body.trimStart()
  ].join("\n");
}

function stripLeadingFrontmatter(content) {
<<<<<<< HEAD
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

=======
  return String(content).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

function buildDailyPath(root, date) {
  return `${root}/${date.format("YYYY")}/${date.format("MM")}/${date.format("YYYY-MM-DD")}.md`;
}

async function ensureDailyNote({ app, dailyPath, templatePath, date }) {
  const existing = app.vault.getAbstractFileByPath(dailyPath);
  if (existing) {
    if (existing.extension !== "md") throw new Error(`Daily NoteのパスがMarkdownファイルではありません: ${dailyPath}`);
>>>>>>> 2d7fdc96c305b880f1de1e4888c749cfcb3c3f4d
    return existing;
  }

  const folder = dailyPath.split("/").slice(0, -1).join("/");
  await ensureFolder(app, folder);

  const templateFile = app.vault.getAbstractFileByPath(templatePath);
  let content;
<<<<<<< HEAD

=======
>>>>>>> 2d7fdc96c305b880f1de1e4888c749cfcb3c3f4d
  if (templateFile?.extension === "md") {
    const template = await app.vault.read(templateFile);
    content = renderKnownDailyTemplate(template, date);
  } else {
<<<<<<< HEAD
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

=======
    content = ["---", "type: daily-review", "---", "# Note", "- ", "# Tasks", "", "# Related", ""].join("\n");
  }
>>>>>>> 2d7fdc96c305b880f1de1e4888c749cfcb3c3f4d
  return app.vault.create(dailyPath, content);
}

function renderKnownDailyTemplate(template, date) {
  const year = date.format("YYYY");
  const month = date.format("YYYY-MM");
  const day = date.format("YYYY-MM-DD");
<<<<<<< HEAD

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

=======
  return String(template)
    .replace(/<%\s*moment\(tp\.file\.title,\s*['"]YYYY-MM-DD['"]\)\.format\(['"]YYYY['"]\)\s*%>/g, year)
    .replace(/<%\s*moment\(tp\.file\.title,\s*['"]YYYY-MM-DD['"]\)\.format\(['"]YYYY-MM['"]\)\s*%>/g, month)
    .replace(/<%\s*tp\.file\.title\s*%>/g, day);
}

async function appendTaskLinkToDaily({ app, dailyPath, taskFile, taskTitle, heading }) {
  const dailyFile = app.vault.getAbstractFileByPath(dailyPath);
  if (!dailyFile || dailyFile.extension !== "md") throw new Error(`Daily Noteが見つかりません: ${dailyPath}`);

  const content = await app.vault.read(dailyFile);
  if (content.includes(taskFile.basename)) return;

  const link = app.fileManager.generateMarkdownLink(taskFile, dailyPath, undefined, taskTitle);
  const line = `- ${link}`;
  const headingPattern = new RegExp(`(^${escapeRegExp(heading)}[ \\t]*\\r?\\n)`, "m");
  const nextContent = headingPattern.test(content)
    ? content.replace(headingPattern, `$1${line}\n`)
    : `${content.trimEnd()}\n\n${heading}\n${line}\n`;
>>>>>>> 2d7fdc96c305b880f1de1e4888c749cfcb3c3f4d
  await app.vault.modify(dailyFile, nextContent);
}

async function ensureFolder(app, folderPath) {
  const parts = String(folderPath).split("/").filter(Boolean);
  let current = "";
<<<<<<< HEAD

  for (const part of parts) {
    current = current ? `${current}/${part}` : part;

    if (!app.vault.getAbstractFileByPath(current)) {
      await app.vault.createFolder(current);
    }
=======
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!app.vault.getAbstractFileByPath(current)) await app.vault.createFolder(current);
>>>>>>> 2d7fdc96c305b880f1de1e4888c749cfcb3c3f4d
  }
}

async function uniqueMarkdownPath(app, folder, baseName) {
  let candidate = `${folder}/${baseName}.md`;
  let counter = 2;
<<<<<<< HEAD

=======
>>>>>>> 2d7fdc96c305b880f1de1e4888c749cfcb3c3f4d
  while (app.vault.getAbstractFileByPath(candidate)) {
    candidate = `${folder}/${baseName}-${counter}.md`;
    counter += 1;
  }
<<<<<<< HEAD

=======
>>>>>>> 2d7fdc96c305b880f1de1e4888c749cfcb3c3f4d
  return candidate;
}

function sanitizeFilename(value) {
  const sanitized = String(value)
    .replace(/[\\/:*?"<>|#^\[\]]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 100);
<<<<<<< HEAD

  return sanitized || "Task";
}

function yamlString(value) {
  return JSON.stringify(String(value ?? ""));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
=======
  return sanitized || "Task";
}

function yamlString(value) { return JSON.stringify(String(value ?? "")); }
function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
>>>>>>> 2d7fdc96c305b880f1de1e4888c749cfcb3c3f4d
