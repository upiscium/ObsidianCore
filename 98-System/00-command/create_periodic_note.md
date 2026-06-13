<%*
const { TFile, TFolder, Notice } = tp.obsidian;

const moment = window.moment;
const now = moment();

const year = now.format("YYYY");
const month = now.format("MM");
const today = now.format("YYYY-MM-DD");

// ===== 設定ここから =====

// Daily Note
const DAILY_FOLDER = `00-DailyNote/${year}/${month}`;
const DAILY_TITLE = today;
const DAILY_PATH = `${DAILY_FOLDER}/${DAILY_TITLE}.md`;
const DAILY_TEMPLATE_PATH = `98-System/03-template/01-note/daily-note-template.md`;

// Monthly Note
const MONTHLY_FOLDER = `01-MonthlyNote/${year}`;
const MONTHLY_TITLE = `${year}-${month}`;
const MONTHLY_PATH = `${MONTHLY_FOLDER}/${MONTHLY_TITLE}.md`;
const MONTHLY_TEMPLATE_PATH = `98-System/03-template/01-note/monthly-note-template.md`;

// 作成時にノートを開くか
const OPEN_CREATED_NOTE = false;

// 通知を出すか
const SHOW_NOTICE = true;

// ===== 設定ここまで =====

async function ensureFolder(folderPath) {
  const parts = folderPath.split("/").filter(Boolean);
  let current = "";

  for (const part of parts) {
    current = current ? `${current}/${part}` : part;

    const existing = app.vault.getAbstractFileByPath(current);

    if (!existing) {
      await app.vault.createFolder(current);
      continue;
    }

    if (!(existing instanceof TFolder)) {
      throw new Error(`フォルダとして作成したい場所に同名ファイルがあります: ${current}`);
    }
  }

  const folder = app.vault.getAbstractFileByPath(folderPath);

  if (!(folder instanceof TFolder)) {
    throw new Error(`フォルダを取得できませんでした: ${folderPath}`);
  }

  return folder;
}

function getTemplateFile(templatePath) {
  const template = app.vault.getAbstractFileByPath(templatePath);

  if (!template) {
    throw new Error(`テンプレートが見つかりません: ${templatePath}`);
  }

  if (!(template instanceof TFile)) {
    throw new Error(`テンプレートパスがファイルではありません: ${templatePath}`);
  }

  return template;
}

async function createFromTemplateIfMissing({ notePath, folderPath, title, templatePath }) {
  const existing = app.vault.getAbstractFileByPath(notePath);

  if (existing) {
    if (existing instanceof TFile) {
      return false;
    }

    throw new Error(`ノートとして作成したい場所に同名フォルダがあります: ${notePath}`);
  }

  const folder = await ensureFolder(folderPath);
  const template = getTemplateFile(templatePath);

  await tp.file.create_new(
    template,
    title,
    OPEN_CREATED_NOTE,
    folder
  );

  return true;
}

try {
  const createdDaily = await createFromTemplateIfMissing({
    notePath: DAILY_PATH,
    folderPath: DAILY_FOLDER,
    title: DAILY_TITLE,
    templatePath: DAILY_TEMPLATE_PATH,
  });

  const createdMonthly = await createFromTemplateIfMissing({
    notePath: MONTHLY_PATH,
    folderPath: MONTHLY_FOLDER,
    title: MONTHLY_TITLE,
    templatePath: MONTHLY_TEMPLATE_PATH,
  });

  if (SHOW_NOTICE && (createdDaily || createdMonthly)) {
    const created = [];

    if (createdDaily) created.push("Daily");
    if (createdMonthly) created.push("Monthly");

    new Notice(`自動生成: ${created.join(" / ")}`);
  }
} catch (error) {
  console.error(error);
  new Notice(`Periodic Note自動生成エラー: ${error.message}`);
}
%>