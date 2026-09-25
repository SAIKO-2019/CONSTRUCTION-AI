// SAIKO Construction AI v17 — ultra-light controls
(function(){
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
  const initials=name=>String(name||'U').trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('')||'U';
  const themeOrder=['light','dark','midnight','pastel','cute','summer','ocean','forest','sunset','lavender','glass','executive'];
  let editMode=false;
  let presenceBusy=false;

  function ago(ts){
    if(!ts)return'';
    const s=Math.max(0,Math.round((Date.now()-new Date(ts).getTime())/1000));
    if(s<60)return `${s}s ago`;
    if(s<3600)return `${Math.floor(s/60)}m ago`;
    if(s<86400)return `${Math.floor(s/3600)}h ago`;
    return `${Math.floor(s/86400)}d ago`;
  }

  // Theme cards — direct, cheap handlers.
  document.querySelectorAll('.theme-preview').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const t=btn.dataset.themeChoice;
      if(typeof applyTheme==='function') applyTheme(t);
      else document.documentElement.dataset.theme=t;
      if($('settingsTheme')) $('settingsTheme').value=t;
      document.querySelectorAll('.theme-preview').forEach(x=>x.classList.toggle('active',x===btn));
    });
  });
  $('settingsTheme')?.addEventListener('change',e=>{
    const t=e.target.value;
    if(typeof applyTheme==='function') applyTheme(t);
    else document.documentElement.dataset.theme=t==='system'?'light':t;
    document.querySelectorAll('.theme-preview').forEach(x=>x.classList.toggle('active',x.dataset.themeChoice===t));
  });

  // Quick theme switch.
  const quick=$('quickThemeBtn');
  if(quick){
    quick.onclick=async()=>{
      if(!currentUser)return;
      const current=cache.userPreferences?.theme||'light';
      const resolved=current==='system'?(document.documentElement.dataset.theme||'light'):current;
      const i=Math.max(0,themeOrder.indexOf(resolved));
      const next=themeOrder[(i+1)%themeOrder.length];
      if(typeof applyTheme==='function') applyTheme(next);
      else document.documentElement.dataset.theme=next;
      if($('settingsTheme')) $('settingsTheme').value=next;
      document.querySelectorAll('.theme-preview').forEach(x=>x.classList.toggle('active',x.dataset.themeChoice===next));
      if(cache.userPreferences){
        const row={...cache.userPreferences,theme:next,user_id:currentUser.id,updated_at:new Date().toISOString()};
        const {error}=await sb.from('user_preferences').upsert(row,{onConflict:'user_id'});
        if(!error)cache.userPreferences=row;
      }
    };
  }

  // Settings live panel loads only when settings opens or user manually refreshes.
  async function refreshSettingsPanel(){
    if(!currentUser)return;
    const users=$('settingsOnlineUsers'),edits=$('settingsEditingNow'),acts=$('settingsActivityMini'),count=$('settingsEditingCount');
    if(!users||!edits||!acts)return;
    const cutoff=new Date(Date.now()-5*60*1000).toISOString();
    const now=new Date().toISOString();
    try{
      const [p,l,a]=await Promise.all([
        sb.from('collaboration_presence').select('*').gte('last_seen',cutoff).order('last_seen',{ascending:false}),
        sb.from('collaboration_locks').select('*').gt('expires_at',now).order('locked_at',{ascending:false}),
        sb.from('activity_log').select('*').order('created_at',{ascending:false}).limit(6)
      ]);
      const pres=p.data||[],locks=l.data||[],activity=a.data||[];
      users.innerHTML=pres.length?pres.map(x=>{
        const idle=Date.now()-new Date(x.last_seen).getTime()>90000;
        return `<div class="settings-online-card"><div class="settings-online-avatar ${idle?'idle':''}">${initials(x.display_name)}</div><div class="settings-online-main"><strong>${esc(x.display_name||'User')}</strong><span>${esc(x.module||'dashboard')} · ${ago(x.last_seen)}</span></div></div>`;
      }).join(''):'<div class="settings-empty-state">No recently active users.</div>';
      if(count)count.textContent=String(locks.length);
      edits.innerHTML=locks.length?locks.map(x=>`<div class="settings-edit-card"><strong>${esc(x.display_name||'User')}</strong><span>${esc(x.module)} · record ${esc(x.record_id)}</span></div>`).join(''):'<div class="settings-empty-state">No records are being edited.</div>';
      acts.innerHTML=activity.length?activity.map(x=>`<div class="settings-activity-row"><strong>${esc(x.display_name||'User')}</strong><span>${esc(x.module||'workspace')} · ${ago(x.created_at)}</span></div>`).join(''):'<div class="settings-empty-state">No recent activity.</div>';
    }catch(e){console.warn('settings live panel',e)}
  }
  window.refreshSettingsTeamPanel=refreshSettingsPanel;
  $('settingsBtn')?.addEventListener('click',()=>setTimeout(refreshSettingsPanel,30));
  $('refreshSettingsTeamBtn')?.addEventListener('click',e=>{e.preventDefault();refreshSettingsPanel()});

  // Active status privacy.
  $('settingsShowActiveStatus')?.addEventListener('change',async e=>{
    if(!currentUser)return;
    cache.userPreferences=cache.userPreferences||{};
    cache.userPreferences.show_active_status=e.target.checked;
    if(e.target.checked){
      if(typeof heartbeatPresence==='function') await heartbeatPresence();
    }else{
      if(typeof hideMyPresence==='function') await hideMyPresence();
    }
  });

  // Top online icons — only refresh every 60 seconds.
  async function refreshPresenceRail(){
    if(presenceBusy||!currentUser)return;
    presenceBusy=true;
    try{
      const rail=$('topPresenceRail'),holder=rail?.querySelector('.presence-avatars');
      if(!holder)return;
      const cutoff=new Date(Date.now()-5*60*1000).toISOString();
      const {data,error}=await sb.from('collaboration_presence').select('*').gte('last_seen',cutoff).order('last_seen',{ascending:false});
      if(error)return;
      const pres=data||[];
      if(!pres.length){holder.innerHTML='<span class="presence-empty">No one online yet</span>';return;}
      const shown=pres.slice(0,5);
      holder.innerHTML='<span class="presence-rail-label">Online</span>'+shown.map(x=>`<button type="button" class="presence-avatar" title="${esc(x.display_name||'User')} · ${ago(x.last_seen)}">${initials(x.display_name)}</button>`).join('');
    }finally{presenceBusy=false}
  }
  setTimeout(()=>refreshPresenceRail().catch(()=>{}),1200);
  setInterval(()=>refreshPresenceRail().catch(()=>{}),60000);

  // Smooth logout. One owner only.
  const logout=$('logoutBtn');
  if(logout){
    logout.onclick=async()=>{
      if(logout.disabled)return;
      if(!confirm('Log out of Construction Monitoring?'))return;
      logout.disabled=true;
      const old=logout.innerHTML;
      logout.innerHTML='…';
      try{
        if(typeof hideMyPresence==='function')await hideMyPresence();
        const {error}=await sb.auth.signOut();
        if(error)throw error;
        location.reload();
      }catch(e){
        alert('Logout failed: '+(e?.message||e));
        logout.disabled=false;
        logout.innerHTML=old;
      }
    };
  }

  // Edit Mode without MutationObserver. Re-scan only after navigation/data refresh.
  const maps={
    projectRows:{table:'projects',cols:{1:['project_name','text'],2:['client_name','text'],3:['location','text'],4:['contract_amount','number'],5:['status','text']}},
    billingRows:{table:'billings',cols:{3:['billing_no','text'],4:['accomplishment_percent','number'],5:['gross_amount','number'],11:['date_submitted','date'],12:['date_paid','date'],14:['status','text']}},
    scheduleRows:{table:'schedule_items',cols:{1:['activity','text'],2:['start_date','date'],3:['end_date','date'],4:['weight','number']}},
    progressRows:{table:'actual_progress',cols:{1:['activity','text'],2:['weight','number'],3:['actual_percent','number']}}
  };

  function decorateEditables(){
    Object.entries(maps).forEach(([tbodyId,map])=>{
      const body=$(tbodyId); if(!body)return;
      [...body.rows].forEach(tr=>{
        const id=tr.dataset.id||tr.getAttribute('data-id');
        [...tr.cells].forEach((td,i)=>{
          td.classList.remove('inline-editable');
          td.removeAttribute('data-inline-config');
          if(editMode&&id&&map.cols[i]){
            td.classList.add('inline-editable');
            td.dataset.inlineConfig=JSON.stringify({table:map.table,id,field:map.cols[i][0],type:map.cols[i][1]});
          }
        });
      });
    });
  }

  async function editCell(td){
    if(!editMode||td.querySelector('input'))return;
    const cfg=JSON.parse(td.dataset.inlineConfig||'null'); if(!cfg)return;
    const old=td.textContent.trim();
    const input=document.createElement('input');
    input.className='inline-editor';
    input.type=cfg.type==='number'?'number':cfg.type==='date'?'date':'text';
    input.value=old.replace(/[₱,%]/g,'').replace(/,/g,'').trim();
    td.textContent=''; td.appendChild(input); input.focus(); input.select();
    let done=false;
    const cancel=()=>{if(done)return;done=true;td.textContent=old;decorateEditables()};
    const save=async()=>{
      if(done)return; done=true;
      let value=input.value;
      if(cfg.type==='number')value=Number(value||0);
      if(cfg.type==='date'&&!value)value=null;
      try{
        const {error}=await sb.from(cfg.table).update({[cfg.field]:value}).eq('id',cfg.id);
        if(error)throw error;
        if(typeof refreshAll==='function')await refreshAll();
      }catch(e){alert('Save failed: '+(e?.message||e));td.textContent=old}
      decorateEditables();
    };
    input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();save()}else if(e.key==='Escape'){e.preventDefault();cancel()}};
    input.onblur=()=>setTimeout(save,80);
  }

  document.addEventListener('dblclick',e=>{
    const td=e.target.closest?.('td[data-inline-config]');
    if(td)editCell(td);
  });

  const editBtn=$('editModeBtn');
  if(editBtn)editBtn.onclick=()=>{
    editMode=!editMode;
    document.documentElement.dataset.editMode=editMode?'on':'off';
    editBtn.classList.toggle('active',editMode);
    editBtn.textContent=editMode?'✓ Edit Mode ON':'✎ Edit Mode';
    decorateEditables();
  };

  const baseShow=window.show;
  if(typeof baseShow==='function'){
    window.show=function(id){
      baseShow(id);
      if(editMode)setTimeout(decorateEditables,0);
    };
  }
  const baseRefresh=window.refreshAll;
  if(typeof baseRefresh==='function'){
    window.refreshAll=async function(){
      await baseRefresh();
      if(editMode)decorateEditables();
    };
  }

  // Close buttons: one small delegated fallback. Native handlers can still run.
  document.addEventListener('click',e=>{
    const close=e.target.closest?.('[data-close]');
    if(!close)return;
    const dlg=$(close.dataset.close);
    if(dlg?.open)dlg.close();
  });

  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    const open=[...document.querySelectorAll('dialog[open]')];
    open.at(-1)?.close();
  });
})();
