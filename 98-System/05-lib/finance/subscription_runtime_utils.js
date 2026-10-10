(() => {
  const CONFIG = Object.freeze({
    registryFolder: "96-Global/00-subscription",
    monthlyFolder: "01-MonthlyNote",
    expenseHeading: "# 今月の支出",
    defaultCategory: "サブスク",
  });

  const CYCLES = Object.freeze(["monthly", "yearly", "interval"]);
  const CURRENCIES = Object.freeze(["JPY", "USD"]);
  const EXCHANGE_RATE_MODES = Object.freeze(["manual", "auto"]);

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
    if (value == null || String(value).trim() === "") return null;
    const amount = Number(String(value).replace(/,/g, "").trim());
    return Number.isFinite(amount) && amount >= 0 ? amount : null;
  }

  function normalizeCurrency(value) {
    // Missing currency in historical registry notes means JPY. A present
    // but blank/invalid currency is NOT silently interpreted as JPY.
    return value === undefined ? "JPY" : String(value ?? "").trim().toUpperCase();
  }

  function normalizeExchangeRate(value) {
    if (value == null || String(value).trim() === "") return null;
    const rate = Number(String(value).replace(/,/g, "").trim());
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  }

  function normalizeBillingDay(value) {
    if (value === undefined) return 1; // Historical registry notes post on the first.
    if (value == null || String(value).trim() === "") return null;
    const day = Number(value);
    return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null;
  }

  function normalizeExchangeRateMode(value) {
    return value === undefined ? "manual" : String(value ?? "").trim().toLowerCase();
  }

  function billingDateInMonth(subscription, yearMonth) {
    const s = normalizeSubscription(subscription);
    const ym = normalizeYearMonth(yearMonth);
    if (!ym || s.billing_day == null) return null;
    const [year, month] = ym.split("-").map(Number);
    const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const day = Math.min(s.billing_day, maxDay);
    return `${ym}-${String(day).padStart(2, "0")}`;
  }

  function yenExpenseAmount(subscription, overrideRate = null) {
    const s = normalizeSubscription(subscription);
    if (s.amount == null) return null;
    if (s.currency === "JPY") return s.amount;
    if (s.currency !== "USD") return null;
    const rate = overrideRate == null
      ? (s.exchange_rate_mode === "manual" ? s.exchange_rate_jpy_per_usd : null)
      : normalizeExchangeRate(overrideRate);
    if (rate == null) return null;
    // Decimal half-up using integer cents and a base-10 rate fraction.
    // Math.round(19.99 * 150) is 2998 in JS due to binary float error,
    // while the currency result must be 2999 yen.
    const centsNumber = s.amount * 100;
    const cents = Math.round(centsNumber);
    if (!Number.isSafeInteger(cents) ||
        Math.abs(centsNumber - cents) > 1e-7) return null;
    const match = String(rate).match(/^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i);
    if (!match) return null;
    const digits = (match[1] + (match[2] ?? "")).replace(/^0+(?=\d)/, "");
    const exponent = Number(match[3] ?? 0) - (match[2]?.length ?? 0);
    if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 18) return null;
    const numerator = BigInt(digits) * (exponent >= 0 ? 10n ** BigInt(exponent) : 1n);
    const denominator = 100n * (exponent < 0 ? 10n ** BigInt(-exponent) : 1n);
    const product = BigInt(cents) * numerator;
    const yen = (2n * product + denominator) / (2n * denominator);
    return yen <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(yen) : null;
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
    const currency = normalizeCurrency(raw?.currency);

    return {
      ...raw,
      id,
      subscription_id: id,
      name,
      enabled: normalizeBoolean(raw?.enabled),
      amount: normalizeAmount(raw?.amount),
      currency,
      exchange_rate_mode: normalizeExchangeRateMode(raw?.exchange_rate_mode),
      exchange_rate_jpy_per_usd: normalizeExchangeRate(raw?.exchange_rate_jpy_per_usd),
      billing_day: normalizeBillingDay(raw?.billing_day),
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
    if (s.billing_day == null) errors.push(`${prefix}: billing_dayは1〜31で指定してください`);
    if (!CURRENCIES.includes(s.currency)) {
      errors.push(`${prefix}: currencyはJPYまたはUSDで指定してください`);
    }
    if (s.currency === "USD") {
      if (!EXCHANGE_RATE_MODES.includes(s.exchange_rate_mode)) {
        errors.push(`${prefix}: exchange_rate_modeはmanualまたはautoで指定してください`);
      }
      if (s.exchange_rate_mode === "manual" && s.exchange_rate_jpy_per_usd == null) {
        errors.push(`${prefix}: 手動USDにはexchange_rate_jpy_per_usd（円/ドル）が必要です`);
      }
      if (s.amount != null && Math.abs(s.amount * 100 - Math.round(s.amount * 100)) > 1e-7) {
        errors.push(`${prefix}: USD amountは小数第2位までです`);
      }
      if (s.amount != null && s.exchange_rate_mode === "manual" &&
          s.exchange_rate_jpy_per_usd != null && yenExpenseAmount(s) == null) {
        errors.push(`${prefix}: USDの円換算額が範囲外です`);
      }
    }
    if (s.currency === "JPY" && s.exchange_rate_mode !== "manual") {
      errors.push(`${prefix}: JPYのexchange_rate_modeはmanualにしてください`);
    }
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
      `currency: ${s.currency}`,
      `billing_day: ${s.billing_day}`,
      `exchange_rate_mode: ${s.exchange_rate_mode}`,
      `exchange_rate_jpy_per_usd: ${s.currency === "USD" && s.exchange_rate_mode === "manual" ? s.exchange_rate_jpy_per_usd : ""}`,
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
    CURRENCIES,
    EXCHANGE_RATE_MODES,
    normalizeYearMonth,
    currentYearMonth,
    monthIndex,
    normalizeAmount,
    normalizeCurrency,
    normalizeExchangeRate,
    normalizeBillingDay,
    normalizeExchangeRateMode,
    billingDateInMonth,
    yenExpenseAmount,
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
