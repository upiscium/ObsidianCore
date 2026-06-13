// 98-System/dataview/lib/meta-utils.js

(() => {
  const STATUS_LABELS = {
    "not-yet-running": "⬛️ 未着手",
    "planning": "📝 案出し",
    "running": "🏃 進行中",
    "done": "✅ 完了",
    "stopped": "⏸️ 保留",
    "deleted": "🗑️ 破棄",
    "archived": "📦️ アーカイブ済",

    // Task用
    "waiting": "⏳ 待機",
    "blocked": "⛔ ブロック",
    "someday": "💭 Someday",
    "cancelled": "🚫 キャンセル",

    "none": "▫️"
  };

  const STATUS_ORDER = {
    "blocked": 0,
    "waiting": 1,
    "running": 2,
    "planning": 3,
    "not-yet-running": 4,
    "stopped": 5,
    "someday": 6,
    "done": 7,
    "archived": 8,
    "cancelled": 9,
    "deleted": 10,
    "none": 11
  };

  const PRIORITY_LABELS = {
    "0": "🚨 緊急",
    "1": "🔴 高",
    "2": "🟡 中",
    "3": "🟢 低",
    "4": "🔵 最低",
    "5": "▫️"
  };

  const PRIORITY_ALIASES = {
    urgent: "0",
    high: "1",
    normal: "2",
    medium: "2",
    low: "3",
    lowest: "4",
    none: "5"
  };

  function normalizeKey(value) {
    if (value === null || value === undefined || value === "") return "none";
    return String(value);
  }

  function normalizePriority(value) {
    if (value === null || value === undefined || value === "") return "5";

    const raw = String(value);

    if (["0", "1", "2", "3", "4", "5"].includes(raw)) {
      return raw;
    }

    return PRIORITY_ALIASES[raw] ?? "5";
  }

  function statusLabel(value) {
    const key = normalizeKey(value);
    return STATUS_LABELS[key] ?? `❓ ${key}`;
  }

  function statusOrder(value) {
    const key = normalizeKey(value);
    return STATUS_ORDER[key] ?? 999;
  }

  function priorityLabel(value) {
    const key = normalizePriority(value);
    return PRIORITY_LABELS[key] ?? `❓ ${String(value)}`;
  }

  function priorityOrder(value) {
    return Number(normalizePriority(value));
  }

  function isClosedStatus(value) {
    const key = normalizeKey(value);

    return [
      "done",
      "cancelled",
      "deleted",
      "archived"
    ].includes(key);
  }

  function isTaskActionableStatus(value) {
    const key = normalizeKey(value);

    return ![
      "done",
      "cancelled",
      "deleted",
      "archived",
      "waiting",
      "blocked",
      "someday"
    ].includes(key);
  }

  function isWaitingOrBlockedStatus(value) {
    const key = normalizeKey(value);
    return key === "waiting" || key === "blocked";
  }

  function isSomedayStatus(value) {
    return normalizeKey(value) === "someday";
  }

  function isActiveStatus(value) {
    const key = normalizeKey(value);

    return [
      "not-yet-running",
      "planning",
      "running",
      "none"
    ].includes(key);
  }

  function isArchivedStatus(value) {
    const key = normalizeKey(value);

    return [
      "done",
      "archived"
    ].includes(key);
  }

  function isHiddenStatus(value) {
    const key = normalizeKey(value);

    return [
      "deleted",
      "cancelled"
    ].includes(key);
  }

  function formatDate(value) {
    if (!value) return "-";
    if (value.toFormat) return value.toFormat("yyyy-MM-dd");
    if (value.toISODate) return value.toISODate();
    return String(value);
  }

  function basename(path) {
    return String(path)
      .split("/")
      .pop()
      .replace(/\.md$/, "");
  }

  function fieldText(value) {
    if (value === null || value === undefined || value === "") return "-";

    if (Array.isArray(value)) {
      const values = value.map(fieldText).filter(v => v !== "-");
      return values.length > 0 ? values.join(", ") : "-";
    }

    if (typeof value === "object" && value.path) {
      return value.display ?? basename(value.path);
    }

    if (value.toFormat || value.toISODate) {
      return formatDate(value);
    }

    return String(value);
  }

  function dateOnly(value, dv) {
    if (!value) return null;

    if (value.startOf) {
      return value.startOf("day");
    }

    const parsed = dv.date(String(value));
    if (!parsed) return null;

    return parsed.startOf ? parsed.startOf("day") : parsed;
  }

  return {
    normalizeKey,
    normalizePriority,

    statusLabel,
    statusOrder,
    priorityLabel,
    priorityOrder,

    isClosedStatus,
    isTaskActionableStatus,
    isWaitingOrBlockedStatus,
    isSomedayStatus,

    isActiveStatus,
    isArchivedStatus,
    isHiddenStatus,

    formatDate,
    fieldText,
    dateOnly
  };
})()
