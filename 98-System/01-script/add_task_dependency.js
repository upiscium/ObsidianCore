module.exports = async function addTaskDependency(tp) {
  const TASK_ROOT = "02-Task";
  const TASK_TYPE = "task-pack";

  const buttonBlock = createButtonBlock();

  const activeFile = app.workspace.getActiveFile();

  if (!activeFile) {
    new Notice("アクティブなファイルがありません。");
    return buttonBlock;
  }

  const tasks = app.vault
    .getMarkdownFiles()
    .filter(file =>
      file.path.startsWith(`${TASK_ROOT}/`) &&
      file.path !== activeFile.path
    )
    .map(file => {
      const cache = app.metadataCache.getFileCache(file);
      const fm = cache?.frontmatter ?? {};

      return {
        file,
        title:
          String(fm.title ?? "").trim() ||
          file.basename.replace(/^[0-9]{8}-[0-9]{4}-/, ""),
        type: String(fm.type ?? "").trim(),
        status: String(fm.status ?? "").trim(),
        project: String(fm.project ?? "").trim(),
      };
    })
    .filter(task =>
      task.type === TASK_TYPE &&
      !["done", "cancelled"].includes(task.status)
    )
    .sort((a, b) => a.title.localeCompare(b.title, "ja"));

  if (tasks.length === 0) {
    new Notice("追加できる依存Taskがありません。");
    return buttonBlock;
  }

  const selectedTask = await tp.system.suggester(
    tasks.map(task =>
      task.project
        ? `${task.title} — ${task.project}`
        : task.title
    ),
    tasks,
    false,
    "依存するTaskを選択"
  );

  // キャンセル時はボタンだけを再生成する
  if (!selectedTask) {
    return buttonBlock;
  }

  const link = app.fileManager.generateMarkdownLink(
    selectedTask.file,
    activeFile.path,
    undefined,
    selectedTask.title
  );

  return `- ${link}
${buttonBlock}`;
};

function createButtonBlock() {
  return `\`\`\`meta-bind-button
label: Add dependency
icon: circle-plus
style: primary
action:
  type: replaceSelf
  replacement: "98-System/00-command/add_task_dependency.md"
  templater: true
\`\`\``;
}