// Shared behavior for the new Task chooser and the two legacy QuickAdd scripts.
// This expression is loaded from a fixed Vault path on Desktop and Mobile.
(() => {
  const UTILS_PATH = "98-System/01-script/task_creation_utils.js";
  const DEPENDENCIES_PATH = "98-System/01-script/task_dependency_creation_utils.js";
  const MODES = ["actionable", "backlog"];

  async function loadExpression(app, path) {
    const file = app.vault.getAbstractFileByPath(path);
    if (!file || file.extension !== "js") {
      throw new Error(`Task utilityが見つかりません: ${path}`);
    }
    const source = await app.vault.read(file);
    return new Function(`"use strict"; return (${source});`)();
  }

  function checkedMode(mode) {
    if (!MODES.includes(mode)) {
      throw new Error(`Task作成モードが不正です: ${String(mode)}`);
    }
    return mode;
  }

  async function selectMode({ quickAddApi, variables = {} }) {
    if (variables.taskMode !== null && variables.taskMode !== undefined) {
      return { cancelled: false, mode: checkedMode(variables.taskMode) };
    }
    if (typeof quickAddApi?.suggester !== "function") {
      throw new Error("Task作成モードの選択にはQuickAddが必要です。");
    }
    const selected = await quickAddApi.suggester(
      ["通常Task（期限を設定）", "Backlog（期限なし）"],
      MODES
    );
    if (selected === null || selected === undefined) {
      return { cancelled: true, mode: null };
    }
    return { cancelled: false, mode: checkedMode(selected) };
  }

  async function create({ params, mode }) {
    checkedMode(mode); // Fail closed before any prompt, file or metadata operation.
    const { app, quickAddApi, variables = {} } = params;
    const backlog = mode === "backlog";
    const U = await loadExpression(app, UTILS_PATH);
    const D = await loadExpression(app, DEPENDENCIES_PATH);
    const now = window.moment();
    const activeFile = app.workspace.getActiveFile();

    const titleResult = await U.readRequiredText({
      quickAddApi,
      initialValue: backlog ? (variables.title ?? variables.value) : variables.title,
      prompt: backlog ? "Backlogタイトル" : "Taskタイトル",
      placeholder: backlog ? "いつかやりたいこと" : "例: レポートを提出する"
    });
    if (titleResult.cancelled) return;
    const title = titleResult.value;

    const priorityResult = await U.choosePriority(quickAddApi);
    if (priorityResult.cancelled) return;

    let start = null;
    let due = null;
    if (!backlog) {
      const startResult = await U.chooseOptionalDate(quickAddApi, "取り掛かる予定日");
      if (startResult.cancelled) return;
      const dueResult = await U.chooseRequiredDate({
        quickAddApi,
        initialValue: variables.due,
        label: "期限"
      });
      if (dueResult.cancelled) return;
      start = startResult.value;
      due = dueResult.value;

      if (start && window.moment(start).isAfter(window.moment(due), "day")) {
        new Notice("StartはDue以前の日付にしてください。");
        return;
      }
    }

    const context = await U.chooseContext({ app, quickAddApi });
    if (context.cancelled) return;

    const dependencyResult = await D.chooseDependencies({ app, quickAddApi });
    if (dependencyResult.cancelled) return;

    // Retain legacy write-order and Daily Note ownership in each mode.
    let dailyPath;
    let taskPath;
    if (backlog) {
      ({ taskPath } = await U.prepareTaskFile({ app, now, title }));
      dailyPath = U.buildDailyPath(now);
    } else {
      dailyPath = U.buildDailyPath(now);
      await U.ensureDailyNote({ app, dailyPath, date: now });
      ({ taskPath } = await U.prepareTaskFile({ app, now, title }));
    }

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
      ...(backlog ? {} : { start, due }),
      workspace: workspaceLink,
      project: projectLink,
      priority: priorityResult.value,
      triaged: true,
      backlog,
      body
    });

    const taskFile = await app.vault.create(taskPath, content);
    variables.createdTaskPath = taskFile.path;

    try {
      await D.applyDependencies({ app, taskFile, dependencies: dependencyResult.tasks });
    } catch (error) {
      console.error("依存Taskの設定に失敗:", error);
      new Notice(backlog
        ? "Backlog Taskは作成しましたが、依存Taskの設定に失敗しました。"
        : "Taskは作成しましたが、依存Taskの設定に失敗しました。");
    }

    if (!backlog) {
      try {
        await U.appendTaskLinkToDaily({ app, dailyPath, taskFile, taskTitle: title });
      } catch (error) {
        console.error("Daily Noteへのリンク追加に失敗:", error);
        new Notice("Taskは作成しましたが、Daily Noteへのリンク追加に失敗しました。");
        return taskFile.path;
      }
    }

    new Notice(backlog ? `Backlogへ追加しました: ${title}` : `Taskを作成しました: ${title}`);
    return taskFile.path;
  }

  return { selectMode, create };
})()
