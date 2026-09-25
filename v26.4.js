// SAIKO Construction AI v26.4
// Fixes Actual live-link controls after Projected changed to file upload.
// Actual page mirrors all visible linked-sheet data and result is based on STATUS.
(function(){
  const n=v=>{
    if(v==null)return 0;
    const x=Number(String(v).replace(/,/g,'').replace(/%/g,'').trim());
    return Number.isFinite(x)?x:0;
  };

  window.trackerSheetViews=window.trackerSheetViews||{schedule:{},actual:{}};

  function actualProject(){
    const pid=$('progressProject')?.value||$('workspaceProject')?.value||'';
    return (cache.projects||[]).find(p=>String(p.id)===String(pid))||null;
  }

  function actualRows(pid){
    return (cache.progress||[]).filter(r=>String(r.project_id)===String(pid));
  }

  function actualStatusTotal(pid){
    return Math.max(0,Math.min(100,actualRows(pid).reduce((sum,r)=>sum+n(r.actual_percent),0)));
  }

  function colLetter(num){
    let out='';
    while(num>0){
      num--;
      out=String.fromCharCode(65+(num%26))+out;
      num=Math.floor(num/26);
    }
    return out;
  }

  function renderActualMirror(){
    const p=actualProject();
    const target=$('actualSheetMirror');
    const badge=$('actualMirrorStatus');
    if(!target)return;

    const rows=(window.trackerSheetViews.actual[String(p?.id||'')]||[]);
    if(!rows.length){
      target.innerHTML='<div class="empty">No visible linked-sheet data loaded yet. Click <strong>Save Link</strong> or <strong>Sync Now</strong>.</div>';
      if(badge)badge.textContent='WAITING';
      return;
    }

    let width=0;
    for(const row of rows){
      for(let c=row.length-1;c>=0;c--){
        if(String(row[c]??'').trim()!==''){width=Math.max(width,c+1);break;}
      }
    }
    const trimmed=rows.map(r=>r.slice(0,width));

    const heads=Array.from({length:width},(_,i)=>`<th class="sheet-col-letter">${colLetter(i+1)}</th>`).join('');
    const body=trimmed.map((row,ri)=>{
      const cells=Array.from({length:width},(_,ci)=>{
        const val=String(row[ci]??'');
        const numeric=/^-?[\d,.]+%?$/.test(val.trim())?' numeric-cell':'';
        return `<td class="sheet-mirror-cell${numeric}" title="${esc(val)}">${esc(val)}</td>`;
      }).join('');
      return `<tr><th class="sheet-row-number">${ri+1}</th>${cells}</tr>`;
    }).join('');

    target.innerHTML=`<div class="sheet-mirror-scroll"><table class="sheet-mirror-table"><thead><tr><th class="sheet-corner"></th>${heads}</tr></thead><tbody>${body}</tbody></table></div>`;
    if(badge)badge.textContent=`LIVE • ${trimmed.length} VISIBLE ROWS`;
  }

  function renderActualSummary(){
    const p=actualProject();
    if(!p||!$('progressSummary'))return;
    const rows=actualRows(p.id);
    const actual=actualStatusTotal(p.id);

    $('progressSummary').innerHTML=[
      ['Actual Accomplishment',pct(actual)],
      ['Remaining',pct(Math.max(0,100-actual))],
      ['Scopes Read',rows.length],
      ['Basis','STATUS']
    ].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');

    if($('actualSheetStatus')){
      $('actualSheetStatus').textContent=p.actual_progress_sheet_link?'Live link saved • 10 sec sync':'Not linked';
    }
    if($('actualSheetLink')&&document.activeElement!==$('actualSheetLink')){
      $('actualSheetLink').value=p.actual_progress_sheet_link||'';
    }
  }

  async function saveAndSyncActual(){
    const p=actualProject();
    if(!p)return alert('Select a project first.');

    const link=$('actualSheetLink')?.value.trim()||'';
    if(!link)return alert('Paste the Actual Google Sheet link first.');

    const saveBtn=$('saveActualSheetLinkBtn');
    const syncBtn=$('syncActualSheetBtn');
    if(saveBtn)saveBtn.disabled=true;
    if(syncBtn)syncBtn.disabled=true;

    try{
      const {data,error}=await sb.from('projects')
        .update({actual_progress_sheet_link:link})
        .eq('id',p.id)
        .select();
      if(error)throw error;

      const i=(cache.projects||[]).findIndex(x=>String(x.id)===String(p.id));
      if(i>=0)cache.projects[i]={...cache.projects[i],...(data?.[0]||{actual_progress_sheet_link:link})};

      if($('actualSheetStatus'))$('actualSheetStatus').textContent='Syncing visible sheet data...';

      const updated=(cache.projects||[]).find(x=>String(x.id)===String(p.id))||{...p,actual_progress_sheet_link:link};
      await window.syncActual(updated,false);

      renderActualMirror();
      renderActualSummary();
      if(typeof renderDashboard==='function')renderDashboard();
      if(typeof renderSchedule==='function')renderSchedule();

      if(typeof toast==='function')toast('Actual link saved and synced.');
    }catch(err){
      alert(err?.message||'Could not save/sync Actual Google Sheet.');
      renderActualSummary();
    }finally{
      if(saveBtn)saveBtn.disabled=false;
      if(syncBtn)syncBtn.disabled=false;
    }
  }

  async function syncActualNow(){
    const p=actualProject();
    if(!p)return alert('Select a project first.');
    if(!p.actual_progress_sheet_link){
      // If there is a pasted link but it has not been saved yet, save + sync in one click.
      const pasted=$('actualSheetLink')?.value.trim()||'';
      if(pasted)return saveAndSyncActual();
      return alert('Save the Actual Google Sheet link first.');
    }

    const btn=$('syncActualSheetBtn');
    if(btn)btn.disabled=true;
    try{
      await window.syncActual(p,false);
      renderActualMirror();
      renderActualSummary();
      if(typeof renderDashboard==='function')renderDashboard();
      if(typeof renderSchedule==='function')renderSchedule();
    }catch(err){
      alert(err?.message||'Could not sync Actual Google Sheet.');
    }finally{
      if(btn)btn.disabled=false;
    }
  }

  // Override old handlers with the v26.4 final handlers.
  if($('saveActualSheetLinkBtn'))$('saveActualSheetLinkBtn').onclick=saveAndSyncActual;
  if($('syncActualSheetBtn'))$('syncActualSheetBtn').onclick=syncActualNow;

  if($('progressProject')){
    $('progressProject').addEventListener('change',()=>{
      renderActualMirror();
      renderActualSummary();
    },{passive:true});
  }

  // Final Actual renderer used after each 10-sec live sync.
  window.renderProgress=function(){
    renderActualMirror();
    renderActualSummary();
  };

  // Keep actualForProject explicitly STATUS-based.
  window.actualForProject=function(pid){
    return actualStatusTotal(pid);
  };

  setTimeout(()=>{
    renderActualMirror();
    renderActualSummary();
  },400);
})();
