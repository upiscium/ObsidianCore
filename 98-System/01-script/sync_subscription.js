const CONFIG = {
  registryPath: "98-System/05-data/subscriptions.md",
  monthlyFolder: "01-MonthlyNote",
  expenseHeading: "# 今月の支出",
  defaultCategory: "サブスク",
};

module.exports = async (tp, targetMonth = null, options = {}) => {
  const silent = options?.silent === true;

  const notify = (message, timeout = 5000) => {
    if (!silent && typeof Notice !== "undefined") {
      new Notice(message, timeout);
    }
  };

  const fail = (message) => {
    if (typeof Notice !== "undefined") {
      new Notice(`サブスク同期エラー: ${message}`, 8000);
    }
    console.error(`[sync_subscriptions] ${message}`);
    return { ok: false, added: 0, message };
  };

  const getFileByPath = (path) =>
    app.vault.getFileByPath?.(path) ?? app.vault.getAbstractFileByPath(path);

  const normalizeYearMonth = (value) => {
    if (value == null) return null;

    if (typeof value === "string") {
      const match = value.match(/(\d{4})-(\d{2})/);
      return match ? `${match[1]}-${match[2]}` : null;
    }

    if (typeof value?.toFormat === "function") {
      return value.toFormat("yyyy-MM");
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
    }

    return null;
  };

  const currentYearMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  };

  const resolveTargetMonth = () => {
    const explicit = normalizeYearMonth(targetMonth);
    if (explicit) return explicit;

    const activeFile = app.workspace.getActiveFile?.();
    const activeMonth = normalizeYearMonth(activeFile?.basename);
    if (activeMonth) return activeMonth;

    const tpMonth = normalizeYearMonth(tp?.file?.title);
    if (tpMonth) return tpMonth;

    return currentYearMonth();
  };

  const monthIndex = (yearMonth) => {
    const [year, month] = yearMonth.split("-").map(Number);
    return year * 12 + month - 1;
  };

  const normalizeAmount = (value) => {
    const amount = Number(String(value ?? "").replace(/,/g, "").trim());
    return Number.isFinite(amount) && amount >= 0 ? amount : null;
  };

  const sanitizeInlineValue = (value) =>
    String(value ?? "")
      .replace(/\r?\n/g, " ")
      .replace(/\]/g, "）")
      .trim();

  const parseRegistry = (content) => {
    const subscriptions = [];
    const parseErrors = [];
    const seenIds = new Map();
    const lines = content.split(/\r?\n/);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const checkboxMatch = line.match(/^\s*-\s*\[([ xX])\]\s*(.*)$/);
      if (!checkboxMatch) continue;

      const enabled = checkboxMatch[1].toLowerCase() === "x";
      const body = checkboxMatch[2];
      const fields = {};

      for (const match of body.matchAll(/\[([A-Za-z0-9_-]+)::\s*([^\]]*?)\s*\]/g)) {
        fields[match[1]] = match[2].trim();
      }

      const lineNumber = index + 1;
      const id = String(fields.id ?? "").trim();

      if (!id) {
        parseErrors.push(`L${lineNumber}: idがありません`);
        continue;
      }

      if (!/^[^\s@\[\]]+$/.test(id)) {
        parseErrors.push(`L${lineNumber}: idに空白・@・角括弧は使用できません (${id})`);
        continue;
      }

      if (seenIds.has(id)) {
        parseErrors.push(
          `L${lineNumber}: idが重複しています (${id}, 最初はL${seenIds.get(id)})`
        );
        continue;
      }

      seenIds.set(id, lineNumber);
      subscriptions.push({
        ...fields,
        id,
        enabled,
        __line: lineNumber,
      });
    }

    return { subscriptions, parseErrors };
  };

  const validateSubscription = (subscription) => {
    const line = `L${subscription.__line}`;
    const errors = [];
    const cycle = String(subscription.cycle ?? "monthly").toLowerCase();
    const startMonth = normalizeYearMonth(subscription.start);
    const amount = normalizeAmount(subscription.amount);

    if (!String(subscription.name ?? "").trim()) {
      errors.push(`${line}: nameがありません`);
    }

    if (amount == null) {
      errors.push(`${line}: amountが不正です`);
    }

    if (!startMonth) {
      errors.push(`${line}: startはYYYY-MM形式で指定してください`);
    }

    if (!["monthly", "yearly", "interval"].includes(cycle)) {
      errors.push(`${line}: cycleが不正です (${cycle})`);
    }

    if (cycle === "yearly") {
      const paymentMonth = Number(subscription.payment_month);
      if (!Number.isInteger(paymentMonth) || paymentMonth < 1 || paymentMonth > 12) {
        errors.push(`${line}: yearlyではpayment_monthを1〜12で指定してください`);
      }
    }

    if (cycle === "interval") {
      const intervalMonths = Number(subscription.interval_months);
      if (!Number.isInteger(intervalMonths) || intervalMonths < 1) {
        errors.push(`${line}: intervalではinterval_monthsを1以上で指定してください`);
      }
    }

    return errors;
  };

  const isDueInMonth = (subscription, yearMonth) => {
    if (!subscription?.enabled) return false;

    const startMonth = normalizeYearMonth(subscription.start);
    if (!startMonth || monthIndex(yearMonth) < monthIndex(startMonth)) {
      return false;
    }

    const cycle = String(subscription.cycle ?? "monthly").toLowerCase();

    if (cycle === "monthly") return true;

    if (cycle === "yearly") {
      return Number(yearMonth.split("-")[1]) === Number(subscription.payment_month);
    }

    if (cycle === "interval") {
      const elapsedMonths = monthIndex(yearMonth) - monthIndex(startMonth);
      return elapsedMonths % Number(subscription.interval_months) === 0;
    }

    return false;
  };

  const findSectionInsertionIndex = (lines, heading) => {
    const headingIndex = lines.findIndex((line) => line.trim() === heading);
    if (headingIndex < 0) return null;

    const headingMatch = heading.match(/^(#{1,6})\s+/);
    if (!headingMatch) return null;

    const headingLevel = headingMatch[1].length;
    let sectionEnd = lines.length;

    for (let i = headingIndex + 1; i < lines.length; i += 1) {
      const match = lines[i].match(/^(#{1,6})\s+/);
      if (match && match[1].length <= headingLevel) {
        sectionEnd = i;
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
  const monthlyPath = `${CONFIG.monthlyFolder}/${year}/${yearMonth}.md`;

  const registryFile = getFileByPath(CONFIG.registryPath);
  if (!registryFile || registryFile.extension !== "md") {
    return fail(`サブスク台帳が見つかりません: ${CONFIG.registryPath}`);
  }

  let registryContent;
  try {
    registryContent = await app.vault.cachedRead(registryFile);
  } catch (error) {
    return fail(`サブスク台帳を読み込めません: ${error?.message ?? error}`);
  }

  const { subscriptions, parseErrors } = parseRegistry(registryContent);
  if (parseErrors.length > 0) {
    console.error("[sync_subscriptions] Registry errors:", parseErrors);
    return fail(`台帳の書式エラー: ${parseErrors.slice(0, 3).join(" / ")}`);
  }

  if (subscriptions.length === 0) {
    return fail("サブスク台帳にチェックボックス形式の登録行がありません。");
  }

  const activeSubscriptions = subscriptions.filter((subscription) => subscription.enabled);
  const validationErrors = activeSubscriptions.flatMap(validateSubscription);
  if (validationErrors.length > 0) {
    console.error("[sync_subscriptions] Validation errors:", validationErrors);
    return fail(`台帳の設定エラー: ${validationErrors.slice(0, 3).join(" / ")}`);
  }

  const monthlyFile = getFileByPath(monthlyPath);
  if (!monthlyFile || monthlyFile.extension !== "md") {
    return fail(`MonthlyNoteが見つかりません: ${monthlyPath}`);
  }

  let added = 0;

  try {
    await app.vault.process(monthlyFile, (content) => {
      const existingKeys = new Set(
        [...content.matchAll(/\[subscription_key::\s*([^\]]+?)\s*\]/g)].map(
          (match) => match[1].trim()
        )
      );

      const newLines = [];

      for (const subscription of subscriptions) {
        if (!isDueInMonth(subscription, yearMonth)) continue;

        const id = sanitizeInlineValue(subscription.id);
        const name = sanitizeInlineValue(subscription.name);
        const amount = normalizeAmount(subscription.amount);
        const category = sanitizeInlineValue(
          subscription.category || CONFIG.defaultCategory
        );
        const key = `${id}@${yearMonth}`;

        if (existingKeys.has(key)) continue;

        newLines.push(
          `- [date:: ${yearMonth}-01] [expense:: ${amount}] [cat:: ${category}] [memo:: ${name}] [subscription_key:: ${key}]`
        );
        existingKeys.add(key);
      }

      if (newLines.length === 0) return content;

      const newline = content.includes("\r\n") ? "\r\n" : "\n";
      const lines = content.split(/\r?\n/);
      const insertionIndex = findSectionInsertionIndex(lines, CONFIG.expenseHeading);

      if (insertionIndex == null) {
        throw new Error(`挿入先の見出しが見つかりません: ${CONFIG.expenseHeading}`);
      }

      const block = [];
      if (insertionIndex > 0 && lines[insertionIndex - 1].trim() !== "") {
        block.push("");
      }
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
      ? `サブスク同期: ${yearMonth}に${added}件追加しました。`
      : `サブスク同期: ${yearMonth}は追加対象なしです。`
  );

  return {
    ok: true,
    added,
    targetMonth: yearMonth,
    targetPath: monthlyPath,
  };
};
