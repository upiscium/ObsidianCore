(() => {
  // Reference rates are indicative (not a bank/card settlement quote).
  // A fixed pair prevents a registry value from influencing network destinations.
  const URL = "https://api.frankfurter.dev/v2/rate/usd/jpy";
  const SOURCE = "frankfurter-v2";
  const BASIS = "frankfurter_daily_reference";
  const MAX_AGE_DAYS = 7; // tolerate weekends and multi-day market closures

  function utcDay(isoDate) {
    if (typeof isoDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
    const [year, month, day] = isoDate.split("-").map(Number);
    const utc = Date.UTC(year, month - 1, day);
    const date = new Date(utc);
    if (date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day) return null;
    return utc / 86400000;
  }

  function parseQuote(data, today) {
    const nowDay = utcDay(today);
    const refDay = utcDay(data?.date);
    if (nowDay == null) throw new Error("FXの適用日が不正です");
    if (data?.base !== "USD" || data?.quote !== "JPY") {
      throw new Error("FXの通貨ペアがUSD/JPYではありません");
    }
    const rate = data?.rate;
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      throw new Error("FXの円換算レートが不正です");
    }
    if (refDay == null || refDay > nowDay || nowDay - refDay > MAX_AGE_DAYS) {
      throw new Error("FX参照レートが未来日付または古すぎます");
    }
    return Object.freeze({
      rate,
      date: data.date,
      source: SOURCE,
      basis: BASIS,
    });
  }

  async function loadLatestUsdJpy(requestUrl, today) {
    if (typeof requestUrl !== "function") throw new Error("Obsidian requestUrlが利用できません");
    const response = await requestUrl({ url: URL, method: "GET", throw: false });
    if (response?.status !== 200) {
      throw new Error(`FX API応答が不正です (HTTP ${String(response?.status ?? "?")})`);
    }
    const json = response.json;
    return parseQuote(json, today);
  }

  return Object.freeze({ URL, SOURCE, BASIS, MAX_AGE_DAYS, parseQuote, loadLatestUsdJpy });
})()
