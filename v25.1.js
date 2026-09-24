// SAIKO Construction AI v25.1
// Live sync restored, but Schedule and Actual remain strictly separate.
// Google Sheet reader is visible-only: hidden rows/columns are excluded server-side.
(function(){
  const LIVE_SYNC_MS=10*1000;
  let syncing=false;

  function activeView(){
    return document.querySelector('.view.active-view')?.id||'';
  }
  function selectedProjectFor(view){
    const id=view==='schedule'?'scheduleProject':view==='progress'?'progressProject':'workspaceProject';
    const pid=$(id)?.value||$('workspaceProject')?.value||'';
    return (cache.projects||[]).find(p=>String(p.id)===String(pid))||null;
  }

  async function syncRelevantForView(silent=true){
    if(syncing||!currentUser||document.visibilityState!=='visible')return;
    const view=activeView();
    if(!['schedule','progress','dashboard'].includes(view))return;

    syncing=true;
    try{
      if(view==='schedule'){
        // v26.3: Projected is file-upload based. No Google Sheet live sync here.
      }else if(view==='progress'){
        const p=selectedProjectFor('progress');
        if(p?.actual_progress_sheet_link){
          await syncActual(p,silent);
          renderProgress();
          renderDashboard();
        }
      }else if(view==='dashboard'){
        // Dashboard compares both sources for the selected workspace project only.
        // This keeps the sync lightweight instead of refreshing every project.
        const p=selectedProjectFor('dashboard');
        if(p?.actual_progress_sheet_link)await syncActual(p,true);
        renderDashboard();
      }
    }catch(err){
      console.warn('live tracker sync',err);
      if(!silent)alert(err.message||'Tracker sync failed.');
    }finally{
      syncing=false;
    }
  }

  // Save Link remains save-only; Sync Now still works for immediate manual refresh.
  // Live sync is an additional convenience while the page is open.
  if($('scheduleSheetStatus'))$('scheduleSheetStatus').textContent=
    selectedProjectFor('schedule')?.schedule_sheet_link?'Live sync · visible cells only':'Not linked';
  if($('actualSheetStatus'))$('actualSheetStatus').textContent=
    selectedProjectFor('progress')?.actual_progress_sheet_link?'Live sync · visible cells only':'Not linked';

  const originalUpdateTrackerLinkUI=typeof updateTrackerLinkUI==='function'?updateTrackerLinkUI:null;
  if(originalUpdateTrackerLinkUI){
    updateTrackerLinkUI=function(){
      originalUpdateTrackerLinkUI();
      const sp=selectedProjectFor('schedule');
      const ap=selectedProjectFor('progress');
      if($('scheduleSheetStatus'))$('scheduleSheetStatus').textContent=sp?.schedule_sheet_link?'Live sync · visible cells only':'Not linked';
      if($('actualSheetStatus'))$('actualSheetStatus').textContent=ap?.actual_progress_sheet_link?'Live sync · visible cells only':'Not linked';
    };
  }

  if($('scheduleProject'))$('scheduleProject').addEventListener('change',()=>setTimeout(()=>syncRelevantForView(true),25),{passive:true});
  if($('progressProject'))$('progressProject').addEventListener('change',()=>setTimeout(()=>syncRelevantForView(true),25),{passive:true});
  if($('workspaceProject'))$('workspaceProject').addEventListener('change',()=>setTimeout(()=>syncRelevantForView(true),25),{passive:true});

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')syncRelevantForView(true);
  },{passive:true});
  window.addEventListener('online',()=>syncRelevantForView(true),{passive:true});

  // Single lightweight recurring timer only, now every 10 seconds.
  setInterval(()=>syncRelevantForView(true),LIVE_SYNC_MS);
  setTimeout(()=>syncRelevantForView(true),900);
})();
