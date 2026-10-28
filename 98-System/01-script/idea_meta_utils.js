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

  // Adoption is historical metadata, never inferred from the related Project.
  // Missing/null/empty YAML scalars all represent an absent optional field.
  function hasAdoptionValue(value) {
    return value !== null && value !== undefined && value !== "";
  }

  function adoptionState(frontmatter) {
    const project = hasAdoptionValue(frontmatter.adopted_project);
    const date = hasAdoptionValue(frontmatter.adopted_at);
    if (project && date) return "complete";
    if (project || date) return "partial";
    return isAdopted(frontmatter.status) ? "legacy" : "none";
  }

  function normalizeAdoptionDate(value) {
    if (typeof value !== "string" || value.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split("-").map(Number);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
      ? value : null;
  }

  return {
    normalizeStatus,
    statusLabel,
    statusOrder,
    isActive,
    isAdopted,
    isArchived,
    isStringArray,
    hasAdoptionValue,
    adoptionState,
    normalizeAdoptionDate
  };
})()
