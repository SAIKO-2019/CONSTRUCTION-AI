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

  // v28.28: keep the user's exact viewport during data refreshes/rerenders.
  // No polling and no MutationObserver.
  function captureViewport(){
    const active=document.querySelector('.view.active-view');
    const scrollers=[];
    if(active){
      active.querySelectorAll('.table-wrap, .inventory-table-wrap, .quotation-table-wrap, .chart-box').forEach((el,i)=>{
        if(el.scrollTop||el.scrollLeft){
          scrollers.push({el,top:el.scrollTop,left:el.scrollLeft,i});
        }
      });
    }
    return {
      x:window.scrollX||0,
      y:window.scrollY||0,
      scrollers
    };
  }

  function restoreViewport(state){
    if(!state)return;
    const apply=()=>{
      window.scrollTo(state.x||0,state.y||0);
      (state.scrollers||[]).forEach(s=>{
        if(!s.el?.isConnected)return;
        s.el.scrollTop=s.top||0;
        s.el.scrollLeft=s.left||0;
      });
    };
    // Restore after the immediate DOM update and once more after layout settles.
    requestAnimationFrame(()=>{
      apply();
      requestAnimationFrame(apply);
    });
  }

  window.captureStableViewportV2828=captureViewport;
  window.restoreStableViewportV2828=restoreViewport;

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

    const viewport=rerender?captureViewport():null;

    const ws=$('workspaceProject');
    if(canSelect(ws,target))ws.value=target;

    mirrorProject(target);
    saveProject(target);

    if(rerender){
      renderActiveModule();
      restoreViewport(viewport);
    }
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
    const viewport=captureViewport();

    await baseRefresh();

    const target=applyProject(before,false);

    requestAnimationFrame(()=>{
      mirrorProject(target);
      if(activeView && $(activeView))renderActiveModule();
      restoreViewport(viewport);
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
