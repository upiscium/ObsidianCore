(() => {
  const STATUS_LABELS = { "not-yet-running":"⬛️ 未着手", planning:"📝 案出し", running:"🏃 進行中", done:"✅ 完了", stopped:"⏸️ 保留", deleted:"🗑️ 破棄", archived:"📦️ アーカイブ済", waiting:"⏳ 待機", blocked:"⛔ ブロック", someday:"💭 Someday", cancelled:"🚫 キャンセル", none:"▫️" };
  const STATUS_ORDER = { blocked:0, waiting:1, running:2, planning:3, "not-yet-running":4, stopped:5, someday:6, done:7, archived:8, cancelled:9, deleted:10, none:11 };
  const PRIORITY_LABELS = { "0":"🚨 緊急", "1":"🔴 高", "2":"🟡 中", "3":"🟢 低", "4":"🔵 最低", "5":"▫️" };
  const PRIORITY_ALIASES = { urgent:"0", high:"1", normal:"2", medium:"2", low:"3", lowest:"4", none:"5" };

  const TASK_STATUS_LABELS = { todo:"⬜ 未着手", doing:"🏃 進行中", done:"✅ 完了", cancelled:"🚫 キャンセル" };
  const TASK_STATUS_ORDER = { doing:0, todo:1, done:2, cancelled:3 };
  const TASK_STATUS_ALIASES = { todo:"todo", doing:"doing", done:"done", cancelled:"cancelled", "not-yet-running":"todo", planning:"todo", running:"doing", waiting:"todo", blocked:"todo", someday:"todo", stopped:"todo", archived:"done", deleted:"cancelled", none:"todo" };
  const TASK_PRIORITY_LABELS = { high:"🔴 高", medium:"🟡 中", low:"🟢 低", none:"▫️ 無" };
  const TASK_PRIORITY_ORDER = { high:0, medium:1, low:2, none:3 };
  const TASK_PRIORITY_ALIASES = { high:"high", medium:"medium", low:"low", none:"none", urgent:"high", normal:"medium", lowest:"low", "0":"high", "1":"high", "2":"medium", "3":"low", "4":"low", "5":"none" };

  function normalizeKey(value){ return value===null||value===undefined||value==="" ? "none" : String(value); }
  function normalizePriority(value){ if(value===null||value===undefined||value==="") return "5"; const raw=String(value); return ["0","1","2","3","4","5"].includes(raw)?raw:(PRIORITY_ALIASES[raw]??"5"); }
  function normalizeTaskStatus(value){ return TASK_STATUS_ALIASES[normalizeKey(value)] ?? "todo"; }
  function normalizeTaskPriority(value){ if(value===null||value===undefined||value==="") return "none"; return TASK_PRIORITY_ALIASES[String(value)] ?? "none"; }
  function asArray(value){ if(value===null||value===undefined||value==="") return []; if(Array.isArray(value)) return value; if(typeof value==="object"&&value!==null&&typeof value.array==="function") return value.array(); return [value]; }
  function statusLabel(value){ const key=normalizeKey(value); return STATUS_LABELS[key]??`❓ ${key}`; }
  function statusOrder(value){ return STATUS_ORDER[normalizeKey(value)]??999; }
  function priorityLabel(value){ const key=normalizePriority(value); return PRIORITY_LABELS[key]??`❓ ${String(value)}`; }
  function priorityOrder(value){ return Number(normalizePriority(value)); }
  function isClosedStatus(value){ return ["done","cancelled","deleted","archived"].includes(normalizeKey(value)); }
  function isActiveStatus(value){ return ["not-yet-running","planning","running","none"].includes(normalizeKey(value)); }
  function isArchivedStatus(value){ return ["done","archived"].includes(normalizeKey(value)); }
  function isHiddenStatus(value){ return ["deleted","cancelled"].includes(normalizeKey(value)); }
  function taskStatusLabel(value){ const key=normalizeTaskStatus(value); return TASK_STATUS_LABELS[key]??`❓ ${key}`; }
  function taskStatusOrder(value){ return TASK_STATUS_ORDER[normalizeTaskStatus(value)]??999; }
  function taskPriorityLabel(value){ const key=normalizeTaskPriority(value); return TASK_PRIORITY_LABELS[key]??`❓ ${String(value)}`; }
  function taskPriorityOrder(value){ return TASK_PRIORITY_ORDER[normalizeTaskPriority(value)]??999; }
  function isTaskType(value){ return ["task","task-pack"].includes(String(value??"")); }
  function isTaskClosedStatus(value){ return ["done","cancelled"].includes(normalizeTaskStatus(value)); }
  function isTaskActionableStatus(value){ return !isTaskClosedStatus(value); }
  function isTaskTodoStatus(value){ return normalizeTaskStatus(value)==="todo"; }
  function isTaskDoingStatus(value){ return normalizeTaskStatus(value)==="doing"; }
  function isWaitingOrBlockedStatus(value){ const key=normalizeKey(value); return key==="waiting"||key==="blocked"; }
  function isSomedayStatus(value){ return normalizeKey(value)==="someday"; }
  function formatDate(value){ if(!value) return "-"; if(value.toFormat) return value.toFormat("yyyy-MM-dd"); if(value.toISODate) return value.toISODate(); return String(value); }
  function basename(path){ return String(path).split("/").pop().replace(/\.md$/,""); }
  function fieldText(value){ if(value===null||value===undefined||value==="") return "-"; if(Array.isArray(value)){ const values=value.map(fieldText).filter(item=>item!=="-"); return values.length>0?values.join(", "):"-"; } if(typeof value==="object"&&value.path) return value.display??basename(value.path); if(value.toFormat||value.toISODate) return formatDate(value); return String(value); }
  function dateOnly(value,dv){ if(!value) return null; if(value.startOf) return value.startOf("day"); const parsed=dv.date(String(value)); if(!parsed) return null; return parsed.startOf?parsed.startOf("day"):parsed; }

  return { normalizeKey, normalizePriority, normalizeTaskStatus, normalizeTaskPriority, asArray, statusLabel, statusOrder, priorityLabel, priorityOrder, taskStatusLabel, taskStatusOrder, taskPriorityLabel, taskPriorityOrder, isClosedStatus, isActiveStatus, isArchivedStatus, isHiddenStatus, isTaskType, isTaskClosedStatus, isTaskActionableStatus, isTaskTodoStatus, isTaskDoingStatus, isWaitingOrBlockedStatus, isSomedayStatus, formatDate, fieldText, dateOnly };
})()
