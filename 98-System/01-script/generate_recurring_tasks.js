module.exports = async function generateRecurringTasks(tp) {
  const S = await loadExpression("98-System/01-script/task_schedule_utils.js");
  const recurringFactory = await loadExpression("98-System/01-script/recurring_task_utils.js");
  const R = recurringFactory(S);
  const C = await loadExpression("98-System/01-script/task_creation_utils.js");
  const today = window.moment().format("YYYY-MM-DD");

  const definitions = app.vault.getMarkdownFiles()
    .filter(file => file.path.startsWith("02-Task/Recurring/"))
    .map(file => ({ file, fm: app.metadataCache.getFileCache(file)?.frontmatter ?? {} }))
    .filter(item => item.fm.type === "recurring-task");

  let generated = 0;
  let existing = 0;
  let disabled = 0;
  const errors = [];

  for (const item of definitions) {
    let definition;
    try {
      definition = R.normalizeDefinition(item.fm);
    } catch (error) {
      errors.push(`${item.file.path}: ${error.message}`);
      continue;
    }

    if (!definition.enabled) {
      disabled += 1;
      continue;
    }

    const occurrences = R.occurrencesInWindow(definition, today);
    for (const occurrence of occurrences) {
      try {
        const taskPath = R.occurrenceTaskPath(definition, occurrence);
        const current = app.vault.getAbstractFileByPath(taskPath);
        if (current) {
          const currentFm = current.extension === "md"
            ? app.metadataCache.getFileCache(current)?.frontmatter ?? {}
            : {};
          if (current.extension !== "md" || currentFm.type !== "task") {
            errors.push(`${taskPath}: 生成先がcanonical Taskではない既存ファイルと競合しています`);
          } else {
            existing += 1;
          }
          continue;
        }

        await ensureFolder(taskPath.split("/").slice(0, -1).join("/"));
        const fields = R.occurrenceTaskFields(definition, occurrence, today);
        const source = app.fileManager.generateMarkdownLink(item.file, taskPath, undefined, item.file.basename);
        const body = await C.readTaskTemplate({ app, title: fields.title });
        const content = C.buildTaskContent({
          title: fields.title,
          source,
          created: fields.created,
          start: fields.start,
          due: fields.due,
          workspace: fields.workspace,
          project: fields.project,
          priority: fields.priority,
          triaged: true,
          backlog: false,
          body
        });
        await app.vault.create(taskPath, content);
        generated += 1;
      } catch (error) {
        errors.push(`${item.file.path} (${occurrence}): ${error.message}`);
      }
    }
  }

  console.log("Recurring Task Generator", { generated, existing, disabled, errors });
  if (errors.length) console.table(errors.map(message => ({ message })));
  new Notice(`Recurring Task: ${generated}件生成 / ${existing}件既存 / ${disabled}件無効 / ${errors.length}件エラー`);
  return { generated, existing, disabled, errors };

  async function loadExpression(path) {
    const file = app.vault.getAbstractFileByPath(path);
    if (!file || file.extension !== "js") throw new Error(`Utilityが見つかりません: ${path}`);
    return new Function(`"use strict"; return (${await app.vault.read(file)});`)();
  }

  async function ensureFolder(folderPath) {
    let current = "";
    for (const part of folderPath.split("/").filter(Boolean)) {
      current = current ? `${current}/${part}` : part;
      if (!app.vault.getAbstractFileByPath(current)) await app.vault.createFolder(current);
    }
  }
};
