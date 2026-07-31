```dvjs
const monthlyFolder = "01-MonthlyNote";

const root = this.container.createEl("div", {
  cls: "household-stacked-section household-expense"
});

function getTargetMonth() {
  const raw = dv.current().target_month;

  if (raw && raw.toFormat) {
    return raw.toFormat("yyyy-MM");
  }

  if (typeof raw === "string" && /^\d{4}-\d{2}$/.test(raw)) {
    return raw;
  }

  const fileName = dv.current().file.name;

  if (/^\d{4}-\d{2}$/.test(fileName)) {
    return fileName;
  }

  return moment().format("YYYY-MM");
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
  if (!value) {
    return null;
  }

  if (value.toFormat) {
    return value.toFormat("yyyy-MM-dd");
  }

  return String(value);
}

function getTargetPath(targetMonth) {
  const year = targetMonth.substring(0, 4);

  return `${monthlyFolder}/${year}/${targetMonth}`;
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

function getPerDayExpenseData(targetMonth) {
  const page = dv.page(getTargetPath(targetMonth));

  const result = {
    targetMonth,
    pageExists: !!page,
    days: [],
    maxDailyTotal: 0,
    monthTotal: 0
  };

  if (!page?.file?.lists) {
    return result;
  }

  const dayMap = Object.create(null);

  for (const item of page.file.lists) {
    const date = normalizeDate(item.date);

    if (!date || !date.startsWith(targetMonth)) {
      continue;
    }

    const expense = normalizeAmount(item.expense);

    if (expense === null || expense <= 0) {
      continue;
    }

    if (!dayMap[date]) {
      dayMap[date] = {
        date,
        total: 0,
        totals: Object.create(null),
        rows: []
      };
    }

    dayMap[date].total += expense;
    result.monthTotal += expense;

    addCategoryTotal(
      dayMap[date].totals,
      item.cat,
      expense
    );
  }

  result.days = Object.values(dayMap)
    .map(day => {
      day.rows = toRows(day.totals, day.total);
      return day;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  result.maxDailyTotal = result.days.reduce(
    (max, day) => Math.max(max, day.total),
    0
  );

  return result;
}

function renderPerDayGraph(data) {
  root.empty();

  root.createEl("h4", {
    text: `${data.targetMonth} 日別出費`
  });

  if (!data.pageExists) {
    root.createEl("p", {
      cls: "household-stacked-empty",
      text: "対象のMonthly Noteが見つかりません．"
    });

    return;
  }

  if (data.days.length === 0 || data.monthTotal <= 0) {
    root.createEl("p", {
      cls: "household-stacked-empty",
      text: "この月の出費記録はありません．"
    });

    return;
  }

  const list = root.createEl("div", {
    cls: "household-per-day-list"
  });

  for (const day of data.days) {
    const item = list.createEl("div", {
      cls: "household-per-day-item"
    });

    const header = item.createEl("div", {
      cls: "household-per-day-header"
    });

    header.createEl("span", {
      cls: "household-per-day-date",
      text: day.date
    });

    header.createEl("span", {
      cls: "household-per-day-total",
      text:
        `${formatYen(day.total)} / ` +
        `月合計の ${((day.total / data.monthTotal) * 100).toFixed(1)}%`
    });

    const track = item.createEl("div", {
      cls: "household-per-day-bar-track"
    });

    const barWidth =
      data.maxDailyTotal > 0
        ? (day.total / data.maxDailyTotal) * 100
        : 0;

    const bar = track.createEl("div", {
      cls: "household-per-day-bar",
      attr: {
        style: `width: ${barWidth.toFixed(3)}%;`
      }
    });

    for (const row of day.rows) {
      const percent = row.ratio * 100;

      const segment = bar.createEl("div", {
        cls: "household-stacked-segment",
        attr: {
          style: `width: ${percent.toFixed(3)}%;`,
          title:
            `${day.date} ${row.cat}: ` +
            `${formatYen(row.sum)} / ${percent.toFixed(1)}%`
        }
      });

      if (percent >= 12) {
        segment.createEl("span", {
          cls: "household-stacked-segment-label",
          text: `${percent.toFixed(0)}%`
        });
      }
    }

    const amountList = item.createEl("div", {
      cls: "household-per-day-amount-list"
    });

    for (const row of day.rows) {
      amountList.createEl("span", {
        cls: "household-per-day-amount-item",
        text:
          `${row.cat}: ${formatYen(row.sum)} ` +
          `(${(row.ratio * 100).toFixed(1)}%)`
      });
    }
  }

  root.createEl("p", {
    cls: "household-stacked-total",
    text: `月合計: ${formatYen(data.monthTotal)}`
  });
}

const targetMonth = getTargetMonth();
const data = getPerDayExpenseData(targetMonth);

renderPerDayGraph(data);
```
