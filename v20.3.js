// SAIKO Construction AI v20.8 — lightweight quotation deadline reminders
// One timer only, no MutationObserver, no repeated global rescans.
(function(){
  const $=id=>document.getElementById(id);
  const REMINDER_HOURS=[8,10,12,14,16]; // 8AM, 10AM, 12PM, 2PM, 4PM
  const STORAGE_KEY='saiko_quotation_deadline_notifications_v208';
  const POPUP_LIFETIME=30000;
  let popupTimer=null;
  let audioCtx=null;
  let audioUnlocked=false;

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
    if(n<0)return`Overdue by ${Math.abs(n)} day${Math.abs(n)===1?'':'s'}`;
    if(n===0)return'Due today';
    if(n===1)return'Due tomorrow';
    return`Due in ${n} days`;
  }

  function pendingRows(){
    return (cache.quotationProjects||[])
      .filter(q=>!isComplete(q)&&q.target_submission)
      .sort((a,b)=>String(a.target_submission).localeCompare(String(b.target_submission)));
  }

  function urgentRows(){
    return pendingRows().filter(q=>{
      const n=daysTo(q);
      return n!==null && n<=3;
    });
  }

  function getLog(){
    try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}catch(_){return{}}
  }
  function saveLog(log){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(log))}catch(_){}
  }
  function dayKey(){
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function slotForNow(){
    const h=new Date().getHours();
    const eligible=REMINDER_HOURS.filter(x=>h>=x);
    return eligible.length?eligible[eligible.length-1]:null;
  }

  function ensurePopup(){
    let popup=$('quotationReminderPopup');
    if(popup)return popup;
    popup=document.createElement('aside');
    popup.id='quotationReminderPopup';
    popup.className='quotation-reminder-popup';
    popup.setAttribute('role','status');
    popup.setAttribute('aria-live','polite');
    popup.innerHTML=`
      <button id="quotationReminderClose" class="quotation-reminder-close" type="button" aria-label="Close reminder" title="Close">×</button>
      <div class="quotation-reminder-icon">🔔</div>
      <div class="quotation-reminder-copy">
        <small>REMINDER</small>
        <strong id="quotationReminderTitle">Pending quotation</strong>
        <div id="quotationReminderBody"></div>
        <div class="quotation-reminder-progress"><i></i></div>
      </div>`;
    document.body.appendChild(popup);

    $('quotationReminderClose').onclick=()=>hidePopup();
    return popup;
  }

  function hidePopup(){
    const popup=$('quotationReminderPopup');
    if(!popup)return;
    if(popupTimer){clearTimeout(popupTimer);popupTimer=null}
    popup.classList.remove('is-visible');
    popup.classList.add('is-leaving');
    setTimeout(()=>{
      popup.classList.remove('is-leaving');
      popup.setAttribute('aria-hidden','true');
    },420);
  }

  function showPopup(rows){
    const popup=ensurePopup();
    if(popupTimer){clearTimeout(popupTimer);popupTimer=null}

    const urgent=rows.filter(q=>{
      const n=daysTo(q);
      return n!==null&&n<=3;
    });
    const title=$('quotationReminderTitle');
    const body=$('quotationReminderBody');

    title.textContent='Reminder';

    const shown=(urgent.length?urgent:rows).slice(0,4);
    body.innerHTML=shown.map(q=>{
      const n=daysTo(q);
      const cls=n<0?'overdue':n===0?'today':n<=3?'soon':'normal';
      return `<div class="quotation-popup-row ${cls}">
        <span>${esc(q.project_name||'Quotation Project')}</span>
        <b>${deadlineLabel(q)}</b>
      </div>`;
    }).join('')+(rows.length>shown.length
      ? `<div class="quotation-popup-more">+${rows.length-shown.length} more pending project${rows.length-shown.length===1?'':'s'}</div>`
      : '');

    popup.setAttribute('aria-hidden','false');
    popup.classList.remove('is-leaving');
    // force only a tiny local reflow for reliable fade/slide transition
    void popup.offsetWidth;
    popup.classList.add('is-visible');

    const bar=popup.querySelector('.quotation-reminder-progress i');
    if(bar){
      bar.style.animation='none';
      void bar.offsetWidth;
      bar.style.animation=`quotationReminderCountdown ${POPUP_LIFETIME}ms linear forwards`;
    }

    popupTimer=setTimeout(hidePopup,POPUP_LIFETIME);
  }

  function getAudioContext(){
    if(audioCtx)return audioCtx;
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx)return null;
    try{
      audioCtx=new Ctx();
      return audioCtx;
    }catch(_){return null}
  }

  async function unlockAudio(){
    const ctx=getAudioContext();
    if(!ctx)return;
    try{
      if(ctx.state==='suspended')await ctx.resume();
      audioUnlocked=ctx.state==='running';
    }catch(_){}
  }

  // Cute three-note chime made with WebAudio — no media file/network load.
  function playCuteChime(){
    const ctx=getAudioContext();
    if(!ctx||ctx.state!=='running')return;
    const now=ctx.currentTime;
    const notes=[
      {f:659.25,t:0.00,d:.16,g:.060},
      {f:783.99,t:0.16,d:.18,g:.055},
      {f:987.77,t:0.34,d:.30,g:.050}
    ];
    notes.forEach(n=>{
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.type='sine';
      osc.frequency.setValueAtTime(n.f,now+n.t);
      gain.gain.setValueAtTime(0.0001,now+n.t);
      gain.gain.exponentialRampToValueAtTime(n.g,now+n.t+.025);
      gain.gain.exponentialRampToValueAtTime(0.0001,now+n.t+n.d);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now+n.t);
      osc.stop(now+n.t+n.d+.03);
    });
  }

  function renderNotificationUI(){
    const rows=pendingRows();
    const urgent=urgentRows();
    const badge=$('quotationNotifBadge');
    if(badge){
      badge.textContent=String(rows.length);
      badge.classList.toggle('hidden',rows.length===0);
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

    const rows=pendingRows();
    if(!rows.length)return;

    const log=getLog();
    const key=`${dayKey()}-${hour}`;
    if(log[key])return;

    // In-app popup is the main reminder.
    showPopup(rows);
    playCuteChime();

    const urgent=urgentRows();
    const focus=urgent.length?urgent:rows;
    const summary=focus.slice(0,3).map(q=>`${q.project_name}: ${deadlineLabel(q)}`).join(' • ');
    const extra=focus.length>3?` +${focus.length-3} more`:'';
    const message=`Quotation reminder: ${summary}${extra}`;

    // Keep browser notification optional; no permission prompt is forced.
    if('Notification' in window && Notification.permission==='granted'){
      try{new Notification('SAIKO — For Quotation',{body:message,tag:`quotation-${key}`})}catch(_){}
    }

    log[key]=new Date().toISOString();
    const entries=Object.entries(log).slice(-30);
    saveLog(Object.fromEntries(entries));
  }

  // Audio browsers require a user gesture. Unlock once on the first interaction,
  // then remove these one-time listeners so they add no ongoing overhead.
  async function firstInteraction(){
    await unlockAudio();
    document.removeEventListener('pointerdown',firstInteraction);
    document.removeEventListener('keydown',firstInteraction);
  }
  document.addEventListener('pointerdown',firstInteraction,{once:true,passive:true});
  document.addEventListener('keydown',firstInteraction,{once:true});

  $('quotationNotifBtn')?.addEventListener('click',async()=>{
    await unlockAudio();
    renderNotificationUI();
    $('quotationNotifDialog')?.showModal();
  });

  // One lightweight timer only.
  setTimeout(()=>{if(currentUser){renderNotificationUI();maybeNotify()}},1200);
  setInterval(()=>{if(currentUser)maybeNotify()},60000);

  // Refresh notification list when the existing quotation renderer runs.
  const oldRender=window.renderPending;
  if(typeof oldRender==='function'){
    window.renderPending=function(){
      const out=oldRender.apply(this,arguments);
      renderNotificationUI();
      return out;
    };
  }

  window.refreshQuotationDeadlineNotifications=renderNotificationUI;
  window.testQuotationReminder=async function(){
    await unlockAudio();
    const rows=pendingRows();
    showPopup(rows.length?rows:[{project_name:'Sample Quotation Reminder',target_submission:dayKey(),status:'For Quotation'}]);
    playCuteChime();
  };
})();
