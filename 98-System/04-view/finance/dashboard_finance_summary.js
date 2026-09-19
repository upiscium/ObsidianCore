async function loadExpression(path) {
  const source = await dv.io.load(path);
  if (!source) throw new Error(`Dataview library not found: ${path}`);
  return new Function(`"use strict"; return (${source});`)();
}

const V = await loadExpression("98-System/05-lib/shared/view_utils.js");
const financeFactory = await loadExpression("98-System/05-lib/finance/finance_view_utils.js");
const F = financeFactory(V);

const monthlyFolder = "01-MonthlyNote";
const initialBalance = 0;
const targetMonth = moment().format("YYYY-MM");
const pages = dv
  .pages(`"${monthlyFolder}"`)
  .where(page => F.pageMonth(page) !== null)
  .array();

const data = F.summarizeMonth(pages, targetMonth, initialBalance);
const root = dv.container.createEl("div", {
  cls: "household-dashboard-lite"
});

function balanceClass(value) {
  if (value < 0) return "household-danger";
  if (value === 0) return "household-warning";
  return "household-income";
}

function card(label, value, cls) {
  const item = root.createEl("div", {
    cls: `household-summary-card ${cls}`
  });
  item.createEl("div", {
    cls: "household-summary-label",
    text: label
  });
  item.createEl("div", {
    cls: "household-summary-value",
    text: F.formatYen(value)
  });
}

const summary = root.createEl("div", {
  cls: "household-summary household-summary-extended"
});

function summaryCard(label, value, cls) {
  const item = summary.createEl("div", {
    cls: `household-summary-card ${cls}`
  });
  item.createEl("div", {
    cls: "household-summary-label",
    text: label
  });
  item.createEl("div", {
    cls: "household-summary-value",
    text: F.formatYen(value)
  });
}

summaryCard("今月収入", data.incomeTotal, "household-income");
summaryCard("今月支出", data.expenseTotal, "household-expense");
summaryCard("今月収支", data.monthlyBalance, balanceClass(data.monthlyBalance));
summaryCard("月末残高", data.monthEndBalance, balanceClass(data.monthEndBalance));

if (!data.pageExists) {
  root.createEl("p", {
    cls: "household-summary-sub",
    text: `${targetMonth} のMonthly Noteはまだありません。`
  });
}
