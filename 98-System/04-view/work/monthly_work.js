async function loadExpression(path) {
  const source = await dv.io.load(path);
  if (!source) throw new Error(`Dataview library not found: ${path}`);
  return new Function(`"use strict"; return (${source});`)();
}

const S = await loadExpression("98-System/05-lib/shared/view_utils.js");
const workFactory = await loadExpression("98-System/05-lib/work/work_time_utils.js");
const W = workFactory(S);
const current = dv.current();
const targetMonth = /^\d{4}-\d{2}$/.test(current.file.name)
  ? current.file.name
  : moment().format("YYYY-MM");
const rows = W.rowsForMonth(current.file.lists ?? [], targetMonth);
const root = dv.container;

root.innerHTML = "";
root.classList.add("work-time-monthly");

if (rows.length === 0) {
  root.createEl("p", { text: "この月の勤務記録はありません．" });
} else {
  const table = root.createEl("table", { cls: "work-time-table" });
  const head = table.createEl("thead").createEl("tr");
  head.createEl("th", { text: "勤務日" });
  head.createEl("th", { text: "勤務時間" });

  const body = table.createEl("tbody");
  for (const row of rows) {
    const tr = body.createEl("tr");
    tr.createEl("td", { text: row.date });
    tr.createEl("td", { text: W.formatDuration(row.minutes) });
  }
}
