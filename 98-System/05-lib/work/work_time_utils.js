({
  monthlyFolder: "01-MonthlyNote",
  workplace: "composition",

  normalizeDate(value) {
    if (!value) return null;
    if (value.toFormat) return value.toFormat("yyyy-MM-dd");
    return String(value);
  },

  normalizeMinutes(value) {
    if (value === undefined || value === null || value === "") return null;
    const minutes = Number(value);
    return Number.isInteger(minutes) && minutes > 0 ? minutes : null;
  },

  formatDuration(totalMinutes) {
    const total = Number(totalMinutes);
    if (!Number.isFinite(total) || total <= 0) return "0m";
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    if (hours && minutes) return `${hours}h ${minutes}m`;
    if (hours) return `${hours}h`;
    return `${minutes}m`;
  },

  recordsForDate(items, date) {
    let total = 0;
    let records = 0;

    for (const item of items ?? []) {
      if (this.normalizeDate(item.date) !== date) continue;
      if (String(item.workplace ?? "") !== this.workplace) continue;

      const minutes = this.normalizeMinutes(item.work_min);
      if (minutes === null) continue;

      total += minutes;
      records += 1;
    }

    return { total, records };
  },

  rowsForMonth(items, targetMonth) {
    const rowsByDate = new Map();

    for (const item of items ?? []) {
      const date = this.normalizeDate(item.date);
      if (!date || !date.startsWith(`${targetMonth}-`)) continue;
      if (String(item.workplace ?? "") !== this.workplace) continue;

      const minutes = this.normalizeMinutes(item.work_min);
      if (minutes === null) continue;

      rowsByDate.set(date, (rowsByDate.get(date) ?? 0) + minutes);
    }

    return [...rowsByDate.entries()]
      .map(([date, minutes]) => ({ date, minutes }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  totalMinutes(rows) {
    return (rows ?? []).reduce((sum, row) => sum + row.minutes, 0);
  }
})
