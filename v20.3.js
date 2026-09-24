// SAIKO Construction AI v20.3 — quotation deadline reminders
(function(){
  const $=id=>document.getElementById(id);
  const REMINDER_HOURS=[8,10,12,14,16]; // five times during 8 AM–5 PM workday
  const STORAGE_KEY='saiko_quotation_deadline_notifications_v203';

  function isComplete(q){return q?.status==='Complete'||!!q?.boq_file_name}
  function todayStart(){const d=new Date();d.setHours(0,0,0,0);return d}
  function parseDeadline(q){return q?.target_submission?new Date(`${q.target_submission}T00:00:00`):null}
  function daysTo(q){
    const d=parseDeadline(q); if(!d)return null;
    return Math.round((d-todayStart())/86400000);
  }
  function deadlineLabel(q){
    const n=daysTo(q);
    if(n===null)return'No deadline';
    if(n<0)return`OVERDUE by ${Math.abs(n)} day${Math.abs(n)===1?'':'s'}`;
    if(n===0)return'DUE TODAY';
    if(n===1)return'Due tomorrow';
    return`Due in ${n} days`;
  }
  function relevantRows(){
    return (cache.quotationProjects||[])
      .filter(q=>!isComplete(q)&&q.target_submission)
      .sort((a,b)=>String(a.target_submission).localeCompare(String(b.target_submission)));
  }
  function urgentRows(){
    // Notify for overdue, due today, and deadlines within the next 3 days.
    return relevantRows().filter(q=>{
      const n=daysTo(q);
      return n!==null && n<=3;
    });
  }

  function getLog(){
    try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}catch(_){return{}}
  }
  function saveLog(log){localStorage.setItem(STORAGE_KEY,JSON.stringify(log))}
  function dayKey(){
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function slotForNow(){
    const n=new Date(), h=n.getHours(), m=n.getMinutes();
    // A slot is eligible from its hour until 59 minutes after.
    const eligible=REMINDER_HOURS.filter(x=>h>=x);
    if(!eligible.length)return null;
    return eligible[eligible.length-1];
  }

  function renderNotificationUI(){
    const rows=relevantRows();
    const urgent=urgentRows();
    const badge=$('quotationNotifBadge');
    if(badge){
      badge.textContent=String(urgent.length);
      badge.classList.toggle('hidden',urgent.length===0);
    }

    const list=$('quotationNotifList');
    if(!list)return;
    list.innerHTML=rows.length?rows.map(q=>{
      const n=daysTo(q);
      const cls=n<0?'overdue':n===0?'today':n<=3?'soon':'normal';
      return `<div class="quotation-notif-item ${cls}">
        <div>
          <strong>${esc(q.project_name||'Quotation Project')}</strong>
          <span>${esc(q.client_name||'No client')} · Deadline ${new Date(`${q.target_submission}T00:00:00`).toLocaleDateString()}</span>
        </div>
        <b>${deadlineLabel(q)}</b>
      </div>`;
    }).join(''):'<div class="settings-empty-state">No pending quotation deadlines.</div>';
  }

  async function maybeNotify(){
    if(!currentUser)return;
    renderNotificationUI();

    const hour=slotForNow();
    if(hour===null)return;
    const urgent=urgentRows();
    if(!urgent.length)return;

    const log=getLog();
    const key=`${dayKey()}-${hour}`;
    if(log[key])return;

    const summary=urgent.slice(0,3).map(q=>`${q.project_name}: ${deadlineLabel(q)}`).join(' • ');
    const extra=urgent.length>3?` +${urgent.length-3} more`:'';
    const message=`Quotation deadlines: ${summary}${extra}`;

    if(typeof toast==='function')toast(message);

    // Browser notification is optional and only used if permission was already granted.
    if('Notification' in window && Notification.permission==='granted'){
      try{new Notification('SAIKO — Quotation Deadlines',{body:message})}catch(_){}
    }

    log[key]=new Date().toISOString();
    // Keep only recent keys
    const entries=Object.entries(log).slice(-25);
    saveLog(Object.fromEntries(entries));
  }

  $('quotationNotifBtn')?.addEventListener('click',()=>{
    renderNotificationUI();
    $('quotationNotifDialog')?.showModal();
  });

  // Refresh when quotation page opens and every minute while logged in.
  setTimeout(()=>{if(currentUser){renderNotificationUI();maybeNotify()}},1200);
  setInterval(()=>{if(currentUser)maybeNotify()},60000);

  // Also refresh after quotation data reloads if renderPending exists.
  const oldRender=window.renderPending;
  if(typeof oldRender==='function'){
    window.renderPending=function(){
      oldRender();
      renderNotificationUI();
    };
  }

  window.refreshQuotationDeadlineNotifications=renderNotificationUI;
})();
