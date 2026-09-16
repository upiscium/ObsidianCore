```dvjs
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

const current = dv.current();
const targetMonth = /^\d{4}-\d{2}$/.test(current.file.name)
  ? current.file.name
  : moment().format("YYYY-MM");
const rowsByDate = new Map();

for (const item of current.file.lists ?? []) {
  const date = normalizeDate(item.date);
  if (!date || !date.startsWith(`${targetMonth}-`)) continue;
  if (String(item.workplace ?? "") !== WORKPLACE) continue;

  const minutes = normalizeMinutes(item.work_min);
  if (minutes === null) continue;

  rowsByDate.set(date, (rowsByDate.get(date) ?? 0) + minutes);
}

const rows = [...rowsByDate.entries()]
  .map(([date, minutes]) => ({ date, minutes }))
  .sort((a, b) => a.date.localeCompare(b.date));
const total = rows.reduce((sum, row) => sum + row.minutes, 0);
const root = this.container.createEl("div", { cls: "work-time-monthly" });

const summary = root.createEl("div", { cls: "work-time-summary" });
summary.createEl("p", { text: `勤務日数: ${rows.length}日` });
summary.createEl("p", { text: `合計勤務時間: ${formatDuration(total)}` });

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
    tr.createEl("td", { text: formatDuration(row.minutes) });
  }
}
```
