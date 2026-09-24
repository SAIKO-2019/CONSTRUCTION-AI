// SAIKO Construction AI v21.4 — Awarded / Not Awarded quotation folders
(function(){
  const $=id=>document.getElementById(id);
  let activeFolder='pending';

  function list(){ return cache.quotationProjects||[]; }
  function isComplete(q){ return !!q?.boq_file_name || ['Complete','Awarded','Not Awarded'].includes(q?.status); }
  function resultState(q){
    if(q?.status==='Awarded')return 'awarded';
    if(q?.status==='Not Awarded')return 'not_awarded';
    return 'pending';
  }
  function selectedQuotation(){
    const active=document.querySelector('.quotation-project-card.active');
    const id=active?.dataset?.quotationId;
    if(id)return list().find(q=>String(q.id)===String(id))||null;
    return list()[0]||null;
  }
  function countFolders(){
    const rows=list();
    const awarded=rows.filter(q=>q.status==='Awarded').length;
    const notAwarded=rows.filter(q=>q.status==='Not Awarded').length;
    const pending=rows.length-awarded-notAwarded;
    if($('quotationPendingCount'))$('quotationPendingCount').textContent=String(pending);
    if($('quotationAwardedCount'))$('quotationAwardedCount').textContent=String(awarded);
    if($('quotationNotAwardedCount'))$('quotationNotAwardedCount').textContent=String(notAwarded);
  }

  function applyFolderFilter(){
    countFolders();
    document.querySelectorAll('.quotation-project-card[data-quotation-id]').forEach(card=>{
      const q=list().find(x=>String(x.id)===String(card.dataset.quotationId));
      if(!q){card.hidden=true;return}
      card.hidden=resultState(q)!==activeFolder;
    });
    document.querySelectorAll('.quotation-folder-tab').forEach(btn=>{
      btn.classList.toggle('active',btn.dataset.folder===activeFolder);
    });

    const visible=[...document.querySelectorAll('.quotation-project-card[data-quotation-id]:not([hidden])')];
    if(visible.length && !visible.some(x=>x.classList.contains('active'))){
      visible[0].click();
    }
  }

  function updateSelectedActions(){
    const q=selectedQuotation();
    const wrap=$('quotationResultActions');
    if(!wrap)return;
    if(!q){wrap.classList.add('hidden');return}

    // Result classification is available once the final file has been uploaded.
    const canClassify=isComplete(q);
    wrap.classList.toggle('hidden',!canClassify);
    if(!canClassify)return;

    const awarded=$('markQuotationAwardedBtn');
    const notAwarded=$('markQuotationNotAwardedBtn');
    const remove=$('removeQuotationResultBtn');

    awarded?.classList.toggle('hidden',q.status==='Awarded');
    notAwarded?.classList.toggle('hidden',q.status==='Not Awarded');
    remove?.classList.toggle('hidden',!['Awarded','Not Awarded'].includes(q.status));

    if(awarded){
      awarded.textContent=q.status==='Not Awarded' ? '✓ Accept → Move to Awarded' : '✓ Mark Awarded';
    }
    if(notAwarded){
      notAwarded.textContent=q.status==='Awarded' ? '✕ Decline → Move to Not Awarded' : '✕ Mark Not Awarded';
    }
  }

  async function setResult(status){
    const q=selectedQuotation(); if(!q)return;
    if(!isComplete(q)){
      alert('Upload the final quotation file first before marking the project result.');
      return;
    }

    const action=status==='Awarded'
      ? (q.status==='Not Awarded'?'accept':'awarded')
      : (q.status==='Awarded'?'declined':'not_awarded');

    const message=status==='Awarded'
      ? (q.status==='Not Awarded'
          ? `Accept "${q.project_name}" and move it to the Awarded folder?`
          : `Mark "${q.project_name}" as Awarded?`)
      : (q.status==='Awarded'
          ? `Decline "${q.project_name}" and move it to the Not Awarded folder?`
          : `Mark "${q.project_name}" as Not Awarded?`);

    if(!confirm(message))return;

    const btn=status==='Awarded' ? $('markQuotationAwardedBtn') : $('markQuotationNotAwardedBtn');
    if(btn){btn.disabled=true}

    try{
      const {error}=await sb.from('quotation_projects')
        .update({status,updated_at:new Date().toISOString()})
        .eq('id',q.id);
      if(error)throw error;

      try{
        await sb.from('activity_log').insert({
          project_id:null,
          module:'quotation',
          record_id:String(q.id),
          action,
          details:{
            project_name:q.project_name,
            previous_status:q.status,
            new_status:status
          },
          created_by:currentUser.id
        });
      }catch(_){}

      activeFolder=status==='Awarded'?'awarded':'not_awarded';
      await refreshAll();
      if(typeof renderPending==='function')renderPending();
      applyFolderFilter();
      updateSelectedActions();
      if(typeof toast==='function')toast(status==='Awarded'?'Moved to Awarded folder.':'Moved to Not Awarded folder.');
    }catch(err){
      alert('Update failed: '+(err?.message||err));
    }finally{
      if(btn)btn.disabled=false;
    }
  }

  async function removeFromFolder(){
    const q=selectedQuotation(); if(!q)return;
    if(!['Awarded','Not Awarded'].includes(q.status))return;
    if(!confirm(`Remove "${q.project_name}" from this result folder and return it to Completed / unclassified?`))return;

    try{
      const previous=q.status;
      const {error}=await sb.from('quotation_projects')
        .update({status:'Complete',updated_at:new Date().toISOString()})
        .eq('id',q.id);
      if(error)throw error;

      try{
        await sb.from('activity_log').insert({
          project_id:null,module:'quotation',record_id:String(q.id),
          action:'result_folder_removed',
          details:{project_name:q.project_name,previous_status:previous,new_status:'Complete'},
          created_by:currentUser.id
        });
      }catch(_){}

      activeFolder='pending';
      await refreshAll();
      if(typeof renderPending==='function')renderPending();
      applyFolderFilter();
      updateSelectedActions();
      if(typeof toast==='function')toast('Returned to Completed / unclassified.');
    }catch(err){
      alert('Update failed: '+(err?.message||err));
    }
  }

  document.querySelectorAll('.quotation-folder-tab').forEach(btn=>{
    btn.addEventListener('click',()=>{
      activeFolder=btn.dataset.folder||'pending';
      applyFolderFilter();
      updateSelectedActions();
    });
  });

  $('markQuotationAwardedBtn')?.addEventListener('click',()=>setResult('Awarded'));
  $('markQuotationNotAwardedBtn')?.addEventListener('click',()=>setResult('Not Awarded'));
  $('removeQuotationResultBtn')?.addEventListener('click',removeFromFolder);

  // Single delegated click listener to refresh actions after selecting a card.
  document.addEventListener('click',e=>{
    if(e.target.closest?.('.quotation-project-card[data-quotation-id]')){
      setTimeout(updateSelectedActions,0);
    }
  },{passive:true});

  // Wrap only the quotation renderer once so newly-rendered cards are filtered.
  const oldRender=window.renderPending;
  if(typeof oldRender==='function'){
    window.renderPending=function(){
      const out=oldRender.apply(this,arguments);
      applyFolderFilter();
      updateSelectedActions();
      return out;
    };
  }

  // Initial setup.
  setTimeout(()=>{
    countFolders();
    applyFolderFilter();
    updateSelectedActions();
  },800);

  window.refreshQuotationAwardFolders=function(){
    countFolders();
    applyFolderFilter();
    updateSelectedActions();
  };
})();
