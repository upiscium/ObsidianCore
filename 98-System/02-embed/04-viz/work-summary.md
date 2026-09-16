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

const month = moment().format("YYYY-MM");
const year = moment().format("YYYY");
const page = dv.page(`${MONTHLY_FOLDER}/${year}/${month}`);
const root = this.container.createEl("div", { cls: "work-time-dashboard" });

if (!page?.file?.lists) {
  root.createEl("p", { text: "今月のMonthly Noteが見つかりません．" });
} else {
  const days = new Set();
  let total = 0;

  for (const item of page.file.lists) {
    const date = normalizeDate(item.date);
    if (!date || !date.startsWith(`${month}-`)) continue;
    if (String(item.workplace ?? "") !== WORKPLACE) continue;

    const minutes = normalizeMinutes(item.work_min);
    if (minutes === null) continue;

    days.add(date);
    total += minutes;
  }

  root.createEl("p", { text: `今月の勤務日数: ${days.size}日` });
  root.createEl("p", { text: `合計勤務時間: ${formatDuration(total)}` });
}
```
