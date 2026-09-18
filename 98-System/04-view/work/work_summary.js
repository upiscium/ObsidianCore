async function loadWorkLib() {
  const source = await dv.io.load("98-System/05-lib/work/work_time_utils.js");
  if (!source) throw new Error("Dataview library not found: 98-System/05-lib/work/work_time_utils.js");
  return new Function(`"use strict"; return (${source});`)();
}

const W = await loadWorkLib();
const month = moment().format("YYYY-MM");
const year = moment().format("YYYY");
const page = dv.page(`${W.monthlyFolder}/${year}/${month}`);
const root = dv.container;

root.innerHTML = "";
root.classList.add("work-time-dashboard");

if (!page?.file?.lists) {
  root.createEl("p", { text: "今月のMonthly Noteが見つかりません．" });
} else {
  const rows = W.rowsForMonth(page.file.lists, month);
  const total = W.totalMinutes(rows);
  root.createEl("p", { text: `今月の勤務日数: ${rows.length}日` });
  root.createEl("p", { text: `合計勤務時間: ${W.formatDuration(total)}` });
}
