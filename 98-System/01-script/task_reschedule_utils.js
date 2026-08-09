(S => (() => {
  if (!S || typeof S.normalizeDateKey !== "function") {
    throw new Error("task_schedule_utils.js is required");
  }

  const DUE_PRESETS = new Set(["keep", "tomorrow", "plus3", "nextWeek", "custom"]);
  const START_PRESETS = new Set(["keep", "clear", "today", "tomorrow", "nextWeek", "custom"]);
  const DAY_MS = 24 * 60 * 60 * 1000;

  function addDays(value, amount) {
    const key = S.normalizeDateKey(value);
    if (!key) throw new Error(`基準日が不正です: ${String(value ?? "")}`);
    const [year, month, day] = key.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + Number(amount)));
    return [
      String(date.getUTCFullYear()).padStart(4, "0"),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
      String(date.getUTCDate()).padStart(2, "0")
    ].join("-");
  }

  function normalizeExistingDate(value, label) {
    if (value === null || value === undefined || value === "") return null;
    const key = S.normalizeDateKey(value);
    if (!key) throw new Error(`既存${label}の日付が不正です`);
    return key;
  }

  function requireCustomDate(value, label) {
    const key = S.normalizeDateKey(value);
    if (!key) throw new Error(`${label}はYYYY-MM-DD形式の正しい日付にしてください`);
    return key;
  }

  function resolveDuePreset({ preset, customDate, today }) {
    if (!DUE_PRESETS.has(preset)) throw new Error(`不正なDue操作です: ${String(preset)}`);
    if (preset === "keep") return { changed: false, value: null };
    if (preset === "custom") return { changed: true, value: requireCustomDate(customDate, "Due") };
    if (preset === "tomorrow") return { changed: true, value: addDays(today, 1) };
    if (preset === "plus3") return { changed: true, value: addDays(today, 3) };
    return { changed: true, value: addDays(today, 7) };
  }

  function resolveStartPreset({ preset, customDate, today }) {
    if (!START_PRESETS.has(preset)) throw new Error(`不正なStart操作です: ${String(preset)}`);
    if (preset === "keep") return { changed: false, value: null };
    if (preset === "clear") return { changed: true, value: null };
    if (preset === "custom") return { changed: true, value: requireCustomDate(customDate, "Start") };
    if (preset === "today") return { changed: true, value: S.normalizeDateKey(today) };
    if (preset === "tomorrow") return { changed: true, value: addDays(today, 1) };
    return { changed: true, value: addDays(today, 7) };
  }

  function dayNumber(value) {
    const key = S.normalizeDateKey(value);
    if (!key) return null;
    const [year, month, day] = key.split("-").map(Number);
    return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
  }

  function buildReschedulePatch({
    currentStart = null,
    currentDue = null,
    startPreset = "keep",
    duePreset = "keep",
    customStart = null,
    customDue = null,
    today
  }) {
    const todayKey = S.normalizeDateKey(today);
    if (!todayKey) throw new Error("today must be a valid date");

    const start = resolveStartPreset({ preset: startPreset, customDate: customStart, today: todayKey });
    const due = resolveDuePreset({ preset: duePreset, customDate: customDue, today: todayKey });
    const finalStart = start.changed ? start.value : normalizeExistingDate(currentStart, "Start");
    const finalDue = due.changed ? due.value : normalizeExistingDate(currentDue, "Due");

    if (finalStart && finalDue && dayNumber(finalStart) > dayNumber(finalDue)) {
      throw new Error("StartはDue以前の日付にしてください");
    }

    const patch = {};
    if (start.changed) patch.start = start.value;
    if (due.changed) patch.due = due.value;
    return patch;
  }

  function applyReschedulePatch(frontmatter, patch) {
    if (!frontmatter || typeof frontmatter !== "object") throw new Error("frontmatter is required");
    if (Object.prototype.hasOwnProperty.call(patch, "start")) frontmatter.start = patch.start;
    if (Object.prototype.hasOwnProperty.call(patch, "due")) frontmatter.due = patch.due;
    return frontmatter;
  }

  return {
    addDays,
    buildReschedulePatch,
    applyReschedulePatch
  };
})())
