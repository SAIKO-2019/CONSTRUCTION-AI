// SAIKO Construction AI v22.6 — lightweight automatic Google Sheet sync
(function(){
  const SYNC_EVERY_MS=30*1000; // every 30 seconds
  const INITIAL_DELAY_MS=1000;   // first background sync ~1 sec after login/app load
  let syncing=false;
  let timer=null;

  function rows(){ return cache.quotationProjects||[]; }
  function eligible(q){
    // Live Google Sheet sync applies ONLY to active For Quotation projects.
    // Complete, Awarded and Not Awarded projects are intentionally frozen.
    return !!(
      q &&
      q.gsheet_link &&
      (q.status==='For Quotation' || !q.status)
    );
  }
  function stable(v){
    try{return JSON.stringify(v??null)}catch(_){return String(v??'')}
  }
  function n(v){
    const x=Number(v);
    return Number.isFinite(x)?x:0;
  }

  function changed(q,data){
    if(n(q.estimated_cost)!==n(data.indirectTotalCost))return true;
    if(n(q.running_amount)!==n(data.indirectTotalCost))return true;
    if(n(q.projected_profit)!==n(data.presentProfit))return true;
    if((q.summary_sheet_name||'')!==(data.summarySheetName||''))return true;
    if(stable(q.scope_breakdown)!==stable(data.scopeBreakdown||[]))return true;
    if(stable(q.summary_breakdown)!==stable(data.summaryBreakdown||[]))return true;
    if(stable(q.summary_headers)!==stable(data.summaryHeaders||[]))return true;
    if(stable(q.summary_table)!==stable(data.summaryTable||[]))return true;
    return false;
  }

  async function readSheet(link){
    const r=await fetch('/api/read-quotation-sheet',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({link})
    });
    let data={};
    try{data=await r.json()}catch(_){ }
    if(!r.ok||!data?.ok)throw new Error(data?.error||'Could not read Google Sheet.');
    return data;
  }

  async function syncOne(q){
    const data=await readSheet(q.gsheet_link);
    if(!changed(q,data))return false;

    const values={
      estimated_cost:n(data.indirectTotalCost),
      running_amount:n(data.indirectTotalCost),
      projected_profit:n(data.presentProfit),
      scope_breakdown:Array.isArray(data.scopeBreakdown)?data.scopeBreakdown:[],
      summary_breakdown:Array.isArray(data.summaryBreakdown)?data.summaryBreakdown:[],
      summary_headers:Array.isArray(data.summaryHeaders)?data.summaryHeaders:[],
      summary_table:Array.isArray(data.summaryTable)?data.summaryTable:[],
      summary_sheet_name:data.summarySheetName||q.summary_sheet_name||null,
      updated_at:new Date().toISOString()
    };

    const {error}=await sb.from('quotation_projects').update(values).eq('id',q.id);
    if(error)throw error;

    try{
      await sb.from('activity_log').insert({
        project_id:null,
        module:'quotation',
        record_id:String(q.id),
        action:'auto_sheet_sync',
        details:{
          project_name:q.project_name,
          indirect_total_cost:values.estimated_cost,
          present_profit:values.projected_profit,
          scope_count:values.summary_breakdown.length,
          source:'Google Sheet SUMMARY auto-sync'
        },
        created_by:currentUser.id
      });
    }catch(_){ }
    return true;
  }

  async function runAutoSync(){
    if(syncing||!currentUser||document.visibilityState!=='visible')return;
    syncing=true;
    let updates=0;
    let failed=0;
    try{
      // Sequential on purpose: avoids burst requests and keeps the UI responsive.
      const all=rows().filter(eligible);
      const active=document.querySelector('.quotation-project-card.active');
      const activeId=active?.dataset?.quotationId;
      const queue=[...all].sort((a,b)=>{
        if(String(a.id)===String(activeId))return -1;
        if(String(b.id)===String(activeId))return 1;
        return 0;
      });
      for(const q of queue){
        try{
          if(await syncOne(q))updates++;
        }catch(err){
          failed++;
          console.warn('quotation auto-sync',q?.project_name,err);
        }
      }

      if(updates>0){
        await refreshAll();
        if(typeof renderPending==='function')renderPending();
        if(typeof window.renderQuotationSummary==='function')window.renderQuotationSummary();
        if(typeof window.renderQuotationSummaryMirror==='function')window.renderQuotationSummaryMirror();
        if(typeof window.refreshQuotationAwardFolders==='function')window.refreshQuotationAwardFolders();
        if(typeof toast==='function')toast(`${updates} quotation project${updates===1?'':'s'} updated from Google Sheets.`);
      }
    }finally{
      syncing=false;
    }
  }

  // One repeating timer only. No MutationObserver, no page scanning loop.
  setTimeout(()=>{ if(currentUser)runAutoSync(); },INITIAL_DELAY_MS);
  timer=setInterval(runAutoSync,SYNC_EVERY_MS);

  // If the user returns after being away, check immediately instead of waiting up to 5 min.
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&currentUser)runAutoSync();
  },{passive:true});


  document.addEventListener('click',e=>{
    if(e.target.closest?.('.quotation-project-card[data-quotation-id]')){
      setTimeout(()=>{if(currentUser)runAutoSync();},250);
    }
  },{passive:true});

  // Allow manual triggering from console/other controls without adding another timer.
  window.syncQuotationSheetsNow=runAutoSync;
})();
