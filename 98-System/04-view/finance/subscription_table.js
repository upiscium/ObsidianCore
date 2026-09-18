async function loadExpression(path) {
  const source = await dv.io.load(path);
  if (!source) throw new Error(`Dataview library not found: ${path}`);
  return new Function(`"use strict"; return (${source});`)();
}

const S = await loadExpression("98-System/05-lib/finance/subscription_view_utils.js");

const rows = Array.from(dv.pages('"96-Global/00-subscription"'))
  .filter(page => S.isSubscription(page))
  .sort((a, b) => S.compareSubscriptions(a, b, dv.compare));

dv.table(
  ["サブスク", "状態", "金額", "周期", "開始", "カテゴリ"],
  rows.map(page => [
    dv.fileLink(page.file.path, false, S.displayName(page)),
    S.stateLabel(page.enabled),
    page.amount,
    S.cycleLabel(page),
    page.start,
    page.category,
  ]),
);
