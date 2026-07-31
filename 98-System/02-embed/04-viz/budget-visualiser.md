```dvjs
const budgetLimit = 55000;
const dangerLimit = 50000;
const monthlyFolder = "01-MonthlyNote";

// 家計簿の記録開始時点の残高．
// 単純な収支累計だけでよければ 0．
const initialBalance = 0;

// false: 現在のタブで開く
// true : 新しいタブで開く
const openInNewTab = false;

const root = this.container.createEl("div", {
  cls: "household-dashboard-lite"
});

// 月ごとの集計キャッシュ
const monthCache = new Map();

// Monthly Note一覧のキャッシュ
let monthlyPagesCache = null;

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
  return moment(month, "YYYY-MM")
    .add(diff, "months")
    .format("YYYY-MM");
}

function formatYen(value) {
  const amount = Number(value);
  const sign = amount < 0 ? "-" : "";

  return `${sign}¥${Math.abs(amount).toLocaleString()}`;
}

function normalizeAmount(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const amount = Number(
    String(value).replace(/[,\s円¥]/g, "")
  );

  return Number.isFinite(amount)
    ? amount
    : null;
}

function getPageMonth(page) {
  if (!page?.file?.name) {
    return null;
  }

  const name = String(page.file.name);

  return /^\d{4}-\d{2}$/.test(name)
    ? name
    : null;
}

function getTargetPath(targetMonth) {
  const targetYear = targetMonth.substring(0, 4);

  return `${monthlyFolder}/${targetYear}/${targetMonth}`;
}

function getTargetFilePath(targetMonth) {
  return `${getTargetPath(targetMonth)}.md`;
}

function getMonthlyPages() {
  if (monthlyPagesCache !== null) {
    return monthlyPagesCache;
  }

  monthlyPagesCache = dv
    .pages(`"${monthlyFolder}"`)
    .where(page => getPageMonth(page) !== null)
    .array()
    .sort((a, b) => {
      return getPageMonth(a).localeCompare(
        getPageMonth(b)
      );
    });

  return monthlyPagesCache;
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

function aggregatePage(page) {
  const result = {
    incomeTotal: 0,
    expenseTotal: 0,
    incomeRows: [],
    expenseRows: []
  };

  if (!page?.file?.lists) {
    return result;
  }

  const incomeTotals = Object.create(null);
  const expenseTotals = Object.create(null);

  for (const item of page.file.lists) {
    const income = normalizeAmount(item.income);

    if (income !== null && income > 0) {
      result.incomeTotal += income;

      addCategoryTotal(
        incomeTotals,
        item.cat,
        income
      );
    }

    const expense = normalizeAmount(item.expense);

    if (expense !== null && expense > 0) {
      result.expenseTotal += expense;

      addCategoryTotal(
        expenseTotals,
        item.cat,
        expense
      );
    }
  }

  result.incomeRows = toRows(
    incomeTotals,
    result.incomeTotal
  );

  result.expenseRows = toRows(
    expenseTotals,
    result.expenseTotal
  );

  return result;
}

function getMonthData(targetMonth) {
  if (monthCache.has(targetMonth)) {
    return monthCache.get(targetMonth);
  }

  const targetPath = getTargetPath(targetMonth);
  const page = dv.page(targetPath);
  const aggregate = aggregatePage(page);

  const result = {
    targetMonth,
    targetPath,
    pageExists: !!page,

    incomeTotal: aggregate.incomeTotal,
    expenseTotal: aggregate.expenseTotal,

    monthlyBalance:
      aggregate.incomeTotal -
      aggregate.expenseTotal,

    incomeRows: aggregate.incomeRows,
    expenseRows: aggregate.expenseRows
  };

  monthCache.set(targetMonth, result);

  return result;
}

/**
 * 対象月より前の全収支から前月繰越を計算する．
 *
 * 前月繰越 =
 * 初期残高
 * + 過去の収入
 * - 過去の出費
 */
function getCarryoverBefore(targetMonth) {
  let incomeTotal = 0;
  let expenseTotal = 0;
  let monthCount = 0;

  for (const page of getMonthlyPages()) {
    const pageMonth = getPageMonth(page);

    if (!pageMonth || pageMonth >= targetMonth) {
      continue;
    }

    const data = getMonthData(pageMonth);

    incomeTotal += data.incomeTotal;
    expenseTotal += data.expenseTotal;
    monthCount += 1;
  }

  return {
    initialBalance,
    incomeTotal,
    expenseTotal,
    monthCount,

    balance:
      initialBalance +
      incomeTotal -
      expenseTotal
  };
}

/**
 * 対象月末時点の残高を計算する．
 */
function getBalanceThrough(targetMonth) {
  const month = getMonthData(targetMonth);
  const carryover = getCarryoverBefore(targetMonth);

  return {
    carryover: carryover.balance,

    balance:
      carryover.balance +
      month.monthlyBalance
  };
}

/**
 * 全Monthly Noteを対象に通算残高を計算する．
 */
function getAllTimeData() {
  let incomeTotal = 0;
  let expenseTotal = 0;
  let monthCount = 0;

  for (const page of getMonthlyPages()) {
    const pageMonth = getPageMonth(page);

    if (!pageMonth) {
      continue;
    }

    const data = getMonthData(pageMonth);

    incomeTotal += data.incomeTotal;
    expenseTotal += data.expenseTotal;
    monthCount += 1;
  }

  return {
    incomeTotal,
    expenseTotal,
    monthCount,

    balance:
      initialBalance +
      incomeTotal -
      expenseTotal
  };
}

function getBalanceClass(value) {
  if (value < 0) {
    return "household-danger";
  }

  if (value === 0) {
    return "household-warning";
  }

  return "household-income";
}

function createSummaryCard(
  parent,
  label,
  value,
  cls,
  subText = ""
) {
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

function renderStackedBreakdown(
  parent,
  title,
  rows,
  total,
  emptyMessage,
  kindClass
) {
  const section = parent.createEl("div", {
    cls: `household-stacked-section ${kindClass}`
  });

  section.createEl("h4", {
    text: title
  });

  if (!rows || rows.length === 0 || total <= 0) {
    section.createEl("p", {
      cls: "household-stacked-empty",
      text: emptyMessage
    });

    return;
  }

  const track = section.createEl("div", {
    cls: "household-stacked-bar-track"
  });

  const bar = track.createEl("div", {
    cls: "household-stacked-bar"
  });

  for (const row of rows) {
    const percent = row.ratio * 100;

    const segment = bar.createEl("div", {
      cls: "household-stacked-segment",
      attr: {
        style: `width: ${percent.toFixed(3)}%;`,
        title:
          `${row.cat}: ${formatYen(row.sum)} / ` +
          `${percent.toFixed(1)}%`
      }
    });

    if (percent >= 7) {
      segment.createEl("span", {
        cls: "household-stacked-segment-label",
        text: `${percent.toFixed(0)}%`
      });
    }
  }

  const list = section.createEl("div", {
    cls: "household-stacked-list"
  });

  for (const row of rows) {
    const percent = row.ratio * 100;

    const line = list.createEl("div", {
      cls: "household-stacked-list-row"
    });

    line.createEl("span", {
      cls: "household-stacked-list-cat",
      text: row.cat
    });

    line.createEl("span", {
      cls: "household-stacked-list-amount",
      text: formatYen(row.sum)
    });

    line.createEl("span", {
      cls: "household-stacked-list-ratio",
      text: `${percent.toFixed(1)}%`
    });
  }

  section.createEl("p", {
    cls: "household-stacked-total",
    text: `合計: ${formatYen(total)}`
  });
}

async function openMonthlyNote(targetMonth) {
  const targetFilePath = getTargetFilePath(targetMonth);

  const file = app.vault.getAbstractFileByPath(
    targetFilePath
  );

  if (!file) {
    new Notice(
      `Monthly Noteが見つかりません: ${targetFilePath}`
    );
    return;
  }

  const leaf = openInNewTab
    ? app.workspace.getLeaf("tab")
    : app.workspace.getLeaf(false);

  await leaf.openFile(file);
}

function render(targetMonth) {
  root.empty();

  const prevMonth = shiftMonth(targetMonth, -1);
  const nextMonth = shiftMonth(targetMonth, 1);

  const data = getMonthData(targetMonth);
  const balanceData = getBalanceThrough(targetMonth);
  const allTime = getAllTimeData();

  // ========================================================
  // 月ナビゲーション
  // ========================================================

  const nav = root.createEl("div", {
    cls: "household-nav"
  });

  const prevButton = nav.createEl("button", {
    text: `◀ ${prevMonth}`
  });

  prevButton.onclick = () => {
    render(prevMonth);
  };

  const center = nav.createEl("div", {
    cls: "household-nav-center"
  });

  center.createEl("strong", {
    text: targetMonth
  });

  const openButton = center.createEl("button", {
    text: "Monthly Noteを開く",
    cls: "household-open-note-button"
  });

  openButton.onclick = async () => {
    await openMonthlyNote(targetMonth);
  };

  const nextButton = nav.createEl("button", {
    text: `${nextMonth} ▶`
  });

  nextButton.onclick = () => {
    render(nextMonth);
  };

  // ========================================================
  // タイトル
  // ========================================================

  root.createEl("h3", {
    text: `${targetMonth} の家計簿`
  });

  // ========================================================
  // Monthly Note存在確認
  // ========================================================

  if (!data.pageExists) {
    root.createEl("p", {
      text:
        `⚠️ 対象のMonthly Note ` +
        `(${data.targetPath}) が見つかりません．`
    });

    return;
  }

  // ========================================================
  // 出費アラート
  // ========================================================

  let expenseClass = "household-normal";
  let expenseAlert = "";

  if (data.expenseTotal > dangerLimit) {
    expenseClass = "household-danger";
    expenseAlert = "🚨 予算超過";
  } else if (data.expenseTotal > budgetLimit) {
    expenseClass = "household-warning";
    expenseAlert = "⚠️ 予算上限警告";
  }

  // ========================================================
  // サマリー
  // ========================================================

  const summary = root.createEl("div", {
    cls:
      "household-summary " +
      "household-summary-extended"
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
    data.monthlyBalance >= 0
      ? "黒字"
      : "赤字"
  );

  createSummaryCard(
    summary,
    "前月繰越",
    balanceData.carryover,
    getBalanceClass(balanceData.carryover),
    "過去月から自動計算"
  );

  createSummaryCard(
    summary,
    "月末残高",
    balanceData.balance,
    getBalanceClass(balanceData.balance),
    "前月繰越 + 今月収支"
  );

  createSummaryCard(
    summary,
    "全期間残高",
    allTime.balance,
    getBalanceClass(allTime.balance),
    `${allTime.monthCount}か月分`
  );

  // ========================================================
  // 記録なし
  // ========================================================

  if (
    data.incomeRows.length === 0 &&
    data.expenseRows.length === 0
  ) {
    root.createEl("p", {
      text:
        `ℹ️ ${targetMonth} の収入・出費記録はありません．`
    });

    return;
  }

  // ========================================================
  // カテゴリ別表示
  // ========================================================

    renderStackedBreakdown(
      root,
      "収入カテゴリ",
      data.incomeRows,
      data.incomeTotal,
      "今月の収入記録はありません．",
      "household-income"
    );

    renderStackedBreakdown(
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
