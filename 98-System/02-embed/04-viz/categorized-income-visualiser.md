```dvjs
const page = dv.current();

const incomes = page.file.lists
  .where(item => item.date && item.income && item.cat)
  .map(item => {
    const date =
      item.date?.toFormat
        ? item.date.toFormat("yyyy-MM-dd")
        : String(item.date);

    return {
      date,
      amount: Number(item.income),
      cat: String(item.cat),
      memo: item.memo ? String(item.memo) : ""
    };
  })
  .where(item => !Number.isNaN(item.amount))
  .array();

function yen(value) {
  return `${value.toLocaleString()} 円`;
}

if (incomes.length === 0) {
  dv.paragraph("今月の収入データはまだありません。");
} else {
  const total = incomes.reduce((sum, item) => sum + item.amount, 0);

  const grouped = Object.values(
    incomes.reduce((acc, item) => {
      if (!acc[item.cat]) {
        acc[item.cat] = {
          cat: item.cat,
          total: 0,
          count: 0,
          items: []
        };
      }

      acc[item.cat].total += item.amount;
      acc[item.cat].count += 1;
      acc[item.cat].items.push(item);

      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total);

  dv.paragraph(`**収入合計:** ${yen(total)}`);

  dv.table(
    ["種別", "件数", "合計", "割合"],
    grouped.map(group => [
      group.cat,
      group.count,
      yen(group.total),
      `${((group.total / total) * 100).toFixed(1)}%`
    ])
  );

  dv.header(3, "収入明細");

  dv.table(
    ["日付", "種別", "金額", "メモ"],
    incomes
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(item => [
        item.date,
        item.cat,
        yen(item.amount),
        item.memo
      ])
  );
}
```
