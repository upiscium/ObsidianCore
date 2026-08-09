async function loadLib(path) {
  const source = await dv.io.load(path);
  if (!source) throw new Error(`Dataview library not found: ${path}`);
  return new Function("dv", `"use strict"; return (${source});`)(dv);
}

async function loadTaskReferenceLibs() {
  const genericSource = await dv.io.load("98-System/01-script/reference_utils.js");
  const runtimeSource = await dv.io.load("98-System/01-script/reference_runtime_utils.js");
  const taskSource = await dv.io.load("98-System/01-script/task_reference_utils.js");
  if (!genericSource) throw new Error("Dataview library not found: 98-System/01-script/reference_utils.js");
  if (!runtimeSource) throw new Error("Dataview library not found: 98-System/01-script/reference_runtime_utils.js");
  if (!taskSource) throw new Error("Dataview library not found: 98-System/01-script/task_reference_utils.js");
  const G = new Function(`"use strict"; return (${genericSource});`)();
  const runtimeFactory = new Function(`"use strict"; return (${runtimeSource});`)();
  const taskFactory = new Function(`"use strict"; return (${taskSource});`)();
  const X = runtimeFactory(G);
  return { G, X, R: taskFactory(G, X) };
}

async function loadEntityLibs(G) {
  const referenceSource = await dv.io.load("98-System/01-script/entity_reference_utils.js");
  const metadataSource = await dv.io.load("98-System/01-script/entity_meta_utils.js");
  if (!referenceSource) throw new Error("Dataview library not found: 98-System/01-script/entity_reference_utils.js");
  if (!metadataSource) throw new Error("Dataview library not found: 98-System/01-script/entity_meta_utils.js");
  const referenceFactory = new Function(`"use strict"; return (${referenceSource});`)();
  const E = new Function(`"use strict"; return (${metadataSource});`)();
  return { ER: referenceFactory(G), E };
}

const U = await loadLib("98-System/01-script/task_meta_utils.js");
const S = await loadLib("98-System/01-script/task_schedule_utils.js");
const { G, X, R } = await loadTaskReferenceLibs();
const config = { mode:"primary", source:'"02-Task"', emptyMessage:"対象のTaskはありません。", project:null, workspace:null, ...(input ?? {}) };
const today = dv.date("today").startOf("day");
const primaryLimit = today.plus({ days: 14 });
const farFuture = dv.date("9999-12-31").startOf("day");
const farPast = dv.date("0001-01-01").startOf("day");

let triage = null;
if(config.mode==="inbox"){
  const Q = await loadLib("98-System/01-script/task_triage_utils.js");
  const { ER, E } = await loadEntityLibs(G);
  const workspaces = ER.findEntityNotes(app,{folder:"03-Workspace",types:["workspace"],isActiveStatus:E.isActiveStatus});
  const projects = ER.findEntityNotes(app,{folder:"10-Project",types:["project"],isActiveStatus:E.isActiveStatus});
  triage={Q,ER,workspaces,projects};
}

function d(value){ return U.dateOnly(value,dv); }
function dateOrFuture(value){ return d(value) ?? farFuture; }
function dateOrPast(value){ return d(value) ?? farPast; }
function compareDate(a,b){ return dv.compare(dateOrFuture(a),dateOrFuture(b)); }
function lt(value,target){ const date=d(value); return date&&dv.compare(date,target)<0; }
function lte(value,target){ const date=d(value); return date&&dv.compare(date,target)<=0; }
function eq(value,target){ const date=d(value); return date&&dv.compare(date,target)===0; }
function matchesContext(task){ return G.matchesReference(task.project,config.project)&&G.matchesReference(task.workspace,config.workspace); }
function referenceDisplay(value){ return X.dataviewReferenceDisplay(dv,value); }
function taskTitle(task){ return String(task.title??"").trim()||U.stripTaskTimestamp(task.file.name)||task.file.name; }
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
function isFutureMode(mode){ return ["next7","next30","later"].includes(mode); }
function futureDateKey(task){ return S.effectiveFutureDate({start:task.start,due:task.due,today})??"9999-12-31"; }

function dependencyInfo(task){ return R.dependencyInfo(dv,task,U.isTaskClosedStatus); }
function dependencyReason(task){
  const info=dependencyInfo(task), parts=[];
  if(info.cyclic)parts.push("循環依存");
  if(info.unresolved.length>0)parts.push(info.unresolved.map(page=>String(page.title??U.stripTaskTimestamp(page.file.name))).join(", "));
  if(info.missing.length>0)parts.push(`参照不明: ${info.missing.join(", ")}`);
  return parts.join(" / ");
}
function effectiveStatus(task){ const reason=dependencyReason(task); return reason?`⛔ Blocked — ${reason}`:U.taskStatusLabel(task.status); }

function getTaskFile(task){ const file=app.vault.getAbstractFileByPath(task.file.path); if(!file||file.extension!=="md")throw new Error(`Taskファイルが見つかりません: ${task.file.path}`); return file; }
async function setTaskStatus(task,nextStatus){ const file=getTaskFile(task); await app.fileManager.processFrontMatter(file,fm=>{ fm.status=nextStatus; fm.completed=nextStatus==="done"?(fm.completed||window.moment().format("YYYY-MM-DD")):null; }); }
function createDoneToggle(task){ const checkbox=document.createElement("input"); checkbox.type="checkbox"; checkbox.checked=false; checkbox.setAttribute("aria-label","Taskを完了にする"); checkbox.addEventListener("change",async event=>{ if(!event.target.checked)return; checkbox.disabled=true; try{ await setTaskStatus(task,"done"); checkbox.closest("tr")?.remove(); new Notice(`Taskを完了しました: ${taskTitle(task)}`); }catch(error){ console.error(error); checkbox.checked=false; checkbox.disabled=false; new Notice("Taskの完了処理に失敗しました。"); }}); return checkbox; }
function createBacklogPromoteButton(task){ const button=document.createElement("button"); button.type="button"; button.textContent="Inboxへ"; button.setAttribute("aria-label","BacklogからInboxへ移動する"); button.addEventListener("click",async()=>{ button.disabled=true; try{ const file=getTaskFile(task); await app.fileManager.processFrontMatter(file,fm=>{fm.backlog=false;fm.triaged=false;}); button.closest("tr")?.remove(); new Notice(`Inboxへ移動しました: ${taskTitle(task)}`); }catch(error){ console.error(error); button.disabled=false; new Notice("Backlogからの移動に失敗しました。"); }}); return button; }

function createSelect(options,selectedValue,ariaLabel){
  const select=document.createElement("select");
  select.setAttribute("aria-label",ariaLabel);
  for(const option of options){
    const element=document.createElement("option");
    element.value=option.value;
    element.textContent=option.label;
    element.selected=option.value===selectedValue;
    select.appendChild(element);
  }
  return select;
}
function taskDateInputValue(value){ const date=d(value); if(!date)return ""; if(date.toFormat)return date.toFormat("yyyy-MM-dd"); if(date.toISODate)return date.toISODate(); return String(value).slice(0,10); }
function entityForPath(entities,path){ return entities.find(entity=>entity.file.path===path)??null; }
function entityPathForReference(value,entities){ return entities.find(entity=>triage.ER.entityMatchesReference(value,entity))?.file.path??""; }
function projectOptionsForWorkspace(workspacePath){
  const workspace=entityForPath(triage.workspaces,workspacePath);
  if(!workspace)return [];
  return triage.projects.filter(project=>triage.ER.entityMatchesReference(project.workspace,workspace));
}
function replaceSelectOptions(select,options,selectedValue){
  select.replaceChildren();
  for(const option of options){
    const element=document.createElement("option");
    element.value=option.value;
    element.textContent=option.label;
    element.selected=option.value===selectedValue;
    select.appendChild(element);
  }
}
function fieldRow(label,control){ const row=document.createElement("label"); row.style.display="grid"; row.style.gridTemplateColumns="5.5rem minmax(9rem,1fr)"; row.style.gap="0.4rem"; row.style.alignItems="center"; const caption=document.createElement("span"); caption.textContent=label; row.append(caption,control); return row; }
function createInboxTriageControls(task){
  const details=document.createElement("details");
  const summary=document.createElement("summary");
  summary.textContent="整理";
  summary.style.cursor="pointer";
  details.appendChild(summary);

  const panel=document.createElement("div");
  panel.style.display="grid";
  panel.style.gap="0.35rem";
  panel.style.minWidth="18rem";
  panel.style.paddingTop="0.4rem";

  const normalizedPriority=U.normalizeTaskPriority(task.priority);
  const prioritySelect=createSelect([
    {value:"high",label:"🔴 高"},{value:"medium",label:"🟡 中"},{value:"low",label:"🟢 低"},{value:"none",label:"▫️ 無"}
  ],normalizedPriority??"none","Priority");

  const startInput=document.createElement("input"); startInput.type="date"; startInput.value=taskDateInputValue(task.start); startInput.setAttribute("aria-label","Start");
  const dueInput=document.createElement("input"); dueInput.type="date"; dueInput.required=true; dueInput.value=taskDateInputValue(task.due); dueInput.setAttribute("aria-label","Due");

  const currentWorkspacePath=entityPathForReference(task.workspace,triage.workspaces);
  const workspaceSelect=createSelect([
    {value:"",label:"▫️ Workspaceなし"},...triage.workspaces.map(entity=>({value:entity.file.path,label:entity.displayName}))
  ],currentWorkspacePath,"Workspace");

  const initialProjects=projectOptionsForWorkspace(workspaceSelect.value);
  const currentProjectPath=entityPathForReference(task.project,initialProjects);
  const projectSelect=createSelect([
    {value:"",label:"▫️ Projectなし"},...initialProjects.map(entity=>({value:entity.file.path,label:entity.displayName}))
  ],currentProjectPath,"Project");

  workspaceSelect.addEventListener("change",()=>{
    const projects=projectOptionsForWorkspace(workspaceSelect.value);
    replaceSelectOptions(projectSelect,[
      {value:"",label:"▫️ Projectなし"},...projects.map(entity=>({value:entity.file.path,label:entity.displayName}))
    ],"");
  });

  const applyButton=document.createElement("button");
  applyButton.type="button";
  applyButton.textContent="適用";
  applyButton.setAttribute("aria-label","Taskを整理済みにする");
  applyButton.addEventListener("click",async()=>{
    applyButton.disabled=true;
    try{
      const workspace=entityForPath(triage.workspaces,workspaceSelect.value);
      const projects=projectOptionsForWorkspace(workspaceSelect.value);
      const project=entityForPath(projects,projectSelect.value);
      const workspaceLink=triage.ER.makeEntityLink(app,workspace,task.file.path);
      const projectLink=triage.ER.makeEntityLink(app,project,task.file.path);
      const patch=triage.Q.buildTriagePatch({
        priority:prioritySelect.value==="none"?null:prioritySelect.value,
        start:startInput.value,
        due:dueInput.value,
        workspace:workspaceLink,
        project:projectLink
      });
      const file=getTaskFile(task);
      await app.fileManager.processFrontMatter(file,fm=>triage.Q.applyTriagePatch(fm,patch));
      details.closest("tr")?.remove();
      new Notice(`Taskを整理しました: ${taskTitle(task)}`);
    }catch(error){
      console.error(error);
      new Notice(error?.message??"Taskの整理に失敗しました。");
      applyButton.disabled=false;
    }
  });

  panel.append(
    fieldRow("Priority",prioritySelect),
    fieldRow("Start",startInput),
    fieldRow("Due",dueInput),
    fieldRow("Workspace",workspaceSelect),
    fieldRow("Project",projectSelect),
    applyButton
  );
  details.appendChild(panel);
  return details;
}

let tasks=Array.from(dv.pages(config.source).where(task=>U.isTaskType(task.type)).where(matchesContext));
switch(config.mode){
  case "overdue": tasks=tasks.filter(task=>isOpen(task)&&!isBacklog(task)&&task.due&&lt(task.due,today)); break;
  case "today": tasks=tasks.filter(task=>isOpen(task)&&!isBacklog(task)&&task.due&&eq(task.due,today)); break;
  case "primary": tasks=tasks.filter(isPrimary); break;
  case "inbox": tasks=tasks.filter(task=>isOpen(task)&&!isBacklog(task)&&task.triaged===false); break;
  case "backlog": tasks=tasks.filter(task=>isOpen(task)&&isBacklog(task)); break;
  case "next7":
  case "next30":
  case "later": tasks=tasks.filter(task=>S.matchesFutureMode(task,config.mode,today,U.isTaskActionableStatus)); break;
  default: throw new Error(`Unknown task-table mode: ${config.mode}`);
}
function statusRank(task){ if(dependencyInfo(task).blocked)return 2; if(U.isTaskDoingStatus(task.status))return 0; return 1; }
tasks.sort((a,b)=>{
  if(config.mode==="backlog")return dv.compare(a.file.mtime,b.file.mtime);
  if(config.mode==="inbox"){ const created=dv.compare(dateOrPast(b.created),dateOrPast(a.created)); if(created!==0)return created; return dv.compare(b.file.ctime,a.file.ctime); }
  if(config.mode==="primary"){ const status=statusRank(a)-statusRank(b); if(status!==0)return status; }
  if(isFutureMode(config.mode)){ const future=futureDateKey(a).localeCompare(futureDateKey(b)); if(future!==0)return future; }
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
    dv.table(["整理",...commonHeaders,"Source","Created"],tasks.map(task=>[createInboxTriageControls(task),...commonRow(task),referenceDisplay(task.source),U.formatDate(task.created)]));
  } else {
    dv.table(commonHeaders,tasks.map(commonRow));
  }
}
