module.exports = async params => {
  const { app, quickAddApi, variables = {} } = params;
  const U = await loadTaskUtils(app);
  const D = await loadTaskDependencyCreationUtils(app);
  const now = window.moment();
  const activeFile = app.workspace.getActiveFile();

  const titleResult = await U.readRequiredText({
    quickAddApi,
    initialValue: variables.title ?? variables.value,
    prompt: "Backlogタイトル",
    placeholder: "いつかやりたいこと"
  });
  if (titleResult.cancelled) return;
  const title = titleResult.value;

  const priorityResult = await U.choosePriority(quickAddApi);
  if (priorityResult.cancelled) return;

  const context = await U.chooseContext({ app, quickAddApi });
  if (context.cancelled) return;

  const dependencyResult = await D.chooseDependencies({ app, quickAddApi });
  if (dependencyResult.cancelled) return;

  const { taskPath } = await U.prepareTaskFile({ app, now, title });
  const dailyPath = U.buildDailyPath(now);
  const sourceFile = activeFile?.extension === "md"
    ? activeFile
    : app.vault.getAbstractFileByPath(dailyPath);

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
    workspace: workspaceLink,
    project: projectLink,
    priority: priorityResult.value,
    triaged: true,
    backlog: true,
    body
  });

  const taskFile = await app.vault.create(taskPath, content);
  variables.createdTaskPath = taskFile.path;

  try {
    await D.applyDependencies({ app, taskFile, dependencies: dependencyResult.tasks });
  } catch (error) {
    console.error("依存Taskの設定に失敗:", error);
    new Notice("Backlog Taskは作成しましたが、依存Taskの設定に失敗しました。");
  }

  new Notice(`Backlogへ追加しました: ${title}`);
  return taskFile.path;
};

async function loadTaskUtils(app) {
  const path = "98-System/01-script/task_creation_utils.js";
  const file = app.vault.getAbstractFileByPath(path);
  if (!file || file.extension !== "js") throw new Error(`Task creation utilityが見つかりません: ${path}`);
  const source = await app.vault.read(file);
  return new Function(`"use strict"; return (${source});`)();
}

async function loadTaskDependencyCreationUtils(app) {
  const path = "98-System/01-script/task_dependency_creation_utils.js";
  const file = app.vault.getAbstractFileByPath(path);
  if (!file || file.extension !== "js") throw new Error(`Task dependency creation utilityが見つかりません: ${path}`);
  const source = await app.vault.read(file);
  return new Function(`"use strict"; return (${source});`)();
}
