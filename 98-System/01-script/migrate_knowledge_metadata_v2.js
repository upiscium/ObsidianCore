module.exports = async function migrateKnowledgeMetadataV2(tp) {
  const files = app.vault.getMarkdownFiles()
    .filter(file => file.path.startsWith("11-Knowledge/"))
    .filter(file => app.metadataCache.getFileCache(file)?.frontmatter?.type === "knowledge-note");

  const report = {
    updated: 0,
    unchanged: 0,
    unknownStatus: [],
    unknownCategory: [],
    unknownMaturity: [],
    unknownSourceType: []
  };

  for (const file of files) {
    let changed = false;

    await app.fileManager.processFrontMatter(file, fm => {
      const status = mapStatus(fm.status);
      const category = mapOptionalCanonical(fm.category, CATEGORIES);
      const maturity = mapMaturity(fm.maturity);
      const sourceType = mapOptionalCanonical(fm.source_type, SOURCE_TYPES);

      if (!status.known) report.unknownStatus.push(`${file.path}: ${String(fm.status)}`);
      if (!category.known) report.unknownCategory.push(`${file.path}: ${String(fm.category)}`);
      if (!maturity.known) report.unknownMaturity.push(`${file.path}: ${String(fm.maturity)}`);
      if (!sourceType.known) report.unknownSourceType.push(`${file.path}: ${String(fm.source_type)}`);

      if (status.known) {
        let nextStatus = status.value;
        if (maturity.known && maturity.wasOutdated && nextStatus !== "archived" && nextStatus !== "deleted") {
          nextStatus = "outdated";
        }
        if (fm.status !== nextStatus) {
          fm.status = nextStatus;
          changed = true;
        }
      }

      if (maturity.known && !(maturity.wasOutdated && !status.known)) {
        if (!sameOptional(fm.maturity, maturity.value)) {
          fm.maturity = maturity.value;
          changed = true;
        }
      }

      if (category.known && !sameOptional(fm.category, category.value)) {
        fm.category = category.value;
        changed = true;
      }

      if (sourceType.known && !sameOptional(fm.source_type, sourceType.value)) {
        fm.source_type = sourceType.value;
        changed = true;
      }
    });

    if (changed) report.updated += 1;
    else report.unchanged += 1;
  }

  console.log("Knowledge metadata v2 migration", report);
  if (report.unknownStatus.length > 0) console.warn("Unknown Knowledge statuses", report.unknownStatus);
  if (report.unknownCategory.length > 0) console.warn("Unknown Knowledge categories", report.unknownCategory);
  if (report.unknownMaturity.length > 0) console.warn("Unknown Knowledge maturities", report.unknownMaturity);
  if (report.unknownSourceType.length > 0) console.warn("Unknown Knowledge source types", report.unknownSourceType);

  new Notice(
    `Knowledge metadata移行: 更新 ${report.updated}件 / 変更なし ${report.unchanged}件 / ` +
    `未知status ${report.unknownStatus.length}件 / 未知category ${report.unknownCategory.length}件 / ` +
    `未知maturity ${report.unknownMaturity.length}件 / 未知source_type ${report.unknownSourceType.length}件`
  );

  return report;
};

const CATEGORIES = new Set(["explanation", "manual", "troubleshooting", "spec", "reference", "summary"]);
const SOURCE_TYPES = new Set(["self", "official", "paper", "book", "web", "other"]);

function mapStatus(value) {
  const key = value === null || value === undefined || value === ""
    ? "empty"
    : String(value).trim();

  const mapping = {
    active: "active",
    outdated: "outdated",
    archived: "archived",
    deleted: "deleted",
    "not-yet-running": "active",
    planning: "active",
    running: "active",
    done: "active",
    stopped: "active",
    waiting: "active",
    blocked: "active",
    someday: "active",
    cancelled: "active",
    empty: "active"
  };

  return Object.prototype.hasOwnProperty.call(mapping, key)
    ? { known: true, value: mapping[key] }
    : { known: false, value: null };
}

function mapMaturity(value) {
  if (value === null || value === undefined || value === "") {
    return { known: true, value: null, wasOutdated: false };
  }

  const key = String(value).trim();
  if (["seed", "draft", "verified", "stable"].includes(key)) {
    return { known: true, value: key, wasOutdated: false };
  }
  if (key === "outdated") {
    return { known: true, value: null, wasOutdated: true };
  }
  return { known: false, value: null, wasOutdated: false };
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

function sameOptional(current, next) {
  const currentEmpty = current === null || current === undefined || current === "";
  const nextEmpty = next === null;
  return (currentEmpty && nextEmpty) || current === next;
}
