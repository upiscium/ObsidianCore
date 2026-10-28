async function loadExpression(path) {
  const source = await dv.io.load(path);
  if (!source) throw new Error(`Dataview library not found: ${path}`);
  return new Function(`"use strict"; return (${source});`)();
}

const S = await loadExpression("98-System/05-lib/shared/view_utils.js");
const workFactory = await loadExpression("98-System/05-lib/work/work_time_utils.js");
const W = workFactory(S);
const current = dv.current();
const currentName = current?.file?.name ?? "";
const isMonthlyNote = /^\d{4}-\d{2}$/.test(currentName);
const month = isMonthlyNote ? currentName : moment().format("YYYY-MM");
const year = month.slice(0, 4);
const page = isMonthlyNote
  ? current
  : dv.page(`${W.monthlyFolder}/${year}/${month}`);
const root = dv.container;

root.innerHTML = "";
root.classList.add("work-time-dashboard");

if (!page?.file?.lists) {
  const scope = isMonthlyNote ? month : "今月";
  root.createEl("p", { text: `${scope}のMonthly Noteが見つかりません．` });
} else {
  const rows = W.rowsForMonth(page.file.lists, month);
  const total = W.totalMinutes(rows);
  const prefix = isMonthlyNote ? "" : "今月の";
  root.createEl("p", { text: `${prefix}勤務日数: ${rows.length}日` });
  root.createEl("p", { text: `${prefix}合計勤務時間: ${W.formatDuration(total)}` });

  if (isMonthlyNote) {
    const workplaces = W.workplaceTotalsForMonth(page.file.lists, month);
    if (workplaces.length > 0) {
      root.createEl("h4", { text: "勤務先別の勤務時間" });
      const table = root.createEl("table", { cls: "work-time-table" });
      const head = table.createEl("thead").createEl("tr");
      head.createEl("th", { text: "勤務先" });
      head.createEl("th", { text: "勤務日数" });
      head.createEl("th", { text: "勤務時間" });

      const body = table.createEl("tbody");
      for (const workplace of workplaces) {
        const tr = body.createEl("tr");
        tr.createEl("td", { text: workplace.workplace });
        tr.createEl("td", { text: `${workplace.days}日` });
        tr.createEl("td", { text: W.formatDuration(workplace.minutes) });
      }
    }
  }
}
