async function loadSubscriptionUtils(appRef) {
  const path = "98-System/05-lib/finance/subscription_runtime_utils.js";
  const file = appRef.vault.getAbstractFileByPath(path);
  if (!file || file.extension !== "js") {
    throw new Error(`Subscription utilityが見つかりません: ${path}`);
  }
  const source = await appRef.vault.read(file);
  return new Function(`"use strict"; return (${source});`)();
}

module.exports = async function syncSubscriptions(tp, targetMonth = null, options = {}) {
  const appRef = tp?.app ?? globalThis.app;
  if (!appRef?.vault) throw new Error("Obsidian Vault is required");

  const U = await loadSubscriptionUtils(appRef);
  const silent = options?.silent === true;

  const notify = (message, timeout = 5000) => {
    if (!silent && typeof Notice !== "undefined") new Notice(message, timeout);
  };

  const fail = (message, details = []) => {
    if (typeof Notice !== "undefined") {
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

  const yearMonth = resolveTargetMonth();
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

  let added = 0;

  try {
    await appRef.vault.process(monthlyFile, content => {
      const existingKeys = new Set(
        [...content.matchAll(/\[subscription_key::\s*([^\]]+?)\s*\]/g)]
          .map(match => match[1].trim())
      );

      const newLines = [];

      for (const subscription of loaded.subscriptions) {
        if (!U.isDueInMonth(subscription, yearMonth)) continue;

        const key = U.subscriptionKey(subscription, yearMonth);
        if (!key || existingKeys.has(key)) continue;

        newLines.push(
          `- [date:: ${yearMonth}-01] ` +
          `[expense:: ${subscription.amount}] ` +
          `[cat:: ${U.sanitizeInlineValue(subscription.category)}] ` +
          `[memo:: ${U.sanitizeInlineValue(subscription.name)}] ` +
          `[subscription_key:: ${key}]`
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
