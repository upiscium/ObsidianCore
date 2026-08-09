(() => {
  const FUTURE_MODES = new Set(["next7", "next30", "later"]);
  const DAY_MS = 24 * 60 * 60 * 1000;

  function normalizeDateKey(value) {
    if (value === null || value === undefined || value === "") return null;

    let raw = value;
    if (typeof value === "object") {
      if (typeof value.toISODate === "function") raw = value.toISODate();
      else if (typeof value.toFormat === "function") raw = value.toFormat("yyyy-MM-dd");
    }

    raw = String(raw).trim().slice(0, 10);
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) return null;

    return raw;
  }

  function dayNumber(value) {
    const key = normalizeDateKey(value);
    if (!key) return null;
    const [year, month, day] = key.split("-").map(Number);
    return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
  }

  function effectiveFutureDate({ start = null, due = null, today }) {
    const todayDay = dayNumber(today);
    if (todayDay === null) throw new Error("today must be a valid date");

    const startKey = normalizeDateKey(start);
    const startDay = dayNumber(startKey);
    if (startDay !== null && startDay > todayDay) return startKey;

    const dueKey = normalizeDateKey(due);
    const dueDay = dayNumber(dueKey);
    if (dueDay !== null && dueDay > todayDay) return dueKey;

    return null;
  }

  function futureBucket({ start = null, due = null, today }) {
    const futureDate = effectiveFutureDate({ start, due, today });
    if (!futureDate) return null;

    const delta = dayNumber(futureDate) - dayNumber(today);
    if (delta <= 7) return "next7";
    if (delta <= 30) return "next30";
    return "later";
  }

  function matchesFutureMode(task, mode, today, isActionableStatus) {
    if (!FUTURE_MODES.has(mode)) throw new Error(`Unknown future Task mode: ${mode}`);
    if (typeof isActionableStatus !== "function") throw new Error("isActionableStatus is required");
    if (!task || !isActionableStatus(task.status) || task.backlog === true) return false;
    return futureBucket({ start: task.start, due: task.due, today }) === mode;
  }

  return {
    normalizeDateKey,
    effectiveFutureDate,
    futureBucket,
    matchesFutureMode
  };
})()
