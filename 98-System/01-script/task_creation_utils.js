(() => {
  const TASK_ROOT = "02-Task";
  const TASK_TEMPLATE_PATH = "98-System/03-template/01-note/task-note-template.md";
  const DAILY_ROOT = "00-DailyNote";
  const DAILY_TEMPLATE_PATH = "98-System/03-template/01-note/daily-note-template.md";
  const DAILY_TASK_HEADING = "# Tasks";
  const WORKSPACE_FOLDER = "03-Workspace";
  const PROJECT_FOLDER = "10-Project";
  const REFERENCE_UTILS_PATH = "98-System/01-script/task_reference_utils.js";
  let cachedReferenceUtils = null;

  async function loadReferenceUtils(app) {
    if (cachedReferenceUtils) return cachedReferenceUtils;
    const file = app.vault.getAbstractFileByPath(REFERENCE_UTILS_PATH);
    if (!file || file.extension !== "js") {
      throw new Error(`Task reference utilityが見つかりません: ${REFERENCE_UTILS_PATH}`);
    }
    const source = await app.vault.read(file);
    cachedReferenceUtils = new Function(`"use strict"; return (${source});`)();
    return cachedReferenceUtils;
  }

  async function readRequiredText({ quickAddApi, initialValue, prompt, placeholder }) {
    const supplied = String(initialValue ?? "").trim();
    if (supplied) return { cancelled: false, value: supplied };
    const raw = await quickAddApi.inputPrompt(prompt, placeholder);
    if (raw === null || raw === undefined) return { cancelled: true, value: null };
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
    if (selected === null || selected === undefined) return { cancelled: true, value: null };
    return { cancelled: false, value: selected === "none" ? null : selected };
  }

  async function chooseOptionalDate(quickAddApi, label) {
    const options = ["設定しない", "今日", "明日", "明後日", "3日後", "1週間後", "1ヶ月後", "自由入力"];
    const selected = await quickAddApi.suggester(options.map(value => `【${label}】${value}`), options);
    if (selected === null || selected === undefined) return { cancelled: true, value: null };
    if (selected === "設定しない") return { cancelled: false, value: null };
    if (selected === "自由入力") return readOptionalDateInput(quickAddApi, label);
    return { cancelled: false, value: relativeDate(selected) };
  }

  async function chooseRequiredDate({ quickAddApi, initialValue, label }) {
    const supplied = String(initialValue ?? "").trim();
    if (supplied) return parseRequiredDate(supplied, label, "指定");
    const options = ["今日", "明日", "明後日", "3日後", "1週間後", "1ヶ月後", "自由入力"];
    const selected = await quickAddApi.suggester(options.map(value => `【${label}】${value}`), options);
    if (selected === null || selected === undefined) return { cancelled: true, value: null };
    if (selected === "自由入力") {
      const raw = await quickAddApi.inputPrompt(`${label}を入力`, "YYYY-MM-DD");
      if (raw === null || raw === undefined) return { cancelled: true, value: null };
      return parseRequiredDate(String(raw).trim(), label, "入力");
    }
    return { cancelled: false, value: relativeDate(selected) };
  }

  function relativeDate(selected) {
    const date = window.moment();
    const offsets = {
      "今日": [0, "day"],
      "明日": [1, "day"],
      "明後日": [2, "day"],
      "3日後": [3, "day"],
      "1週間後": [1, "week"],
      "1ヶ月後": [1, "month"]
    };
    const [amount, unit] = offsets[selected] ?? [0, "day"];
    return date.add(amount, unit).format("YYYY-MM-DD");
  }

  async function readOptionalDateInput(quickAddApi, label) {
    const raw = await quickAddApi.inputPrompt(`${label}を入力`, "YYYY-MM-DD");
    if (raw === null || raw === undefined) return { cancelled: true, value: null };
    const value = String(raw).trim();
    if (!value) return { cancelled: false, value: null };
    const parsed = window.moment(value, "YYYY-MM-DD", true);
    if (!parsed.isValid()) {
      new Notice(`${label}はYYYY-MM-DD形式で入力してください。`);
      return { cancelled: true, value: null };
    }
    return { cancelled: false, value: parsed.format("YYYY-MM-DD") };
  }

  function parseRequiredDate(value, label, action) {
    const parsed = window.moment(value, "YYYY-MM-DD", true);
    if (!parsed.isValid()) {
      new Notice(`${label}はYYYY-MM-DD形式で${action}してください。`);
      return { cancelled: true, value: null };
    }
    return { cancelled: false, value: parsed.format("YYYY-MM-DD") };
  }

  async function chooseEntityOrNone({ quickAddApi, label, entities }) {
    const none = { kind: "none" };
    const selected = await quickAddApi.suggester(
      [`▫️ ${label}を設定しない`, ...entities.map(entity => entity.displayName)],
      [none, ...entities]
    );
    if (selected === null || selected === undefined) return { cancelled: true, value: null };
    return { cancelled: false, value: selected.kind === "none" ? null : selected };
  }

  async function chooseContext({ app, quickAddApi }) {
    const R = await loadReferenceUtils(app);
    const workspaces = R.findEntityNotes(app, {
      folder: WORKSPACE_FOLDER,
      types: ["workspace"]
    });
    const workspaceResult = await chooseEntityOrNone({
      quickAddApi,
      label: "Workspace",
      entities: workspaces
    });
    if (workspaceResult.cancelled) return { cancelled: true, workspace: null, project: null };

    const workspace = workspaceResult.value;
    if (!workspace) return { cancelled: false, workspace: null, project: null };

    const projects = R.findEntityNotes(app, {
      folder: PROJECT_FOLDER,
      types: ["project"]
    }).filter(project => R.entityMatchesReference(project.workspace, workspace));

    if (projects.length === 0) return { cancelled: false, workspace, project: null };

    const projectResult = await chooseEntityOrNone({
      quickAddApi,
      label: "Project",
      entities: projects
    });
    if (projectResult.cancelled) return { cancelled: true, workspace: null, project: null };
    return { cancelled: false, workspace, project: projectResult.value };
  }

  async function prepareTaskFile({ app, now, title }) {
    const taskFolder = `${TASK_ROOT}/${now.format("YYYY")}/${now.format("MM")}`;
    await ensureFolder(app, taskFolder);
    const filename = `${now.format("YYYYMMDD-HHmmss-SSS")}-${sanitizeFilename(title)}`;
    const taskPath = await uniqueMarkdownPath(app, taskFolder, filename);
    return { taskFolder, taskPath };
  }

  async function readTaskTemplate({ app, title }) {
    const templateFile = app.vault.getAbstractFileByPath(TASK_TEMPLATE_PATH);
    if (!templateFile || templateFile.extension !== "md") {
      throw new Error(`Taskテンプレートが見つかりません: ${TASK_TEMPLATE_PATH}`);
    }
    const template = await app.vault.read(templateFile);
    return stripLeadingFrontmatter(template).replaceAll("__TITLE__", title);
  }

  function makeEntityLink({ app, entity, taskPath }) {
    if (!cachedReferenceUtils) {
      throw new Error("Task reference utilityが初期化されていません。chooseContext()を先に実行してください。");
    }
    return cachedReferenceUtils.makeEntityLink(app, entity, taskPath);
  }

  function makeSourceLink({ app, sourceFile, taskPath, fallbackDailyPath, fallbackLabel }) {
    if (sourceFile?.extension === "md") {
      return app.fileManager.generateMarkdownLink(sourceFile, taskPath, undefined, sourceFile.basename);
    }
    return `[[${fallbackDailyPath.replace(/\.md$/, "")}|${fallbackLabel}]]`;
  }

  function buildTaskContent({ title, source, created, start = null, due = null, workspace = null, project = null, priority = null, triaged = false, backlog = false, body }) {
    return [
      "---",
      "type: task",
      `title: ${yamlString(title)}`,
      `source: ${yamlString(source)}`,
      `created: ${created}`,
      "completed:",
      `start: ${start ?? ""}`,
      `due: ${due ?? ""}`,
      `workspace: ${workspace ? yamlString(workspace) : ""}`,
      `project: ${project ? yamlString(project) : ""}`,
      "status: todo",
      `priority: ${priority ?? ""}`,
      `triaged: ${triaged ? "true" : "false"}`,
      `backlog: ${backlog ? "true" : "false"}`,
      "depends_on: []",
      "---",
      body.trimStart()
    ].join("\n");
  }

  function buildDailyPath(date) {
    return `${DAILY_ROOT}/${date.format("YYYY")}/${date.format("MM")}/${date.format("YYYY-MM-DD")}.md`;
  }

  async function ensureDailyNote({ app, dailyPath, date }) {
    const existing = app.vault.getAbstractFileByPath(dailyPath);
    if (existing) {
      if (existing.extension !== "md") throw new Error(`Daily NoteのパスがMarkdownファイルではありません: ${dailyPath}`);
      return existing;
    }
    const folder = dailyPath.split("/").slice(0, -1).join("/");
    await ensureFolder(app, folder);
    const templateFile = app.vault.getAbstractFileByPath(DAILY_TEMPLATE_PATH);
    let content;
    if (templateFile?.extension === "md") {
      content = renderKnownDailyTemplate(await app.vault.read(templateFile), date);
    } else {
      content = ["---", "type: daily-review", "---", "# Note", "- ", "# Tasks", "", "# Related", ""].join("\n");
    }
    return app.vault.create(dailyPath, content);
  }

  function renderKnownDailyTemplate(template, date) {
    const year = date.format("YYYY");
    const month = date.format("YYYY-MM");
    const day = date.format("YYYY-MM-DD");
    return String(template)
      .replace(/<%\s*moment\(tp\.file\.title,\s*['"]YYYY-MM-DD['"]\)\.format\(['"]YYYY['"]\)\s*%>/g, year)
      .replace(/<%\s*moment\(tp\.file\.title,\s*['"]YYYY-MM-DD['"]\)\.format\(['"]YYYY-MM['"]\)\s*%>/g, month)
      .replace(/<%\s*tp\.file\.title\s*%>/g, day);
  }

  async function appendTaskLinkToDaily({ app, dailyPath, taskFile, taskTitle }) {
    const dailyFile = app.vault.getAbstractFileByPath(dailyPath);
    if (!dailyFile || dailyFile.extension !== "md") throw new Error(`Daily Noteが見つかりません: ${dailyPath}`);
    const content = await app.vault.read(dailyFile);
    if (content.includes(taskFile.basename)) return;
    const link = app.fileManager.generateMarkdownLink(taskFile, dailyPath, undefined, taskTitle);
    const line = `- ${link}`;
    const headingPattern = new RegExp(`(^${escapeRegExp(DAILY_TASK_HEADING)}[ \\t]*\\r?\\n)`, "m");
    const nextContent = headingPattern.test(content)
      ? content.replace(headingPattern, `$1${line}\n`)
      : `${content.trimEnd()}\n\n${DAILY_TASK_HEADING}\n${line}\n`;
    await app.vault.modify(dailyFile, nextContent);
  }

  async function ensureFolder(app, folderPath) {
    const parts = String(folderPath).split("/").filter(Boolean);
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!app.vault.getAbstractFileByPath(current)) await app.vault.createFolder(current);
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

  function stripLeadingFrontmatter(content) {
    return String(content).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  }

  function sanitizeFilename(value) {
    const sanitized = String(value).replace(/[\\/:*?"<>|#^\[\]]+/g, "-").replace(/\s+/g, " ").replace(/^\.+/, "").trim().slice(0, 100);
    return sanitized || "Task";
  }

  function yamlString(value) {
    return JSON.stringify(String(value ?? ""));
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  return {
    TASK_TEMPLATE_PATH,
    readRequiredText,
    choosePriority,
    chooseOptionalDate,
    chooseRequiredDate,
    chooseContext,
    prepareTaskFile,
    readTaskTemplate,
    makeEntityLink,
    makeSourceLink,
    buildTaskContent,
    buildDailyPath,
    ensureDailyNote,
    appendTaskLinkToDaily
  };
})()
