// CONSTRUCTION MONITORING v28.18
// ONE PROJECT FOLDER SOURCE OF TRUTH
// The topbar #workspaceProject is the only visible project selector.
// Hidden module selectors mirror it for backward compatibility.
(function(){
  const VIEW_KEY='saiko_last_view';
  const SCROLL_KEY='saiko_last_scroll';
  const PROJECT_KEY='saiko_project_workspace';

  const MODULE_SELECTORS=[
    'billingProjectFilter',
    'scheduleProject',
    'progressProject',
    'inventoryProject',
    'budgetProject',
    'reportProject',
    'fileProject',
    'smartProject'
  ];

  const FORM_PROJECT_SELECTORS=[
    'bProject',
    'iProject'
  ];

  // Old per-module keys are retired so they cannot restore a different project.
  const OLD_KEYS=[
    'saiko_project_billing',
    'saiko_project_schedule',
    'saiko_project_progress',
    'saiko_project_inventory',
    'saiko_project_budget',
    'saiko_project_files',
    'saiko_project_smart'
  ];

  function validProject(id){
    return !!(id && (cache.projects||[]).some(p=>String(p.id)===String(id)));
  }

  function savedProject(){
    try{return localStorage.getItem(PROJECT_KEY)||''}catch(_){return ''}
  }

  function saveProject(pid){
    try{
      if(pid)localStorage.setItem(PROJECT_KEY,pid);
      else localStorage.removeItem(PROJECT_KEY);
      OLD_KEYS.forEach(k=>localStorage.removeItem(k));
    }catch(_){}
  }

  function canSelect(el,pid){
    return !!(el && pid && [...el.options].some(o=>String(o.value)===String(pid)));
  }

  function mirrorProject(pid){
    if(!pid)return;

    [...MODULE_SELECTORS,...FORM_PROJECT_SELECTORS].forEach(id=>{
      const el=$(id);
      if(canSelect(el,pid))el.value=pid;
    });
  }

  function resolveProject(preferred=''){
    if(validProject(preferred))return preferred;

    const ws=$('workspaceProject')?.value||'';
    if(validProject(ws))return ws;

    const saved=savedProject();
    if(validProject(saved))return saved;

    return cache.projects?.[0]?.id||'';
  }

  function renderActiveModule(){
    const active=document.querySelector('.view.active-view')?.id||'';
    try{
      if(active==='billing')renderBilling();
      else if(active==='schedule')renderSchedule();
      else if(active==='progress')renderProgress();
      else if(active==='inventory')renderInventory();
      else if(active==='budget')renderBudget();
      else if(active==='files')renderFiles();
      else if(active==='projects')renderProjects();
      else if(active==='dashboard')renderDashboard();
      else if(active==='reports' && typeof window.renderReportPreview==='function')window.renderReportPreview();
    }catch(err){
      console.warn('Active project render:',err);
    }
  }

  function applyProject(pid,rerender=true){
    const target=resolveProject(pid);
    if(!target)return '';

    const ws=$('workspaceProject');
    if(canSelect(ws,target))ws.value=target;

    mirrorProject(target);
    saveProject(target);

    if(rerender)renderActiveModule();
    return target;
  }

  // Replace v13's old "render every module" onchange with one canonical change.
  if($('workspaceProject')){
    $('workspaceProject').onchange=e=>{
      applyProject(e.target.value,true);
    };
  }

  // Local selectors are compatibility mirrors only. If old code changes one,
  // immediately put it back on the canonical project instead of allowing drift.
  MODULE_SELECTORS.forEach(id=>{
    const el=$(id);
    if(!el)return;

    el.addEventListener('change',e=>{
      const canonical=resolveProject();
      if(canonical && String(e.target.value)!==String(canonical)){
        e.target.value=canonical;
      }
    },{capture:true});
  });

  // Preserve only ONE project across refreshes.
  const baseRefresh=refreshAll;
  refreshAll=async function(){
    const before=resolveProject();
    const activeView=document.querySelector('.view.active-view')?.id||'';
    const scrollY=window.scrollY||0;

    await baseRefresh();

    const target=applyProject(before,false);

    // A few late modules repopulate their selectors during refresh; mirror once more
    // after those options exist.
    requestAnimationFrame(()=>{
      mirrorProject(target);
      if(activeView && $(activeView))renderActiveModule();
      window.scrollTo(0,scrollY);
    });
  };

  function restorePosition(){
    const target=resolveProject(savedProject());
    applyProject(target,false);

    let view='';
    try{view=localStorage.getItem(VIEW_KEY)||''}catch(_){}
    if(view && $(view))show(view);

    requestAnimationFrame(()=>{
      mirrorProject(target);
      let y=0;
      try{y=Number(localStorage.getItem(SCROLL_KEY)||0)}catch(_){}
      window.scrollTo(0,y);
    });
  }

  // Clear old independent project memories immediately.
  saveProject(resolveProject());

  // Public helper for folder cards / future modules.
  window.setActiveProjectFolder=function(pid){
    return applyProject(pid,true);
  };

  setTimeout(()=>{if(currentUser)restorePosition()},900);
})();
