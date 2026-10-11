(() => {
  function isSubscription(page) {
    return page?.type === "subscription";
  }

  function displayName(page) {
    return page?.name ?? page?.file?.name ?? "";
  }

  function stateLabel(enabled) {
    return enabled ? "🟢 有効" : "⚪ 終了";
  }

  // Match the Ledger's whole-JPY ceiling; use decimal integer arithmetic
  // rather than Math.ceil(amount * rate), which can add a spurious yen when
  // a binary float lands just above an exact integer.
  function ceilYenFromUsd(amount, rate) {
    const centsNumber = amount * 100;
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
    const yen = (product + denominator - 1n) / denominator;
    return yen <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(yen) : null;
  }

  function amountLabel(subscription) {
    // Match Registry validation: absent amounts are invalid, not zero.
    const rawAmount = subscription?.amount;
    if (rawAmount == null || String(rawAmount).trim() === "") return "金額不正";
    const amount = Number(String(rawAmount).replace(/,/g, "").trim());
    if (!Number.isFinite(amount) || amount < 0) return "金額不正";

    const currency = subscription?.currency === undefined
      ? "JPY"
      : String(subscription.currency ?? "").trim().toUpperCase();

    if (currency === "JPY") {
      return `¥${amount.toLocaleString("ja-JP")}`;
    }
    if (currency === "USD") {
      // Do not display an invalid 3+-decimal USD amount as rounded cents.
      if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7) {
        return "金額不正";
      }
      const dollars = amount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      if (subscription?.exchange_rate_mode === "auto") {
        return `${dollars}（課金時に自動円換算）`;
      }
      const rawRate = subscription?.exchange_rate_jpy_per_usd;
      const rate = rawRate == null || String(rawRate).trim() === ""
        ? NaN
        : Number(String(rawRate).replace(/,/g, "").trim());
      if (!Number.isFinite(rate) || rate <= 0) {
        return `$${dollars}（円換算レート未設定）`;
      }
      const yen = ceilYenFromUsd(amount, rate);
      if (yen == null) return "$" + dollars + "（円換算額不正）";
      return `$${dollars}（約¥${yen.toLocaleString("ja-JP")}）`;
    }
    return "通貨不正";
  }

  function cycleLabel(subscription) {
    const cycle = subscription?.cycle;

    if (cycle === "monthly") return "毎月";
    if (cycle === "yearly") return `年1回（${subscription?.payment_month}月）`;
    if (cycle === "interval") return `${subscription?.interval_months}か月ごと`;

    return cycle;
  }

  function compareSubscriptions(a, b, compare) {
    if (typeof compare !== "function") {
      throw new Error("Subscription table requires compare");
    }

    const enabledOrder = compare(b?.enabled, a?.enabled);
    if (enabledOrder !== 0) return enabledOrder;

    return compare(a?.name, b?.name);
  }

  return Object.freeze({
    isSubscription,
    displayName,
    amountLabel,
    stateLabel,
    cycleLabel,
    compareSubscriptions,
  });
})()
