async function loadSubscriptionUtils(appRef) {
  const path = "98-System/05-lib/finance/subscription_runtime_utils.js";
  const file = appRef.vault.getAbstractFileByPath(path);
  if (!file || file.extension !== "js") {
    throw new Error(`Subscription utilityが見つかりません: ${path}`);
  }
  const source = await appRef.vault.read(file);
  return new Function(`"use strict"; return (${source});`)();
}

async function loadSubscriptionFxUtils(appRef) {
  const path = "98-System/05-lib/finance/subscription_fx_utils.js";
  const file = appRef.vault.getAbstractFileByPath(path);
  if (!file || file.extension !== "js") throw new Error("Subscription FX utilityが見つかりません");
  return new Function(`"use strict"; return (${await appRef.vault.read(file)});`)();
}

// Startup auto uses the Japan calendar regardless of phone/PC travel timezone.
function japanToday() {
  const fields = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = type => fields.find(field => field.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

module.exports = async function syncSubscriptions(tp, targetMonth = null, options = {}) {
  const appRef = tp?.app ?? globalThis.app;
  if (!appRef?.vault) throw new Error("Obsidian Vault is required");

  const U = await loadSubscriptionUtils(appRef);
  const silent = options?.silent === true;
  const automatic = options?.automatic === true;
  const today = options?.today ?? japanToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || Number.isNaN(Date.parse(`${today}T00:00:00Z`))) {
    throw new Error("Invalid automatic subscription date");
  }

  const notify = (message, timeout = 5000) => {
    if (!silent && typeof Notice !== "undefined") new Notice(message, timeout);
  };

  const fail = (message, details = []) => {
    if (!silent && typeof Notice !== "undefined") {
      new Notice(`サブスク同期エラー: ${message}`, 8000);
    }
    console.error("[sync_subscriptions]", message, details);
    return { ok: false, added: 0, message, details };
  };

  const getFileByPath = path =>
    appRef.vault.getFileByPath?.(path) ?? appRef.vault.getAbstractFileByPath(path);

  const resolveTargetMonth = () => {
    const explicit = U.normalizeYearMonth(targetMonth);
    if (explicit) return explicit;

    const forced = U.normalizeYearMonth(globalThis.__subscriptionSyncTargetMonth);
    if (forced) return forced;

    const activeMonth = U.normalizeYearMonth(appRef.workspace.getActiveFile?.()?.basename);
    if (activeMonth) return activeMonth;

    const templateMonth = U.normalizeYearMonth(tp?.file?.title);
    if (templateMonth) return templateMonth;

    return U.currentYearMonth();
  };

  const loadSubscriptions = () => {
    const prefix = `${U.CONFIG.registryFolder.replace(/\/$/, "")}/`;
    const files = appRef.vault.getMarkdownFiles().filter(file => file.path.startsWith(prefix));

    const subscriptions = [];
    const errors = [];
    const seenIds = new Map();

    for (const file of files) {
      const frontmatter = appRef.metadataCache.getFileCache(file)?.frontmatter;
      if (!frontmatter || frontmatter.type !== "subscription") continue;

      const subscription = U.normalizeSubscription(frontmatter, {
        filePath: file.path,
        fileName: file.basename,
      });

      if (!subscription.id) {
        errors.push(`${file.path}: subscription_idがありません`);
        continue;
      }
      if (!U.validSubscriptionId(subscription.id)) {
        errors.push(`${file.path}: subscription_idに空白・@・角括弧は使えません`);
        continue;
      }
      if (seenIds.has(subscription.id)) {
        errors.push(
          `${file.path}: subscription_idが${seenIds.get(subscription.id)}と重複しています (${subscription.id})`
        );
        continue;
      }

      seenIds.set(subscription.id, file.path);
      subscriptions.push(subscription);
    }

    return { subscriptions, errors, scannedFiles: files.length };
  };

  const findSectionInsertionIndex = (lines, heading) => {
    const headingIndex = lines.findIndex(line => line.trim() === heading);
    if (headingIndex < 0) return null;

    const headingMatch = heading.match(/^(#{1,6})\s+/);
    if (!headingMatch) return null;

    const headingLevel = headingMatch[1].length;
    let sectionEnd = lines.length;

    for (let index = headingIndex + 1; index < lines.length; index += 1) {
      const match = lines[index].match(/^(#{1,6})\s+/);
      if (match && match[1].length <= headingLevel) {
        sectionEnd = index;
        break;
      }
    }

    while (sectionEnd > headingIndex + 1 && lines[sectionEnd - 1].trim() === "") {
      sectionEnd -= 1;
    }
    return sectionEnd;
  };

  const yearMonth = automatic ? today.slice(0, 7) : resolveTargetMonth();
  if (automatic && targetMonth != null && U.normalizeYearMonth(targetMonth) !== yearMonth) {
    return fail("自動同期は現在月のみ処理できます");
  }
  const [year] = yearMonth.split("-");
  const monthlyPath = `${U.CONFIG.monthlyFolder}/${year}/${yearMonth}.md`;
  const loaded = loadSubscriptions();

  if (loaded.errors.length > 0) {
    return fail(
      `台帳の設定エラー: ${loaded.errors.slice(0, 3).join(" / ")}`,
      loaded.errors
    );
  }

  if (loaded.subscriptions.length === 0) {
    if (automatic) return { ok: true, added: 0, targetMonth: yearMonth, reason: "empty_registry" };
    return fail(
      loaded.scannedFiles === 0
        ? `サブスクノートがありません: ${U.CONFIG.registryFolder}`
        : "type: subscriptionのノートがありません"
    );
  }

  const validationErrors = loaded.subscriptions
    .filter(subscription => subscription.enabled)
    .flatMap(U.validateSubscription);

  if (validationErrors.length > 0) {
    return fail(
      `有効なサブスクの設定エラー: ${validationErrors.slice(0, 3).join(" / ")}`,
      validationErrors
    );
  }


  const monthlyFile = getFileByPath(monthlyPath);
  if (!monthlyFile || monthlyFile.extension !== "md") {
    return fail(`MonthlyNoteが見つかりません: ${monthlyPath}`);
  }

  // Snapshot only: the transactional vault.process callback repeats the key check.
  // Never fetch FX for entries which are already posted.
  let snapshot;
  try {
    snapshot = await appRef.vault.read(monthlyFile);
  } catch (error) {
    return fail(`MonthlyNoteを読み込めません: ${error?.message ?? String(error)}`);
  }
  const existingKeys = new Set(
    [...snapshot.matchAll(/\[subscription_key::\s*([^\]]+?)\s*\]/g)]
      .map(match => match[1].trim())
  );
  const due = loaded.subscriptions
    .filter(subscription => U.isDueInMonth(subscription, yearMonth))
    .filter(subscription => !automatic ||
      U.billingDateInMonth(subscription, yearMonth) <= today)
    .filter(subscription => !existingKeys.has(U.subscriptionKey(subscription, yearMonth)));

  let quote = null;
  if (due.some(subscription => subscription.currency === "USD" &&
      subscription.exchange_rate_mode === "auto")) {
    try {
      const FX = await loadSubscriptionFxUtils(appRef);
      const request = options?.requestUrl ?? tp?.obsidian?.requestUrl ??
        globalThis.requestUrl;
      quote = await FX.loadLatestUsdJpy(request, today);
    } catch (error) {
      return fail(`USDJPY参照レートを取得できません: ${error?.message ?? String(error)}`);
    }
  }

  const planned = due.map(subscription => {
    const auto = subscription.currency === "USD" && subscription.exchange_rate_mode === "auto";
    const rate = auto ? quote?.rate : subscription.exchange_rate_jpy_per_usd;
    return {
      subscription,
      dueDate: U.billingDateInMonth(subscription, yearMonth),
      yenAmount: U.yenExpenseAmount(subscription, auto ? rate : null),
      rate,
      quote: auto ? quote : null,
    };
  });
  const invalid = planned.find(({ dueDate, yenAmount }) => !dueDate || yenAmount == null);
  if (invalid) {
    return fail(`${invalid.subscription.__file ?? invalid.subscription.name}: 課金日または円換算額が不正です`);
  }

  let added = 0;

  try {
    await appRef.vault.process(monthlyFile, content => {
      const existingKeys = new Set(
        [...content.matchAll(/\[subscription_key::\s*([^\]]+?)\s*\]/g)]
          .map(match => match[1].trim())
      );

      const newLines = [];

      for (const { subscription, dueDate, yenAmount, rate, quote } of planned) {
        const key = U.subscriptionKey(subscription, yearMonth);
        if (!key || existingKeys.has(key)) continue;

        const foreignFields = subscription.currency === "USD"
          ? ` [original_amount:: ${subscription.amount}]` +
            ` [original_currency:: USD]` +
            ` [exchange_rate_jpy_per_usd:: ${rate}]` +
            ` [exchange_rate_basis:: ${quote ? quote.basis : "manual_estimate"}]` +
            (quote ? ` [exchange_rate_source:: ${quote.source}]` +
              ` [exchange_rate_date:: ${quote.date}]` : "")
          : "";

        newLines.push(
          `- [date:: ${dueDate}] ` +
          `[expense:: ${yenAmount}] ` +
          `[cat:: ${U.sanitizeInlineValue(subscription.category)}] ` +
          `[memo:: ${U.sanitizeInlineValue(subscription.name)}] ` +
          `[subscription_key:: ${key}]` + foreignFields
        );
        existingKeys.add(key);
      }

      if (newLines.length === 0) return content;

      const newline = content.includes("\r\n") ? "\r\n" : "\n";
      const lines = content.split(/\r?\n/);
      const insertionIndex = findSectionInsertionIndex(lines, U.CONFIG.expenseHeading);

      if (insertionIndex == null) {
        throw new Error(`挿入先の見出しが見つかりません: ${U.CONFIG.expenseHeading}`);
      }

      const block = [];
      if (insertionIndex > 0 && lines[insertionIndex - 1].trim() !== "") block.push("");
      block.push(...newLines, "");

      lines.splice(insertionIndex, 0, ...block);
      added = newLines.length;
      return lines.join(newline);
    });
  } catch (error) {
    return fail(error?.message ?? String(error));
  }

  notify(
    added > 0
      ? `サブスク同期: ${yearMonth}に${added}件追加しました`
      : `サブスク同期: ${yearMonth}は追加対象なしです`
  );

  return {
    ok: true,
    added,
    targetMonth: yearMonth,
    targetPath: monthlyPath,
  };
};
