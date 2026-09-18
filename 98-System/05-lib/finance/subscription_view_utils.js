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
    stateLabel,
    cycleLabel,
    compareSubscriptions,
  });
})()
