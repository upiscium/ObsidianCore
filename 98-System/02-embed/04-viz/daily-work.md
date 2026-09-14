```dvjs
const MONTHLY_FOLDER = "01-MonthlyNote";
const WORKPLACE = "composition";

function normalizeDate(value) {
  if (!value) return null;
  if (value.toFormat) return value.toFormat("yyyy-MM-dd");
  return String(value);
}

function normalizeMinutes(value) {
  if (value === undefined || value === null || value === "") return null;
  const minutes = Number(value);
  return Number.isInteger(minutes) && minutes > 0 ? minutes : null;
}

function formatDuration(totalMinutes) {
  const total = Number(totalMinutes);
  if (!Number.isFinite(total) || total <= 0) return "0m";
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
}

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
const monthlyPath = `${MONTHLY_FOLDER}/${dateMoment.format("YYYY")}/${dateMoment.format("YYYY-MM")}`;
const page = dv.page(monthlyPath);
const root = this.container.createEl("div", { cls: "work-time-daily" });

root.createEl("h3", { text: `${date} の勤務` });

if (!page?.file?.lists) {
  root.createEl("p", { text: "⚠️ 対応するMonthly Noteが見つかりません．" });
} else {
  let total = 0;
  let records = 0;

  for (const item of page.file.lists) {
    if (normalizeDate(item.date) !== date) continue;
    if (String(item.workplace ?? "") !== WORKPLACE) continue;

    const minutes = normalizeMinutes(item.work_min);
    if (minutes === null) continue;

    total += minutes;
    records += 1;
  }

  if (records === 0) {
    root.createEl("p", { text: "この日の勤務記録はありません．" });
  } else {
    root.createEl("p", {
      cls: "work-time-total",
      text: `勤務時間: ${formatDuration(total)}`
    });

    if (records > 1) {
      root.createEl("p", {
        cls: "work-time-record-count",
        text: `${records}件の記録を合算しています．`
      });
    }
  }
}
```
