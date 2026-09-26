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
  root.createEl("p", { text: `合計勤務時間: ${W.formatDuration(total)}` });
}
