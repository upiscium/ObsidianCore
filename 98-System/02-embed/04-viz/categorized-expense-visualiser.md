```dvjs
const page = dv.current();

const items = page.file.lists
  .where(item => item.date && item.expense && item.cat)
  .map(item => {
    const date =
      item.date?.toFormat
        ? item.date.toFormat("yyyy-MM-dd")
        : String(item.date);

    return {
      date,
      expense: Number(item.expense),
      cat: String(item.cat),
      memo: item.memo ? String(item.memo) : ""
    };
  })
  .where(item => !Number.isNaN(item.expense))
  .array();

const root = dv.container;
root.innerHTML = "";

if (items.length === 0) {
  root.createEl("p", { text: "今月の支出データはまだありません。" });
} else {
  const categories = [...new Set(items.map(item => item.cat))]
    .sort((a, b) => a.localeCompare(b, "ja"));

  const control = root.createEl("div", {
    cls: "monthly-expense-filter-control"
  });

  control.createEl("span", {
    text: "表示する種別: "
  });

  const select = control.createEl("select");

  select.createEl("option", {
    text: "すべて",
    value: "__ALL__"
  });

  for (const cat of categories) {
    select.createEl("option", {
      text: cat,
      value: cat
    });
  }

  const result = root.createEl("div", {
    cls: "monthly-expense-filter-result"
  });

  function yen(value) {
    return `${value.toLocaleString()} 円`;
  }

  function createTable(parent, headers, rows) {
    const table = parent.createEl("table");

    const thead = table.createEl("thead");
    const headerRow = thead.createEl("tr");

    for (const header of headers) {
      headerRow.createEl("th", { text: header });
    }

    const tbody = table.createEl("tbody");

    for (const row of rows) {
      const tr = tbody.createEl("tr");

      for (const cell of row) {
        tr.createEl("td", { text: String(cell) });
      }
    }

    return table;
  }

  function render(selectedCat) {
    result.innerHTML = "";

    const filteredItems =
      selectedCat === "__ALL__"
        ? items
        : items.filter(item => item.cat === selectedCat);

    const total = filteredItems.reduce((sum, item) => sum + item.expense, 0);

    const grouped = Object.values(
      filteredItems.reduce((acc, item) => {
        if (!acc[item.cat]) {
          acc[item.cat] = {
            cat: item.cat,
            total: 0,
            count: 0
          };
        }

        acc[item.cat].total += item.expense;
        acc[item.cat].count += 1;

        return acc;
      }, {})
    ).sort((a, b) => b.total - a.total);

    result.createEl("p", {
      text: `表示中の合計: ${yen(total)}`
    });

    createTable(
      result,
      ["種別", "件数", "合計"],
      grouped.map(group => [
        group.cat,
        group.count,
        yen(group.total)
      ])
    );

    result.createEl("h3", {
      text: "明細"
    });

    createTable(
      result,
      ["日付", "種別", "金額", "メモ"],
      filteredItems
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(item => [
          item.date,
          item.cat,
          yen(item.expense),
          item.memo
        ])
    );
  }

  select.addEventListener("change", () => {
    render(select.value);
  });

  render("__ALL__");
}
```
