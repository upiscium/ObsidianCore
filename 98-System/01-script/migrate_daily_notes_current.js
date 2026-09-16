const DAILY_ROOT = "00-DailyNote/";
const DAILY_NAME = /^\d{4}-\d{2}-\d{2}$/;
const WORK_BUTTONS = "[[work-buttons]]";
const DAILY_WORK = "[[daily-work]]";

function embedLines(target) {
  return ["```meta-bind-embed", target, "```"];
}

function ensureWorkSection(content) {
  const source = String(content ?? "");
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const lines = source.split(/\r?\n/);
  const workIndex = lines.findIndex(line => line.trim() === "# Work");

  if (workIndex < 0) {
    let insertAt = lines.findIndex(line => line.trim() === "# Note");
    if (insertAt < 0) insertAt = lines.length;

    const block = [
      "# Work",
      ...embedLines(WORK_BUTTONS),
      ...embedLines(DAILY_WORK),
      ""
    ];
    if (insertAt > 0 && lines[insertAt - 1].trim() !== "") block.unshift("");
    lines.splice(insertAt, 0, ...block);
    return lines.join(eol);
  }

  let sectionEnd = lines.length;
  for (let index = workIndex + 1; index < lines.length; index += 1) {
    if (/^#\s+/.test(lines[index])) {
      sectionEnd = index;
      break;
    }
  }

  const section = lines.slice(workIndex + 1, sectionEnd).join("\n");
  const additions = [];
  if (!section.includes(WORK_BUTTONS)) additions.push(...embedLines(WORK_BUTTONS));
  if (!section.includes(DAILY_WORK)) additions.push(...embedLines(DAILY_WORK));
  if (additions.length === 0) return source;

  additions.push("");
  lines.splice(workIndex + 1, 0, ...additions);
  return lines.join(eol);
}

function isDailyNote(file, frontmatter) {
  return Boolean(
    file?.extension === "md" &&
    String(file.path ?? "").startsWith(DAILY_ROOT) &&
    DAILY_NAME.test(String(file.basename ?? "")) &&
    String(frontmatter?.type ?? "") === "daily-review"
  );
}

async function migrateDailyNotesCurrent(tp) {
  const files = app.vault.getMarkdownFiles();
  let updated = 0;
  let unchanged = 0;
  let skipped = 0;
  let moodAdded = 0;
  let workUpdated = 0;
  const failures = [];

  for (const file of files) {
    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    if (!isDailyNote(file, frontmatter)) {
      skipped += 1;
      continue;
    }

    try {
      let changed = false;

      if (!Object.prototype.hasOwnProperty.call(frontmatter, "mood")) {
        await app.fileManager.processFrontMatter(file, fm => {
          if (!Object.prototype.hasOwnProperty.call(fm, "mood")) fm.mood = null;
        });
        moodAdded += 1;
        changed = true;
      }

      const current = await app.vault.read(file);
      const next = ensureWorkSection(current);
      if (next !== current) {
        await app.vault.modify(file, next);
        workUpdated += 1;
        changed = true;
      }

      if (changed) updated += 1;
      else unchanged += 1;
    } catch (error) {
      console.error(`Daily Note migration failed: ${file.path}`, error);
      failures.push(file.path);
    }
  }

  new Notice(
    `Daily Note移行: 更新 ${updated} / 変更なし ${unchanged} / 対象外 ${skipped} / ` +
    `mood追加 ${moodAdded} / Work更新 ${workUpdated} / 失敗 ${failures.length}`
  );
  if (failures.length > 0) console.warn("Daily Note移行に失敗したファイル:", failures);

  return { updated, unchanged, skipped, moodAdded, workUpdated, failures };
}

module.exports = migrateDailyNotesCurrent;
module.exports.ensureWorkSection = ensureWorkSection;
module.exports.isDailyNote = isDailyNote;
