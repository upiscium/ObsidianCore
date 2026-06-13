module.exports = async (params) => {
  const { quickAddApi, variables } = params;

  const categories = [
    "食費",
    "日用品",
    "交通",
    "学業",
    "書籍",
    "研究",
    "開発",
    "サーバ",
    "ガジェット",
    "サブスク",
    "医療",
    "衣服",
    "交際",
    "娯楽",
    "固定費",
    "その他"
  ];

  const pays = [
    "現金",
    "クレカ",
    "PayPay",
    "Suica",
    "銀行",
    "その他"
  ];

  const today = window.moment().format("YYYY-MM-DD");

  const dateRaw = await quickAddApi.inputPrompt(
    `日付を入力（空なら ${today}）`
  );

  const date = dateRaw && String(dateRaw).trim()
    ? String(dateRaw).trim()
    : today;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    new Notice("日付は YYYY-MM-DD 形式で入力してください。");
    throw new Error("Invalid date format");
  }

  const dateMoment = window.moment(date, "YYYY-MM-DD", true);

  if (!dateMoment.isValid()) {
    new Notice("存在しない日付です。");
    throw new Error("Invalid date value");
  }

  const targetYear = dateMoment.format("YYYY");
  const targetMonth = dateMoment.format("YYYY-MM");
  const targetPath = `01-MonthlyNote/${targetYear}/${targetMonth}`;

  let cat = await quickAddApi.suggester(categories, categories);
  if (!cat) throw new Error("カテゴリ選択がキャンセルされました。");

  let pay = await quickAddApi.suggester(pays, pays);
  if (!pay) throw new Error("決済手段選択がキャンセルされました。");

  const amountRaw = await quickAddApi.inputPrompt("金額を入力");
  if (!amountRaw) throw new Error("金額入力がキャンセルされました。");

  const amount = Number(String(amountRaw).replace(/[,\s円¥]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) {
    new Notice("金額が不正です。数字だけで入力してください。");
    throw new Error("Invalid expense amount");
  }

  const memoRaw = await quickAddApi.inputPrompt("メモを入力");
  const memo = memoRaw ? memoRaw.trim() : "";

  variables["targetPath"] = targetPath;

  variables["expenseDate"] = date;
  variables["expenseCat"] = cat;
  variables["expensePay"] = pay;
  variables["expenseAmount"] = String(amount);
  variables["expenseMemo"] = memo;
};