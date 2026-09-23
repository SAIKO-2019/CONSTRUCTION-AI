// SAIKO Construction AI v15.5 — button reliability + Active Status privacy
(function(){
  const byId=id=>document.getElementById(id);

  function ensureButtonsClickable(){
    document.querySelectorAll('button,[role="button"],.theme-preview').forEach(el=>{
      el.style.pointerEvents='auto';
    });
  }

  async function applyPresencePrivacy(){
    const box=byId('settingsShowActiveStatus');
    if(!box || typeof currentUser==='undefined' || !currentUser)return;
    if(!box.checked){
      if(typeof hideMyPresence==='function') await hideMyPresence();
      const rail=byId('topPresenceRail');
      if(rail) rail.setAttribute('data-private','1');
    }else{
      if(typeof heartbeatPresence==='function') await heartbeatPresence();
      const rail=byId('topPresenceRail');
      if(rail) rail.removeAttribute('data-private');
    }
    if(typeof refreshTopPresenceRail==='function') await refreshTopPresenceRail();
    if(typeof refreshSettingsTeamPanel==='function') await refreshSettingsTeamPanel();
    if(typeof refreshTeamActivity==='function') await refreshTeamActivity();
  }

  // Toggle applies immediately in the current session. Save Settings persists it.
  document.addEventListener('change',e=>{
    if(e.target?.id==='settingsShowActiveStatus') applyPresencePrivacy().catch(console.warn);
  });

  // Robust close buttons: later CSS/handlers cannot break them.
  document.addEventListener('click',e=>{
    const close=e.target.closest?.('[data-close]');
    if(close){
      const dlg=byId(close.dataset.close);
      if(dlg?.open){ e.preventDefault(); e.stopPropagation(); dlg.close(); }
      return;
    }
    const refreshSettings=e.target.closest?.('#refreshSettingsTeamBtn');
    if(refreshSettings && typeof refreshSettingsTeamPanel==='function'){
      e.preventDefault(); refreshSettingsTeamPanel(); return;
    }
    const refreshTeam=e.target.closest?.('#refreshTeamActivityBtn');
    if(refreshTeam && typeof refreshTeamActivity==='function'){
      e.preventDefault(); refreshTeamActivity(); return;
    }
    const theme=e.target.closest?.('.theme-preview');
    if(theme && theme.dataset.themeChoice){
      const value=theme.dataset.themeChoice;
      if(typeof applyTheme==='function') applyTheme(value);
      const sel=byId('settingsTheme'); if(sel) sel.value=value;
    }
  },true);

  // Keep dialog action areas above decorative layers.
  function hardenUI(){
    ensureButtonsClickable();
    ['settingsDialog','teamActivityDialog'].forEach(id=>{
      const d=byId(id); if(!d)return;
      d.style.pointerEvents='auto';
      d.querySelectorAll('.dialog-head,.dialog-actions,.settings-live-panel,.settings-section').forEach(x=>{
        x.style.pointerEvents='auto';
        x.style.position=x.style.position||'relative';
      });
    });
  }

  setTimeout(hardenUI,300);
  setInterval(hardenUI,5000);

  // Remove presence on logout before Supabase session is ended.
  const logout=byId('logoutBtn');
  if(logout){
    const old=logout.onclick;
    logout.onclick=async function(ev){
      try{ if(typeof hideMyPresence==='function') await hideMyPresence(); }catch(_e){}
      if(old) return old.call(this,ev);
    };
  }
})();
