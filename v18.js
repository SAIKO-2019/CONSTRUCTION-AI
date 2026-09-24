// SAIKO Construction AI v18 — focused quotation link reader
(function(){
  const $=id=>document.getElementById(id);
  let syncTimer=null;
  let syncBusy=false;

  function selectedQuotation(){
    const id=$('pendingProject')?.value;
    return cache.quotationProjects?.find(x=>String(x.id)===String(id))||null;
  }

  function setSyncStatus(type,text){
    const box=$('quotationSyncStatus');
    if(!box)return;
    box.className=`quotation-sync-status ${type||''}`;
    box.innerHTML=`<span class="status-dot"></span><span>${esc(text)}</span>`;
  }

  function setMetric(id,value){
    const el=$(id);
    if(el)el.textContent=money(Number(value||0));
  }

  function renderFocusedQuotation(){
    const q=selectedQuotation();
    if(!q){
      setMetric('quotationIndirectCost',0);
      setMetric('quotationPresentProfit',0);
      if($('quotationGsheetLink'))$('quotationGsheetLink').value='';
      if($('quotationCompletionBadge')){$('quotationCompletionBadge').textContent='For Quotation';$('quotationCompletionBadge').className='status-pill pending';}
      if($('quotationCompletionFile'))$('quotationCompletionFile').textContent='No completion file uploaded yet.';
      setSyncStatus('', 'Select a quotation project.');
      return;
    }

    if($('quotationGsheetLink'))$('quotationGsheetLink').value=q.gsheet_link||'';
    setMetric('quotationIndirectCost',q.estimated_cost);
    setMetric('quotationPresentProfit',q.projected_profit);

    if($('quotationIndirectSource'))$('quotationIndirectSource').textContent=q.gsheet_link?'Saved from Google Sheet':'Waiting for Google Sheet';
    if($('quotationProfitSource'))$('quotationProfitSource').textContent=q.gsheet_link?'Saved from Google Sheet':'Waiting for Google Sheet';

    const complete=q.status==='Complete' || !!q.boq_file_name;
    if($('quotationCompletionBadge')){
      $('quotationCompletionBadge').textContent=complete?'Complete':'For Quotation';
      $('quotationCompletionBadge').className=`status-pill ${complete?'complete':'pending'}`;
    }
    if($('quotationCompletionFile')){
      $('quotationCompletionFile').innerHTML=q.boq_file_name
        ? `Completed file: <strong>${esc(q.boq_file_name)}</strong>`
        : 'No completion file uploaded yet.';
    }
    setSyncStatus(q.gsheet_link?'ok':'', q.gsheet_link?'Google Sheet linked.':'Paste a Google Sheets link to read the costing.');
  }

  window.renderPending=function(){
    if(!$('pendingRows'))return;
    const rows=cache.quotationProjects||[];
    const indirect=rows.reduce((s,q)=>s+Number(q.estimated_cost||0),0);
    const profit=rows.reduce((s,q)=>s+Number(q.projected_profit||0),0);
    const complete=rows.filter(q=>q.status==='Complete'||q.boq_file_name).length;

    $('pendingKPIs').innerHTML=[
      ['Quotation Projects',String(rows.length)],
      ['Indirect Total Cost',money(indirect)],
      ['Present Profit',money(profit)],
      ['Complete',`${complete} / ${rows.length}`]
    ].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');

    $('pendingRows').innerHTML=rows.length?rows.map(q=>{
      const done=q.status==='Complete'||q.boq_file_name;
      return `<tr>
        <td><strong>${esc(q.project_name)}</strong></td>
        <td>${esc(q.client_name||'—')}</td>
        <td>${q.gsheet_link?`<a class="quote-link" href="${esc(q.gsheet_link)}" target="_blank" rel="noopener">Open Sheet</a>`:'—'}</td>
        <td>${money(q.estimated_cost||0)}</td>
        <td class="${Number(q.projected_profit||0)>=0?'cost-positive':'cost-negative'}">${money(q.projected_profit||0)}</td>
        <td><span class="status-pill ${done?'complete':'pending'}">${done?'Complete':'For Quotation'}</span></td>
        <td>${q.boq_file_name?esc(q.boq_file_name):'—'}</td>
        <td><div class="row-actions"><button class="icon-action" onclick="selectQuotation('${q.id}')">Open</button><button class="danger-link" onclick="deleteQuotation('${q.id}')">Delete</button></div></td>
      </tr>`;
    }).join(''):'<tr><td colspan="8" class="empty">No quotation projects yet.</td></tr>';

    renderFocusedQuotation();
    if(typeof renderQuotationDashboard==='function')renderQuotationDashboard();
  };

  // Replace the add-quotation submit behavior with For Quotation only.
  if($('pendingForm')){
    $('pendingForm').onsubmit=async e=>{
      e.preventDefault();
      const row={
        project_name:$('pwWorkItem').value.trim(),
        client_name:$('pwClient')?.value.trim()||'',
        estimator:$('pwAssignedTo')?.value.trim()||'',
        target_submission:$('pwTargetDate')?.value||null,
        status:'For Quotation',
        notes:$('pwNotes')?.value.trim()||'',
        created_by:currentUser.id,
        updated_at:new Date().toISOString()
      };
      const {error}=await sb.from('quotation_projects').insert(row);
      if(error)return alert(error.message);
      $('pendingDialog').close();
      await refreshAll();
      renderPending();
      toast('Quotation project added.');
    };
  }

  async function syncSheetLink(force=false){
    if(syncBusy)return;
    const q=selectedQuotation();
    if(!q)return alert('Select a quotation project first.');
    const link=$('quotationGsheetLink')?.value.trim()||'';
    if(!link){
      setSyncStatus('error','Paste a Google Sheets link first.');
      return;
    }
    if(!force && link===q.gsheet_link && q.estimated_cost!=null && q.projected_profit!=null){
      // still allow normal auto refresh if user just pasted the same link by waiting for explicit refresh
    }

    syncBusy=true;
    setSyncStatus('loading','Reading Google Sheet…');
    if($('refreshQuotationLinkBtn'))$('refreshQuotationLinkBtn').disabled=true;

    try{
      const r=await fetch('/api/read-quotation-sheet',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({link})
      });
      const data=await r.json().catch(()=>({}));
      if(!r.ok||!data.ok)throw new Error(data.error||'Could not read Google Sheet.');

      const indirect=Number(data.indirectTotalCost??0);
      const profit=Number(data.presentProfit??0);

      const values={
        gsheet_link:link,
        estimated_cost:indirect,
        running_amount:indirect,
        projected_profit:profit,
        updated_at:new Date().toISOString()
      };
      const {error}=await sb.from('quotation_projects').update(values).eq('id',q.id);
      if(error)throw error;

      setMetric('quotationIndirectCost',indirect);
      setMetric('quotationPresentProfit',profit);
      if($('quotationIndirectSource'))$('quotationIndirectSource').textContent=data.sources?.indirect||'Read from Google Sheet';
      if($('quotationProfitSource'))$('quotationProfitSource').textContent=data.sources?.profit||'Read from Google Sheet';
      setSyncStatus('ok',data.warnings?.length?`Read complete. ${data.warnings.join(' ')}`:'Google Sheet read successfully.');

      await refreshAll();
      renderPending();
      toast('Quotation values updated from Google Sheet.');
    }catch(err){
      setSyncStatus('error',err?.message||String(err));
    }finally{
      syncBusy=false;
      if($('refreshQuotationLinkBtn'))$('refreshQuotationLinkBtn').disabled=false;
    }
  }

  function queueLinkSync(){
    clearTimeout(syncTimer);
    syncTimer=setTimeout(()=>syncSheetLink(false),700);
  }

  if($('quotationGsheetLink')){
    $('quotationGsheetLink').addEventListener('change',queueLinkSync);
    $('quotationGsheetLink').addEventListener('paste',()=>setTimeout(queueLinkSync,20));
  }
  $('refreshQuotationLinkBtn')?.addEventListener('click',()=>syncSheetLink(true));

  // Upload final file -> mark complete.
  if($('saveQuotationDataBtn')){
    $('saveQuotationDataBtn').onclick=async()=>{
      const q=selectedQuotation();
      if(!q)return alert('Select a quotation project first.');
      const file=$('quotationBoqFile')?.files?.[0];
      if(!file)return alert('Choose the completed costing/quotation file first.');

      const btn=$('saveQuotationDataBtn');
      btn.disabled=true;
      const old=btn.textContent;
      btn.textContent='Uploading…';
      try{
        const safe=file.name.replace(/[^a-zA-Z0-9._-]+/g,'_');
        const path=`quotation/${q.id}/final/${Date.now()}-${safe}`;
        const up=await sb.storage.from('project-files').upload(path,file,{upsert:false});
        if(up.error)throw up.error;

        const {error}=await sb.from('quotation_projects').update({
          boq_file_name:file.name,
          boq_storage_path:path,
          status:'Complete',
          updated_at:new Date().toISOString()
        }).eq('id',q.id);
        if(error)throw error;

        $('quotationBoqFile').value='';
        await refreshAll();
        renderPending();
        toast('Quotation marked Complete.');
      }catch(err){
        alert(err?.message||String(err));
      }finally{
        btn.disabled=false;
        btn.textContent=old;
      }
    };
  }

  // Rewire selector for the focused workspace.
  if($('pendingProject')){
    $('pendingProject').onchange=()=>{
      renderFocusedQuotation();
      renderPending();
    };
  }

  // Replace dashboard quotation summary with the same two tracked values.
  window.renderQuotationDashboard=function(){
    const box=$('quotationDashboardSnapshot');if(!box)return;
    const rows=cache.quotationProjects||[];
    const indirect=rows.reduce((s,q)=>s+Number(q.estimated_cost||0),0);
    const profit=rows.reduce((s,q)=>s+Number(q.projected_profit||0),0);
    const complete=rows.filter(q=>q.status==='Complete'||q.boq_file_name).length;
    box.innerHTML=[
      ['Quotation Projects',String(rows.length)],
      ['Indirect Total Cost',money(indirect)],
      ['Present Profit',money(profit)],
      ['Complete',`${complete} / ${rows.length}`]
    ].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
  };

  // Initial focused render after cache is available.
  setTimeout(()=>{if(currentUser){renderPending();renderFocusedQuotation();}},900);
})();
