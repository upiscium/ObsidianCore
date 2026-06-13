```dvjs
const budgetLimit = 30000;
const dangerLimit = 40000;
const monthlyFolder = "01-MonthlyNote";

const root = this.container.createEl("div", {
  cls: "household-dashboard-lite"
});

const cache = new Map();
let cumulativeCache = null;

function getInitialMonth() {
  const raw = dv.current().target_month;

  if (raw && raw.toFormat) {
    return raw.toFormat("yyyy-MM");
  }

  if (typeof raw === "string" && /^\d{4}-\d{2}$/.test(raw)) {
    return raw;
  }

  return moment().format("YYYY-MM");
}

function shiftMonth(month, diff) {
  return moment(month, "YYYY-MM").add(diff, "months").format("YYYY-MM");
}

function formatYen(value) {
  const n = Number(value);
  const sign = n < 0 ? "-" : "";
  return `${sign}¥${Math.abs(n).toLocaleString()}`;
}

function normalizeAmount(value) {
  const amount = Number(String(value).replace(/[,\s円¥]/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

function getCarryover(page) {
  if (!page || page.carryover === undefined || page.carryover === null) {
    return 0;
  }

  const amount = normalizeAmount(page.carryover);
  return amount === null ? 0 : amount;
}

function addCategoryTotal(totals, cat, amount) {
  const key = cat ? String(cat) : "未分類";
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

function getMonthData(targetMonth) {
  if (cache.has(targetMonth)) {
    return cache.get(targetMonth);
  }

  const targetYear = targetMonth.substring(0, 4);
  const targetPath = `${monthlyFolder}/${targetYear}/${targetMonth}`;
  const page = dv.page(targetPath);

  const result = {
    targetMonth,
    targetPath,
    pageExists: !!page,
    hasLists: !!(page && page.file && page.file.lists),

    carryover: 0,
    incomeTotal: 0,
    expenseTotal: 0,
    monthlyBalance: 0,
    balanceWithCarryover: 0,

    incomeRows: [],
    expenseRows: []
  };

  if (!page) {
    cache.set(targetMonth, result);
    return result;
  }

  result.carryover = getCarryover(page);

  if (!page.file || !page.file.lists) {
    result.monthlyBalance = result.incomeTotal - result.expenseTotal;
    result.balanceWithCarryover = result.carryover + result.monthlyBalance;
    cache.set(targetMonth, result);
    return result;
  }

  const incomeTotals = Object.create(null);
  const expenseTotals = Object.create(null);

  for (const item of page.file.lists) {
    if (item.income) {
      const amount = normalizeAmount(item.income);
      if (amount !== null && amount > 0) {
        const cat = item.cat || "未分類";
        addCategoryTotal(incomeTotals, cat, amount);
        result.incomeTotal += amount;
      }
    }

    if (item.expense) {
      const amount = normalizeAmount(item.expense);
      if (amount !== null && amount > 0) {
        const cat = item.cat || "未分類";
        addCategoryTotal(expenseTotals, cat, amount);
        result.expenseTotal += amount;
      }
    }
  }

  result.monthlyBalance = result.incomeTotal - result.expenseTotal;
  result.balanceWithCarryover = result.carryover + result.monthlyBalance;

  result.incomeRows = toRows(incomeTotals, result.incomeTotal);
  result.expenseRows = toRows(expenseTotals, result.expenseTotal);

  cache.set(targetMonth, result);
  return result;
}

function getCumulativeData() {
  if (cumulativeCache) {
    return cumulativeCache;
  }

  const pages = dv.pages(`"${monthlyFolder}"`)
    .where(p => p.file && p.file.path && /^\d{4}-\d{2}$/.test(p.file.name))
    .array();

  const result = {
    incomeTotal: 0,
    expenseTotal: 0,
    balance: 0,
    monthCount: pages.length
  };

  for (const page of pages) {
    if (!page.file || !page.file.lists) continue;

    for (const item of page.file.lists) {
      if (item.income) {
        const amount = normalizeAmount(item.income);
        if (amount !== null && amount > 0) {
          result.incomeTotal += amount;
        }
      }

      if (item.expense) {
        const amount = normalizeAmount(item.expense);
        if (amount !== null && amount > 0) {
          result.expenseTotal += amount;
        }
      }
    }
  }

  result.balance = result.incomeTotal - result.expenseTotal;
  cumulativeCache = result;
  return result;
}

function createSummaryCard(parent, label, value, cls, subText = "") {
  const card = parent.createEl("div", {
    cls: `household-summary-card ${cls}`
  });

  card.createEl("div", {
    cls: "household-summary-label",
    text: label
  });

  card.createEl("div", {
    cls: "household-summary-value",
    text: formatYen(value)
  });

  if (subText) {
    card.createEl("div", {
      cls: "household-summary-sub",
      text: subText
    });
  }

  return card;
}

function getBalanceClass(value) {
  if (value < 0) return "household-danger";
  if (value === 0) return "household-warning";
  return "household-normal";
}

function renderCategoryBars(parent, title, rows, total, emptyMessage, kindClass) {
  const section = parent.createEl("div", {
    cls: `household-section ${kindClass}`
  });

  section.createEl("h4", {
    text: title
  });

  if (rows.length === 0) {
    section.createEl("p", {
      text: emptyMessage
    });
    return;
  }

  const list = section.createEl("div", {
    cls: "household-category-list"
  });

  for (const row of rows) {
    const item = list.createEl("div", {
      cls: "household-category-item"
    });

    const header = item.createEl("div", {
      cls: "household-category-header"
    });

    header.createEl("span", {
      text: row.cat
    });

    header.createEl("span", {
      text: `${formatYen(row.sum)} / ${(row.ratio * 100).toFixed(1)}%`
    });

    const barOuter = item.createEl("div", {
      cls: "household-bar-outer"
    });

    barOuter.createEl("div", {
      cls: `household-bar-inner ${kindClass}`,
      attr: {
        style: `width: ${(row.ratio * 100).toFixed(1)}%;`
      }
    });
  }
}

function render(targetMonth) {
  root.empty();

  const prevMonth = shiftMonth(targetMonth, -1);
  const nextMonth = shiftMonth(targetMonth, 1);
  const data = getMonthData(targetMonth);
  const cumulative = getCumulativeData();

  const nav = root.createEl("div", {
    cls: "household-nav"
  });

  const prevBtn = nav.createEl("button", {
    text: `◀ ${prevMonth}`
  });
  prevBtn.onclick = () => render(prevMonth);

  nav.createEl("strong", {
    text: targetMonth
  });

  const nextBtn = nav.createEl("button", {
    text: `${nextMonth} ▶`
  });
  nextBtn.onclick = () => render(nextMonth);

  root.createEl("h3", {
    text: `${targetMonth} の家計簿`
  });

  if (!data.pageExists) {
    root.createEl("p", {
      text: `⚠️ 対象のMonthly Note (${data.targetPath}) が見つかりません．`
    });
    return;
  }

  let expenseClass = "household-normal";
  let expenseAlert = "";

  if (data.expenseTotal > dangerLimit) {
    expenseClass = "household-danger";
    expenseAlert = "🚨 予算超過";
  } else if (data.expenseTotal > budgetLimit) {
    expenseClass = "household-warning";
    expenseAlert = "⚠️ 予算上限警告";
  }

  const summary = root.createEl("div", {
    cls: "household-summary household-summary-extended"
  });

  createSummaryCard(
    summary,
    "今月収入",
    data.incomeTotal,
    "household-income"
  );

  createSummaryCard(
    summary,
    "今月出費",
    data.expenseTotal,
    expenseClass,
    expenseAlert
  );

  createSummaryCard(
    summary,
    "今月収支",
    data.monthlyBalance,
    getBalanceClass(data.monthlyBalance),
    data.monthlyBalance >= 0 ? "黒字" : "赤字"
  );

  createSummaryCard(
    summary,
    "前月繰越",
    data.carryover,
    getBalanceClass(data.carryover),
    "frontmatter: carryover"
  );

  createSummaryCard(
    summary,
    "繰越込み残高",
    data.balanceWithCarryover,
    getBalanceClass(data.balanceWithCarryover),
    "前月繰越 + 今月収支"
  );

  createSummaryCard(
    summary,
    "通算収支",
    cumulative.balance,
    getBalanceClass(cumulative.balance),
    `${cumulative.monthCount}か月分`
  );

  if (data.incomeRows.length === 0 && data.expenseRows.length === 0) {
    root.createEl("p", {
      text: `ℹ️ ${targetMonth} の収入・出費記録はありません．`
    });
    return;
  }

  renderCategoryBars(
    root,
    "収入カテゴリ",
    data.incomeRows,
    data.incomeTotal,
    "今月の収入記録はありません．",
    "household-income"
  );

  renderCategoryBars(
    root,
    "出費カテゴリ",
    data.expenseRows,
    data.expenseTotal,
    "今月の出費記録はありません．",
    "household-expense"
  );
}

render(getInitialMonth());
```
