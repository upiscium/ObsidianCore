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
    unknownLifecycle: [],
    unknownStatus: [],
    unknownPriority: []
  };

  for (const file of files) {
    let changed = false;

    await app.fileManager.processFrontMatter(file, fm => {
      if (fm.type === "workspace") {
        const lifecycle = mapWorkspaceLifecycle(fm.lifecycle);
        const legacyStatus = mapWorkspaceLegacyStatus(fm.status);

        if (lifecycle.present && !lifecycle.known) {
          report.unknownLifecycle.push(`${file.path}: ${String(fm.lifecycle)}`);
          return;
        }
        if (!lifecycle.present && !legacyStatus.known) {
          report.unknownStatus.push(`${file.path}: ${String(fm.status)}`);
          return;
        }

        const nextLifecycle = lifecycle.known ? lifecycle.value : legacyStatus.value;
        if (fm.lifecycle !== nextLifecycle) {
          fm.lifecycle = nextLifecycle;
          changed = true;
        }
        if (Object.prototype.hasOwnProperty.call(fm, "status")) {
          delete fm.status;
          changed = true;
        }
        if (Object.prototype.hasOwnProperty.call(fm, "priority")) {
          delete fm.priority;
          changed = true;
        }
        return;
      }

      const status = mapProjectStatus(fm.status);
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

  console.log("Entity metadata migration", report);
  if (report.unknownLifecycle.length > 0) console.warn("Unknown Workspace lifecycles", report.unknownLifecycle);
  if (report.unknownStatus.length > 0) console.warn("Unknown entity statuses", report.unknownStatus);
  if (report.unknownPriority.length > 0) console.warn("Unknown Project priorities", report.unknownPriority);

  new Notice(
    `Entity metadata移行: 更新 ${report.updated}件 / 変更なし ${report.unchanged}件 / ` +
    `未知lifecycle ${report.unknownLifecycle.length}件 / 未知status ${report.unknownStatus.length}件 / ` +
    `未知priority ${report.unknownPriority.length}件`
  );

  return report;
};

function mapWorkspaceLifecycle(value) {
  if (value === null || value === undefined || value === "") {
    return { present: false, known: false, value: null };
  }
  const key = String(value).trim();
  return ["active", "inactive", "archived"].includes(key)
    ? { present: true, known: true, value: key }
    : { present: true, known: false, value: null };
}

function mapWorkspaceLegacyStatus(value) {
  const key = value === null || value === undefined || value === ""
    ? "empty"
    : String(value).trim();

  const mapping = {
    planning: "active",
    running: "active",
    "not-yet-running": "active",
    none: "active",
    empty: "active",
    stopped: "inactive",
    waiting: "inactive",
    blocked: "inactive",
    someday: "inactive",
    done: "archived",
    cancelled: "archived",
    archived: "archived",
    deleted: "archived"
  };

  return Object.prototype.hasOwnProperty.call(mapping, key)
    ? { known: true, value: mapping[key] }
    : { known: false, value: null };
}

function mapProjectStatus(value) {
  const key = value === null || value === undefined || value === ""
    ? "none"
    : String(value).trim();

  const mapping = {
    planning: "planning",
    running: "running",
    stopped: "stopped",
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
