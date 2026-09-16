const MONTHLY_FOLDER = "01-MonthlyNote";
const WORK_HEADING = "# 今月の勤務";
const WORKPLACE = "composition";

function parseWorkDuration(value) {
  const match = String(value ?? "").trim().match(/^(\d{1,2}):([0-5]\d)$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || (hours === 24 && minutes !== 0)) return null;

  const total = hours * 60 + minutes;
  return total > 0 ? total : null;
}

function formatWorkDuration(value) {
  const total = Number(value);
  if (!Number.isInteger(total) || total < 0) return "0m";

  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
}

function buildWorkRecord(date, workMin) {
  return `- [date:: ${date}] [workplace:: ${WORKPLACE}] [work_min:: ${workMin}]`;
}

function appendWorkRecord(content, record) {
  const source = String(content ?? "");
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const lines = source.split(/\r?\n/);
  const headingIndex = lines.findIndex(line => line.trim() === WORK_HEADING);

  if (headingIndex < 0) {
    const trimmedEnd = source.replace(/[\r\n]+$/, "");
    return `${trimmedEnd}${trimmedEnd ? eol + eol : ""}${WORK_HEADING}${eol}${record}${eol}`;
  }

  let sectionEnd = headingIndex + 1;
  while (sectionEnd < lines.length && !/^#{1,6}\s+/.test(lines[sectionEnd])) {
    sectionEnd += 1;
  }

  let insertAt = sectionEnd;
  while (insertAt > headingIndex + 1 && lines[insertAt - 1].trim() === "") {
    insertAt -= 1;
  }
  lines.splice(insertAt, 0, record);
  return lines.join(eol);
}

async function addWork(tp) {
  const activeFile = app.workspace.getActiveFile();
  const activeDate = activeFile?.basename && /^\d{4}-\d{2}-\d{2}$/.test(activeFile.basename)
    ? activeFile.basename
    : null;
  const today = window.moment().format("YYYY-MM-DD");
  const defaultDate = activeDate || today;

  const dateRaw = await tp.system.prompt(
    `勤務日 (YYYY-MM-DD / 空欄=${defaultDate})`
  );
  if (dateRaw === null || dateRaw === undefined) return null;

  const date = String(dateRaw).trim() || defaultDate;
  const dateMoment = window.moment(date, "YYYY-MM-DD", true);
  if (!dateMoment.isValid()) {
    new Notice("勤務日はYYYY-MM-DD形式の実在する日付にしてください。");
    return null;
  }

  const durationRaw = await tp.system.prompt("勤務時間 (H:MM / 例: 7:30)");
  if (durationRaw === null || durationRaw === undefined) return null;

  const workMin = parseWorkDuration(durationRaw);
  if (workMin === null) {
    new Notice("勤務時間は0:01〜24:00のH:MM形式で入力してください。");
    return null;
  }

  const year = dateMoment.format("YYYY");
  const month = dateMoment.format("YYYY-MM");
  const targetPath = `${MONTHLY_FOLDER}/${year}/${month}.md`;
  const targetFile = app.vault.getFileByPath(targetPath);

  if (!targetFile) {
    new Notice(`対象のMonthly Noteが見つかりません:\n${targetPath}`);
    return null;
  }

  const current = await app.vault.read(targetFile);
  const record = buildWorkRecord(date, workMin);
  const updated = appendWorkRecord(current, record);
  await app.vault.modify(targetFile, updated);

  new Notice(`勤務時間を記録しました: ${date} / ${formatWorkDuration(workMin)}`);
  return {
    date,
    workplace: WORKPLACE,
    work_min: workMin,
    target_path: targetPath
  };
}

module.exports = addWork;
module.exports.parseWorkDuration = parseWorkDuration;
module.exports.formatWorkDuration = formatWorkDuration;
module.exports.buildWorkRecord = buildWorkRecord;
module.exports.appendWorkRecord = appendWorkRecord;
