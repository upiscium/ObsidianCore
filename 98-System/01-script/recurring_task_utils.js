(S => (() => {
  if (!S || typeof S.normalizeDateKey !== "function") throw new Error("task_schedule_utils.js is required");

  const FREQUENCIES = new Set(["daily", "weekly", "monthly"]);
  const PRIORITIES = new Set(["high", "medium", "low"]);
  const DAY_MS = 24 * 60 * 60 * 1000;

  function dayNumber(value) {
    const key = S.normalizeDateKey(value);
    if (!key) return null;
    const [y, m, d] = key.split("-").map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
  }

  function addDays(value, amount) {
    const key = S.normalizeDateKey(value);
    if (!key) throw new Error("日付が不正です: " + String(value ?? ""));
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + Number(amount)));
    return [
      String(date.getUTCFullYear()).padStart(4, "0"),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
      String(date.getUTCDate()).padStart(2, "0")
    ].join("-");
  }

  // ISO weekdays: Monday=1 ... Sunday=7. Use UTC to avoid device DST/time-zone shifts.
  function weekday(value) {
    const key = S.normalizeDateKey(value);
    if (!key) throw new Error("曜日を判定できない日付です");
    const [y, m, d] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
  }

  function integer(value, fallback, label, { min, max }) {
    if (value === null || value === undefined || value === "") return fallback;
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max) {
      throw new Error(label + "は" + min + "〜" + max + "の整数にしてください");
    }
    return number;
  }

  function optional(value) {
    return value === null || value === undefined || value === "";
  }

  function weekdays(value) {
    // Absence is handled by normalizeDefinition. Explicit null/empty means an
    // incorrectly configured new field and must not fall back to legacy logic.
    // Dataview returns a DataArray from YAML lists; native frontmatter uses Array.
    const list = Array.isArray(value) ? value : typeof value?.array === "function" ? value.array() : null;
    if (!list || list.length < 1 || list.length > 7) {
      throw new Error("weekdaysは月=1〜日=7の重複しない曜日リストにしてください");
    }
    const numbers = list.map(item => {
      if (typeof item !== "number" || !Number.isInteger(item) || item < 1 || item > 7) {
        throw new Error("weekdaysは1〜7の整数だけを指定してください");
      }
      return item;
    });
    if (new Set(numbers).size !== numbers.length) throw new Error("weekdaysに重複があります");
    return numbers.slice().sort((a, b) => a - b);
  }

  function monthlyWeek(value) {
    if (value === "last") return "last";
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) {
      throw new Error("month_weekは第1〜第5またはlastを指定してください");
    }
    return value;
  }

  function monthlyWeekday(value) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 7) {
      throw new Error("month_weekdayは1〜7の整数にしてください");
    }
    return value;
  }

  function normalizeDefinition(raw) {
    if (!raw || raw.type !== "recurring-task") throw new Error("typeはrecurring-taskである必要があります");
    const uid = String(raw.uid ?? "").trim();
    if (!/^rct_[A-Za-z0-9-]+$/.test(uid)) throw new Error("Recurring Definitionのuidが不正です");
    const title = String(raw.title ?? "").trim();
    if (!title) throw new Error("Recurring Definitionにtitleがありません");
    const frequency = String(raw.frequency ?? "").trim();
    if (!FREQUENCIES.has(frequency)) throw new Error("frequencyが不正です: " + frequency);
    const anchor = S.normalizeDateKey(raw.anchor);
    if (!anchor) throw new Error("anchorはYYYY-MM-DD形式の正しい日付にしてください");
    const priorityRaw = optional(raw.priority) ? null : String(raw.priority).trim();
    if (priorityRaw !== null && !PRIORITIES.has(priorityRaw)) throw new Error("priorityが不正です: " + priorityRaw);

    // Missing new fields preserve legacy schedules; explicitly present but
    // malformed fields (null, empty, bool, array, etc.) are rejected.
    const weeklyDays = raw.weekdays === undefined ? null : weekdays(raw.weekdays);
    const monthWeek = raw.month_week === undefined ? null : monthlyWeek(raw.month_week);
    const monthWeekday = raw.month_weekday === undefined ? null : monthlyWeekday(raw.month_weekday);
    if (weeklyDays !== null && frequency !== "weekly") {
      throw new Error("weekdaysはweeklyでのみ指定できます");
    }
    if (monthWeek !== null || monthWeekday !== null) {
      if (frequency !== "monthly" || monthWeek === null || monthWeekday === null) {
        throw new Error("month_weekとmonth_weekdayはmonthlyで一緒に指定してください");
      }
    }

    return {
      type: "recurring-task",
      uid,
      title,
      enabled: raw.enabled === true,
      frequency,
      interval: integer(raw.interval, 1, "interval", { min: 1, max: 365 }),
      anchor,
      lookaheadDays: integer(raw.lookahead_days, 7, "lookahead_days", { min: 0, max: 90 }),
      startOffsetDays: optional(raw.start_offset_days)
        ? null : integer(raw.start_offset_days, null, "start_offset_days", { min: -365, max: 365 }),
      dueOffsetDays: integer(raw.due_offset_days, 0, "due_offset_days", { min: -365, max: 365 }),
      priority: priorityRaw,
      workspace: raw.workspace ?? null,
      project: raw.project ?? null,
      weekdays: weeklyDays,
      monthWeek,
      monthWeekday
    };
  }

  function monthsBetween(anchor, date) {
    const [ay, am] = anchor.split("-").map(Number);
    const [dy, dm] = date.split("-").map(Number);
    return (dy - ay) * 12 + (dm - am);
  }

  function isOccurrence(definition, dateValue) {
    const def = definition.type === "recurring-task" && definition.lookaheadDays !== undefined
      ? definition : normalizeDefinition(definition);
    const date = S.normalizeDateKey(dateValue);
    if (!date) return false;
    const delta = dayNumber(date) - dayNumber(def.anchor);
    if (delta < 0) return false;
    if (def.frequency === "daily") return delta % def.interval === 0;

    if (def.frequency === "weekly") {
      if (def.weekdays === null || def.weekdays === undefined) {
        // Preserve the existing anchor weekday exactly for legacy definitions.
        return delta % (7 * def.interval) === 0;
      }
      const weeks = (
        (dayNumber(date) - weekday(date) + 1) -
        (dayNumber(def.anchor) - weekday(def.anchor) + 1)
      ) / 7;
      return Number.isInteger(weeks) && weeks % def.interval === 0
        && def.weekdays.includes(weekday(date));
    }

    const months = monthsBetween(def.anchor, date);
    if (months < 0 || months % def.interval !== 0) return false;
    if (def.monthWeek === null || def.monthWeek === undefined) {
      // Preserve legacy same-day-of-month semantics and skip nonexistent dates.
      return Number(date.slice(8, 10)) === Number(def.anchor.slice(8, 10));
    }
    if (weekday(date) !== def.monthWeekday) return false;
    if (def.monthWeek === "last") {
      return addDays(date, 7).slice(0, 7) !== date.slice(0, 7);
    }
    // e.g. second Monday = the Monday occurring on date 8..14.
    return Math.floor((Number(date.slice(8, 10)) - 1) / 7) + 1 === def.monthWeek;
  }

  function occurrencesInWindow(definition, todayValue) {
    const def = definition.type === "recurring-task" && definition.lookaheadDays !== undefined
      ? definition : normalizeDefinition(definition);
    if (!def.enabled) return [];
    const today = S.normalizeDateKey(todayValue);
    if (!today) throw new Error("today must be a valid date");
    const result = [];
    for (let offset = 0; offset <= def.lookaheadDays; offset += 1) {
      const date = addDays(today, offset);
      if (isOccurrence(def, date)) result.push(date);
    }
    return result;
  }

  // UI-only bounded preview. Does not generate Task files or change lookahead_days.
  function nextOccurrences(definition, fromValue, limit = 3, horizonDays = 400) {
    const def = definition.type === "recurring-task" && definition.lookaheadDays !== undefined
      ? definition : normalizeDefinition(definition);
    const from = S.normalizeDateKey(fromValue);
    if (!from) throw new Error("from must be a valid date");
    if (!Number.isInteger(limit) || limit < 1 || limit > 5
        || !Number.isInteger(horizonDays) || horizonDays < 0 || horizonDays > 2000) {
      throw new Error("preview limit/horizon is out of bounds");
    }
    const result = [];
    if (!def.enabled) return result;
    for (let n = 0; n <= horizonDays && result.length < limit; n += 1) {
      const day = addDays(from, n);
      if (isOccurrence(def, day)) result.push(day);
    }
    return result;
  }

  function occurrenceTaskFields(definition, occurrenceValue, createdValue) {
    const def = definition.type === "recurring-task" && definition.lookaheadDays !== undefined
      ? definition : normalizeDefinition(definition);
    const occurrence = S.normalizeDateKey(occurrenceValue);
    const created = S.normalizeDateKey(createdValue);
    if (!occurrence || !created) throw new Error("occurrence/created must be valid dates");
    const due = addDays(occurrence, def.dueOffsetDays);
    const start = def.startOffsetDays === null ? null : addDays(occurrence, def.startOffsetDays);
    if (start && dayNumber(start) > dayNumber(due)) throw new Error("Recurring DefinitionのStartはDue以前になる必要があります");
    return { title: def.title, created, start, due, workspace: def.workspace, project: def.project, priority: def.priority };
  }

  function occurrenceTaskPath(definition, occurrenceValue) {
    const def = definition.type === "recurring-task" && definition.lookaheadDays !== undefined
      ? definition : normalizeDefinition(definition);
    const occurrence = S.normalizeDateKey(occurrenceValue);
    if (!occurrence) throw new Error("occurrence must be a valid date");
    const [year, month] = occurrence.split("-");
    return "02-Task/" + year + "/" + month + "/" + occurrence.replaceAll("-", "") + "-R-" + def.uid + ".md";
  }

  return {
    normalizeDefinition,
    addDays,
    weekday,
    isOccurrence,
    occurrencesInWindow,
    nextOccurrences,
    occurrenceTaskFields,
    occurrenceTaskPath
  };
})())