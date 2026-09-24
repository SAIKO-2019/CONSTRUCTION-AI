// SAIKO Construction AI v22.9 — Project Edit action
(function(){
  let editingProjectId=null;

  function setProjectDialogMode(mode){
    const editing=mode==='edit';
    const title=$('projectDialogTitle');
    const save=$('projectSaveBtn');
    if(title)title.textContent=editing?'Edit Project':'Add Project';
    if(save)save.textContent=editing?'Save Changes':'Save Project';
  }

  function fillProjectForm(p){
    $('pName').value=p?.project_name||'';
    $('pClient').value=p?.client_name||'';
    $('pLocation').value=p?.location||'';
    $('pOriginalContract').value=Number(p?.original_contract_amount ?? p?.contract_amount ?? 0);
    $('pDiscount').value=Number(p?.discount_amount||0);
    if(typeof updateProjectNet==='function') updateProjectNet();
    else $('pContract').value=Number(p?.contract_amount||0).toFixed(2);
    $('pStart').value=p?.start_date||'';
    $('pTarget').value=p?.target_date||'';
    $('pStatus').value=p?.status||'Planning';
  }

  // Preserve Add Project behavior while resetting edit state.
  $('addProjectBtn').onclick=()=>{
    editingProjectId=null;
    $('projectForm').reset();
    $('pOriginalContract').value=0;
    $('pDiscount').value=0;
    if(typeof updateProjectNet==='function')updateProjectNet();
    setProjectDialogMode('add');
    $('projectDialog').showModal();
  };

  window.editProject=projectId=>{
    const p=(cache.projects||[]).find(x=>String(x.id)===String(projectId));
    if(!p)return alert('Project record not found.');
    editingProjectId=String(projectId);
    fillProjectForm(p);
    setProjectDialogMode('edit');
    $('projectDialog').showModal();
  };

  // Render Edit + Delete together in Action column.
  renderProjects=function(){
    const rows=cache.projects||[];
    $('projectRows').innerHTML=rows.length?rows.map(p=>`<tr>
      <td class="check-col"><input class="project-row-check" type="checkbox" value="${p.id}" ${selectedProjectIds.has(String(p.id))?'checked':''}></td>
      <td><strong>${esc(p.project_name)}</strong></td>
      <td>${esc(p.client_name||'—')}</td>
      <td>${esc(p.location||'—')}</td>
      <td>${money(p.contract_amount)}</td>
      <td>${esc(p.status)}</td>
      <td>${pct(typeof projectDerivedProgress==='function'?projectDerivedProgress(p.id):actualForProject(p.id))}</td>
      <td><div class="row-actions">
        <button class="icon-action" type="button" onclick="editProject('${p.id}')">Edit</button>
        <button class="danger-link" type="button" onclick="deleteProject('${p.id}')">Delete</button>
      </div></td>
    </tr>`).join(''):'<tr><td colspan="8" class="empty">No projects yet.</td></tr>';
    wireBulkChecks('project-row-check',selectedProjectIds,()=>bulkUI('project',selectedProjectIds,rows));
    bulkUI('project',selectedProjectIds,rows);
  };

  // Single submit handler for Add and Edit.
  $('projectForm').onsubmit=async e=>{
    e.preventDefault();
    if(typeof updateProjectNet==='function')updateProjectNet();

    const values={
      project_name:$('pName').value.trim(),
      client_name:$('pClient').value.trim(),
      location:$('pLocation').value.trim(),
      original_contract_amount:Number($('pOriginalContract').value||0),
      discount_amount:Number($('pDiscount').value||0),
      contract_amount:Number($('pContract').value||0),
      start_date:$('pStart').value||null,
      target_date:$('pTarget').value||null,
      status:$('pStatus').value,
      derived_progress:true
    };

    try{
      if(editingProjectId){
        await q('projects','update',{id:editingProjectId,values});
        $('projectDialog').close();
        const edited=editingProjectId;
        editingProjectId=null;
        await refreshAll();
        renderProjects();
        if(typeof renderBudget==='function')renderBudget();
        if(typeof syncV14Selectors==='function')syncV14Selectors();
        toast('Project information updated.');
      }else{
        await q('projects','insert',{...values,created_by:currentUser.id});
        $('projectDialog').close();
        await refreshAll();
        renderProjects();
        if(typeof renderBudget==='function')renderBudget();
        toast('Project saved. Accomplishment will follow Actual Progress.');
      }
    }catch(err){
      alert(err.message||'Could not save project.');
    }
  };
})();
