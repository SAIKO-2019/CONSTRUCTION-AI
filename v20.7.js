// SAIKO Construction AI v20.9 — quotation edit button in card header
(function(){
  const $=id=>document.getElementById(id);
  let editingId=null;
  function list(){return cache.quotationProjects||[]}
  function byId(id){return list().find(q=>String(q.id)===String(id))}

  function addEditButtons(){
    document.querySelectorAll('.quotation-project-card[data-quotation-id]').forEach(card=>{
      const head=card.querySelector('.quotation-card-head');
      if(!head||head.querySelector('.quotation-card-edit-btn'))return;
      const status=head.querySelector('.status-pill');
      const wrap=document.createElement('div');
      wrap.className='quotation-card-head-actions';
      if(status)wrap.appendChild(status);
      const btn=document.createElement('button');
      btn.type='button';btn.className='quotation-card-edit-btn';btn.title='Edit quotation project';btn.innerHTML='✎ <span>Edit</span>';
      btn.onclick=e=>{e.preventDefault();e.stopPropagation();openEdit(card.dataset.quotationId)};
      wrap.appendChild(btn);head.appendChild(wrap);
    });
  }
  function openEdit(id){
    const q=byId(id);if(!q)return;
    editingId=q.id;
    $('eqProjectName').value=q.project_name||'';
    $('eqClient').value=q.client_name||'';
    $('eqDeadline').value=q.target_submission||'';
    $('eqGsheetLink').value=q.gsheet_link||'';
    $('editQuotationError').textContent='';
    $('editQuotationDialog')?.showModal();
  }
  $('editQuotationForm')?.addEventListener('submit',async e=>{
    e.preventDefault();if(!editingId)return;
    const project_name=$('eqProjectName').value.trim(),client_name=$('eqClient').value.trim(),target_submission=$('eqDeadline').value||null,gsheet_link=$('eqGsheetLink').value.trim(),err=$('editQuotationError');
    if(!project_name||!target_submission||!gsheet_link){err.textContent='Project name, deadline and Google Sheets link are required.';return}
    try{
      const {error}=await sb.from('quotation_projects').update({project_name,client_name,target_submission,gsheet_link,updated_at:new Date().toISOString()}).eq('id',editingId);
      if(error)throw error;
      $('editQuotationDialog')?.close();editingId=null;
      await refreshAll(); if(typeof renderPending==='function')renderPending(); if(typeof toast==='function')toast('Quotation project updated.');
    }catch(ex){err.textContent=ex?.message||String(ex)}
  });
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-close="editQuotationDialog"]'))$('editQuotationDialog')?.close()});
  const oldRender=window.renderPending;
  if(typeof oldRender==='function')window.renderPending=function(){const out=oldRender.apply(this,arguments);addEditButtons();return out};
  setTimeout(addEditButtons,700);
})();
