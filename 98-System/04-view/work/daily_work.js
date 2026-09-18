async function loadWorkLib() {
  const source = await dv.io.load("98-System/05-lib/work/work_time_utils.js");
  if (!source) throw new Error("Dataview library not found: 98-System/05-lib/work/work_time_utils.js");
  return new Function(`"use strict"; return (${source});`)();
}

const W = await loadWorkLib();

function targetDate() {
  const raw = dv.current().target_date;
  if (raw?.toFormat) return raw.toFormat("yyyy-MM-dd");
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const fileName = dv.current().file.name;
  if (/^\d{4}-\d{2}-\d{2}$/.test(fileName)) return fileName;
  return moment().format("YYYY-MM-DD");
}

const date = targetDate();
const dateMoment = moment(date, "YYYY-MM-DD", true);
const monthlyPath = `${W.monthlyFolder}/${dateMoment.format("YYYY")}/${dateMoment.format("YYYY-MM")}`;
const page = dv.page(monthlyPath);
const root = dv.container;

root.innerHTML = "";
root.classList.add("work-time-daily");
root.createEl("h3", { text: `${date} の勤務` });

if (!page?.file?.lists) {
  root.createEl("p", { text: "⚠️ 対応するMonthly Noteが見つかりません．" });
} else {
  const { total, records } = W.recordsForDate(page.file.lists, date);

  if (records === 0) {
    root.createEl("p", { text: "この日の勤務記録はありません．" });
  } else {
    root.createEl("p", {
      cls: "work-time-total",
      text: `勤務時間: ${W.formatDuration(total)}`
    });

    if (records > 1) {
      root.createEl("p", {
        cls: "work-time-record-count",
        text: `${records}件の記録を合算しています．`
      });
    }
  }
}
