// SAIKO Construction AI v27.5
// Cross-account shared-state sync.
//
// Fix:
// - Projected/Actual S-Curve tables are loaded for every account at login.
// - Supabase Realtime changes from one account refresh other open accounts.
// - No extra polling timer. Uses database events + visibility/online refresh.
(function(){
  let channel=null;
  let refreshTimer=null;
  let refreshing=false;

  const TABLES={
    projects:'projects',
    billings:'billings',
    payments:'payments',
    schedule:'schedule_items',
    progress:'actual_progress',
    projectedSeries:'projected_progress_series',
    actualSeries:'actual_progress_series',
    projectedScopeSeries:'projected_scope_series'
  };

  async function readTable(table){
    const {data,error}=await sb.from(table).select('*');
    if(error)throw error;
    return data||[];
  }

  function activeView(){
    return document.querySelector('.view.active-view')?.id||'dashboard';
  }

  function rerenderVisible(){
    if(typeof syncProjectSelects==='function')syncProjectSelects();

    const view=activeView();
    try{
      if(view==='dashboard' && typeof renderDashboard==='function')renderDashboard();
      else if(view==='projects' && typeof renderProjects==='function')renderProjects();
      else if(view==='billing' && typeof renderBilling==='function')renderBilling();
      else if(view==='schedule' && typeof renderSchedule==='function')renderSchedule();
      else if(view==='progress' && typeof renderProgress==='function')renderProgress();
      else if(view==='files' && typeof renderFiles==='function')renderFiles();
      else if(view==='templates' && typeof renderTemplates==='function')renderTemplates();

      // Dashboard curve cards are also shared state; refresh if its renderer exists.
      if(view!=='dashboard' && typeof window.renderDateDrivenProjectCurves==='function'){
        // Do not switch views; this only updates the detached dashboard card markup.
        window.renderDateDrivenProjectCurves();
      }
    }catch(err){
      console.warn('shared rerender',err);
    }
  }

  async function refreshSharedState(){
    if(refreshing || !window.currentUser || !window.sb?.from)return;
    refreshing=true;

    try{
      const entries=Object.entries(TABLES);
      const results=await Promise.allSettled(entries.map(([,table])=>readTable(table)));

      let changed=false;
      results.forEach((result,i)=>{
        if(result.status!=='fulfilled'){
          console.warn('shared table refresh',entries[i][1],result.reason);
          return;
        }
        const [cacheKey]=entries[i];
        cache[cacheKey]=result.value;
        changed=true;
      });

      if(changed)rerenderVisible();
    }finally{
      refreshing=false;
    }
  }

  function queueSharedRefresh(){
    if(refreshTimer)clearTimeout(refreshTimer);
    refreshTimer=setTimeout(()=>{
      refreshTimer=null;
      refreshSharedState();
    },300);
  }

  function attachRealtime(){
    if(channel || !window.currentUser || !window.sb?.channel)return;

    channel=sb.channel('saiko-shared-state-v275');

    const watched=[
      'projects',
      'billings',
      'payments',
      'schedule_items',
      'actual_progress',
      'projected_progress_series',
      'actual_progress_series',
      'projected_scope_series',
      'actual_sheet_snapshots',
      'projected_sheet_snapshots'
    ];

    watched.forEach(table=>{
      channel.on(
        'postgres_changes',
        {event:'*',schema:'public',table},
        queueSharedRefresh
      );
    });

    channel.subscribe(status=>{
      if(status==='SUBSCRIBED'){
        // Reconcile once after the channel is live so every account starts from
        // the same database state even if a change happened during login.
        refreshSharedState();
      }
    });
  }

  function detachRealtime(){
    if(!channel)return;
    try{sb.removeChannel(channel)}catch(_){}
    channel=null;
  }

  // Keep all accounts fresh when returning to the tab or reconnecting.
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'){
      refreshSharedState();
      attachRealtime();
      if(typeof window.checkForSaikoPatch==='function')window.checkForSaikoPatch();
    }
  },{passive:true});

  window.addEventListener('online',()=>{
    refreshSharedState();
    attachRealtime();
    if(typeof window.checkForSaikoPatch==='function')window.checkForSaikoPatch();
  },{passive:true});

  // Auth-event driven; no additional recurring interval.
  if(window.sb?.auth?.onAuthStateChange){
    sb.auth.onAuthStateChange((event,session)=>{
      if(session?.user){
        setTimeout(()=>{
          refreshSharedState();
          attachRealtime();
        },250);
      }else if(event==='SIGNED_OUT'){
        detachRealtime();
      }
    });
  }

  // Covers accounts that were already signed in before this script loaded.
  setTimeout(()=>{
    if(window.currentUser){
      refreshSharedState();
      attachRealtime();
    }
  },700);

  window.refreshSaikoSharedState=refreshSharedState;
})();
