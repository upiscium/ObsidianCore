<%*
const year = moment().format("YYYY");
const month = moment().format("MM");

const path = `01-MonthlyNote/${year}/${year}-${month}.md`;
const file = app.vault.getFileByPath(path);

if (!file) {
  new Notice(`今月のMonthly Noteが見つかりません:\n${path}`);
  return;
}

await app.workspace.getLeaf(false).openFile(file);
%>