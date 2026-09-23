// SAIKO Construction AI v15.2 — Settings + Live Team Sidebar
(function(){
  const $id=id=>document.getElementById(id);
  const safe=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const initials=name=>String(name||'U').trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('')||'U';
  const agoLocal=ts=>{if(!ts)return'';const sec=Math.max(0,Math.round((Date.now()-new Date(ts).getTime())/1000));if(sec<60)return`${sec}s ago`;if(sec<3600)return`${Math.floor(sec/60)}m ago`;if(sec<86400)return`${Math.floor(sec/3600)}h ago`;return`${Math.floor(sec/86400)}d ago`;};

  async function refreshSettingsTeamPanel(){
    if(typeof currentUser==='undefined'||!currentUser||typeof sb==='undefined')return;
    const usersEl=$id('settingsOnlineUsers'),editEl=$id('settingsEditingNow'),activityEl=$id('settingsActivityMini'),countEl=$id('settingsEditingCount');
    if(!usersEl||!editEl||!activityEl)return;
    const cutoff=new Date(Date.now()-5*60*1000).toISOString();
    const now=new Date().toISOString();
    try{
      const [pRes,lRes,aRes]=await Promise.all([
        sb.from('collaboration_presence').select('*').gte('last_seen',cutoff).order('last_seen',{ascending:false}),
        sb.from('collaboration_locks').select('*').gt('expires_at',now).order('locked_at',{ascending:false}),
        sb.from('activity_log').select('*').order('created_at',{ascending:false}).limit(8)
      ]);
      const pres=pRes.data||[],locks=lRes.data||[],acts=aRes.data||[];
      usersEl.innerHTML=pres.length?pres.map(p=>{const idle=Date.now()-new Date(p.last_seen).getTime()>90000;const me=p.user_id===currentUser.id;return`<div class="settings-online-card"><div class="settings-online-avatar ${idle?'idle':''}">${safe(initials(p.display_name))}</div><div class="settings-online-main"><strong>${safe(p.display_name||'User')}</strong><span>${safe(p.module||'Dashboard')} · ${safe(agoLocal(p.last_seen))}</span></div>${me?'<span class="settings-you-pill">YOU</span>':''}</div>`;}).join(''):'<div class="settings-empty-state">No recently active users.</div>';
      if(countEl)countEl.textContent=String(locks.length);
      editEl.innerHTML=locks.length?locks.map(l=>`<div class="settings-edit-card"><strong>${safe(l.display_name||'User')}</strong><span>${safe(l.module)} · record ${safe(l.record_id)}</span></div>`).join(''):'<div class="settings-empty-state">No records are being edited right now.</div>';
      activityEl.innerHTML=acts.length?acts.map(a=>`<div class="settings-activity-row"><strong>${safe(a.display_name||'User')} · ${safe(a.action||'update')}</strong><span>${safe(a.module||'workspace')} · ${safe(agoLocal(a.created_at))}</span></div>`).join(''):'<div class="settings-empty-state">No recent team activity.</div>';
    }catch(err){
      console.warn('Settings team panel:',err);
      usersEl.innerHTML='<div class="settings-empty-state">Team status is temporarily unavailable.</div>';
      editEl.innerHTML='<div class="settings-empty-state">Could not load edit locks.</div>';
      activityEl.innerHTML='<div class="settings-empty-state">Could not load activity.</div>';
    }
  }

  const btn=$id('settingsBtn');
  if(btn){const prior=btn.onclick;btn.onclick=function(ev){if(prior)prior.call(this,ev);setTimeout(refreshSettingsTeamPanel,60);};}
  const refresh=$id('refreshSettingsTeamBtn');
  if(refresh)refresh.onclick=refreshSettingsTeamPanel;
  setInterval(()=>{const dlg=$id('settingsDialog');if(dlg?.open)refreshSettingsTeamPanel();},30000);
})();
