```dvjs
const monthlyFolder = "01-MonthlyNote";

const root = this.container.createEl("div", {
  cls: "daily-expense-summary-lite"
});

function getTargetDate() {
  const raw = dv.current().target_date;

  if (raw && raw.toFormat) {
    return raw.toFormat("yyyy-MM-dd");
  }

  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const fileName = dv.current().file.name;

  if (/^\d{4}-\d{2}-\d{2}$/.test(fileName)) {
    return fileName;
  }

  return moment().format("YYYY-MM-DD");
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

function getMonthlyPageByDate(date) {
  const m = moment(date, "YYYY-MM-DD", true);
  const year = m.format("YYYY");
  const month = m.format("YYYY-MM");

  return dv.page(`${monthlyFolder}/${year}/${month}`);
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  if (value.toFormat) {
    return value.toFormat("yyyy-MM-dd");
  }

  return String(value);
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

function getDailyExpenseData(targetDate) {
  const page = getMonthlyPageByDate(targetDate);

  const result = {
    targetDate,
    pageExists: !!page,
    total: 0,
    rows: []
  };

  if (!page?.file?.lists) {
    return result;
  }

  const totals = Object.create(null);

  for (const item of page.file.lists) {
    const itemDate = normalizeDate(item.date);

    if (itemDate !== targetDate) {
      continue;
    }

    const expense = normalizeAmount(item.expense);

    if (expense === null || expense <= 0) {
      continue;
    }

    result.total += expense;

    addCategoryTotal(
      totals,
      item.cat,
      expense
    );
  }

  result.rows = toRows(totals, result.total);

  return result;
}

const targetDate = getTargetDate();
const data = getDailyExpenseData(targetDate);

root.createEl("h3", {
  text: `${targetDate} の出費`
});

if (!data.pageExists) {
  root.createEl("p", {
    text: `⚠️ 対応するMonthly Noteが見つかりません．`
  });
} else {
  renderStackedBreakdown(
    root,
    "出費内訳",
    data.rows,
    data.total,
    "この日の出費記録はありません．",
    "household-expense"
  );
}
```
