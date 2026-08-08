module.exports = async params => {
  const { app, quickAddApi, variables = {} } = params;
  const U = await loadTaskUtils(app);
  const now = window.moment();
  const activeFile = app.workspace.getActiveFile();

  const titleResult = await U.readRequiredText({
    quickAddApi,
    initialValue: variables.title,
    prompt: "Taskタイトル",
    placeholder: "例: レポートを提出する"
  });
  if (titleResult.cancelled) return;
  const title = titleResult.value;

  const priorityResult = await U.choosePriority(quickAddApi);
  if (priorityResult.cancelled) return;

  const startResult = await U.chooseOptionalDate(quickAddApi, "取り掛かる予定日");
  if (startResult.cancelled) return;

  const dueResult = await U.chooseRequiredDate({
    quickAddApi,
    initialValue: variables.due,
    label: "期限"
  });
  if (dueResult.cancelled) return;

  if (startResult.value && window.moment(startResult.value).isAfter(window.moment(dueResult.value), "day")) {
    new Notice("StartはDue以前の日付にしてください。");
    return;
  }

  const context = await U.chooseContext({ app, quickAddApi });
  if (context.cancelled) return;

  const dailyPath = U.buildDailyPath(now);
  await U.ensureDailyNote({ app, dailyPath, date: now });

  const { taskPath } = await U.prepareTaskFile({ app, now, title });
  const dailyFile = app.vault.getAbstractFileByPath(dailyPath);
  const sourceFile = activeFile?.extension === "md" ? activeFile : dailyFile;

  const sourceLink = U.makeSourceLink({
    app,
    sourceFile,
    taskPath,
    fallbackDailyPath: dailyPath,
    fallbackLabel: now.format("YYYY-MM-DD")
  });
  const workspaceLink = U.makeEntityLink({ app, entity: context.workspace, taskPath });
  const projectLink = U.makeEntityLink({ app, entity: context.project, taskPath });
  const body = await U.readTaskTemplate({ app, title });

  const content = U.buildTaskContent({
    title,
    source: sourceLink,
    created: now.format("YYYY-MM-DD"),
    start: startResult.value,
    due: dueResult.value,
    workspace: workspaceLink,
    project: projectLink,
    priority: priorityResult.value,
    triaged: true,
    backlog: false,
    body
  });

  const taskFile = await app.vault.create(taskPath, content);
  variables.createdTaskPath = taskFile.path;

  try {
    await U.appendTaskLinkToDaily({ app, dailyPath, taskFile, taskTitle: title });
  } catch (error) {
    console.error("Daily Noteへのリンク追加に失敗:", error);
    new Notice("Taskは作成しましたが、Daily Noteへのリンク追加に失敗しました。");
    return taskFile.path;
  }

  new Notice(`Taskを作成しました: ${title}`);
  return taskFile.path;
};

async function loadTaskUtils(app) {
  const path = "98-System/01-script/task_creation_utils.js";
  const file = app.vault.getAbstractFileByPath(path);
  if (!file || file.extension !== "js") throw new Error(`Task creation utilityが見つかりません: ${path}`);
  const source = await app.vault.read(file);
  return new Function(`"use strict"; return (${source});`)();
}
