module.exports = async function migrateTaskDependencyControls(tp) {
  const TASK_ROOT = "02-Task/";
  const EMBED_TARGET = "[[98-System/02-embed/01-button/task-dependency-controls|task-dependency-controls]]";
  const files = app.vault
    .getMarkdownFiles()
    .filter(file => file.path.startsWith(TASK_ROOT));

  let migrated = 0;
  let alreadyEmbedded = 0;
  let skipped = 0;
  const failures = [];

  for (const file of files) {
    try {
      const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
      if (!isTaskType(fm.type)) {
        skipped += 1;
        continue;
      }

      const content = await app.vault.read(file);
      if (content.includes(EMBED_TARGET)) {
        alreadyEmbedded += 1;
        continue;
      }

      const next = replaceLegacyControls(content, EMBED_TARGET);
      if (next === content) {
        skipped += 1;
        continue;
      }

      await app.vault.modify(file, next);
      migrated += 1;
    } catch (error) {
      console.error(`Task dependency controls migration failed: ${file.path}`, error);
      failures.push(file.path);
    }
  }

  new Notice(
    `Task依存ボタン移行: 移行 ${migrated} / embed済み ${alreadyEmbedded} / ` +
    `対象外 ${skipped} / 失敗 ${failures.length}`
  );
  if (failures.length > 0) console.warn("Task依存ボタン移行に失敗したファイル:", failures);

  return { migrated, alreadyEmbedded, skipped, failures };
};

function isTaskType(value) {
  return String(value ?? "") === "task" || String(value ?? "") === "task-pack";
}

function replaceLegacyControls(content, embedTarget) {
  const source = String(content ?? "");
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const embed = ["```meta-bind-embed", embedTarget, "```"].join(newline);
  const patterns = [
    /^[ \t]*`BUTTON\[task-add-dependency,\s*task-remove-dependency\]`[ \t]*$/m,
    /^[ \t]*`BUTTON\[task-add-dependency,\s*task-add-child(?:-dependency)?,\s*task-remove-dependency\]`[ \t]*$/m
  ];

  for (const pattern of patterns) {
    if (pattern.test(source)) return source.replace(pattern, embed);
  }
  return source;
}
