// SAIKO Construction AI v19 — link-only quotation project workflow
(function(){
  const $=id=>document.getElementById(id);
  let selectedId=null;
  let readBusy=false;

  function rows(){return cache.quotationProjects||[]}
  function selected(){return rows().find(x=>String(x.id)===String(selectedId))||null}

  async function readSheet(link){
    const r=await fetch('/api/read-quotation-sheet',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({link})
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok||!data.ok)throw new Error(data.error||'Could not read Google Sheet.');
    return data;
  }

  function isComplete(q){return q?.status==='Complete'||!!q?.boq_file_name}

  function renderCards(){
    const box=$('quotationProjectCards');
    const empty=$('quotationEmptyState');
    const list=rows();

    if(empty)empty.classList.toggle('hidden',list.length>0);
    if(!box)return;

    if(!list.length){
      box.innerHTML='';
      selectedId=null;
      renderSelected();
      return;
    }

    if(!selectedId || !list.some(q=>String(q.id)===String(selectedId))){
      selectedId=String(list[0].id);
    }

    box.innerHTML=list.map(q=>{
      const active=String(q.id)===String(selectedId);
      const complete=isComplete(q);
      return `<button type="button" class="quotation-project-card ${active?'active':''}" data-quotation-id="${q.id}">
        <div class="quotation-card-head">
          <div>
            <small>QUOTATION PROJECT</small>
            <h3>${esc(q.project_name||'Quotation Project')}</h3>
          </div>
          <span class="status-pill ${complete?'complete':'pending'}">${complete?'Complete':'For Quotation'}</span>
        </div>
        <div class="quotation-card-metrics">
          <div><span>Running / Indirect Total Cost</span><strong>${money(q.estimated_cost||0)}</strong></div>
          <div><span>Present Profit</span><strong class="${Number(q.projected_profit||0)>=0?'cost-positive':'cost-negative'}">${money(q.projected_profit||0)}</strong></div>
        </div>
        <div class="quotation-card-foot">
          <span>${q.client_name?esc(q.client_name):'Google Sheet linked'}</span>
          <span>${q.boq_file_name?'Final file uploaded':'Waiting for final file'}</span>
        </div>
      </button>`;
    }).join('');

    box.querySelectorAll('[data-quotation-id]').forEach(btn=>{
      btn.onclick=()=>{
        selectedId=btn.dataset.quotationId;
        renderCards();
        renderSelected();
      };
    });
    renderSelected();
  }

  function renderSelected(){
    const q=selected();
    const wrap=$('quotationSelectedPanel');
    if(!wrap)return;
    wrap.classList.toggle('hidden',!q);
    if(!q)return;

    const complete=isComplete(q);
    $('quotationSelectedName').textContent=q.project_name||'Quotation Project';
    $('quotationSelectedLink').href=q.gsheet_link||'#';
    $('quotationSelectedLink').style.pointerEvents=q.gsheet_link?'auto':'none';

    $('quotationStatusValue').textContent=complete?'Complete':'For Quotation';
    $('quotationStatusMeta').textContent=complete?'Final quotation file uploaded':'Still under quotation';
    $('quotationIndirectCost').textContent=money(q.estimated_cost||0);
    $('quotationPresentProfit').textContent=money(q.projected_profit||0);
    $('quotationCompletionValue').textContent=complete?'Complete':'Pending';
    $('quotationCompletionMeta').textContent=complete?(q.boq_file_name||'Final file uploaded'):'Upload final file when done';

    $('quotationCompletionBadge').textContent=complete?'Complete':'For Quotation';
    $('quotationCompletionBadge').className=`status-pill ${complete?'complete':'pending'}`;

    $('quotationCompletionFile').innerHTML=q.boq_file_name
      ? `Final file: <strong>${esc(q.boq_file_name)}</strong>`
      : 'No final file uploaded yet.';
  }

  window.renderPending=renderCards;
  window.renderQuotationDashboard=function(){
    const box=$('quotationDashboardSnapshot');if(!box)return;
    const list=rows();
    const indirect=list.reduce((s,q)=>s+Number(q.estimated_cost||0),0);
    const profit=list.reduce((s,q)=>s+Number(q.projected_profit||0),0);
    const complete=list.filter(isComplete).length;
    box.innerHTML=[
      ['Quotation Projects',String(list.length)],
      ['Indirect Total Cost',money(indirect)],
      ['Present Profit',money(profit)],
      ['Complete',`${complete} / ${list.length}`]
    ].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
  };

  // Add quotation = link only
  const addBtn=$('addPendingBtn');
  if(addBtn){
    addBtn.onclick=()=>{
      $('pendingForm')?.reset();
      $('quotationAddStatus').textContent='';
      $('pendingDialog').showModal();
      setTimeout(()=>$('pwGsheetLink')?.focus(),50);
    };
  }

  if($('pendingForm')){
    $('pendingForm').onsubmit=async e=>{
      e.preventDefault();
      if(readBusy)return;
      const link=$('pwGsheetLink')?.value.trim()||'';
      if(!link)return;

      readBusy=true;
      const submit=$('createQuotationFromLinkBtn');
      const old=submit.textContent;
      submit.disabled=true;
      submit.textContent='Reading Google Sheet…';
      $('quotationAddStatus').className='quotation-add-status loading';
      $('quotationAddStatus').textContent='Reading project name, Indirect Total Cost, and Present Profit…';

      try{
        const data=await readSheet(link);

        const row={
          project_name:data.projectName||`Quotation ${Date.now()}`,
          client_name:data.clientName||'',
          estimator:'',
          target_submission:null,
          status:'For Quotation',
          notes:'',
          gsheet_link:link,
          estimated_cost:Number(data.indirectTotalCost||0),
          running_amount:Number(data.indirectTotalCost||0),
          projected_profit:Number(data.presentProfit||0),
          created_by:currentUser.id,
          updated_at:new Date().toISOString()
        };

        const {data:inserted,error}=await sb.from('quotation_projects').insert(row).select('*').single();
        if(error)throw error;

        selectedId=String(inserted.id);
        $('quotationAddStatus').className='quotation-add-status ok';
        $('quotationAddStatus').textContent='Quotation project created.';
        $('pendingDialog').close();

        await refreshAll();
        renderCards();
        window.renderQuotationDashboard();
        toast('Quotation added from Google Sheet.');
      }catch(err){
        $('quotationAddStatus').className='quotation-add-status error';
        $('quotationAddStatus').textContent=err?.message||String(err);
      }finally{
        readBusy=false;
        submit.disabled=false;
        submit.textContent=old;
      }
    };
  }

  // Refresh selected project from its Sheet
  $('refreshQuotationLinkBtn')?.addEventListener('click',async()=>{
    const q=selected();
    if(!q?.gsheet_link)return;
    const btn=$('refreshQuotationLinkBtn');
    const old=btn.textContent;
    btn.disabled=true;
    btn.textContent='Reading…';
    try{
      const data=await readSheet(q.gsheet_link);
      const values={
        project_name:data.projectName||q.project_name,
        client_name:data.clientName||q.client_name||'',
        estimated_cost:Number(data.indirectTotalCost||0),
        running_amount:Number(data.indirectTotalCost||0),
        projected_profit:Number(data.presentProfit||0),
        updated_at:new Date().toISOString()
      };
      const {error}=await sb.from('quotation_projects').update(values).eq('id',q.id);
      if(error)throw error;
      await refreshAll();
      renderCards();
      window.renderQuotationDashboard();
      toast('Quotation refreshed from Google Sheet.');
    }catch(err){alert(err?.message||String(err))}
    finally{btn.disabled=false;btn.textContent=old;}
  });

  // Upload final file => complete
  if($('saveQuotationDataBtn')){
    $('saveQuotationDataBtn').onclick=async()=>{
      const q=selected();
      if(!q)return alert('Select a quotation project first.');
      const file=$('quotationBoqFile')?.files?.[0];
      if(!file)return alert('Choose the completed quotation file first.');

      const btn=$('saveQuotationDataBtn');
      const old=btn.textContent;
      btn.disabled=true;
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
        renderCards();
        window.renderQuotationDashboard();
        toast('Quotation marked Complete.');
      }catch(err){alert(err?.message||String(err))}
      finally{btn.disabled=false;btn.textContent=old;}
    };
  }

  // Delete currently selected from card via keyboard/context intentionally omitted;
  // keep workspace focused and simple.

  // Make show('quotation') render the new project cards.
  const oldShowV19=window.show;
  if(typeof oldShowV19==='function'){
    window.show=function(id){
      oldShowV19(id);
      if(id==='quotation')setTimeout(renderCards,0);
    };
  }

  setTimeout(()=>{
    if(currentUser){
      renderCards();
      window.renderQuotationDashboard();
    }
  },900);
})();
