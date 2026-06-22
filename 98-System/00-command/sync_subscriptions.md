<%*
await (async () => {
  const CONFIG = {
    registryFolder: "96-Global/00-subscription",
    monthlyFolder: "01-MonthlyNote",
    expenseHeading: "# 今月の支出",
    defaultCategory: "サブスク",
    silent: false,
  };

  const app = tp.app;

  const notify = (message, timeout = 5000) => {
    if (!CONFIG.silent) {
      new Notice(message, timeout);
    }
  };

  const fail = (message) => {
    new Notice(
      `サブスク同期エラー: ${message}`,
      8000
    );

    console.error(
      `[sync_subscriptions] ${message}`
    );

    return false;
  };

  const getFileByPath = (path) =>
    app.vault.getFileByPath?.(path) ??
    app.vault.getAbstractFileByPath(path);

  const normalizeYearMonth = (value) => {
    if (value == null) {
      return null;
    }

    if (typeof value === "string") {
      const match = value.match(
        /(\d{4})-(\d{1,2})/
      );

      if (!match) {
        return null;
      }

      const month = Number(match[2]);

      if (month < 1 || month > 12) {
        return null;
      }

      return (
        `${match[1]}-` +
        `${String(month).padStart(2, "0")}`
      );
    }

    if (
      typeof value?.toFormat === "function"
    ) {
      return value.toFormat("yyyy-MM");
    }

    if (
      value instanceof Date &&
      !Number.isNaN(value.getTime())
    ) {
      return (
        `${value.getFullYear()}-` +
        `${String(
          value.getMonth() + 1
        ).padStart(2, "0")}`
      );
    }

    return null;
  };

  const currentYearMonth = () => {
    const now = new Date();

    return (
      `${now.getFullYear()}-` +
      `${String(
        now.getMonth() + 1
      ).padStart(2, "0")}`
    );
  };

const resolveTargetMonth = () => {
  // Startup Templateなどから対象月が明示された場合は最優先
  const forcedMonth = normalizeYearMonth(
    globalThis.__subscriptionSyncTargetMonth
  );

  if (forcedMonth) {
    return forcedMonth;
  }

  // MonthlyNote上の手動同期では、そのノートの月を使用
  const activeFile =
    app.workspace.getActiveFile?.();

  const activeMonth =
    normalizeYearMonth(
      activeFile?.basename
    );

  if (activeMonth) {
    return activeMonth;
  }

  const templateMonth =
    normalizeYearMonth(tp.file.title);

  if (templateMonth) {
    return templateMonth;
  }

  return currentYearMonth();
};

  const monthIndex = (yearMonth) => {
    const [year, month] =
      yearMonth.split("-").map(Number);

    return year * 12 + month - 1;
  };

  const normalizeAmount = (value) => {
    const amount = Number(
      String(value ?? "")
        .replace(/,/g, "")
        .trim()
    );

    return (
      Number.isFinite(amount) &&
      amount >= 0
        ? amount
        : null
    );
  };

  const normalizeBoolean = (value) =>
    value === true ||
    String(value ?? "").toLowerCase() ===
      "true";

  const sanitizeInlineValue = (value) =>
    String(value ?? "")
      .replace(/\r?\n/g, " ")
      .replace(/\]/g, "）")
      .trim();

  const loadSubscriptions = () => {
    const prefix =
      `${CONFIG.registryFolder.replace(
        /\/$/,
        ""
      )}/`;

    const files = app.vault
      .getMarkdownFiles()
      .filter((file) =>
        file.path.startsWith(prefix)
      );

    const subscriptions = [];
    const errors = [];
    const seenIds = new Map();

    for (const file of files) {
      const frontmatter =
        app.metadataCache
          .getFileCache(file)
          ?.frontmatter;

      if (
        !frontmatter ||
        frontmatter.type !== "subscription"
      ) {
        continue;
      }

      const id = String(
        frontmatter.subscription_id ??
          frontmatter.id ??
          ""
      ).trim();

      if (!id) {
        errors.push(
          `${file.path}: subscription_idがありません`
        );

        continue;
      }

      if (!/^[^\s@\[\]]+$/.test(id)) {
        errors.push(
          `${file.path}: subscription_idに空白・@・角括弧は使えません`
        );

        continue;
      }

      if (seenIds.has(id)) {
        errors.push(
          `${file.path}: subscription_idが` +
          `${seenIds.get(id)}と重複しています (${id})`
        );

        continue;
      }

      seenIds.set(id, file.path);

      subscriptions.push({
        ...frontmatter,
        id,
        enabled: normalizeBoolean(
          frontmatter.enabled
        ),
        name: String(
          frontmatter.name ??
            file.basename
        ).trim(),
        __file: file.path,
      });
    }

    return {
      subscriptions,
      errors,
      scannedFiles: files.length,
    };
  };

  const validateSubscription = (
    subscription
  ) => {
    const prefix = subscription.__file;
    const errors = [];

    const cycle = String(
      subscription.cycle ?? "monthly"
    ).toLowerCase();

    const startMonth =
      normalizeYearMonth(
        subscription.start
      );

    const amount =
      normalizeAmount(
        subscription.amount
      );

    if (!subscription.name) {
      errors.push(
        `${prefix}: nameがありません`
      );
    }

    if (amount == null) {
      errors.push(
        `${prefix}: amountが不正です`
      );
    }

    if (!startMonth) {
      errors.push(
        `${prefix}: startはYYYY-MM形式で指定してください`
      );
    }

    if (
      ![
        "monthly",
        "yearly",
        "interval",
      ].includes(cycle)
    ) {
      errors.push(
        `${prefix}: cycleが不正です (${cycle})`
      );
    }

    if (cycle === "yearly") {
      const paymentMonth =
        Number(
          subscription.payment_month
        );

      if (
        !Number.isInteger(paymentMonth) ||
        paymentMonth < 1 ||
        paymentMonth > 12
      ) {
        errors.push(
          `${prefix}: 年1回ではpayment_monthを1〜12で指定してください`
        );
      }
    }

    if (cycle === "interval") {
      const intervalMonths =
        Number(
          subscription.interval_months
        );

      if (
        !Number.isInteger(
          intervalMonths
        ) ||
        intervalMonths < 1
      ) {
        errors.push(
          `${prefix}: Nか月ごとではinterval_monthsを1以上で指定してください`
        );
      }
    }

    return errors;
  };

  const isDueInMonth = (
    subscription,
    yearMonth
  ) => {
    if (!subscription.enabled) {
      return false;
    }

    const startMonth =
      normalizeYearMonth(
        subscription.start
      );

    if (
      !startMonth ||
      monthIndex(yearMonth) <
        monthIndex(startMonth)
    ) {
      return false;
    }

    const cycle = String(
      subscription.cycle ?? "monthly"
    ).toLowerCase();

    if (cycle === "monthly") {
      return true;
    }

    if (cycle === "yearly") {
      return (
        Number(
          yearMonth.split("-")[1]
        ) ===
        Number(
          subscription.payment_month
        )
      );
    }

    if (cycle === "interval") {
      const elapsed =
        monthIndex(yearMonth) -
        monthIndex(startMonth);

      return (
        elapsed %
          Number(
            subscription.interval_months
          ) ===
        0
      );
    }

    return false;
  };

  const findSectionInsertionIndex = (
    lines,
    heading
  ) => {
    const headingIndex =
      lines.findIndex(
        (line) =>
          line.trim() === heading
      );

    if (headingIndex < 0) {
      return null;
    }

    const headingMatch =
      heading.match(
        /^(#{1,6})\s+/
      );

    if (!headingMatch) {
      return null;
    }

    const headingLevel =
      headingMatch[1].length;

    let sectionEnd = lines.length;

    for (
      let index = headingIndex + 1;
      index < lines.length;
      index += 1
    ) {
      const match =
        lines[index].match(
          /^(#{1,6})\s+/
        );

      if (
        match &&
        match[1].length <= headingLevel
      ) {
        sectionEnd = index;
        break;
      }
    }

    while (
      sectionEnd > headingIndex + 1 &&
      lines[
        sectionEnd - 1
      ].trim() === ""
    ) {
      sectionEnd -= 1;
    }

    return sectionEnd;
  };

  const yearMonth =
    resolveTargetMonth();

  const [year] =
    yearMonth.split("-");

  const monthlyPath =
    `${CONFIG.monthlyFolder}/` +
    `${year}/${yearMonth}.md`;

  const {
    subscriptions,
    errors: loadErrors,
    scannedFiles,
  } = loadSubscriptions();

  if (loadErrors.length > 0) {
    console.error(
      "[sync_subscriptions] Load errors:",
      loadErrors
    );

    fail(
      "台帳の設定エラー: " +
      loadErrors
        .slice(0, 3)
        .join(" / ")
    );

    return;
  }

  if (subscriptions.length === 0) {
    fail(
      scannedFiles === 0
        ? `サブスクノートがありません: ${CONFIG.registryFolder}`
        : "type: subscriptionのノートがありません"
    );

    return;
  }

  const validationErrors =
    subscriptions
      .filter(
        (subscription) =>
          subscription.enabled
      )
      .flatMap(
        validateSubscription
      );

  if (
    validationErrors.length > 0
  ) {
    console.error(
      "[sync_subscriptions] Validation errors:",
      validationErrors
    );

    fail(
      "有効なサブスクの設定エラー: " +
      validationErrors
        .slice(0, 3)
        .join(" / ")
    );

    return;
  }

  const monthlyFile =
    getFileByPath(monthlyPath);

  if (
    !monthlyFile ||
    monthlyFile.extension !== "md"
  ) {
    fail(
      `MonthlyNoteが見つかりません: ${monthlyPath}`
    );

    return;
  }

  let added = 0;

  try {
    await app.vault.process(
      monthlyFile,
      (content) => {
        const existingKeys =
          new Set(
            [
              ...content.matchAll(
                /\[subscription_key::\s*([^\]]+?)\s*\]/g
              ),
            ].map(
              (match) =>
                match[1].trim()
            )
          );

        const newLines = [];

        for (
          const subscription
          of subscriptions
        ) {
          if (
            !isDueInMonth(
              subscription,
              yearMonth
            )
          ) {
            continue;
          }

          const id =
            sanitizeInlineValue(
              subscription.id
            );

          const name =
            sanitizeInlineValue(
              subscription.name
            );

          const amount =
            normalizeAmount(
              subscription.amount
            );

          const category =
            sanitizeInlineValue(
              subscription.category ||
                CONFIG.defaultCategory
            );

          const key =
            `${id}@${yearMonth}`;

          if (
            existingKeys.has(key)
          ) {
            continue;
          }

          newLines.push(
            `- [date:: ${yearMonth}-01] ` +
            `[expense:: ${amount}] ` +
            `[cat:: ${category}] ` +
            `[memo:: ${name}] ` +
            `[subscription_key:: ${key}]`
          );

          existingKeys.add(key);
        }

        if (
          newLines.length === 0
        ) {
          return content;
        }

        const newline =
          content.includes("\r\n")
            ? "\r\n"
            : "\n";

        const lines =
          content.split(/\r?\n/);

        const insertionIndex =
          findSectionInsertionIndex(
            lines,
            CONFIG.expenseHeading
          );

        if (
          insertionIndex == null
        ) {
          throw new Error(
            `挿入先の見出しが見つかりません: ${CONFIG.expenseHeading}`
          );
        }

        const block = [];

        if (
          insertionIndex > 0 &&
          lines[
            insertionIndex - 1
          ].trim() !== ""
        ) {
          block.push("");
        }

        block.push(
          ...newLines,
          ""
        );

        lines.splice(
          insertionIndex,
          0,
          ...block
        );

        added = newLines.length;

        return lines.join(newline);
      }
    );
  } catch (error) {
    fail(
      error?.message ??
        String(error)
    );

    return;
  }

  notify(
    added > 0
      ? `サブスク同期: ${yearMonth}に${added}件追加しました`
      : `サブスク同期: ${yearMonth}は追加対象なしです`
  );
})();
%>