async function loadLib(path) {
  const source = await dv.io.load(path);
  if (!source) throw new Error(`Dataview library not found: ${path}`);
  return new Function("dv", `"use strict"; return (${source});`)(dv);
}

async function loadTaskReferenceLib() {
  const genericSource = await dv.io.load("98-System/01-script/reference_utils.js");
  const taskSource = await dv.io.load("98-System/01-script/task_reference_utils.js");
  if (!genericSource) throw new Error("Dataview library not found: 98-System/01-script/reference_utils.js");
  if (!taskSource) throw new Error("Dataview library not found: 98-System/01-script/task_reference_utils.js");
  const G = new Function(`"use strict"; return (${genericSource});`)();
  const factory = new Function(`"use strict"; return (${taskSource});`)();
  return factory(G);
}

const U = await loadLib("98-System/01-script/task_meta_utils.js");
const R = await loadTaskReferenceLib();
const config = { mode:"primary", source:'"02-Task"', emptyMessage:"対象のTaskはありません。", project:null, workspace:null, ...(input ?? {}) };
const today = dv.date("today").startOf("day");
const primaryLimit = today.plus({ days: 14 });
const farFuture = dv.date("9999-12-31").startOf("day");
const farPast = dv.date("0001-01-01").startOf("day");

function d(value){ return U.dateOnly(value,dv); }
function dateOrFuture(value){ return d(value) ?? farFuture; }
function dateOrPast(value){ return d(value) ?? farPast; }
function compareDate(a,b){ return dv.compare(dateOrFuture(a),dateOrFuture(b)); }
function lt(value,target){ const date=d(value); return date&&dv.compare(date,target)<0; }
function lte(value,target){ const date=d(value); return date&&dv.compare(date,target)<=0; }
function eq(value,target){ const date=d(value); return date&&dv.compare(date,target)===0; }
function matchesContext(task){ return R.matchesReference(task.project,config.project)&&R.matchesReference(task.workspace,config.workspace); }
function referenceDisplay(value){ return R.dataviewReferenceDisplay(dv,value); }
function taskTitle(task){ return String(task.title??"").trim()||R.stripTaskTimestamp(task.file.name)||task.file.name; }
function taskLink(task){ return dv.fileLink(task.file.path,false,taskTitle(task)); }
function isOpen(task){ return U.isTaskActionableStatus(task.status); }
function isBacklog(task){ return task.backlog===true; }
function isTriaged(task){ return task.triaged!==false; }
function startReady(task){ return !task.start||lte(task.start,today); }
function isPrimary(task){
  if(!isOpen(task)||isBacklog(task)||!isTriaged(task))return false;
  if(U.isTaskDoingStatus(task.status))return true;
  if(!startReady(task))return false;
  const due=d(task.due); if(due&&dv.compare(due,today)<=0)return false;
  const dueWithinTwoWeeks=due&&dv.compare(due,primaryLimit)<=0;
  const highPriority=U.normalizeTaskPriority(task.priority)==="high";
  return dueWithinTwoWeeks||highPriority;
}

function dependencyInfo(task){ return R.dependencyInfo(dv,task,U.isTaskClosedStatus); }
function dependencyReason(task){
  const info=dependencyInfo(task), parts=[];
  if(info.cyclic)parts.push("循環依存");
  if(info.unresolved.length>0)parts.push(info.unresolved.map(page=>String(page.title??R.stripTaskTimestamp(page.file.name))).join(", "));
  if(info.missing.length>0)parts.push(`参照不明: ${info.missing.join(", ")}`);
  return parts.join(" / ");
}
function effectiveStatus(task){ const reason=dependencyReason(task); return reason?`⛔ Blocked — ${reason}`:U.taskStatusLabel(task.status); }

function getTaskFile(task){ const file=app.vault.getAbstractFileByPath(task.file.path); if(!file||file.extension!=="md")throw new Error(`Taskファイルが見つかりません: ${task.file.path}`); return file; }
async function setTaskStatus(task,nextStatus){ const file=getTaskFile(task); await app.fileManager.processFrontMatter(file,fm=>{ fm.status=nextStatus; fm.completed=nextStatus==="done"?(fm.completed||window.moment().format("YYYY-MM-DD")):null; }); }
function createDoneToggle(task){ const checkbox=document.createElement("input"); checkbox.type="checkbox"; checkbox.checked=false; checkbox.setAttribute("aria-label","Taskを完了にする"); checkbox.addEventListener("change",async event=>{ if(!event.target.checked)return; checkbox.disabled=true; try{ await setTaskStatus(task,"done"); checkbox.closest("tr")?.remove(); new Notice(`Taskを完了しました: ${taskTitle(task)}`); }catch(error){ console.error(error); checkbox.checked=false; checkbox.disabled=false; new Notice("Taskの完了処理に失敗しました。"); }}); return checkbox; }
function createTriagedToggle(task){ const checkbox=document.createElement("input"); checkbox.type="checkbox"; checkbox.checked=task.triaged===true; checkbox.setAttribute("aria-label","Taskを整理済みにする"); checkbox.addEventListener("change",async()=>{ checkbox.disabled=true; try{ const file=getTaskFile(task); await app.fileManager.processFrontMatter(file,fm=>{fm.triaged=checkbox.checked;}); if(config.mode==="inbox"&&checkbox.checked)checkbox.closest("tr")?.remove(); }catch(error){ console.error(error); checkbox.checked=!checkbox.checked; new Notice("整理済み状態の更新に失敗しました。"); }finally{ checkbox.disabled=false; }}); return checkbox; }
function createBacklogPromoteButton(task){ const button=document.createElement("button"); button.type="button"; button.textContent="Inboxへ"; button.setAttribute("aria-label","BacklogからInboxへ移動する"); button.addEventListener("click",async()=>{ button.disabled=true; try{ const file=getTaskFile(task); await app.fileManager.processFrontMatter(file,fm=>{fm.backlog=false;fm.triaged=false;}); button.closest("tr")?.remove(); new Notice(`Inboxへ移動しました: ${taskTitle(task)}`); }catch(error){ console.error(error); button.disabled=false; new Notice("Backlogからの移動に失敗しました。"); }}); return button; }

let tasks=Array.from(dv.pages(config.source).where(task=>U.isTaskType(task.type)).where(matchesContext));
switch(config.mode){
  case "overdue": tasks=tasks.filter(task=>isOpen(task)&&!isBacklog(task)&&task.due&&lt(task.due,today)); break;
  case "today": tasks=tasks.filter(task=>isOpen(task)&&!isBacklog(task)&&task.due&&eq(task.due,today)); break;
  case "primary": tasks=tasks.filter(isPrimary); break;
  case "inbox": tasks=tasks.filter(task=>isOpen(task)&&!isBacklog(task)&&task.triaged===false); break;
  case "backlog": tasks=tasks.filter(task=>isOpen(task)&&isBacklog(task)); break;
  default: throw new Error(`Unknown task-table mode: ${config.mode}`);
}
function statusRank(task){ if(dependencyInfo(task).blocked)return 2; if(U.isTaskDoingStatus(task.status))return 0; return 1; }
tasks.sort((a,b)=>{
  if(config.mode==="backlog")return dv.compare(a.file.mtime,b.file.mtime);
  if(config.mode==="inbox"){ const created=dv.compare(dateOrPast(b.created),dateOrPast(a.created)); if(created!==0)return created; return dv.compare(b.file.ctime,a.file.ctime); }
  if(config.mode==="primary"){ const status=statusRank(a)-statusRank(b); if(status!==0)return status; }
  const due=compareDate(a.due,b.due); if(due!==0)return due;
  const priority=U.taskPriorityOrder(a.priority)-U.taskPriorityOrder(b.priority); if(priority!==0)return priority;
  return compareDate(a.start,b.start);
});

if(tasks.length===0){ dv.paragraph(config.emptyMessage); } else {
  const commonHeaders=["完了","Task","Status","Priority","Start","Due","Workspace","Project"];
  const commonRow=task=>[createDoneToggle(task),taskLink(task),effectiveStatus(task),U.taskPriorityLabel(task.priority),U.formatDate(task.start),U.formatDate(task.due),referenceDisplay(task.workspace),referenceDisplay(task.project)];
  if(config.mode==="backlog"){
    dv.table(["昇格","Task","Status","Priority","Workspace","Project","Modified"],tasks.map(task=>[createBacklogPromoteButton(task),taskLink(task),effectiveStatus(task),U.taskPriorityLabel(task.priority),referenceDisplay(task.workspace),referenceDisplay(task.project),U.formatDate(task.file.mday)]));
  } else if(config.mode==="inbox"){
    dv.table(["整理",...commonHeaders,"Source","Created"],tasks.map(task=>[createTriagedToggle(task),...commonRow(task),referenceDisplay(task.source),U.formatDate(task.created)]));
  } else {
    dv.table(commonHeaders,tasks.map(commonRow));
  }
}
