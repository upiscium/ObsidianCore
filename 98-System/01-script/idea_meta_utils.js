(() => {
  const STATUS_LABELS = {
    active: "💡 Active",
    adopted: "✅ Adopted",
    archived: "📦 Archived"
  };
  const STATUS_ORDER = { active: 0, adopted: 1, archived: 2 };

  function normalizeStatus(value) {
    const key = String(value ?? "").trim();
    return Object.prototype.hasOwnProperty.call(STATUS_LABELS, key) ? key : null;
  }

  function statusLabel(value) {
    const key = normalizeStatus(value);
    return key ? STATUS_LABELS[key] : `❓ ${String(value ?? "")}`;
  }

  function statusOrder(value) {
    const key = normalizeStatus(value);
    return key ? STATUS_ORDER[key] : 999;
  }

  function isActive(value) {
    return normalizeStatus(value) === "active";
  }

  function isAdopted(value) {
    return normalizeStatus(value) === "adopted";
  }

  function isArchived(value) {
    return normalizeStatus(value) === "archived";
  }

  function isStringArray(value) {
    return Array.isArray(value) && value.every(item => typeof item === "string");
  }

  return {
    normalizeStatus,
    statusLabel,
    statusOrder,
    isActive,
    isAdopted,
    isArchived,
    isStringArray
  };
})()
