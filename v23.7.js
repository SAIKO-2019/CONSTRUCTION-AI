// SAIKO Construction AI v23.7
// Sticky module + sticky project selection.
// Background refreshes must NEVER force the user back to the global Project Folder.
(function(){
  const VIEW_KEY='saiko_last_view';
  const SCROLL_KEY='saiko_last_scroll';
  const PROJECT_KEYS={
    workspaceProject:'saiko_project_workspace',
    billingProjectFilter:'saiko_project_billing',
    scheduleProject:'saiko_project_schedule',
    progressProject:'saiko_project_progress',
    inventoryProject:'saiko_project_inventory',
    budgetProject:'saiko_project_budget',
    fileProject:'saiko_project_files',
    smartProject:'saiko_project_smart'
  };

  function validProject(id){
    return !!(id && (cache.projects||[]).some(p=>String(p.id)===String(id)));
  }

  function saveSelector(id){
    const el=$(id),key=PROJECT_KEYS[id];
    if(!el||!key)return;
    try{
      if(el.value)localStorage.setItem(key,el.value);
      else localStorage.removeItem(key);
    }catch(_){ }
  }

  function restoreSelector(id,fallback=''){
    const el=$(id),key=PROJECT_KEYS[id];
    if(!el||!key)return;
    let saved='';
    try{saved=localStorage.getItem(key)||''}catch(_){ }
    const target=validProject(saved)?saved:(validProject(fallback)?fallback:'');
    if(target && [...el.options].some(o=>String(o.value)===String(target)))el.value=target;
  }

  // Remember each module's project independently.
  Object.keys(PROJECT_KEYS).forEach(id=>{
    const el=$(id);
    if(!el)return;
    el.addEventListener('change',()=>saveSelector(id),{passive:true});
  });

  // Preserve every selector around ANY data refresh. This is the key fix:
  // v13's refresh repopulates selectors and used to force Billing back to
  // the top Workspace Project every time Google Sheet auto-sync refreshed data.
  const baseRefresh=refreshAll;
  refreshAll=async function(){
    const before={};
    Object.keys(PROJECT_KEYS).forEach(id=>{before[id]=$(id)?.value||''});
    const activeView=document.querySelector('.view.active-view')?.id||'';
    const scrollY=window.scrollY||0;

    await baseRefresh();

    const wsFallback=before.workspaceProject||localStorage.getItem(PROJECT_KEYS.workspaceProject)||'';
    Object.keys(PROJECT_KEYS).forEach(id=>{
      const preferred=before[id]||localStorage.getItem(PROJECT_KEYS[id])||'';
      restoreSelector(id,preferred || (id==='workspaceProject'?wsFallback:''));
      saveSelector(id);
    });

    // Re-render only the active module using its restored project selection.
    if(activeView && $(activeView)){
      if(activeView==='billing')renderBilling();
      else if(activeView==='schedule')renderSchedule();
      else if(activeView==='progress')renderProgress();
      else if(activeView==='inventory')renderInventory();
      else if(activeView==='budget')renderBudget();
      else if(activeView==='files')renderFiles();
      else if(activeView==='projects')renderProjects();
      else if(activeView==='dashboard')renderDashboard();
    }

    requestAnimationFrame(()=>window.scrollTo(0,scrollY));
  };

  // Top Project Folder changes are intentional: sync modules then.
  // Background refreshes are not intentional and are handled above.
  if($('workspaceProject')){
    $('workspaceProject').addEventListener('change',e=>{
      const pid=e.target.value;
      saveSelector('workspaceProject');
      if(!pid)return;
      ['billingProjectFilter','scheduleProject','progressProject','inventoryProject','budgetProject','fileProject','smartProject'].forEach(id=>{
        const s=$(id);
        if(s && [...s.options].some(o=>String(o.value)===String(pid))){
          s.value=pid;
          saveSelector(id);
        }
      });
    });
  }

  // Changing the Billing project stays independent from the top Project Folder.
  if($('billingProjectFilter')){
    $('billingProjectFilter').addEventListener('change',()=>{
      saveSelector('billingProjectFilter');
      renderBilling();
    });
  }

  // Restore last module + its own project after login/reload.
  function restorePosition(){
    let view='';
    try{view=localStorage.getItem(VIEW_KEY)||''}catch(_){ }
    Object.keys(PROJECT_KEYS).forEach(id=>restoreSelector(id));
    if(view && $(view))show(view);
    requestAnimationFrame(()=>{
      let y=0;try{y=Number(localStorage.getItem(SCROLL_KEY)||0)}catch(_){ }
      window.scrollTo(0,y);
    });
  }

  setTimeout(()=>{if(currentUser)restorePosition()},900);
})();
