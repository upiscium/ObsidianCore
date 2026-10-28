(S => {
  if (!S || typeof S.normalizeDate !== "function") {
    throw new Error("work_time_utils requires shared view utilities");
  }

  function normalizeMinutes(value) {
    if (value === undefined || value === null || value === "") return null;
    const minutes = Number(value);
    return Number.isInteger(minutes) && minutes > 0 ? minutes : null;
  }

  function normalizeWorkplace(value) {
    return String(value ?? "").trim() || "未指定";
  }

  function monthEntries(items, targetMonth) {
    const entries = [];
    for (const item of items ?? []) {
      const date = S.normalizeDate(item.date);
      if (!date || !date.startsWith(targetMonth + "-")) continue;

      const minutes = normalizeMinutes(item.work_min);
      if (minutes === null) continue;

      entries.push({ date, workplace: normalizeWorkplace(item.workplace), minutes });
    }
    return entries;
  }

  return {
    monthlyFolder: "01-MonthlyNote",

    normalizeDate(value) {
      return S.normalizeDate(value);
    },

    normalizeMinutes,
    normalizeWorkplace,

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

        const minutes = this.normalizeMinutes(item.work_min);
        if (minutes === null) continue;

        total += minutes;
        records += 1;
      }

      return { total, records };
    },

    // One row per date and Workplace; never lose hours to a fixed Workplace filter.
    rowsByWorkplaceForMonth(items, targetMonth) {
      const rows = new Map();

      for (const { date, workplace, minutes } of monthEntries(items, targetMonth)) {
        const key = JSON.stringify([date, workplace]);
        const previous = rows.get(key);
        if (previous) {
          previous.minutes += minutes;
        } else {
          rows.set(key, { date, workplace, minutes });
        }
      }

      return [...rows.values()]
        .sort((a, b) => a.date.localeCompare(b.date) || a.workplace.localeCompare(b.workplace));
    },

    // All Workplaces combined, with each worked date counted only once.
    rowsForMonth(items, targetMonth) {
      const rowsByDate = new Map();

      for (const { date, minutes } of this.rowsByWorkplaceForMonth(items, targetMonth)) {
        rowsByDate.set(date, (rowsByDate.get(date) ?? 0) + minutes);
      }

      return [...rowsByDate.entries()]
        .map(([date, minutes]) => ({ date, minutes }))
        .sort((a, b) => a.date.localeCompare(b.date));
    },

    workplaceTotalsForMonth(items, targetMonth) {
      const totals = new Map();

      for (const { workplace, minutes } of this.rowsByWorkplaceForMonth(items, targetMonth)) {
        const previous = totals.get(workplace);
        if (previous) {
          previous.minutes += minutes;
          previous.days += 1;
        } else {
          totals.set(workplace, { workplace, minutes, days: 1 });
        }
      }

      return [...totals.values()]
        .sort((a, b) => b.minutes - a.minutes || a.workplace.localeCompare(b.workplace));
    },

    totalMinutes(rows) {
      return (rows ?? []).reduce((sum, row) => sum + row.minutes, 0);
    }
  };
})
