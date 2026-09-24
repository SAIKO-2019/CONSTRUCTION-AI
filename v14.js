// SAIKO Construction AI v14 - Integrated Control

cache.inventoryColumns = cache.inventoryColumns || [];
cache.pendingWorks = cache.pendingWorks || [];
cache.pendingEvidence = cache.pendingEvidence || [];

const refreshV14Base = refreshAll;
refreshAll = async function(){
  await refreshV14Base();
  try{cache.inventoryColumns=await q('inventory_columns')}catch(_){cache.inventoryColumns=[]}
  try{cache.pendingWorks=await q('pending_works')}catch(_){cache.pendingWorks=[]}
  try{cache.pendingEvidence=await q('pending_work_evidence')}catch(_){cache.pendingEvidence=[]}
  syncV14Selectors();
};

function syncV14Selectors(){
  ['pendingProject','pwProject'].forEach(id=>{
    const s=$(id); if(!s)return;
    const old=s.value;
    s.innerHTML='<option value="">Select project</option>'+cache.projects.map(p=>`<option value="${p.id}">${esc(p.project_name)}</option>`).join('');
    if(cache.projects.some(p=>String(p.id)===String(old)))s.value=old;
  });
  const ws=$('workspaceProject')?.value;
  if(ws){
    ['pendingProject','pwProject'].forEach(id=>{if($(id)&&[...$(id).options].some(o=>o.value===ws))$(id).value=ws});
  }
}

// PROJECTS: derive accomplishment from actual progress only.
function projectDerivedProgress(projectId){
  return actualForProject(projectId);
}
renderProjects = function(){
  const rows=cache.projects;
  $('projectRows').innerHTML=rows.length?rows.map(p=>`<tr>
    <td class="check-col"><input class="project-row-check" type="checkbox" value="${p.id}" ${selectedProjectIds.has(String(p.id))?'checked':''}></td>
    <td><strong>${esc(p.project_name)}</strong></td><td>${esc(p.client_name||'—')}</td><td>${esc(p.location||'—')}</td>
    <td>${money(p.contract_amount)}</td><td>${esc(p.status)}</td><td>${pct(projectDerivedProgress(p.id))}</td>
    <td><button class="danger-link" onclick="deleteProject('${p.id}')">Delete</button></td></tr>`).join('')
    :'<tr><td colspan="8" class="empty">No projects yet.</td></tr>';
  wireBulkChecks('project-row-check',selectedProjectIds,()=>bulkUI('project',selectedProjectIds,rows));bulkUI('project',selectedProjectIds,rows);
};

$('projectForm').onsubmit=async e=>{
  e.preventDefault();updateProjectNet();
  const row={
    project_name:$('pName').value.trim(),client_name:$('pClient').value.trim(),location:$('pLocation').value.trim(),
    original_contract_amount:Number($('pOriginalContract').value||0),discount_amount:Number($('pDiscount').value||0),
    contract_amount:Number($('pContract').value||0),start_date:$('pStart').value||null,target_date:$('pTarget').value||null,
    status:$('pStatus').value,derived_progress:true,created_by:currentUser.id
  };
  try{await q('projects','insert',row);$('projectDialog').close();await refreshAll();renderProjects();renderBudget();toast('Project saved. Accomplishment will follow Actual Progress.')}catch(e){alert(e.message)}
};

// BILLING: only Client Billing and Subcontractor Billing, optional retention/recoupment for both.
function updateBillingRule(){
  const t=$('bType')?.value||'Client Billing',ret=$('bUseRetention'),rec=$('bUseRecoupment'),note=$('billingRuleNote');
  if(!ret||!rec)return;
  ret.disabled=false;rec.disabled=false;
  $('bRetention').disabled=!ret.checked;$('bRecoup').disabled=!rec.checked;
  if(t==='Subcontractor Billing'){
    note.textContent='Subcontractor Billing: enter Issued / Contract Amount, then each gross billing. Retention and recoupment are optional. Remaining subcontract balance is tracked automatically.';
  }else{
    note.textContent='Client Billing: retention and recoupment are optional. Tick only when applicable.';
  }
  calcBillingV14();
}
function calcBillingV14(){
  const gross=Number($('bGross')?.value||0),retPct=$('bUseRetention')?.checked?Number($('bRetention')?.value||0):0,recPct=$('bUseRecoupment')?.checked?Number($('bRecoup')?.value||0):0;
  const ret=gross*retPct/100,rec=gross*recPct/100,net=Math.max(0,gross-ret-rec),received=Number($('bReceived')?.value||0),out=Math.max(0,net-received);
  const issued=Number($('bIssuedAmount')?.value||0),pid=$('bProject')?.value;
  const previous=cache.billings.filter(b=>String(b.project_id)===String(pid)&&b.billing_type==='Subcontractor Billing').reduce((s,b)=>s+Number(b.gross_amount||0),0);
  const subcontractBalance=Math.max(0,issued-(previous+gross));
  $('billingCalc').innerHTML=[['Retention',money(ret)],['Recoupment',money(rec)],['Net Due',money(net)],['Outstanding',money(out)],...($('bType')?.value==='Subcontractor Billing'?[['Subcontract Balance',money(subcontractBalance)]]:[])].map(x=>`<div>${x[0]}<strong>${x[1]}</strong></div>`).join('');
  return{gross,retPct,recPct,ret,rec,net,received,out,issued,subcontractBalance}
}
['bGross','bRetention','bRecoup','bReceived','bIssuedAmount'].forEach(id=>{if($(id))$(id).oninput=calcBillingV14});
$('bUseRetention').onchange=updateBillingRule;$('bUseRecoupment').onchange=updateBillingRule;$('bType').onchange=updateBillingRule;

function updateRecordTypeUI(){
  const type=$('bRecordType')?.value||'Billing';
  const label=$('bRecordNoLabel');
  if(!label)return;
  if(type==='VO'){
    label.childNodes[0].nodeValue='Variation Order No. ';
    $('bNo').placeholder='VO-01';
  }else{
    label.childNodes[0].nodeValue='Billing No. ';
    $('bNo').placeholder='Billing No. 3';
  }
}
if($('bRecordType')) $('bRecordType').onchange=updateRecordTypeUI;


$('addBillingBtn').onclick=()=>{
  $('billingForm').reset();syncProjectSelects();syncProjectSelectsV13();
  const ws=$('workspaceProject')?.value;if(ws)$('bProject').value=ws;
  $('bType').value='Client Billing';$('bRecordType').value='Billing';updateRecordTypeUI();$('bRetention').value=5;$('bRecoup').value=30;$('bInputBy').value=profileName();
  $('bUseRetention').checked=false;$('bUseRecoupment').checked=false;updateBillingRule();calcBillingV14();$('billingDialog').showModal();
};
$('billingForm').onsubmit=async e=>{
  e.preventDefault();const c=calcBillingV14(),type=$('bType').value;
  const row={
    project_id:$('bProject').value,
    billing_no:$('bRecordType').value==='Billing' ? $('bNo').value.trim() : null,
    variation_no:$('bRecordType').value==='VO' ? $('bNo').value.trim() : null,
    billing_type:type,
    transaction_side:type==='Client Billing'?'receivable':'payable',accomplishment_percent:Number($('bAccomplishment').value||0),
    issued_amount:c.issued,subcontract_balance:c.subcontractBalance,gross_amount:c.gross,
    retention_applicable:$('bUseRetention').checked,retention_percent:c.retPct,retention_amount:c.ret,
    recoupment_applicable:$('bUseRecoupment').checked,recoupment_percent:c.recPct,recoupment_amount:c.rec,
    net_due:c.net,received_amount:c.received,outstanding_amount:c.out,date_request:$('bRequestDate').value||null,
    date_submitted:$('bRequestDate').value||null,date_paid:$('bPaidDate').value||null,input_by_name:profileName(),
    status:c.out<=.01?'Paid':c.received>0?'Partially Paid':'Pending',created_by:currentUser.id
  };
  try{
    const rows=await q('billings','insert',row);
    if(c.received>0)await q('payments','insert',{billing_id:rows[0].id,amount:c.received,payment_date:$('bPaidDate').value||new Date().toISOString().slice(0,10),created_by:currentUser.id});
    $('billingDialog').close();await refreshAll();renderBilling();renderBudget();renderDashboard();toast('Billing saved.');
  }catch(e){alert(e.message)}
};

renderBilling = function(){
  const pid=$('billingProjectFilter')?.value||$('workspaceProject')?.value||'',rows=pid?cache.billings.filter(b=>String(b.project_id)===String(pid)):cache.billings;
  const client=rows.filter(b=>b.billing_type!=='Subcontractor Billing'),subcon=rows.filter(b=>b.billing_type==='Subcontractor Billing');
  const clientGross=client.reduce((s,b)=>s+Number(b.gross_amount||0),0),collections=client.reduce((s,b)=>s+Number(b.received_amount||0),0);
  const subconGross=subcon.reduce((s,b)=>s+Number(b.gross_amount||0),0),subconPaid=subcon.reduce((s,b)=>s+Number(b.received_amount||0),0);
  $('billingKPIs').innerHTML=[['Client Gross Billed',money(clientGross)],['Client Collections',money(collections)],['Subcon Gross Billed',money(subconGross)],['Subcon Paid',money(subconPaid)]].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
  $('billingRows').innerHTML=rows.length?rows.map(b=>`<tr>
    <td class="check-col"><input class="billing-row-check" type="checkbox" value="${b.id}" ${selectedBillingIds.has(String(b.id))?'checked':''}></td>
    <td>${esc(proj(b.project_id)?.project_name||'—')}</td><td>${esc(b.billing_type||'Client Billing')}</td>
    <td><strong>${b.variation_no?`VO: ${esc(b.variation_no)}`:`Billing: ${esc(b.billing_no||'—')}`}</strong>${b.billing_type==='Subcontractor Billing'?`<br><small>Issued: ${money(b.issued_amount||0)} | Balance: ${money(b.subcontract_balance||0)}</small>`:''}</td>
    <td>${pct(b.accomplishment_percent||0)}</td><td>${money(b.gross_amount)}</td><td>${money(b.retention_amount)}</td><td>${money(b.recoupment_amount)}</td>
    <td>${money(b.net_due)}</td><td>${money(b.received_amount)}</td><td>${money(b.outstanding_amount)}</td><td>${b.date_request||b.date_submitted||'—'}</td><td>${b.date_paid||'—'}</td><td>${esc(b.input_by_name||'—')}</td><td>${esc(b.status)}</td>
    <td><div class="row-actions"><button class="icon-action" onclick="addPayment('${b.id}')">${b.billing_type==='Subcontractor Billing'?'Add Payment':'Receive Payment'}</button><button class="icon-action" onclick="generateBilling('${b.id}')">Download</button><button class="danger-link" onclick="deleteBilling('${b.id}')">Delete</button></div></td>
  </tr>`).join(''):'<tr><td colspan="16" class="empty">No billing records for this project.</td></tr>';
  wireBulkChecks('billing-row-check',selectedBillingIds,()=>bulkUI('billing',selectedBillingIds,rows));bulkUI('billing',selectedBillingIds,rows);
};

// INVENTORY spreadsheet-style
function inventoryColumnsForProject(pid){return cache.inventoryColumns.filter(c=>String(c.project_id)===String(pid)).sort((a,b)=>Number(a.display_order||0)-Number(b.display_order||0))}
function inventoryRowsForProject(pid){return cache.inventory.filter(i=>String(i.project_id)===String(pid))}
const baseCols=[
  ['date_request','Date Request'],['date_purchase','Date Purchase'],['category','Category'],['description','Description'],
  ['quantity','Qty'],['unit','Unit'],['unit_cost','Unit Cost'],['total_amount','Total'],['paid_amount','Paid'],['balance_amount','Balance'],
  ['supplier','Supplier / Payee'],['reference_no','Reference No.'],['input_by_name','Input By']
];

function renderInventory(){
  if(!$('inventoryRows'))return;
  const pid=$('inventoryProject')?.value||$('workspaceProject')?.value||'',cat=$('inventoryCategoryFilter')?.value||'';
  let rows=inventoryRowsForProject(pid);if(cat)rows=rows.filter(i=>i.category===cat);
  const custom=inventoryColumnsForProject(pid),head=$('inventoryHead');
  head.innerHTML='<tr>'+baseCols.map(c=>`<th>${c[1]}</th>`).join('')+custom.map(c=>`<th class="custom-col-head">${esc(c.column_name)}</th>`).join('')+'<th>Action</th></tr>';
  const total=rows.reduce((s,i)=>s+Number(i.total_amount||0),0),paid=rows.reduce((s,i)=>s+Number(i.paid_amount||0),0),bal=rows.reduce((s,i)=>s+Number(i.balance_amount||0),0);
  $('inventoryKPIs').innerHTML=[['Committed',money(total)],['Paid',money(paid)],['Balance',money(bal)],['Rows',String(rows.length)]].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
  $('inventoryRows').innerHTML=rows.length?rows.map(i=>`<tr data-id="${i.id}">
    ${baseCols.map(([k])=>`<td contenteditable="${['input_by_name','total_amount','balance_amount'].includes(k)?'false':'true'}" data-field="${k}">${esc(String(i[k]??''))}</td>`).join('')}
    ${custom.map(c=>`<td contenteditable="true" data-custom="${c.column_key}">${esc(String((i.custom_data||{})[c.column_key]??''))}</td>`).join('')}
    <td><button class="danger-link" onclick="deleteInventory('${i.id}')">Delete</button></td>
  </tr>`).join(''):'<tr><td colspan="'+(baseCols.length+custom.length+1)+'" class="empty">No rows yet. Click Add Row.</td></tr>';
  document.querySelectorAll('#inventoryRows td[contenteditable="true"]').forEach(td=>td.onblur=()=>saveInventoryCell(td));
}
async function saveInventoryCell(td){
  const tr=td.closest('tr'),id=tr.dataset.id,row=cache.inventory.find(x=>String(x.id)===String(id));if(!row)return;
  const field=td.dataset.field,custom=td.dataset.custom,value=td.textContent.trim(),values={};
  if(field){
    if(['quantity','unit_cost','paid_amount'].includes(field)) values[field]=Number(value||0); else values[field]=value||null;
  }else if(custom){
    values.custom_data={...(row.custom_data||{}),[custom]:value};
  }
  const qty=Number(field==='quantity'?value:row.quantity||0),unitCost=Number(field==='unit_cost'?value:row.unit_cost||0),paid=Number(field==='paid_amount'?value:row.paid_amount||0);
  if(['quantity','unit_cost','paid_amount'].includes(field)){values.total_amount=qty*unitCost;values.balance_amount=Math.max(0,qty*unitCost-paid)}
  const {error}=await sb.from('inventory_entries').update(values).eq('id',id);if(error)return alert(error.message);
  await refreshAll();renderInventory();renderBudget();renderDashboard();
}
async function addInventoryRow(){
  const pid=$('inventoryProject')?.value||$('workspaceProject')?.value;if(!pid)return alert('Select a project.');
  const {error}=await sb.from('inventory_entries').insert({project_id:pid,category:'Materials',description:'New Row',quantity:0,unit_cost:0,total_amount:0,paid_amount:0,balance_amount:0,input_by_name:profileName(),created_by:currentUser.id});
  if(error)return alert(error.message);await refreshAll();renderInventory();
}
if($('addInventoryRowBtn'))$('addInventoryRowBtn').onclick=addInventoryRow;
if($('addInventoryColumnBtn'))$('addInventoryColumnBtn').onclick=async()=>{
  const pid=$('inventoryProject')?.value||$('workspaceProject')?.value;if(!pid)return alert('Select a project.');
  const name=prompt('New column name:');if(!name)return;const key=name.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  const order=inventoryColumnsForProject(pid).length;
  const {error}=await sb.from('inventory_columns').insert({project_id:pid,column_name:name,column_key:key,display_order:order,created_by:currentUser.id});
  if(error)return alert(error.message);await refreshAll();renderInventory();
};

// PENDING WORKS + evidence gating
function evidenceForPending(id){return cache.pendingEvidence.filter(e=>String(e.pending_work_id)===String(id))}
function canCompletePending(p){return evidenceForPending(p.id).length>0 && String(p.required_evidence||'').trim().length>0}
function pendingClass(p){if(p.status==='Completed')return'pending-complete';if(canCompletePending(p))return'pending-ready';if(p.target_date&&new Date(p.target_date)<new Date())return'pending-overdue';return''}
function renderPending(){
  if(!$('pendingRows'))return;
  const pid=$('pendingProject')?.value||$('workspaceProject')?.value||'',status=$('pendingStatusFilter')?.value||'';
  let rows=cache.pendingWorks.filter(p=>!pid||String(p.project_id)===String(pid));if(status)rows=rows.filter(p=>p.status===status);
  const overdue=rows.filter(p=>p.status!=='Completed'&&p.target_date&&new Date(p.target_date)<new Date()).length;
  const ready=rows.filter(p=>p.status!=='Completed'&&canCompletePending(p)).length;
  $('pendingKPIs').innerHTML=[['Pending',String(rows.filter(p=>p.status==='Pending').length)],['For Verification',String(rows.filter(p=>p.status==='For Verification').length)],['Overdue',String(overdue)],['Completed',String(rows.filter(p=>p.status==='Completed').length)]].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
  $('pendingAlert').textContent=overdue?`${overdue} pending work item(s) are overdue today. These remain open until required evidence is uploaded and verified.`:'No overdue pending works for the selected project.';
  $('pendingRows').innerHTML=rows.length?rows.map(p=>{const ev=evidenceForPending(p.id);const can=canCompletePending(p);return `<tr class="${pendingClass(p)}">
    <td>${esc(proj(p.project_id)?.project_name||'—')}</td><td>${esc(p.work_item)}</td><td>${esc(p.assigned_to||'—')}</td><td>${p.target_date||'—'}</td><td>${esc(p.required_evidence||'Not specified')}</td>
    <td>${ev.length}${ev.length?`<br><small>${esc(ev.map(x=>x.file_name).join(', '))}</small>`:''}</td>
    <td><span class="status-pill ${p.status==='Completed'?'complete':p.status==='For Verification'?'verify':'pending'}">${esc(p.status)}</span></td><td>${new Date(p.updated_at||p.created_at).toLocaleString()}</td>
    <td><div class="row-actions"><button class="icon-action" onclick="openPendingEvidence('${p.id}')">Upload Evidence</button><button class="icon-action" ${can&&p.status!=='Completed'?'':'disabled'} onclick="markPendingForVerification('${p.id}')">For Verification</button><button class="icon-action" ${p.status==='For Verification'&&can?'':'disabled'} onclick="completePending('${p.id}')">Complete</button><button class="danger-link" onclick="deletePending('${p.id}')">Delete</button></div></td>
  </tr>`}).join(''):'<tr><td colspan="9" class="empty">No pending works for this project.</td></tr>';
  renderDashboardPending();
}
if($('pendingProject'))$('pendingProject').onchange=renderPending;if($('pendingStatusFilter'))$('pendingStatusFilter').onchange=renderPending;
if($('addPendingBtn'))$('addPendingBtn').onclick=()=>{syncV14Selectors();const ws=$('workspaceProject')?.value;if(ws)$('pwProject').value=ws;$('pendingForm').reset();if(ws)$('pwProject').value=ws;$('pendingDialog').showModal()};
$('pendingForm').onsubmit=async e=>{
  e.preventDefault();const row={project_id:$('pwProject').value,work_item:$('pwWorkItem').value.trim(),assigned_to:$('pwAssignedTo').value.trim(),target_date:$('pwTargetDate').value||null,required_evidence:$('pwRequiredEvidence').value.trim(),notes:$('pwNotes').value.trim(),status:'Pending',created_by:currentUser.id,updated_at:new Date().toISOString()};
  const {error}=await sb.from('pending_works').insert(row);if(error)return alert(error.message);$('pendingDialog').close();await refreshAll();renderPending();renderDashboard();toast('Pending work added.');
};
window.openPendingEvidence=id=>{$('pePendingId').value=id;$('pendingEvidenceForm').reset();$('pePendingId').value=id;$('pendingEvidenceDialog').showModal()};
$('pendingEvidenceForm').onsubmit=async e=>{
  e.preventDefault();const id=$('pePendingId').value,p=cache.pendingWorks.find(x=>String(x.id)===String(id)),file=$('peFile').files[0];if(!p||!file)return;
  const safe=file.name.replace(/[^a-zA-Z0-9._-]+/g,'_'),path=`${p.project_id}/pending/${p.id}/${Date.now()}-${safe}`;
  const up=await sb.storage.from('project-files').upload(path,file,{upsert:false});if(up.error)return alert(up.error.message);
  const ins=await sb.from('pending_work_evidence').insert({pending_work_id:p.id,project_id:p.project_id,file_name:file.name,storage_path:path,note:$('peNote').value.trim(),uploaded_by:currentUser.id});if(ins.error)return alert(ins.error.message);
  await sb.from('pending_works').update({updated_at:new Date().toISOString()}).eq('id',p.id);$('pendingEvidenceDialog').close();await refreshAll();renderPending();renderDashboard();toast('Completion evidence uploaded.');
};
window.markPendingForVerification=async id=>{
  const p=cache.pendingWorks.find(x=>String(x.id)===String(id));if(!p)return;if(!canCompletePending(p))return alert('Required completion evidence has not been uploaded yet.');
  const{error}=await sb.from('pending_works').update({status:'For Verification',updated_at:new Date().toISOString()}).eq('id',id);if(error)return alert(error.message);await refreshAll();renderPending();renderDashboard();
};
window.completePending=async id=>{
  const p=cache.pendingWorks.find(x=>String(x.id)===String(id));if(!p)return;if(p.status!=='For Verification')return alert('Move this work to For Verification first.');if(!canCompletePending(p))return alert('Completion evidence is incomplete.');
  if(!confirm('Verify that the required evidence is complete and mark this work as Completed?'))return;
  const{error}=await sb.from('pending_works').update({status:'Completed',verified_by:currentUser.id,verified_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id);if(error)return alert(error.message);await refreshAll();renderPending();renderDashboard();
};
window.deletePending=async id=>{if(!confirm('Delete this pending work item?'))return;const{error}=await sb.from('pending_works').delete().eq('id',id);if(error)return alert(error.message);await refreshAll();renderPending();renderDashboard()};

function renderDashboardPending(){
  if(!$('dashboardPendingSnapshot'))return;const pid=$('workspaceProject')?.value||cache.projects[0]?.id;
  const rows=cache.pendingWorks.filter(p=>String(p.project_id)===String(pid)),open=rows.filter(p=>p.status!=='Completed'),over=open.filter(p=>p.target_date&&new Date(p.target_date)<new Date()).length;
  $('dashboardPendingSnapshot').innerHTML=[['Open',String(open.length)],['Overdue',String(over)],['For Verification',String(rows.filter(p=>p.status==='For Verification').length)],['Completed',String(rows.filter(p=>p.status==='Completed').length)]].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
}
function renderDashboardBudget(){
  if(!$('dashboardBudgetSnapshot'))return;const pid=$('workspaceProject')?.value||cache.projects[0]?.id;if(!pid)return;
  const d=budgetData(pid);$('dashboardBudgetSnapshot').innerHTML=[['Net Contract',money(d.contract)],['Running Cost',money(d.runningCost)],['Earned Value',money(d.earned)],['Running Profit',money(d.runningProfit)]].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
}

const oldRenderDashboardV14=renderDashboard;
renderDashboard=function(){oldRenderDashboardV14();renderDashboardPending();renderDashboardBudget();};

const oldShowV14=show;
show=function(id){oldShowV14(id);if(id==='pending')renderPending();if(id==='inventory')renderInventory();};

const oldWorkspaceSyncV14=syncWorkspaceProject;
syncWorkspaceProject=function(pid,rerender=true){oldWorkspaceSyncV14(pid,false);['pendingProject','pwProject'].forEach(id=>{if($(id)&&[...$(id).options].some(o=>o.value===pid))$(id).value=pid});if(rerender){renderBilling();renderSchedule();renderProgress();renderInventory();renderBudget();renderPending();renderFiles();renderDashboard()}};

// Update budget classification for overhead + subcontractor billings
const oldBudgetDataV14=budgetData;
budgetData=function(pid){
  const d=oldBudgetDataV14(pid);
  if(!('Overhead' in d.categories))d.categories={Overhead:0,...d.categories};
  d.categories.Overhead=inventoryForProject(pid).filter(i=>i.category==='Overhead').reduce((s,i)=>s+Number(i.total_amount||0),0);
  // prevent double counting overhead into Other from older v13 categorization
  d.categories.Other=inventoryForProject(pid).filter(i=>!['Overhead','Materials','Labor','Equipment','Subcontractor'].includes(i.category)).reduce((s,i)=>s+Number(i.total_amount||0),0);
  return d;
};

// Template-based download routing helper
window.downloadUsingTemplate=async function(templateType,payload){
  const templates=cache.templates.filter(t=>String(t.template_type||'').toLowerCase().includes(String(templateType||'').toLowerCase()));
  if(!templates.length)return alert(`No ${templateType} template uploaded yet. Upload the template first so downloads follow your exact format.`);
  const t=templates[0];
  const {data,error}=await sb.storage.from('templates').createSignedUrl(t.storage_path,300);if(error)return alert(error.message);
  window.open(data.signedUrl,'_blank');
};

// daily in-app reminder
function dailyPendingReminder(){
  const pid=$('workspaceProject')?.value||cache.projects[0]?.id;if(!pid)return;
  const today=new Date().toISOString().slice(0,10),key=`saiko_pending_notice_${today}_${pid}`;if(localStorage.getItem(key))return;
  const due=cache.pendingWorks.filter(p=>String(p.project_id)===String(pid)&&p.status!=='Completed'&&p.target_date&&p.target_date<=today);
  if(due.length){toast(`${due.length} pending work item(s) need attention today. Open Pending Works.`);localStorage.setItem(key,'1')}
}
setTimeout(async()=>{if(!currentUser)return;try{await refreshAll();renderInventory();renderPending();renderDashboard();dailyPendingReminder()}catch(e){console.warn('v14 init',e)}},600);
