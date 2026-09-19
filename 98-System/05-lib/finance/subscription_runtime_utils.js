(() => {
  const CONFIG = Object.freeze({
    registryFolder: "96-Global/00-subscription",
    monthlyFolder: "01-MonthlyNote",
    expenseHeading: "# 今月の支出",
    defaultCategory: "サブスク",
  });

  const CYCLES = Object.freeze(["monthly", "yearly", "interval"]);

  function normalizeYearMonth(value) {
    if (value == null) return null;

    if (typeof value === "string") {
      const match = value.match(/(\d{4})-(\d{1,2})/);
      if (!match) return null;
      const month = Number(match[2]);
      if (month < 1 || month > 12) return null;
      return `${match[1]}-${String(month).padStart(2, "0")}`;
    }

    if (typeof value?.toFormat === "function") {
      return value.toFormat("yyyy-MM");
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
    }

    return null;
  }

  function currentYearMonth(now = new Date()) {
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
      throw new Error("currentYearMonth requires a valid Date");
    }
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  function monthIndex(yearMonth) {
    const normalized = normalizeYearMonth(yearMonth);
    if (!normalized) return null;
    const [year, month] = normalized.split("-").map(Number);
    return year * 12 + month - 1;
  }

  function normalizeAmount(value) {
    const amount = Number(String(value ?? "").replace(/,/g, "").trim());
    return Number.isFinite(amount) && amount >= 0 ? amount : null;
  }

  function normalizeBoolean(value) {
    return value === true || String(value ?? "").toLowerCase() === "true";
  }

  function normalizeCycle(value) {
    return String(value ?? "monthly").trim().toLowerCase();
  }

  function validSubscriptionId(value) {
    return /^[^\s@\[\]]+$/.test(String(value ?? "").trim());
  }

  function normalizeSubscription(raw, context = {}) {
    const id = String(raw?.subscription_id ?? raw?.id ?? "").trim();
    const name = String(raw?.name ?? context.fileName ?? "").trim();
    const cycle = normalizeCycle(raw?.cycle);
    const category = String(raw?.category ?? "").trim() || CONFIG.defaultCategory;

    return {
      ...raw,
      id,
      subscription_id: id,
      name,
      enabled: normalizeBoolean(raw?.enabled),
      amount: normalizeAmount(raw?.amount),
      category,
      cycle,
      start: normalizeYearMonth(raw?.start),
      payment_month: raw?.payment_month == null || raw?.payment_month === ""
        ? null
        : Number(raw.payment_month),
      interval_months: raw?.interval_months == null || raw?.interval_months === ""
        ? null
        : Number(raw.interval_months),
      __file: context.filePath ?? raw?.__file ?? null,
      __line: context.line ?? raw?.__line ?? null,
    };
  }

  function sourceLabel(subscription) {
    if (subscription?.__file) return subscription.__file;
    if (subscription?.__line) return `L${subscription.__line}`;
    return "subscription";
  }

  function validateSubscription(subscription) {
    const s = normalizeSubscription(subscription, {
      filePath: subscription?.__file,
      line: subscription?.__line,
    });
    const prefix = sourceLabel(s);
    const errors = [];

    if (!s.id) {
      errors.push(`${prefix}: subscription_idがありません`);
    } else if (!validSubscriptionId(s.id)) {
      errors.push(`${prefix}: subscription_idに空白・@・角括弧は使えません`);
    }

    if (!s.name) errors.push(`${prefix}: nameがありません`);
    if (s.amount == null) errors.push(`${prefix}: amountが不正です`);
    if (!s.start) errors.push(`${prefix}: startはYYYY-MM形式で指定してください`);

    if (!CYCLES.includes(s.cycle)) {
      errors.push(`${prefix}: cycleが不正です (${s.cycle})`);
    }

    if (s.cycle === "yearly") {
      if (!Number.isInteger(s.payment_month) || s.payment_month < 1 || s.payment_month > 12) {
        errors.push(`${prefix}: 年1回ではpayment_monthを1〜12で指定してください`);
      }
    }

    if (s.cycle === "interval") {
      if (!Number.isInteger(s.interval_months) || s.interval_months < 1) {
        errors.push(`${prefix}: Nか月ごとではinterval_monthsを1以上で指定してください`);
      }
    }

    return errors;
  }

  function isDueInMonth(subscription, yearMonth) {
    const s = normalizeSubscription(subscription, {
      filePath: subscription?.__file,
      line: subscription?.__line,
    });
    const target = normalizeYearMonth(yearMonth);

    if (!s.enabled || !s.start || !target) return false;

    const targetIndex = monthIndex(target);
    const startIndex = monthIndex(s.start);
    if (targetIndex < startIndex) return false;

    if (s.cycle === "monthly") return true;
    if (s.cycle === "yearly") {
      return Number(target.split("-")[1]) === s.payment_month;
    }
    if (s.cycle === "interval") {
      return (targetIndex - startIndex) % s.interval_months === 0;
    }
    return false;
  }

  function sanitizeInlineValue(value) {
    return String(value ?? "")
      .replace(/\r?\n/g, " ")
      .replace(/\]/g, "）")
      .trim();
  }

  function subscriptionKey(subscription, yearMonth) {
    const s = normalizeSubscription(subscription);
    const target = normalizeYearMonth(yearMonth);
    if (!s.id || !target) return null;
    return `${sanitizeInlineValue(s.id)}@${target}`;
  }

  function sanitizeFilename(value) {
    const result = String(value ?? "")
      .trim()
      .replace(/[\\/:*?"<>|#^\[\]]+/g, "-")
      .replace(/\s+/g, " ")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100);
    return result || "Subscription";
  }

  function yamlString(value) {
    return JSON.stringify(String(value ?? ""));
  }

  function buildSubscriptionContent(fields) {
    const s = normalizeSubscription(fields);
    const errors = validateSubscription(s);
    if (errors.length > 0) throw new Error(errors.join(" / "));

    const paymentMonth = s.cycle === "yearly" ? s.payment_month : "";
    const intervalMonths = s.cycle === "interval" ? s.interval_months : "";

    return [
      "---",
      "type: subscription",
      `subscription_id: ${yamlString(s.id)}`,
      `name: ${yamlString(s.name)}`,
      `enabled: ${s.enabled ? "true" : "false"}`,
      `amount: ${s.amount}`,
      `category: ${yamlString(s.category)}`,
      `cycle: ${s.cycle}`,
      `start: ${yamlString(s.start)}`,
      `payment_month: ${paymentMonth}`,
      `interval_months: ${intervalMonths}`,
      "---",
      `# ${s.name}`,
      "",
      "```meta-bind-embed",
      "[[subscription-meta]]",
      "```",
      "",
    ].join("\n");
  }

  return Object.freeze({
    CONFIG,
    CYCLES,
    normalizeYearMonth,
    currentYearMonth,
    monthIndex,
    normalizeAmount,
    normalizeBoolean,
    normalizeCycle,
    validSubscriptionId,
    normalizeSubscription,
    validateSubscription,
    isDueInMonth,
    sanitizeInlineValue,
    subscriptionKey,
    sanitizeFilename,
    yamlString,
    buildSubscriptionContent,
  });
})()
