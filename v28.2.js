// CONSTRUCTION MONITORING v28.2
// - Per-project Actual Clear Data + unlink
// - Keeps Projected/Planned data intact
// - Cross-account changes propagate through existing Supabase Realtime
// - No new recurring timer / MutationObserver
(function(){
  function selectedActualProject(){
    const pid=$('progressProject')?.value||$('workspaceProject')?.value||'';
    return (cache.projects||[]).find(p=>String(p.id)===String(pid))||null;
  }

  async function clearActualData(){
    const p=selectedActualProject();
    if(!p)return alert('Select a project first.');

    const ok=confirm(
      `Clear Actual data for "${p.project_name}"?\n\n`+
      `This will remove:\n`+
      `• Current Actual scope STATUS data\n`+
      `• Saved Actual history / Actual S-Curve points\n`+
      `• Saved Actual sheet snapshot\n`+
      `• The saved Actual Google Sheet link\n\n`+
      `Projected/Planned data, Billing, Files, and other project data will NOT be deleted.`
    );
    if(!ok)return;

    const btn=$('clearActualDataBtn');
    if(btn){btn.disabled=true;btn.textContent='Clearing…'}

    try{
      const calls=await Promise.all([
        sb.from('actual_progress').delete().eq('project_id',p.id),
        sb.from('actual_progress_series').delete().eq('project_id',p.id),
        sb.from('actual_sheet_snapshots').delete().eq('project_id',p.id),
        sb.from('projects').update({
          actual_progress_sheet_link:null,
          tracker_last_sync_at:null
        }).eq('id',p.id).select()
      ]);

      const err=calls.find(r=>r.error)?.error;
      if(err)throw err;

      // Local shared cache cleanup.
      cache.progress=(cache.progress||[]).filter(r=>String(r.project_id)!==String(p.id));
      cache.actualSeries=(cache.actualSeries||[]).filter(r=>String(r.project_id)!==String(p.id));

      const projectIndex=(cache.projects||[]).findIndex(x=>String(x.id)===String(p.id));
      if(projectIndex>=0){
        cache.projects[projectIndex]={
          ...cache.projects[projectIndex],
          actual_progress_sheet_link:null,
          tracker_last_sync_at:null
        };
      }

      if(window.trackerSheetViews?.actual){
        delete window.trackerSheetViews.actual[String(p.id)];
      }

      if($('actualSheetLink'))$('actualSheetLink').value='';
      if($('actualSheetStatus'))$('actualSheetStatus').textContent='Cleared • Not linked';

      // Best-effort shared activity log.
      try{
        await sb.from('activity_log').insert({
          project_id:p.id,
          module:'actual',
          record_id:String(p.id),
          action:'actual_data_cleared',
          details:{
            project_name:p.project_name,
            note:'Actual STATUS/history/snapshot/link cleared by user'
          },
          created_by:currentUser.id
        });
      }catch(_){}

      // Existing renderers already know how to show zero/empty state.
      if(typeof renderProgress==='function')renderProgress();
      if(typeof renderDashboard==='function')renderDashboard();
      if(typeof window.renderSaikoHome==='function')window.renderSaikoHome();
      if(typeof toast==='function')toast('Actual data cleared and Google Sheet unlinked.');
    }catch(err){
      alert(err?.message||'Could not clear Actual data.');
    }finally{
      if(btn){btn.disabled=false;btn.textContent='Clear Data'}
    }
  }

  if($('clearActualDataBtn'))$('clearActualDataBtn').onclick=clearActualData;

  // Product branding at runtime.
  document.title='Construction Monitoring';

  // Keep top-level identity readable even if older scripts re-render nearby text.
  const sidebarBrand=document.querySelector('.sidebar .brand');
  if(sidebarBrand){
    const mark=sidebarBrand.querySelector('.brand-mark');
    const strong=sidebarBrand.querySelector('strong');
    const span=sidebarBrand.querySelector('span:not(.ultra-pulse)');
    if(mark)mark.textContent='CM';
    if(strong)strong.textContent='CONSTRUCTION';
    if(span)span.textContent='MONITORING · LIVE CONTROL';
  }
})();
