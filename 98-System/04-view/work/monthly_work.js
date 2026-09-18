async function loadWorkLib() {
  const source = await dv.io.load("98-System/05-lib/work/work_time_utils.js");
  if (!source) throw new Error("Dataview library not found: 98-System/05-lib/work/work_time_utils.js");
  return new Function(`"use strict"; return (${source});`)();
}

const W = await loadWorkLib();
const current = dv.current();
const targetMonth = /^\d{4}-\d{2}$/.test(current.file.name)
  ? current.file.name
  : moment().format("YYYY-MM");
const rows = W.rowsForMonth(current.file.lists ?? [], targetMonth);
const total = W.totalMinutes(rows);
const root = dv.container;

root.innerHTML = "";
root.classList.add("work-time-monthly");

const summary = root.createEl("div", { cls: "work-time-summary" });
summary.createEl("p", { text: `勤務日数: ${rows.length}日` });
summary.createEl("p", { text: `合計勤務時間: ${W.formatDuration(total)}` });

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
