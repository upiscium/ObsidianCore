async function loadSubscriptionUtils(appRef) {
  const path = "98-System/05-lib/finance/subscription_runtime_utils.js";
  const file = appRef.vault.getAbstractFileByPath(path);
  if (!file || file.extension !== "js") {
    throw new Error(`Subscription utilityが見つかりません: ${path}`);
  }
  const source = await appRef.vault.read(file);
  return new Function(`"use strict"; return (${source});`)();
}

module.exports = async function createSubscription(tp) {
  const appRef = tp?.app ?? globalThis.app;
  if (!appRef?.vault) throw new Error("Obsidian Vault is required");

  const U = await loadSubscriptionUtils(appRef);

  const name = String(await tp.system.prompt("サブスク名") ?? "").trim();
  if (!name) {
    new Notice("サブスク作成をキャンセルしました。");
    return { ok: false, cancelled: true };
  }

  const amountRaw = String(await tp.system.prompt("金額", "0") ?? "").trim();
  const amount = U.normalizeAmount(amountRaw);
  if (amount == null) {
    new Notice("金額は0以上の数値で指定してください。");
    return { ok: false, cancelled: false, reason: "invalid_amount" };
  }

  const category = String(
    await tp.system.prompt("カテゴリ", U.CONFIG.defaultCategory) ?? ""
  ).trim() || U.CONFIG.defaultCategory;

  const cycle = await tp.system.suggester(
    ["毎月", "年1回", "Nか月ごと"],
    ["monthly", "yearly", "interval"],
    false,
    "支払い周期"
  );
  if (!cycle) return { ok: false, cancelled: true };

  const startRaw = String(
    await tp.system.prompt("課金開始月 (YYYY-MM)", U.currentYearMonth()) ?? ""
  ).trim();
  const start = U.normalizeYearMonth(startRaw);
  if (!start || start !== startRaw) {
    new Notice("課金開始月はYYYY-MM形式で指定してください。");
    return { ok: false, cancelled: false, reason: "invalid_start" };
  }

  let paymentMonth = null;
  let intervalMonths = null;

  if (cycle === "yearly") {
    paymentMonth = await tp.system.suggester(
      Array.from({ length: 12 }, (_, index) => `${index + 1}月`),
      Array.from({ length: 12 }, (_, index) => index + 1),
      false,
      "年払い月"
    );
    if (!paymentMonth) return { ok: false, cancelled: true };
  }

  if (cycle === "interval") {
    const intervalRaw = String(
      await tp.system.prompt("支払い間隔（月）", "3") ?? ""
    ).trim();
    intervalMonths = Number(intervalRaw);
    if (!Number.isInteger(intervalMonths) || intervalMonths < 1) {
      new Notice("支払い間隔は1以上の整数で指定してください。");
      return { ok: false, cancelled: false, reason: "invalid_interval" };
    }
  }

  const subscription = {
    type: "subscription",
    subscription_id: `sub_${crypto.randomUUID()}`,
    name,
    enabled: true,
    amount,
    category,
    cycle,
    start,
    payment_month: paymentMonth,
    interval_months: intervalMonths,
  };

  const errors = U.validateSubscription(subscription);
  if (errors.length > 0) {
    new Notice(`サブスク設定エラー: ${errors.join(" / ")}`, 8000);
    return { ok: false, cancelled: false, reason: "validation", errors };
  }

  await ensureFolder(appRef, U.CONFIG.registryFolder);

  const baseName = U.sanitizeFilename(name);
  const path = uniquePath(appRef, U.CONFIG.registryFolder, baseName);
  const content = U.buildSubscriptionContent(subscription);
  const file = await appRef.vault.create(path, content);

  await appRef.workspace.getLeaf(false).openFile(file);
  new Notice(`サブスク「${name}」を作成しました。`);

  return {
    ok: true,
    path,
    subscriptionId: subscription.subscription_id,
  };
};

async function ensureFolder(appRef, folderPath) {
  let current = "";
  for (const part of folderPath.split("/").filter(Boolean)) {
    current = current ? `${current}/${part}` : part;
    if (!appRef.vault.getAbstractFileByPath(current)) {
      await appRef.vault.createFolder(current);
    }
  }
}

function uniquePath(appRef, folderPath, baseName) {
  let path = `${folderPath}/${baseName}.md`;
  let index = 2;
  while (appRef.vault.getAbstractFileByPath(path)) {
    path = `${folderPath}/${baseName}-${index}.md`;
    index += 1;
  }
  return path;
}
