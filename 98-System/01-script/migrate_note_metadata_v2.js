module.exports = async function migrateNoteMetadataV2(tp) {
  const files = app.vault.getMarkdownFiles()
    .filter(file => file.path.startsWith("03-Workspace/") || file.path.startsWith("10-Project/"))
    .filter(file => {
      const type = app.metadataCache.getFileCache(file)?.frontmatter?.type;
      return type === "workspace-note" || type === "project-note";
    });

  const report = {
    updated: 0,
    unchanged: 0,
    unknownLifecycle: [],
    unknownStatus: [],
    unknownCategory: [],
    invalidAliases: [],
    invalidTags: []
  };

  for (const file of files) {
    let changed = false;

    await app.fileManager.processFrontMatter(file, fm => {
      const lifecycle = mapCanonicalLifecycle(fm.lifecycle);
      const legacyStatus = mapLegacyStatus(fm.status);
      const category = mapOptionalCanonical(fm.category, CATEGORIES);
      const aliases = mapStringList(fm.aliases);
      const tags = mapStringList(fm.tags);

      if (lifecycle.present && !lifecycle.known) {
        report.unknownLifecycle.push(`${file.path}: ${String(fm.lifecycle)}`);
      }
      if (!legacyStatus.known) {
        report.unknownStatus.push(`${file.path}: ${String(fm.status)}`);
      }
      if (!category.known) {
        report.unknownCategory.push(`${file.path}: ${String(fm.category)}`);
      }
      if (!aliases.known) {
        report.invalidAliases.push(`${file.path}: ${String(fm.aliases)}`);
      }
      if (!tags.known) {
        report.invalidTags.push(`${file.path}: ${String(fm.tags)}`);
      }

      let nextLifecycle = null;
      if (lifecycle.known) {
        nextLifecycle = lifecycle.value;
      } else if (!lifecycle.present && legacyStatus.known) {
        nextLifecycle = legacyStatus.value;
      }

      if (nextLifecycle !== null && fm.lifecycle !== nextLifecycle) {
        fm.lifecycle = nextLifecycle;
        changed = true;
      }

      const canRemoveLegacy = nextLifecycle !== null && legacyStatus.known;
      if (canRemoveLegacy) {
        if (Object.prototype.hasOwnProperty.call(fm, "status")) {
          delete fm.status;
          changed = true;
        }
        if (Object.prototype.hasOwnProperty.call(fm, "priority")) {
          delete fm.priority;
          changed = true;
        }
      }

      if (category.known && !sameOptional(fm.category, category.value)) {
        fm.category = category.value;
        changed = true;
      }

      if (aliases.known && !sameArray(fm.aliases, aliases.value)) {
        fm.aliases = aliases.value;
        changed = true;
      }

      if (tags.known && !sameArray(fm.tags, tags.value)) {
        fm.tags = tags.value;
        changed = true;
      }
    });

    if (changed) report.updated += 1;
    else report.unchanged += 1;
  }

  console.log("Note metadata v2 migration", report);
  if (report.unknownLifecycle.length > 0) console.warn("Unknown Note lifecycles", report.unknownLifecycle);
  if (report.unknownStatus.length > 0) console.warn("Unknown legacy Note statuses", report.unknownStatus);
  if (report.unknownCategory.length > 0) console.warn("Unknown Note categories", report.unknownCategory);
  if (report.invalidAliases.length > 0) console.warn("Invalid Note aliases", report.invalidAliases);
  if (report.invalidTags.length > 0) console.warn("Invalid Note tags", report.invalidTags);

  new Notice(
    `Note metadata移行: 更新 ${report.updated}件 / 変更なし ${report.unchanged}件 / ` +
    `未知lifecycle ${report.unknownLifecycle.length}件 / 未知status ${report.unknownStatus.length}件 / ` +
    `未知category ${report.unknownCategory.length}件 / aliases不正 ${report.invalidAliases.length}件 / ` +
    `tags不正 ${report.invalidTags.length}件`
  );

  return report;
};

const CATEGORIES = new Set(["memo", "document", "list", "log", "index"]);

function mapCanonicalLifecycle(value) {
  if (value === null || value === undefined || value === "") {
    return { present: false, known: false, value: null };
  }
  const key = String(value).trim();
  return ["active", "archived"].includes(key)
    ? { present: true, known: true, value: key }
    : { present: true, known: false, value: null };
}

function mapLegacyStatus(value) {
  const key = value === null || value === undefined || value === ""
    ? "empty"
    : String(value).trim();

  const mapping = {
    "not-yet-running": "active",
    planning: "active",
    running: "active",
    done: "active",
    stopped: "active",
    waiting: "active",
    blocked: "active",
    someday: "active",
    cancelled: "active",
    none: "active",
    archived: "archived",
    deleted: "archived",
    empty: "active"
  };

  return Object.prototype.hasOwnProperty.call(mapping, key)
    ? { known: true, value: mapping[key] }
    : { known: false, value: null };
}

function mapOptionalCanonical(value, allowed) {
  if (value === null || value === undefined || value === "") {
    return { known: true, value: null };
  }
  const key = String(value).trim();
  return allowed.has(key)
    ? { known: true, value: key }
    : { known: false, value: null };
}

function mapStringList(value) {
  if (value === null || value === undefined || value === "") {
    return { known: true, value: [] };
  }
  if (Array.isArray(value)) {
    return value.every(item => typeof item === "string")
      ? { known: true, value: [...value] }
      : { known: false, value: null };
  }
  if (typeof value === "string") {
    return { known: true, value: [value] };
  }
  return { known: false, value: null };
}

function sameOptional(current, next) {
  const currentEmpty = current === null || current === undefined || current === "";
  const nextEmpty = next === null;
  return (currentEmpty && nextEmpty) || current === next;
}

function sameArray(current, next) {
  return Array.isArray(current)
    && current.length === next.length
    && current.every((item, index) => item === next[index]);
}
