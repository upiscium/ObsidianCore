(() => {
  const STATUS_LABELS = {
    active: "✅ 有効",
    outdated: "⚠️ 古い",
    archived: "📦 アーカイブ",
    deleted: "🗑️ 削除"
  };
  const STATUS_ORDER = { active: 0, outdated: 1, archived: 2, deleted: 3 };

  const CATEGORY_LABELS = {
    explanation: "解説",
    manual: "マニュアル",
    troubleshooting: "トラブルシューティング",
    spec: "仕様",
    reference: "リファレンス",
    summary: "要約",
    none: "▫️"
  };

  const MATURITY_LABELS = {
    seed: "🌱 断片",
    draft: "📝 下書き",
    verified: "✅ 確認済み",
    stable: "📌 安定",
    none: "▫️"
  };
  const MATURITY_ORDER = { seed: 0, draft: 1, verified: 2, stable: 3, none: 4 };

  const SOURCE_TYPE_LABELS = {
    self: "自分の整理",
    official: "公式資料",
    paper: "論文",
    book: "書籍",
    web: "Web",
    other: "その他",
    none: "▫️"
  };

  function normalizeStatus(value) {
    const key = String(value ?? "").trim();
    return Object.prototype.hasOwnProperty.call(STATUS_LABELS, key) ? key : null;
  }

  function normalizeOptional(value, labels) {
    if (value === null || value === undefined || value === "") return "none";
    const key = String(value).trim();
    return Object.prototype.hasOwnProperty.call(labels, key) && key !== "none"
      ? key
      : null;
  }

  function normalizeCategory(value) {
    return normalizeOptional(value, CATEGORY_LABELS);
  }

  function normalizeMaturity(value) {
    return normalizeOptional(value, MATURITY_LABELS);
  }

  function normalizeSourceType(value) {
    return normalizeOptional(value, SOURCE_TYPE_LABELS);
  }

  function labelFor(value, normalize, labels) {
    const key = normalize(value);
    return key ? labels[key] : `❓ ${String(value ?? "")}`;
  }

  function statusLabel(value) {
    return labelFor(value, normalizeStatus, STATUS_LABELS);
  }

  function statusOrder(value) {
    const key = normalizeStatus(value);
    return key ? STATUS_ORDER[key] : 999;
  }

  function categoryLabel(value) {
    return labelFor(value, normalizeCategory, CATEGORY_LABELS);
  }

  function maturityLabel(value) {
    return labelFor(value, normalizeMaturity, MATURITY_LABELS);
  }

  function maturityOrder(value) {
    const key = normalizeMaturity(value);
    return key ? MATURITY_ORDER[key] : 999;
  }

  function sourceTypeLabel(value) {
    return labelFor(value, normalizeSourceType, SOURCE_TYPE_LABELS);
  }

  function isVisibleStatus(value) {
    const status = normalizeStatus(value);
    return status === "active" || status === "outdated";
  }

  function isArchivedStatus(value) {
    return normalizeStatus(value) === "archived";
  }

  function isHiddenStatus(value) {
    return normalizeStatus(value) === "deleted";
  }

  return {
    normalizeStatus,
    normalizeCategory,
    normalizeMaturity,
    normalizeSourceType,
    statusLabel,
    statusOrder,
    categoryLabel,
    maturityLabel,
    maturityOrder,
    sourceTypeLabel,
    isVisibleStatus,
    isArchivedStatus,
    isHiddenStatus
  };
})()
