module.exports = async function migrateEntityMetadataV2(tp) {
  const files = app.vault.getMarkdownFiles()
    .filter(file => file.path.startsWith("03-Workspace/") || file.path.startsWith("10-Project/"))
    .filter(file => {
      const type = app.metadataCache.getFileCache(file)?.frontmatter?.type;
      return type === "workspace" || type === "project";
    });

  const report = {
    updated: 0,
    unchanged: 0,
    unknownStatus: [],
    unknownPriority: []
  };

  for (const file of files) {
    let changed = false;

    await app.fileManager.processFrontMatter(file, fm => {
      const status = mapStatus(fm.status, fm.type);
      if (status.known) {
        if (fm.status !== status.value) {
          fm.status = status.value;
          changed = true;
        }
      } else {
        report.unknownStatus.push(`${file.path}: ${String(fm.status)}`);
      }

      const priority = mapPriority(fm.priority);
      if (priority.known) {
        const next = priority.value;
        const currentEmpty = fm.priority === null || fm.priority === undefined || fm.priority === "";
        const nextEmpty = next === null;

        if (!(currentEmpty && nextEmpty) && fm.priority !== next) {
          fm.priority = next;
          changed = true;
        }
      } else {
        report.unknownPriority.push(`${file.path}: ${String(fm.priority)}`);
      }
    });

    if (changed) report.updated += 1;
    else report.unchanged += 1;
  }

  console.log("Entity metadata v2 migration", report);
  if (report.unknownStatus.length > 0) console.warn("Unknown entity statuses", report.unknownStatus);
  if (report.unknownPriority.length > 0) console.warn("Unknown entity priorities", report.unknownPriority);

  new Notice(
    `Entity metadata移行: 更新 ${report.updated}件 / 変更なし ${report.unchanged}件 / ` +
    `未知status ${report.unknownStatus.length}件 / 未知priority ${report.unknownPriority.length}件`
  );

  return report;
};

function mapStatus(value, type) {
  const key = value === null || value === undefined || value === ""
    ? "none"
    : String(value).trim();

  if (key === "stopped") {
    return { known: true, value: type === "project" ? "stopped" : "planning" };
  }

  const mapping = {
    planning: "planning",
    running: "running",
    done: "done",
    cancelled: "cancelled",
    "not-yet-running": "planning",
    waiting: "planning",
    blocked: "planning",
    someday: "planning",
    archived: "done",
    deleted: "cancelled",
    none: "planning"
  };

  return Object.prototype.hasOwnProperty.call(mapping, key)
    ? { known: true, value: mapping[key] }
    : { known: false, value: null };
}

function mapPriority(value) {
  if (value === null || value === undefined || value === "") {
    return { known: true, value: null };
  }

  const key = String(value).trim();
  const mapping = {
    high: "high",
    medium: "medium",
    low: "low",
    none: null,
    urgent: "high",
    normal: "medium",
    lowest: "low",
    "0": "high",
    "1": "high",
    "2": "medium",
    "3": "low",
    "4": "low",
    "5": null
  };

  return Object.prototype.hasOwnProperty.call(mapping, key)
    ? { known: true, value: mapping[key] }
    : { known: false, value: null };
}
