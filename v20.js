// SAIKO Construction AI v20 — quotation projects + own dashboard + history
(function(){
  const $=id=>document.getElementById(id);
  let selectedId=null;
  let readBusy=false;

  function rows(){ return cache.quotationProjects||[]; }
  function selected(){ return rows().find(x=>String(x.id)===String(selectedId))||null; }
  function isComplete(q){ return q?.status==='Complete' || !!q?.boq_file_name; }

  async function readSheet(link){
    const r=await fetch('/api/read-quotation-sheet',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({link})
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok||!data.ok) throw new Error(data.error||'Could not read Google Sheet.');
    return data;
  }

  async function addHistory(qid, action, description, data={}){
    try{
      await sb.from('activity_log').insert({
        user_id:currentUser.id,
        display_name:cache.userPreferences?.display_name || currentProfile?.full_name || currentUser.email || 'User',
        module:'quotation',
        action,
        record_id:String(qid),
        project_id:null,
        description,
        change_data:data
      });
    }catch(e){ console.warn('quotation history',e); }
  }

  async function loadHistory(qid){
    const box=$('quotationHistoryList');
    if(!box)return;
    box.innerHTML='<div class="muted">Loading history…</div>';
    try{
      const {data,error}=await sb.from('activity_log')
        .select('*')
        .eq('module','quotation')
        .eq('record_id',String(qid))
        .order('created_at',{ascending:false})
        .limit(30);
      if(error)throw error;
      const items=data||[];
      box.innerHTML=items.length?items.map(x=>`
        <div class="quotation-history-item">
          <div class="quotation-history-dot"></div>
          <div>
            <strong>${esc(x.description||x.action||'Updated quotation')}</strong>
            <span>${esc(x.display_name||'User')} · ${new Date(x.created_at).toLocaleString()}</span>
          </div>
        </div>
      `).join(''):'<div class="settings-empty-state">No history yet.</div>';
    }catch(e){
      box.innerHTML='<div class="settings-empty-state">History unavailable.</div>';
    }
  }

  function renderOverview(){
    const list=rows();
    const totalCost=list.reduce((s,q)=>s+Number(q.estimated_cost||0),0);
    const totalProfit=list.reduce((s,q)=>s+Number(q.projected_profit||0),0);
    const complete=list.filter(isComplete).length;
    const active=list.length-complete;
    const box=$('quotationOverviewKPIs');
    if(box)box.innerHTML=[
      ['Quotation Projects',String(list.length)],
      ['For Quotation',String(active)],
      ['Complete',String(complete)],
      ['Total Indirect Cost',money(totalCost)],
      ['Total Present Profit',money(totalProfit)]
    ].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
  }

  function renderCards(){
    const box=$('quotationProjectCards');
    const empty=$('quotationEmptyState');
    const list=rows();

    renderOverview();
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
          <span>${q.client_name?esc(q.client_name):'No client encoded'}</span>
          <span>${q.boq_file_name?'Final file uploaded':'Waiting for final file'}</span>
        </div>
      </button>`;
    }).join('');

    box.querySelectorAll('[data-quotation-id]').forEach(btn=>{
      btn.onclick=()=>{
        selectedId=btn.dataset.quotationId;
        renderCards();
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
    $('quotationSelectedClient').textContent=q.client_name||'No client encoded';
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

    loadHistory(q.id);
  }

  window.renderPending=renderCards;

  window.renderQuotationDashboard=function(){
    const box=$('quotationDashboardSnapshot'); if(!box)return;
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

  $('addPendingBtn')?.addEventListener('click',()=>{
    $('pendingForm')?.reset();
    $('quotationAddStatus').textContent='';
    $('pendingDialog').showModal();
    setTimeout(()=>$('pwWorkItem')?.focus(),50);
  });

  if($('pendingForm')){
    $('pendingForm').onsubmit=async e=>{
      e.preventDefault();
      if(readBusy)return;

      const projectName=$('pwWorkItem')?.value.trim()||'';
      const client=$('pwClient')?.value.trim()||'';
      const link=$('pwGsheetLink')?.value.trim()||'';
      if(!projectName||!link)return;

      readBusy=true;
      const btn=$('createQuotationFromLinkBtn');
      const old=btn.textContent;
      btn.disabled=true;
      btn.textContent='Reading Google Sheet…';
      $('quotationAddStatus').className='quotation-add-status loading';
      $('quotationAddStatus').textContent='Reading Indirect Total Cost and Present Profit…';

      try{
        const data=await readSheet(link);

        const row={
          project_name:projectName,
          client_name:client || data.clientName || '',
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

        await addHistory(inserted.id,'created','Quotation project created',{
          gsheet_link:link,
          indirect_total_cost:row.estimated_cost,
          present_profit:row.projected_profit
        });

        selectedId=String(inserted.id);
        $('pendingDialog').close();
        await refreshAll();
        renderCards();
        window.renderQuotationDashboard();
        toast('Quotation project saved.');
      }catch(err){
        $('quotationAddStatus').className='quotation-add-status error';
        $('quotationAddStatus').textContent=err?.message||String(err);
      }finally{
        readBusy=false;
        btn.disabled=false;
        btn.textContent=old;
      }
    };
  }

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
        estimated_cost:Number(data.indirectTotalCost||0),
        running_amount:Number(data.indirectTotalCost||0),
        projected_profit:Number(data.presentProfit||0),
        updated_at:new Date().toISOString()
      };
      const {error}=await sb.from('quotation_projects').update(values).eq('id',q.id);
      if(error)throw error;

      await addHistory(q.id,'sheet_refresh','Google Sheet values refreshed',{
        indirect_total_cost:values.estimated_cost,
        present_profit:values.projected_profit
      });

      await refreshAll();
      renderCards();
      window.renderQuotationDashboard();
      toast('Quotation refreshed from Google Sheet.');
    }catch(err){
      alert(err?.message||String(err));
    }finally{
      btn.disabled=false;
      btn.textContent=old;
    }
  });

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

        await addHistory(q.id,'completed','Final quotation file uploaded; project marked Complete',{
          file_name:file.name,
          storage_path:path
        });

        $('quotationBoqFile').value='';
        await refreshAll();
        renderCards();
        window.renderQuotationDashboard();
        toast('Quotation marked Complete.');
      }catch(err){
        alert(err?.message||String(err));
      }finally{
        btn.disabled=false;
        btn.textContent=old;
      }
    };
  }

  const oldShow=window.show;
  if(typeof oldShow==='function'){
    window.show=function(id){
      oldShow(id);
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
