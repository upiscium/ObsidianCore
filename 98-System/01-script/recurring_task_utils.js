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
    if (!key) throw new Error(`日付が不正です: ${String(value ?? "")}`);
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + Number(amount)));
    return [
      String(date.getUTCFullYear()).padStart(4, "0"),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
      String(date.getUTCDate()).padStart(2, "0")
    ].join("-");
  }

  function integer(value, fallback, label, { min, max }) {
    if (value === null || value === undefined || value === "") return fallback;
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max) {
      throw new Error(`${label}は${min}〜${max}の整数にしてください`);
    }
    return number;
  }

  function normalizeDefinition(raw) {
    if (!raw || raw.type !== "recurring-task") throw new Error("typeはrecurring-taskである必要があります");
    const uid = String(raw.uid ?? "").trim();
    if (!/^rct_[A-Za-z0-9-]+$/.test(uid)) throw new Error("Recurring Definitionのuidが不正です");
    const title = String(raw.title ?? "").trim();
    if (!title) throw new Error("Recurring Definitionにtitleがありません");
    const frequency = String(raw.frequency ?? "").trim();
    if (!FREQUENCIES.has(frequency)) throw new Error(`frequencyが不正です: ${frequency}`);
    const anchor = S.normalizeDateKey(raw.anchor);
    if (!anchor) throw new Error("anchorはYYYY-MM-DD形式の正しい日付にしてください");
    const priorityRaw = raw.priority === null || raw.priority === undefined || raw.priority === "" ? null : String(raw.priority).trim();
    if (priorityRaw !== null && !PRIORITIES.has(priorityRaw)) throw new Error(`priorityが不正です: ${priorityRaw}`);

    return {
      type: "recurring-task",
      uid,
      title,
      enabled: raw.enabled === true,
      frequency,
      interval: integer(raw.interval, 1, "interval", { min: 1, max: 365 }),
      anchor,
      lookaheadDays: integer(raw.lookahead_days, 7, "lookahead_days", { min: 0, max: 90 }),
      startOffsetDays: raw.start_offset_days === null || raw.start_offset_days === undefined || raw.start_offset_days === ""
        ? null
        : integer(raw.start_offset_days, null, "start_offset_days", { min: -365, max: 365 }),
      dueOffsetDays: integer(raw.due_offset_days, 0, "due_offset_days", { min: -365, max: 365 }),
      priority: priorityRaw,
      workspace: raw.workspace ?? null,
      project: raw.project ?? null
    };
  }

  function monthsBetween(anchor, date) {
    const [ay, am] = anchor.split("-").map(Number);
    const [dy, dm] = date.split("-").map(Number);
    return (dy - ay) * 12 + (dm - am);
  }

  function isOccurrence(definition, dateValue) {
    const def = definition.type === "recurring-task" && definition.lookaheadDays !== undefined
      ? definition
      : normalizeDefinition(definition);
    const date = S.normalizeDateKey(dateValue);
    if (!date) return false;
    const delta = dayNumber(date) - dayNumber(def.anchor);
    if (delta < 0) return false;
    if (def.frequency === "daily") return delta % def.interval === 0;
    if (def.frequency === "weekly") return delta % (7 * def.interval) === 0;

    const anchorDay = Number(def.anchor.slice(8, 10));
    const dateDay = Number(date.slice(8, 10));
    if (dateDay !== anchorDay) return false;
    const months = monthsBetween(def.anchor, date);
    return months >= 0 && months % def.interval === 0;
  }

  function occurrencesInWindow(definition, todayValue) {
    const def = definition.type === "recurring-task" && definition.lookaheadDays !== undefined
      ? definition
      : normalizeDefinition(definition);
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

  function occurrenceTaskFields(definition, occurrenceValue, createdValue) {
    const def = definition.type === "recurring-task" && definition.lookaheadDays !== undefined
      ? definition
      : normalizeDefinition(definition);
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
      ? definition
      : normalizeDefinition(definition);
    const occurrence = S.normalizeDateKey(occurrenceValue);
    if (!occurrence) throw new Error("occurrence must be a valid date");
    const [year, month] = occurrence.split("-");
    return `02-Task/${year}/${month}/${occurrence.replaceAll("-", "")}-R-${def.uid}.md`;
  }

  return {
    normalizeDefinition,
    addDays,
    isOccurrence,
    occurrencesInWindow,
    occurrenceTaskFields,
    occurrenceTaskPath
  };
})())
