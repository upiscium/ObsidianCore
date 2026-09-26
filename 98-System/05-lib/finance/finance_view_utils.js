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

  function normalizeMonth(value) {
    if (value?.toFormat) {
      const formatted = String(value.toFormat("yyyy-MM"));
      return /^\d{4}-\d{2}$/.test(formatted) ? formatted : null;
    }

    const raw = String(value ?? "").trim();
    return /^\d{4}-\d{2}$/.test(raw) ? raw : null;
  }

  function pageMonth(page) {
    return normalizeMonth(page?.file?.name);
  }

  function resolveTargetMonth(page, fallbackMonth = null) {
    return (
      normalizeMonth(page?.target_month) ??
      pageMonth(page) ??
      normalizeMonth(fallbackMonth)
    );
  }

  function aggregatePage(page) {
    const result = {
      incomeTotal: 0,
      expenseTotal: 0,
      incomeRows: [],
      expenseRows: []
    };

    if (!page?.file?.lists) return result;

    const incomeTotals = Object.create(null);
    const expenseTotals = Object.create(null);

    for (const item of page.file.lists) {
      const income = normalizeAmount(item.income);
      if (income !== null && income > 0) {
        result.incomeTotal += income;
        addCategoryTotal(incomeTotals, item.cat, income);
      }

      const expense = normalizeAmount(item.expense);
      if (expense !== null && expense > 0) {
        result.expenseTotal += expense;
        addCategoryTotal(expenseTotals, item.cat, expense);
      }
    }

    result.incomeRows = toRows(incomeTotals, result.incomeTotal);
    result.expenseRows = toRows(expenseTotals, result.expenseTotal);
    return result;
  }

  function summarizeMonth(pages, targetMonth, initialBalance = 0) {
    if (!/^\d{4}-\d{2}$/.test(String(targetMonth ?? ""))) {
      throw new Error("targetMonth must be YYYY-MM");
    }

    let incomeTotal = 0;
    let expenseTotal = 0;
    let monthEndBalance = Number(initialBalance) || 0;
    let pageExists = false;

    const ordered = Array.from(pages ?? [])
      .map(page => ({ page, month: pageMonth(page) }))
      .filter(item => item.month !== null)
      .sort((a, b) => a.month.localeCompare(b.month));

    for (const { page, month } of ordered) {
      if (month > targetMonth) break;
      const aggregate = aggregatePage(page);
      monthEndBalance += aggregate.incomeTotal - aggregate.expenseTotal;

      if (month === targetMonth) {
        pageExists = true;
        incomeTotal = aggregate.incomeTotal;
        expenseTotal = aggregate.expenseTotal;
      }
    }

    return {
      targetMonth,
      pageExists,
      incomeTotal,
      expenseTotal,
      monthlyBalance: incomeTotal - expenseTotal,
      monthEndBalance
    };
  }

  return Object.freeze({
    formatYen,
    normalizeAmount,
    normalizeDate,
    addCategoryTotal,
    toRows,
    normalizeMonth,
    pageMonth,
    resolveTargetMonth,
    aggregatePage,
    summarizeMonth,
  });
})())
