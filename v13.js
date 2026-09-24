// SAIKO Construction AI v13 - Project Cost Control

cache.inventory = cache.inventory || [];
cache.progressHistory = cache.progressHistory || [];

const baseRefreshAllV13 = refreshAll;
refreshAll = async function(){
  await baseRefreshAllV13();
  try{ cache.inventory = await q('inventory_entries'); }catch(_){ cache.inventory=[]; }
  try{ cache.progressHistory = await q('progress_history'); }catch(_){ cache.progressHistory=[]; }
  syncProjectSelectsV13();
};

function syncProjectSelectsV13(){
  ['workspaceProject','billingProjectFilter','inventoryProject','budgetProject','iProject'].forEach(id=>{
    const s=$(id); if(!s) return;
    const old=s.value;
    s.innerHTML='<option value="">Select project</option>'+cache.projects.map(p=>`<option value="${p.id}">${esc(p.project_name)}</option>`).join('');
    if(cache.projects.some(p=>String(p.id)===String(old))) s.value=old;
  });
  const ws=$('workspaceProject');
  if(ws && !ws.value && cache.projects[0]) ws.value=cache.projects[0].id;
  if(ws?.value) syncWorkspaceProject(ws.value,false);
}

function syncWorkspaceProject(pid, rerender=true){
  ['billingProjectFilter','scheduleProject','progressProject','inventoryProject','budgetProject','fileProject','smartProject'].forEach(id=>{
    const s=$(id); if(s && [...s.options].some(o=>String(o.value)===String(pid))) s.value=pid;
  });
  if(rerender){
    renderBilling(); renderSchedule(); renderProgress(); renderInventory(); renderBudget(); renderFiles();
  }
}
if($('workspaceProject')) $('workspaceProject').onchange=e=>syncWorkspaceProject(e.target.value);
['billingProjectFilter','inventoryProject','budgetProject'].forEach(id=>{
  if($(id)) $(id).onchange=()=>({billingProjectFilter:renderBilling,inventoryProject:renderInventory,budgetProject:renderBudget}[id])();
});

function currentProject(pid){ return cache.projects.find(p=>String(p.id)===String(pid)); }
function profileName(){ return currentProfile?.full_name || currentUser?.email || ''; }
function billIsCost(b){ return ['Labor','Equipment','Subcontractor','Other'].includes(b.billing_type||''); }
function billIsClient(b){ return !billIsCost(b); }

function calcProjectContract(original,discount){
  const o=Number(original||0),d=Number(discount||0); return Math.max(0,o-d);
}
function updateProjectNet(){
  if(!$('pOriginalContract')) return;
  $('pContract').value=calcProjectContract($('pOriginalContract').value,$('pDiscount').value).toFixed(2);
}
if($('pOriginalContract')) $('pOriginalContract').oninput=updateProjectNet;
if($('pDiscount')) $('pDiscount').oninput=updateProjectNet;

$('addProjectBtn').onclick=()=>{
  $('projectForm').reset();
  $('pOriginalContract').value=0; $('pDiscount').value=0; updateProjectNet();
  $('projectDialog').showModal();
};
$('projectForm').onsubmit=async e=>{
  e.preventDefault(); updateProjectNet();
  const row={
    project_name:$('pName').value.trim(), client_name:$('pClient').value.trim(), location:$('pLocation').value.trim(),
    original_contract_amount:Number($('pOriginalContract').value||0), discount_amount:Number($('pDiscount').value||0),
    contract_amount:Number($('pContract').value||0), start_date:$('pStart').value||null,target_date:$('pTarget').value||null,
    status:$('pStatus').value,progress:Number($('pProgress').value||0),created_by:currentUser.id
  };
  try{await q('projects','insert',row);$('projectDialog').close();await refreshAll();renderProjects();renderBudget();toast('Project saved.');}
  catch(e){alert(e.message)}
};

function updateBillingRule(){
  const t=$('bType')?.value||'Client Billing';
  const ret=$('bUseRetention'),rec=$('bUseRecoupment'),note=$('billingRuleNote');
  if(!ret||!rec) return;
  if(t==='Labor' || t==='Subcontractor'){
    ret.disabled=false;rec.disabled=false;
    if(!ret.dataset.touched) ret.checked=true;
    if(!rec.dataset.touched) rec.checked=true;
    note.textContent='Labor/Subcontractor: retention and recoupment are available and enabled by default. You can turn either off when not applicable.';
  }else if(t==='Equipment'){
    ret.disabled=false;rec.disabled=false;
    if(!ret.dataset.touched) ret.checked=false;
    if(!rec.dataset.touched) rec.checked=false;
    note.textContent='Equipment: retention and recoupment are optional. Tick only when applicable.';
  }else{
    ret.checked=false;rec.checked=false;ret.disabled=true;rec.disabled=true;
    note.textContent='Client Billing / Other: retention and recoupment are disabled here unless you change the record type to Labor, Equipment or Subcontractor.';
  }
  $('bRetention').disabled=!ret.checked || ret.disabled;
  $('bRecoup').disabled=!rec.checked || rec.disabled;
  calcBillingV13();
}
if($('bType')) $('bType').onchange=()=>{delete $('bUseRetention').dataset.touched;delete $('bUseRecoupment').dataset.touched;updateBillingRule()};
['bUseRetention','bUseRecoupment'].forEach(id=>{
  if($(id)) $(id).onchange=()=>{$(id).dataset.touched='1';updateBillingRule();};
});

function calcBillingV13(){
  if(!$('bGross')) return {};
  const gross=Number($('bGross').value||0);
  const retPct=$('bUseRetention')?.checked?Number($('bRetention').value||0):0;
  const recPct=$('bUseRecoupment')?.checked?Number($('bRecoup').value||0):0;
  const ret=gross*retPct/100,rec=gross*recPct/100,net=Math.max(0,gross-ret-rec);
  const received=Number($('bReceived').value||0),out=Math.max(0,net-received);
  $('billingCalc').innerHTML=[['Retention',money(ret)],['Recoupment',money(rec)],['Net Due',money(net)],['Outstanding',money(out)]].map(x=>`<div>${x[0]}<strong>${x[1]}</strong></div>`).join('');
  return {gross,retPct,recPct,ret,rec,net,received,out};
}
['bGross','bRetention','bRecoup','bReceived','bAccomplishment'].forEach(id=>{if($(id))$(id).oninput=calcBillingV13});

$('addBillingBtn').onclick=()=>{
  $('billingForm').reset(); syncProjectSelects(); syncProjectSelectsV13();
  const ws=$('workspaceProject')?.value; if(ws) $('bProject').value=ws;
  $('bType').value='Client Billing'; $('bRetention').value=5; $('bRecoup').value=30;
  $('bInputBy').value=profileName(); $('bUseRetention').checked=false;$('bUseRecoupment').checked=false;
  updateBillingRule(); calcBillingV13(); $('billingDialog').showModal();
};
$('billingForm').onsubmit=async e=>{
  e.preventDefault(); const c=calcBillingV13(),type=$('bType').value;
  const row={
    project_id:$('bProject').value,billing_no:$('bNo').value.trim(),variation_no:$('bVariation').value.trim()||null,
    billing_type:type,transaction_side:type==='Client Billing'?'receivable':'payable',
    accomplishment_percent:Number($('bAccomplishment').value||0),gross_amount:c.gross,
    retention_applicable:$('bUseRetention').checked,retention_percent:c.retPct,retention_amount:c.ret,
    recoupment_applicable:$('bUseRecoupment').checked,recoupment_percent:c.recPct,recoupment_amount:c.rec,
    net_due:c.net,received_amount:c.received,outstanding_amount:c.out,date_request:$('bRequestDate').value||null,
    date_submitted:$('bRequestDate').value||null,date_paid:$('bPaidDate').value||null,input_by_name:profileName(),
    status:c.out<=.01?'Paid':c.received>0?'Partially Paid':'Pending',created_by:currentUser.id
  };
  try{
    const rows=await q('billings','insert',row);
    if(c.received>0) await q('payments','insert',{billing_id:rows[0].id,amount:c.received,payment_date:$('bPaidDate').value||new Date().toISOString().slice(0,10),created_by:currentUser.id});
    $('billingDialog').close();await refreshAll();renderBilling();renderBudget();toast('Billing saved.');
  }catch(e){alert(e.message)}
};

renderBilling = function(){
  const pid=$('billingProjectFilter')?.value||$('workspaceProject')?.value||'';
  const rows=pid?cache.billings.filter(b=>String(b.project_id)===String(pid)):cache.billings;
  const client=rows.filter(billIsClient),cost=rows.filter(billIsCost);
  const clientGross=client.reduce((s,b)=>s+Number(b.gross_amount||0),0);
  const collected=client.reduce((s,b)=>s+Number(b.received_amount||0),0);
  const costPaid=cost.reduce((s,b)=>s+Number(b.received_amount||0),0);
  const clientOut=client.reduce((s,b)=>s+Number(b.outstanding_amount||0),0);
  $('billingKPIs').innerHTML=[['Client Gross Billed',money(clientGross)],['Client Collections',money(collected)],['Project Cost Paid',money(costPaid)],['Client Outstanding',money(clientOut)]].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
  $('billingRows').innerHTML=rows.length?rows.map(b=>`<tr>
    <td class="check-col"><input class="billing-row-check" type="checkbox" value="${b.id}" ${selectedBillingIds.has(String(b.id))?'checked':''}></td>
    <td>${esc(proj(b.project_id)?.project_name||'—')}</td><td>${esc(b.billing_type||'Client Billing')}</td>
    <td><strong>${esc(b.billing_no)}</strong>${b.variation_no?`<br><small>${esc(b.variation_no)}</small>`:''}</td>
    <td>${pct(b.accomplishment_percent||0)}</td><td>${money(b.gross_amount)}</td><td>${money(b.retention_amount)}</td><td>${money(b.recoupment_amount)}</td>
    <td>${money(b.net_due)}</td><td>${money(b.received_amount)}</td><td>${money(b.outstanding_amount)}</td>
    <td>${b.date_request||b.date_submitted||'—'}</td><td>${b.date_paid||'—'}</td><td>${esc(b.input_by_name||'—')}</td><td>${esc(b.status)}</td>
    <td><div class="row-actions"><button class="icon-action" onclick="addPayment('${b.id}')">${billIsCost(b)?'Add Payment':'Receive Payment'}</button><button class="icon-action" onclick="generateBilling('${b.id}')">Download</button><button class="danger-link" onclick="deleteBilling('${b.id}')">Delete</button></div></td>
  </tr>`).join(''):'<tr><td colspan="16" class="empty">No billing/payment records for this project.</td></tr>';
  wireBulkChecks('billing-row-check',selectedBillingIds,()=>bulkUI('billing',selectedBillingIds,rows)); bulkUI('billing',selectedBillingIds,rows);
};

function boqForProject(pid){return cache.boq.filter(b=>String(b.project_id)===String(pid))}
function inventoryForProject(pid){return cache.inventory.filter(i=>String(i.project_id)===String(pid))}
function progressForProject(pid){return cache.progress.filter(p=>String(p.project_id)===String(pid))}

function syncBoqActivityList(){
  const pid=$('progressProject')?.value;
  const rows=boqForProject(pid),dl=$('boqActivityList'); if(!dl)return;
  dl.innerHTML=rows.map(b=>`<option value="${esc(b.description)}"></option>`).join('');
}
if($('progressProject')) $('progressProject').addEventListener('change',()=>{syncBoqActivityList();renderProgress();});

if($('loadBoqScopesBtn')) $('loadBoqScopesBtn').onclick=async()=>{
  const pid=$('progressProject').value;if(!pid)return alert('Select a project.');
  const boq=boqForProject(pid);if(!boq.length)return alert('No BOQ items found for this project. Upload/import BOQ first.');
  const total=boq.reduce((s,b)=>s+Number(b.amount||0),0)||1;
  const existing=progressForProject(pid);
  let added=0;
  for(const b of boq){
    if(existing.some(x=>String(x.boq_item_id)===String(b.id)||x.activity.toLowerCase()===String(b.description).toLowerCase()))continue;
    const weight=Number(b.amount||0)>0?Number(b.amount||0)/total*100:0;
    const {error}=await sb.from('actual_progress').insert({
      project_id:pid,activity:b.description,boq_item_id:b.id,cost_category:b.cost_category||'Materials',
      budget_amount:Number(b.amount||0),weight,actual_percent:0,updated_by:currentUser.id,updated_at:new Date().toISOString()
    }); if(error)return alert(error.message); added++;
  }
  await refreshAll();renderProgress();renderSchedule();toast(`${added} BOQ scope(s) loaded to Actual Progress.`);
};

const baseAddProgressClick=$('addProgressBtn').onclick;
$('addProgressBtn').onclick=()=>{
  if(!$('progressProject').value)return alert('Select a project.');
  $('progressForm').reset();syncBoqActivityList();$('progressCostHint').textContent='Choose a BOQ scope. Weight and budget are auto-linked when a matching BOQ item is found.';$('progressDialog').showModal();
};
$('aActivity').addEventListener('change',()=>{
  const pid=$('progressProject').value,b=boqForProject(pid).find(x=>String(x.description).toLowerCase()===String($('aActivity').value).toLowerCase());
  if(b){const total=boqForProject(pid).reduce((s,x)=>s+Number(x.amount||0),0)||1;$('aWeight').value=(Number(b.amount||0)/total*100).toFixed(4);$('progressCostHint').textContent=`BOQ Budget: ${money(b.amount)} | Category: ${b.cost_category||'Materials'}`;}
});
$('progressForm').onsubmit=async e=>{
  e.preventDefault();const pid=$('progressProject').value;
  const b=boqForProject(pid).find(x=>String(x.description).toLowerCase()===String($('aActivity').value).toLowerCase());
  const row={project_id:pid,activity:$('aActivity').value.trim(),boq_item_id:b?.id||null,cost_category:b?.cost_category||null,budget_amount:Number(b?.amount||0),weight:Number($('aWeight').value||0),actual_percent:Number($('aActual').value||0),updated_by:currentUser.id,updated_at:new Date().toISOString()};
  try{
    const old=cache.progress.find(x=>String(x.project_id)===String(pid)&&x.activity.toLowerCase()===row.activity.toLowerCase());
    if(old)await q('actual_progress','update',{id:old.id,values:row});else await q('actual_progress','insert',row);
    await q('progress_history','insert',{project_id:pid,activity:row.activity,boq_item_id:row.boq_item_id,weight:row.weight,actual_percent:row.actual_percent,recorded_by:currentUser.id});
    $('progressDialog').close();await refreshAll();renderProgress();renderSchedule();renderBudget();
  }catch(e){alert(e.message)}
};

function actualCostForProgress(p){
  const rows=inventoryForProject(p.project_id);
  if(p.boq_item_id) return rows.filter(i=>String(i.boq_item_id)===String(p.boq_item_id)).reduce((s,i)=>s+Number(i.total_amount||0),0);
  return 0;
}
renderProgress = function(){
  const pid=$('progressProject').value||$('workspaceProject')?.value||cache.projects[0]?.id;if(pid&&!$('progressProject').value)$('progressProject').value=pid;
  const rows=progressForProject(pid),actual=actualForProject(pid),planned=plannedForProject(pid),variance=actual-planned;
  $('progressSummary').innerHTML=[['Actual',pct(actual)],['Planned',pct(planned)],['Variance',pct(variance)],['Remaining',pct(Math.max(0,100-actual))]].map(x=>`<div class="kpi"><span>${x[0]}</span><strong class="${x[0]==='Variance'?(variance<0?'negative':'positive'):''}">${x[1]}</strong></div>`).join('');
  $('progressRows').innerHTML=rows.length?rows.map(r=>{const ac=actualCostForProgress(r),budget=Number(r.budget_amount||0);return `<tr>
    <td class="check-col"><input class="progress-row-check" type="checkbox" value="${r.id}" ${selectedProgressIds.has(String(r.id))?'checked':''}></td>
    <td>${esc(r.activity)}</td><td>${esc(r.cost_category||'—')}</td><td>${money(budget)}</td><td>${pct(r.weight)}</td><td>${pct(r.actual_percent)}</td>
    <td>${pct(Number(r.weight||0)*Number(r.actual_percent||0)/100)}</td><td>${money(ac)}</td><td>${money(Math.max(0,budget-ac))}</td>
    <td>${new Date(r.updated_at).toLocaleString()}</td><td><button class="danger-link" onclick="deleteProgress('${r.id}')">Delete</button></td></tr>`}).join('')
    :'<tr><td colspan="11" class="empty">No actual progress entries yet. Load BOQ Scopes or add an activity.</td></tr>';
  wireBulkChecks('progress-row-check',selectedProgressIds,()=>bulkUI('progress',selectedProgressIds,rows));bulkUI('progress',selectedProgressIds,rows);
};

function renderSCurve(){
  const pid=$('scheduleProject')?.value||$('workspaceProject')?.value;if(!pid||!$('sCurveChart'))return;
  const rows=scheduleData(pid);if(!rows.length){$('sCurveChart').innerHTML='<div class="empty">Import a project schedule to generate the S-curve.</div>';return}
  const min=new Date(Math.min(...rows.map(r=>new Date(r.start_date)))),max=new Date(Math.max(...rows.map(r=>new Date(r.end_date))));
  const span=Math.max(1,(max-min)/86400000),points=24;
  const dates=[...Array(points)].map((_,i)=>new Date(min.getTime()+span*86400000*i/(points-1)));
  const plannedAt=d=>rows.reduce((sum,r)=>{const s=new Date(r.start_date),e=new Date(r.end_date),w=Number(r.weight||0);const f=d<=s?0:d>=e?1:(d-s)/(e-s||1);return sum+w*f},0);
  const history=cache.progressHistory.filter(h=>String(h.project_id)===String(pid));
  const pRows=progressForProject(pid);
  const actualAt=d=>pRows.reduce((sum,p)=>{const hs=history.filter(h=>h.activity===p.activity&&new Date(h.recorded_at)<=d).sort((a,b)=>new Date(b.recorded_at)-new Date(a.recorded_at));const a=hs[0]?.actual_percent??(d>=new Date()?Number(p.actual_percent||0):0);return sum+Number(p.weight||0)*Number(a||0)/100},0);
  const W=760,H=230,pad=35,x=i=>pad+i*(W-pad*2)/(points-1),y=v=>H-pad-Math.max(0,Math.min(100,v))*(H-pad*2)/100;
  const pp=dates.map((d,i)=>`${x(i)},${y(plannedAt(d))}`).join(' ');
  const ap=dates.map((d,i)=>`${x(i)},${y(actualAt(d))}`).join(' ');
  const grid=[0,25,50,75,100].map(v=>`<line x1="${pad}" y1="${y(v)}" x2="${W-pad}" y2="${y(v)}" stroke="#e5e7eb"/><text x="4" y="${y(v)+4}" font-size="11" fill="#64748b">${v}%</text>`).join('');
  $('sCurveChart').innerHTML=`<svg class="scurve-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${grid}<polyline fill="none" stroke="#2563eb" stroke-width="3" points="${pp}"/><polyline fill="none" stroke="#16a34a" stroke-width="3" points="${ap}"/></svg><div class="chart-legend"><span><i class="legend-dot" style="background:#2563eb"></i>Planned</span><span><i class="legend-dot" style="background:#16a34a"></i>Actual</span><span>${min.toLocaleDateString()} → ${max.toLocaleDateString()}</span></div>`;
}
function renderRecoveryPlan(){
  const pid=$('scheduleProject')?.value||$('workspaceProject')?.value;if(!pid||!$('recoveryPlan'))return;
  const planned=plannedForProject(pid),actual=actualForProject(pid),variance=actual-planned,p=currentProject(pid);
  const rows=scheduleData(pid),today=new Date(),active=rows.filter(r=>new Date(r.start_date)<=today&&new Date(r.end_date)>=today);
  const overdue=rows.filter(r=>new Date(r.end_date)<today).filter(r=>{const ap=progressForProject(pid).find(x=>x.activity.toLowerCase()===r.activity.toLowerCase());return Number(ap?.actual_percent||0)<100});
  const pendingPurch=inventoryForProject(pid).filter(i=>i.date_request&&!i.date_purchase);
  const remainingDays=p?.target_date?Math.max(1,Math.ceil((new Date(p.target_date)-today)/86400000)):null;
  const reqDaily=remainingDays?Math.max(0,(100-actual)/remainingDays):null;
  const list=[];
  if(variance<-2){
    list.push(['Schedule Status',`Behind by ${Math.abs(variance).toFixed(2)}%. Prioritize recovery on the highest-weight delayed activities.`]);
    if(overdue.length) list.push(['Critical Catch-up',`Overdue: ${overdue.slice(0,3).map(x=>x.activity).join(', ')}. Add crew/shift, remove access constraints, and execute parallel work where technically possible.`]);
    if(active.length) list.push(['Workfront Diversion',`Keep crews productive by diverting available manpower to ready parallel activities: ${active.slice(0,3).map(x=>x.activity).join(', ')}.`]);
    if(pendingPurch.length) list.push(['Procurement Acceleration',`${pendingPurch.length} requested item(s) have no purchase date. Expedite these before they become schedule constraints.`]);
    if(reqDaily!=null) list.push(['Recovery Target',`Approximate remaining project progress target: ${reqDaily.toFixed(2)} percentage points/day over ${remainingDays} day(s). Validate against actual resource loading and critical path.`]);
  }else{
    list.push(['Schedule Status',variance>2?`Ahead by ${variance.toFixed(2)}%. Protect the gain by maintaining procurement and manpower continuity.`:'Currently within ±2% of plan. Continue daily monitoring of critical activities and material availability.']);
  }
  $('scheduleHealthBadge').textContent=variance<-2?'BEHIND':variance>2?'AHEAD':'ON TRACK';
  $('recoveryPlan').innerHTML=list.map(x=>`<div class="recovery-item"><strong>${x[0]}</strong><span>${x[1]}</span></div>`).join('');
}
const baseRenderScheduleV13=renderSchedule;
renderSchedule=function(){baseRenderScheduleV13();renderSCurve();renderRecoveryPlan();};

function syncInventoryBoq(){
  const pid=$('iProject')?.value,sel=$('iBoqItem');if(!sel)return;
  sel.innerHTML='<option value="">Unassigned</option>'+boqForProject(pid).map(b=>`<option value="${b.id}">${esc(b.description)}</option>`).join('');
}
if($('iProject')) $('iProject').onchange=syncInventoryBoq;

function calcInventory(){
  const qty=Number($('iQty')?.value||0),unit=Number($('iUnitCost')?.value||0),total=qty*unit,paid=Number($('iPaid')?.value||0);
  if($('iTotal'))$('iTotal').value=total.toFixed(2);if($('iBalance'))$('iBalance').value=Math.max(0,total-paid).toFixed(2);
  return{qty,unit,total,paid,balance:Math.max(0,total-paid)}
}
['iQty','iUnitCost','iPaid'].forEach(id=>{if($(id))$(id).oninput=calcInventory});
if($('addInventoryBtn')) $('addInventoryBtn').onclick=()=>{
  $('inventoryForm').reset();syncProjectSelectsV13();const pid=$('workspaceProject')?.value;if(pid)$('iProject').value=pid;$('iInputBy').value=profileName();syncInventoryBoq();calcInventory();$('inventoryDialog').showModal();
};
if($('inventoryForm')) $('inventoryForm').onsubmit=async e=>{
  e.preventDefault();const c=calcInventory();
  const row={project_id:$('iProject').value,boq_item_id:$('iBoqItem').value||null,category:$('iCategory').value,description:$('iDescription').value.trim(),quantity:c.qty,unit:$('iUnit').value.trim(),unit_cost:c.unit,total_amount:c.total,paid_amount:c.paid,balance_amount:c.balance,date_request:$('iDateRequest').value||null,date_purchase:$('iDatePurchase').value||null,supplier:$('iSupplier').value.trim(),reference_no:$('iReference').value.trim(),input_by_name:profileName(),created_by:currentUser.id};
  try{await q('inventory_entries','insert',row);$('inventoryDialog').close();await refreshAll();renderInventory();renderProgress();renderBudget();toast('Inventory entry saved.')}catch(e){alert(e.message)}
};
window.deleteInventory=async id=>{if(!confirm('Delete this inventory/purchase entry?'))return;const{error}=await sb.from('inventory_entries').delete().eq('id',id);if(error)return alert(error.message);await refreshAll();renderInventory();renderProgress();renderBudget()};

function renderInventory(){
  if(!$('inventoryRows'))return;const pid=$('inventoryProject')?.value||$('workspaceProject')?.value||'',cat=$('inventoryCategoryFilter')?.value||'';
  let rows=pid?cache.inventory.filter(i=>String(i.project_id)===String(pid)):cache.inventory;if(cat)rows=rows.filter(i=>i.category===cat);
  const total=rows.reduce((s,i)=>s+Number(i.total_amount||0),0),paid=rows.reduce((s,i)=>s+Number(i.paid_amount||0),0),bal=rows.reduce((s,i)=>s+Number(i.balance_amount||0),0);
  $('inventoryKPIs').innerHTML=[['Committed',money(total)],['Paid',money(paid)],['Balance',money(bal)],['Entries',String(rows.length)]].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
  $('inventoryRows').innerHTML=rows.length?rows.map(i=>{const b=cache.boq.find(x=>String(x.id)===String(i.boq_item_id));return `<tr><td>${i.date_request||'—'}</td><td>${i.date_purchase||'—'}</td><td>${esc(i.category)}</td><td class="inventory-scope">${esc(b?.description||'Unassigned')}</td><td>${esc(i.description)}</td><td>${Number(i.quantity||0).toLocaleString()}</td><td>${esc(i.unit||'')}</td><td>${money(i.unit_cost)}</td><td>${money(i.total_amount)}</td><td>${money(i.paid_amount)}</td><td>${money(i.balance_amount)}</td><td>${esc(i.supplier||'—')}</td><td>${esc(i.input_by_name||'—')}</td><td><button class="danger-link" onclick="deleteInventory('${i.id}')">Delete</button></td></tr>`}).join(''):'<tr><td colspan="14" class="empty">No inventory/purchase entries for this project.</td></tr>';
}
if($('inventoryCategoryFilter')) $('inventoryCategoryFilter').onchange=renderInventory;

function budgetData(pid){
  const p=currentProject(pid)||{},inv=inventoryForProject(pid),bills=cache.billings.filter(b=>String(b.project_id)===String(pid));
  const client=bills.filter(billIsClient),costBills=bills.filter(billIsCost);
  const original=Number(p.original_contract_amount||p.contract_amount||0),discount=Number(p.discount_amount||0),contract=Number(p.contract_amount||Math.max(0,original-discount));
  const invCommitted=inv.reduce((s,i)=>s+Number(i.total_amount||0),0),invPaid=inv.reduce((s,i)=>s+Number(i.paid_amount||0),0);
  const costCommitted=costBills.reduce((s,b)=>s+Number(b.net_due||0),0),costPaid=costBills.reduce((s,b)=>s+Number(b.received_amount||0),0);
  const runningCost=invPaid+costPaid,committed=invCommitted+costCommitted,actual=actualForProject(pid),earned=contract*actual/100;
  const runningProfit=earned-runningCost,projectedProfit=contract-committed;
  const clientGross=client.reduce((s,b)=>s+Number(b.gross_amount||0),0),collections=client.reduce((s,b)=>s+Number(b.received_amount||0),0);
  const categories={Materials:0,Labor:0,Equipment:0,Subcontractor:0,Other:0};
  inv.forEach(i=>categories[i.category in categories?i.category:'Other']+=Number(i.total_amount||0));
  costBills.forEach(b=>{const k=b.billing_type in categories?b.billing_type:'Other';categories[k]+=Number(b.net_due||0)});
  const remainingByType={Materials:0,Labor:0,Equipment:0,Subcontractor:0,Other:0};
  progressForProject(pid).forEach(r=>{const k=(r.cost_category&&r.cost_category in remainingByType)?r.cost_category:'Other';remainingByType[k]+=Math.max(0,Number(r.budget_amount||0)*(1-Number(r.actual_percent||0)/100))});
  return{p,original,discount,contract,invCommitted,invPaid,costCommitted,costPaid,runningCost,committed,actual,earned,runningProfit,projectedProfit,clientGross,collections,categories,remainingByType};
}
function renderBudget(){
  if(!$('budgetKPIs'))return;const pid=$('budgetProject')?.value||$('workspaceProject')?.value;if(!pid){$('budgetKPIs').innerHTML='';return}
  const d=budgetData(pid),remain=Math.max(0,d.contract-d.runningCost);
  $('budgetKPIs').innerHTML=[['Original Contract',money(d.original)],['Discount',money(d.discount)],['Net Contract',money(d.contract)],['Actual Progress',pct(d.actual)],['Running Cost',money(d.runningCost)],['Earned Value',money(d.earned)],['Running Profit',money(d.runningProfit)],['Projected Profit',money(d.projectedProfit)]].map(x=>`<div class="kpi"><span>${x[0]}</span><strong class="${x[0].includes('Profit')?(Number(x[1].replace(/[^0-9.-]/g,''))<0?'cost-negative':'cost-positive'):''}">${x[1]}</strong></div>`).join('');
  const spentPct=d.contract?Math.min(100,d.runningCost/d.contract*100):0;
  $('budgetPie').innerHTML=`<div class="budget-pie-wrap"><div class="budget-pie" style="background:conic-gradient(#2563eb 0 ${spentPct}%,#e5e7eb ${spentPct}% 100%)"><div class="pie-center">${spentPct.toFixed(1)}%</div></div><div><strong>Running Cost</strong><br>${money(d.runningCost)}<br><span class="muted">Remaining vs net contract: ${money(remain)}</span></div></div>`;
  const max=Math.max(1,...Object.values(d.categories));$('budgetBars').innerHTML=`<div class="bar-list">${Object.entries(d.categories).map(([k,v])=>`<div class="bar-row"><span>${k}</span><div class="bar-track"><div class="bar-fill" style="width:${v/max*100}%"></div></div><strong>${money(v)}</strong></div>`).join('')}</div>`;
  $('budgetSummaryTable').innerHTML=`<table><thead><tr><th>Metric</th><th>Amount</th></tr></thead><tbody>
    <tr><td>Client Gross Billings</td><td>${money(d.clientGross)}</td></tr><tr><td>Client Collections</td><td>${money(d.collections)}</td></tr>
    <tr><td>Inventory Committed</td><td>${money(d.invCommitted)}</td></tr><tr><td>Inventory Paid</td><td>${money(d.invPaid)}</td></tr>
    <tr><td>Labor / Equipment / Subcon Committed</td><td>${money(d.costCommitted)}</td></tr><tr><td>Labor / Equipment / Subcon Paid</td><td>${money(d.costPaid)}</td></tr>
    <tr><td><strong>Running Cost</strong></td><td><strong>${money(d.runningCost)}</strong></td></tr><tr><td><strong>Running Profit (Earned Value - Running Cost)</strong></td><td><strong>${money(d.runningProfit)}</strong></td></tr>
    <tr><td>Estimated Remaining BOQ Spend - Materials</td><td>${money(d.remainingByType.Materials)}</td></tr><tr><td>Estimated Remaining BOQ Spend - Labor</td><td>${money(d.remainingByType.Labor)}</td></tr>
  </tbody></table>`;
}

const baseShowV13=show;
show=function(id){baseShowV13(id);if(id==='inventory')renderInventory();if(id==='budget')renderBudget();if(id==='schedule'){renderSchedule();}if(id==='progress'){syncBoqActivityList();renderProgress();}};

const baseRenderDashboardV13=renderDashboard;
renderDashboard=function(){baseRenderDashboardV13();renderBudget();};

const oldAiSubmit=$('aiForm').onsubmit;
$('aiForm').onsubmit=async e=>{
  e.preventDefault();const msg=$('aiInput').value.trim();if(!msg)return;$('aiInput').value='';$('aiMessages').insertAdjacentHTML('beforeend',`<div class="user-msg">${esc(msg)}</div>`);
  const pid=$('workspaceProject')?.value||cache.projects[0]?.id,d=pid?budgetData(pid):null;
  const ctx={selectedProject:pid?currentProject(pid):null,projects:cache.projects.map(p=>({name:p.project_name,status:p.status,actual:actualForProject(p.id),planned:plannedForProject(p.id)})),billings:cache.billings.filter(b=>!pid||String(b.project_id)===String(pid)),inventory:cache.inventory.filter(i=>!pid||String(i.project_id)===String(pid)),boq:cache.boq.filter(i=>!pid||String(i.project_id)===String(pid)).slice(0,100),schedule:cache.schedule.filter(i=>!pid||String(i.project_id)===String(pid)).slice(0,100),actualProgress:cache.progress.filter(i=>!pid||String(i.project_id)===String(pid)),budget:d};
  const loading=document.createElement('div');loading.className='bot';loading.textContent='Thinking...';$('aiMessages').appendChild(loading);
  try{const r=await fetch('/api/ai',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:msg,context:ctx})});const j=await r.json();loading.textContent=j.answer||j.error||'No answer returned.';}catch(err){loading.textContent='AI endpoint is unavailable.'}
  $('aiMessages').scrollTop=$('aiMessages').scrollHeight;
};

setTimeout(async()=>{
  if(!currentUser) return;
  try{
    await refreshAll();
    if($('workspaceProject')?.value) syncWorkspaceProject($('workspaceProject').value,false);
    renderBilling();renderInventory();renderBudget();syncBoqActivityList();renderProgress();renderSchedule();
  }catch(e){console.warn('v13 init',e)}
},400);
