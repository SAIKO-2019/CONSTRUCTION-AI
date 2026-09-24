// SAIKO Construction AI v20.7 — accurate Summary reader UI + per-project edit
(function(){
  const $=id=>document.getElementById(id);
  let editingId=null;

  function list(){ return cache.quotationProjects||[]; }
  function byId(id){ return list().find(q=>String(q.id)===String(id)); }

  function addEditIcons(){
    document.querySelectorAll('.quotation-project-card[data-quotation-id]').forEach(card=>{
      if(card.querySelector('.quotation-card-edit-btn'))return;
      const id=card.dataset.quotationId;
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='quotation-card-edit-btn';
      btn.title='Edit quotation project';
      btn.setAttribute('aria-label','Edit quotation project');
      btn.textContent='✎';
      btn.onclick=e=>{
        e.preventDefault(); e.stopPropagation();
        openEdit(id);
      };
      card.appendChild(btn);
    });
  }

  function openEdit(id){
    const q=byId(id); if(!q)return;
    editingId=q.id;
    $('eqProjectName').value=q.project_name||'';
    $('eqClient').value=q.client_name||'';
    $('eqDeadline').value=q.target_submission||'';
    $('eqGsheetLink').value=q.gsheet_link||'';
    $('editQuotationError').textContent='';
    $('editQuotationDialog')?.showModal();
  }

  $('editQuotationForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!editingId)return;
    const project_name=$('eqProjectName').value.trim();
    const client_name=$('eqClient').value.trim();
    const target_submission=$('eqDeadline').value||null;
    const gsheet_link=$('eqGsheetLink').value.trim();
    const err=$('editQuotationError');
    if(!project_name||!target_submission||!gsheet_link){
      err.textContent='Project name, deadline and Google Sheets link are required.';
      return;
    }
    try{
      const q=byId(editingId);
      const {error}=await sb.from('quotation_projects').update({
        project_name,client_name,target_submission,gsheet_link,updated_at:new Date().toISOString()
      }).eq('id',editingId);
      if(error)throw error;
      try{
        await sb.from('activity_log').insert({
          project_id:null,module:'quotation',record_id:String(editingId),action:'updated',
          details:{project_name,client_name,target_submission,gsheet_link_changed:gsheet_link!==(q?.gsheet_link||'')},
          created_by:currentUser.id
        });
      }catch(_e){}
      $('editQuotationDialog')?.close();
      editingId=null;
      await refreshAll();
      if(typeof renderPending==='function')renderPending();
      if(typeof window.renderQuotationSummary==='function')window.renderQuotationSummary();
      if(typeof toast==='function')toast('Quotation project updated.');
    }catch(ex){
      err.textContent=ex?.message||String(ex);
    }
  });

  // Keep icons in sync with the existing quotation renderer without observers.
  const oldRender=window.renderPending;
  if(typeof oldRender==='function'){
    window.renderPending=function(){
      const out=oldRender.apply(this,arguments);
      addEditIcons();
      return out;
    };
  }

  document.addEventListener('click',e=>{
    const close=e.target.closest?.('[data-close="editQuotationDialog"]');
    if(close)$('editQuotationDialog')?.close();
  });

  setTimeout(addEditIcons,700);
})();
