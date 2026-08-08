module.exports = async params => {
  const { app, quickAddApi, variables = {} } = params;
  const U = await loadTaskUtils(app);
  const now = window.moment();

  const titleResult = await U.readRequiredText({
    quickAddApi,
    initialValue: variables.title ?? variables.value,
    prompt: "Taskタイトル",
    placeholder: "何をする？"
  });
  if (titleResult.cancelled) return;

  const dueResult = await U.chooseRequiredDate({
    quickAddApi,
    initialValue: variables.due,
    label: "期限"
  });
  if (dueResult.cancelled) return;

  const title = titleResult.value;
  const dailyPath = U.buildDailyPath(now);
  await U.ensureDailyNote({ app, dailyPath, date: now });

  const { taskPath } = await U.prepareTaskFile({ app, now, title });
  const dailyFile = app.vault.getAbstractFileByPath(dailyPath);
  const sourceLink = U.makeSourceLink({
    app,
    sourceFile: dailyFile,
    taskPath,
    fallbackDailyPath: dailyPath,
    fallbackLabel: now.format("YYYY-MM-DD")
  });
  const body = await U.readTaskTemplate({ app, title });

  const content = U.buildTaskContent({
    title,
    source: sourceLink,
    created: now.format("YYYY-MM-DD"),
    due: dueResult.value,
    triaged: false,
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

  new Notice(`TaskをInboxへ追加しました: ${title}`);
  return taskFile.path;
};

async function loadTaskUtils(app) {
  const path = "98-System/01-script/task_creation_utils.js";
  const file = app.vault.getAbstractFileByPath(path);
  if (!file || file.extension !== "js") throw new Error(`Task creation utilityが見つかりません: ${path}`);
  const source = await app.vault.read(file);
  return new Function(`"use strict"; return (${source});`)();
}
