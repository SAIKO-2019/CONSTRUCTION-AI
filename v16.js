// SAIKO Construction AI v16 — clean control layer (no stacked button wrappers)
(function(){
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const initials=name=>String(name||'U').trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('')||'U';
  const themeOrder=['light','dark','midnight','pastel','cute','summer','glass','executive'];
  let settingsRefreshBusy=false;
  let topPresenceBusy=false;

  function ago(ts){
    if(!ts)return'';
    const s=Math.max(0,Math.round((Date.now()-new Date(ts).getTime())/1000));
    if(s<60)return`${s}s ago`;
    if(s<3600)return`${Math.floor(s/60)}m ago`;
    if(s<86400)return`${Math.floor(s/3600)}h ago`;
    return`${Math.floor(s/86400)}d ago`;
  }

  async function loadPresence(){
    if(!currentUser||!sb)return[];
    const cutoff=new Date(Date.now()-5*60*1000).toISOString();
    const {data,error}=await sb.from('collaboration_presence').select('*').gte('last_seen',cutoff).order('last_seen',{ascending:false});
    if(error){console.warn('presence',error);return[];}
    return data||[];
  }

  async function refreshTopPresence(){
    if(topPresenceBusy||!currentUser)return;
    topPresenceBusy=true;
    try{
      const pres=await loadPresence();
      const rail=$('topPresenceRail');
      const holder=rail?.querySelector('.presence-avatars');
      const badge=$('sidebarOnlineCount');
      if(badge){badge.textContent=String(pres.length);badge.style.display=pres.length?'grid':'none';}
      if(!holder)return;
      if(cache.userPreferences?.show_active_status===false){
        rail?.setAttribute('data-private','1');
      }else rail?.removeAttribute('data-private');
      if(!pres.length){holder.innerHTML='<span class="presence-empty">No one online yet</span>';return;}
      const shown=pres.slice(0,5);
      holder.innerHTML='<span class="presence-rail-label">Online</span>'+shown.map(p=>{
        const idle=Date.now()-new Date(p.last_seen).getTime()>90000;
        const you=p.user_id===currentUser.id;
        const title=`${p.display_name||'User'}${you?' (You)':''} • ${p.module||'dashboard'} • ${ago(p.last_seen)}`;
        return `<button type="button" class="presence-avatar ${idle?'idle':''}" title="${esc(title)}" data-presence-open="1">${esc(initials(p.display_name))}</button>`;
      }).join('')+(pres.length>shown.length?`<button type="button" class="presence-avatar more" data-presence-open="1">+${pres.length-shown.length}</button>`:'');
    }finally{topPresenceBusy=false;}
  }
  window.refreshTopPresenceRail=refreshTopPresence;

  async function refreshSettingsPanel(){
    if(settingsRefreshBusy||!currentUser)return;
    settingsRefreshBusy=true;
    try{
      const usersEl=$('settingsOnlineUsers'),editEl=$('settingsEditingNow'),activityEl=$('settingsActivityMini'),countEl=$('settingsEditingCount');
      if(!usersEl||!editEl||!activityEl)return;
      const cutoff=new Date(Date.now()-5*60*1000).toISOString();
      const now=new Date().toISOString();
      const [pRes,lRes,aRes]=await Promise.all([
        sb.from('collaboration_presence').select('*').gte('last_seen',cutoff).order('last_seen',{ascending:false}),
        sb.from('collaboration_locks').select('*').gt('expires_at',now).order('locked_at',{ascending:false}),
        sb.from('activity_log').select('*').order('created_at',{ascending:false}).limit(8)
      ]);
      const pres=pRes.data||[],locks=lRes.data||[],acts=aRes.data||[];
      usersEl.innerHTML=pres.length?pres.map(p=>{
        const idle=Date.now()-new Date(p.last_seen).getTime()>90000;
        const me=p.user_id===currentUser.id;
        return `<div class="settings-online-card"><div class="settings-online-avatar ${idle?'idle':''}">${esc(initials(p.display_name))}</div><div class="settings-online-main"><strong>${esc(p.display_name||'User')}</strong><span>${esc(p.module||'Dashboard')} · ${ago(p.last_seen)}</span></div>${me?'<span class="settings-you-pill">YOU</span>':''}</div>`;
      }).join(''):'<div class="settings-empty-state">No recently active users.</div>';
      if(countEl)countEl.textContent=String(locks.length);
      editEl.innerHTML=locks.length?locks.map(l=>`<div class="settings-edit-card"><strong>${esc(l.display_name||'User')}</strong><span>${esc(l.module)} · record ${esc(l.record_id)}</span></div>`).join(''):'<div class="settings-empty-state">No records are being edited right now.</div>';
      activityEl.innerHTML=acts.length?acts.map(a=>`<div class="settings-activity-row"><strong>${esc(a.display_name||'User')} · ${esc(a.action||'update')}</strong><span>${esc(a.module||'workspace')} · ${ago(a.created_at)}</span></div>`).join(''):'<div class="settings-empty-state">No recent team activity.</div>';
    }catch(err){console.warn('settings team panel',err);}
    finally{settingsRefreshBusy=false;}
  }
  window.refreshSettingsTeamPanel=refreshSettingsPanel;

  // Settings: only one lightweight listener, no wrapping chains.
  const settingsBtn=$('settingsBtn');
  if(settingsBtn) settingsBtn.addEventListener('click',()=>setTimeout(refreshSettingsPanel,40));
  $('refreshSettingsTeamBtn')?.addEventListener('click',e=>{e.preventDefault();refreshSettingsPanel();});

  // Online icons open Team Activity.
  document.addEventListener('click',e=>{
    if(e.target.closest?.('[data-presence-open]')){
      e.preventDefault();
      $('teamActivityBtn')?.click();
      return;
    }
    // Fallback close only if the normal direct handler did not already close it.
    const close=e.target.closest?.('[data-close]');
    if(close){
      const dlg=$(close.dataset.close);
      if(dlg?.open) dlg.close();
    }
  });

  // Backdrop and Esc are simple and isolated.
  document.querySelectorAll('dialog').forEach(dlg=>{
    dlg.addEventListener('click',e=>{if(e.target===dlg&&dlg.open)dlg.close();});
    dlg.addEventListener('close',()=>{document.body.classList.remove('modal-open');});
  });
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    const open=[...document.querySelectorAll('dialog[open]')];
    open.at(-1)?.close();
  });

  // Active status privacy applies immediately but performs only the needed work.
  $('settingsShowActiveStatus')?.addEventListener('change',async e=>{
    if(!currentUser)return;
    const on=e.target.checked;
    cache.userPreferences=cache.userPreferences||{};
    cache.userPreferences.show_active_status=on;
    if(on){if(typeof heartbeatPresence==='function')await heartbeatPresence();}
    else {if(typeof hideMyPresence==='function')await hideMyPresence();}
    await refreshTopPresence();
    if($('settingsDialog')?.open)await refreshSettingsPanel();
  });

  // Quick theme cycles all available presets without extra observers.
  const quick=$('quickThemeBtn');
  if(quick){
    quick.onclick=async()=>{
      if(!currentUser)return;
      const current=cache.userPreferences?.theme||'light';
      const resolved=current==='system'?(document.documentElement.dataset.theme||'light'):current;
      const idx=Math.max(0,themeOrder.indexOf(resolved));
      const next=themeOrder[(idx+1)%themeOrder.length];
      if(typeof applyTheme==='function')applyTheme(next);else document.documentElement.dataset.theme=next;
      document.querySelectorAll('.theme-preview').forEach(btn=>btn.classList.toggle('active',btn.dataset.themeChoice===next));
      if($('settingsTheme'))$('settingsTheme').value=next;
      if(cache.userPreferences){
        const row={...cache.userPreferences,theme:next,user_id:currentUser.id,updated_at:new Date().toISOString()};
        const {error}=await sb.from('user_preferences').upsert(row,{onConflict:'user_id'});
        if(!error){cache.userPreferences=row;if(typeof toast==='function')toast(`Theme: ${next}`);}
      }
    };
  }

  // Smooth logout, exactly one override.
  const logout=$('logoutBtn');
  if(logout){
    logout.onclick=async()=>{
      if(logout.dataset.busy==='1')return;
      if(!confirm('Log out of SAIKO Construction AI?'))return;
      logout.dataset.busy='1';logout.disabled=true;
      const old=logout.innerHTML;logout.innerHTML='…';
      try{
        if(typeof hideMyPresence==='function')await hideMyPresence();
        const {error}=await sb.auth.signOut();
        if(error)throw error;
        location.reload();
      }catch(err){
        alert('Logout failed: '+(err?.message||err));
        logout.disabled=false;logout.dataset.busy='0';logout.innerHTML=old;
      }
    };
  }

  // Lightweight periodic presence refresh only; no DOM-wide scanning.
  setTimeout(()=>refreshTopPresence().catch(()=>{}),900);
  setInterval(()=>{
    if(currentUser)refreshTopPresence().catch(()=>{});
    if($('settingsDialog')?.open)refreshSettingsPanel().catch(()=>{});
  },30000);
})();
