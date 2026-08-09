module.exports = async function rescheduleTask(tp) {
  const activeFile = app.workspace.getActiveFile();
  if (!activeFile || activeFile.extension !== "md") {
    new Notice("Taskファイルを開いてから実行してください。");
    return;
  }

  const { T, Q } = await loadUtils();
  const fm = app.metadataCache.getFileCache(activeFile)?.frontmatter ?? {};
  if (!T.isTaskType(fm.type)) {
    new Notice("現在のファイルはTaskではありません。");
    return;
  }

  const duePreset = await tp.system.suggester(
    [
      `変更しない${fm.due ? ` (${String(fm.due)})` : " (未設定)"}`,
      "明日",
      "3日後",
      "1週間後",
      "自由入力"
    ],
    ["keep", "tomorrow", "plus3", "nextWeek", "custom"],
    false,
    "Dueを変更"
  );
  if (duePreset === null || duePreset === undefined) return;

  let customDue = null;
  if (duePreset === "custom") {
    customDue = await tp.system.prompt("Due", String(fm.due ?? ""));
    if (customDue === null || customDue === undefined) return;
  }

  const startPreset = await tp.system.suggester(
    [
      `変更しない${fm.start ? ` (${String(fm.start)})` : " (未設定)"}`,
      "設定解除",
      "今日",
      "明日",
      "1週間後",
      "自由入力"
    ],
    ["keep", "clear", "today", "tomorrow", "nextWeek", "custom"],
    false,
    "Startを変更"
  );
  if (startPreset === null || startPreset === undefined) return;

  let customStart = null;
  if (startPreset === "custom") {
    customStart = await tp.system.prompt("Start", String(fm.start ?? ""));
    if (customStart === null || customStart === undefined) return;
  }

  try {
    const patch = Q.buildReschedulePatch({
      currentStart: fm.start,
      currentDue: fm.due,
      startPreset,
      duePreset,
      customStart,
      customDue,
      today: window.moment().format("YYYY-MM-DD")
    });

    if (Object.keys(patch).length === 0) {
      new Notice("Taskの日程に変更はありません。");
      return;
    }

    await app.fileManager.processFrontMatter(activeFile, frontmatter => {
      Q.applyReschedulePatch(frontmatter, patch);
    });

    new Notice("Taskの日程を更新しました。");
  } catch (error) {
    console.error(error);
    new Notice(error?.message ?? "Taskの日程変更に失敗しました。");
  }
};

async function loadUtils() {
  const schedulePath = "98-System/01-script/task_schedule_utils.js";
  const reschedulePath = "98-System/01-script/task_reschedule_utils.js";
  const metadataPath = "98-System/01-script/task_meta_utils.js";
  const scheduleFile = app.vault.getAbstractFileByPath(schedulePath);
  const rescheduleFile = app.vault.getAbstractFileByPath(reschedulePath);
  const metadataFile = app.vault.getAbstractFileByPath(metadataPath);

  if (!scheduleFile || scheduleFile.extension !== "js") throw new Error(`Task schedule utilityが見つかりません: ${schedulePath}`);
  if (!rescheduleFile || rescheduleFile.extension !== "js") throw new Error(`Task reschedule utilityが見つかりません: ${reschedulePath}`);
  if (!metadataFile || metadataFile.extension !== "js") throw new Error(`Task metadata utilityが見つかりません: ${metadataPath}`);

  const scheduleSource = await app.vault.read(scheduleFile);
  const rescheduleSource = await app.vault.read(rescheduleFile);
  const metadataSource = await app.vault.read(metadataFile);
  const S = new Function(`"use strict"; return (${scheduleSource});`)();
  const rescheduleFactory = new Function(`"use strict"; return (${rescheduleSource});`)();
  const T = new Function(`"use strict"; return (${metadataSource});`)();
  return { T, Q: rescheduleFactory(S) };
}
