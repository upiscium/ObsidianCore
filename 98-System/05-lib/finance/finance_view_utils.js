(S => (() => {
  if (!S || typeof S.normalizeDate !== "function") {
    throw new Error("finance_view_utils requires shared view utilities");
  }

  function formatYen(value) {
    const amount = Number(value);
    const sign = amount < 0 ? "-" : "";
    return `${sign}¥${Math.abs(amount).toLocaleString()}`;
  }

  function normalizeAmount(value) {
    if (value === undefined || value === null || value === "") {
      return null;
    }

    const amount = Number(
      String(value).replace(/[,\s円¥]/g, "")
    );

    return Number.isFinite(amount) ? amount : null;
  }

  function normalizeDate(value) {
    return S.normalizeDate(value);
  }

  function addCategoryTotal(totals, category, amount) {
    const key = category
      ? String(category)
      : "未分類";

    totals[key] = (totals[key] || 0) + amount;
  }

  function toRows(totals, total) {
    return Object.entries(totals)
      .map(([cat, sum]) => ({
        cat,
        sum,
        ratio: total > 0 ? sum / total : 0
      }))
      .sort((a, b) => b.sum - a.sum);
  }

  return Object.freeze({
    formatYen,
    normalizeAmount,
    normalizeDate,
    addCategoryTotal,
    toRows,
  });
})())
