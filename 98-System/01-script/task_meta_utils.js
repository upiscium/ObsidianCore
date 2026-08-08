(() => {
  const STATUS_LABELS = { todo:"⬜ 未着手", doing:"🏃 進行中", done:"✅ 完了", cancelled:"🚫 キャンセル" };
  const STATUS_ORDER = { doing:0, todo:1, done:2, cancelled:3 };
  const STATUS_ALIASES = { todo:"todo", doing:"doing", done:"done", cancelled:"cancelled", "not-yet-running":"todo", planning:"todo", running:"doing", waiting:"todo", blocked:"todo", someday:"todo", stopped:"todo", archived:"done", deleted:"cancelled", none:"todo" };
  const PRIORITY_LABELS = { high:"🔴 高", medium:"🟡 中", low:"🟢 低", none:"▫️ 無" };
  const PRIORITY_ORDER = { high:0, medium:1, low:2, none:3 };
  const PRIORITY_ALIASES = { high:"high", medium:"medium", low:"low", none:"none", urgent:"high", normal:"medium", lowest:"low", "0":"high", "1":"high", "2":"medium", "3":"low", "4":"low", "5":"none" };

  function normalizeStatus(value){ const key=value===null||value===undefined||value===""?"none":String(value); return STATUS_ALIASES[key]??"todo"; }
  function normalizePriority(value){ if(value===null||value===undefined||value==="")return "none"; return PRIORITY_ALIASES[String(value)]??"none"; }
  function asArray(value){ if(value===null||value===undefined||value==="")return []; if(Array.isArray(value))return value; if(typeof value==="object"&&value!==null&&typeof value.array==="function")return value.array(); return [value]; }
  function statusLabel(value){ const key=normalizeStatus(value); return STATUS_LABELS[key]??`❓ ${key}`; }
  function statusOrder(value){ return STATUS_ORDER[normalizeStatus(value)]??999; }
  function priorityLabel(value){ const key=normalizePriority(value); return PRIORITY_LABELS[key]??`❓ ${String(value)}`; }
  function priorityOrder(value){ return PRIORITY_ORDER[normalizePriority(value)]??999; }
  function isTaskType(value){ return ["task","task-pack"].includes(String(value??"")); }
  function isClosedStatus(value){ return ["done","cancelled"].includes(normalizeStatus(value)); }
  function isActionableStatus(value){ return !isClosedStatus(value); }
  function isDoingStatus(value){ return normalizeStatus(value)==="doing"; }
  function formatDate(value){ if(!value)return "-"; if(value.toFormat)return value.toFormat("yyyy-MM-dd"); if(value.toISODate)return value.toISODate(); return String(value); }
  function dateOnly(value,dv){ if(!value)return null; if(value.startOf)return value.startOf("day"); const parsed=dv.date(String(value)); if(!parsed)return null; return parsed.startOf?parsed.startOf("day"):parsed; }

  return { normalizeStatus, normalizePriority, asArray, statusLabel, statusOrder, priorityLabel, priorityOrder, isTaskType, isClosedStatus, isActionableStatus, isDoingStatus, formatDate, dateOnly };
})()
