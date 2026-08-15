(() => {
  const LIFECYCLE_LABELS = {
    active: "✅ 有効",
    archived: "📦 アーカイブ"
  };

  const CATEGORY_LABELS = {
    memo: "メモ",
    document: "ドキュメント",
    list: "リスト",
    log: "ログ",
    index: "インデックス",
    none: "▫️"
  };

  function normalizeLifecycle(value) {
    const key = String(value ?? "").trim();
    return Object.prototype.hasOwnProperty.call(LIFECYCLE_LABELS, key) ? key : null;
  }

  function normalizeCategory(value) {
    if (value === null || value === undefined || value === "") return "none";
    const key = String(value).trim();
    return Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, key) && key !== "none"
      ? key
      : null;
  }

  function labelFor(value, normalize, labels) {
    const key = normalize(value);
    return key ? labels[key] : `❓ ${String(value ?? "")}`;
  }

  function lifecycleLabel(value) {
    return labelFor(value, normalizeLifecycle, LIFECYCLE_LABELS);
  }

  function categoryLabel(value) {
    return labelFor(value, normalizeCategory, CATEGORY_LABELS);
  }

  function isActiveLifecycle(value) {
    return normalizeLifecycle(value) === "active";
  }

  function isArchivedLifecycle(value) {
    return normalizeLifecycle(value) === "archived";
  }

  function isStringArray(value) {
    return Array.isArray(value) && value.every(item => typeof item === "string");
  }

  function formatDate(value) {
    if (!value) return "-";
    if (value.toFormat) return value.toFormat("yyyy-MM-dd");
    if (value.toISODate) return value.toISODate();
    return String(value);
  }

  return {
    normalizeLifecycle,
    normalizeCategory,
    lifecycleLabel,
    categoryLabel,
    isActiveLifecycle,
    isArchivedLifecycle,
    isStringArray,
    formatDate
  };
})()
