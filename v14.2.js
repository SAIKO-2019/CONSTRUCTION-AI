// SAIKO Construction AI v14.2

cache.quotationProjects = cache.quotationProjects || [];

const refreshV142Base = refreshAll;
refreshAll = async function(){
  await refreshV142Base();
  try{ cache.quotationProjects = await q('quotation_projects'); }catch(_){ cache.quotationProjects=[]; }
  syncQuotationSelectors();
};

function syncQuotationSelectors(){
  const s=$('pendingProject'); if(!s)return;
  const old=s.value;
  s.innerHTML='<option value="">All quotation projects</option>'+cache.quotationProjects.map(p=>`<option value="${p.id}">${esc(p.project_name)}</option>`).join('');
  if(cache.quotationProjects.some(p=>String(p.id)===String(old)))s.value=old;
}

function quotationRows(){
  const id=$('pendingProject')?.value||'',status=$('pendingStatusFilter')?.value||'';
  let rows=id?cache.quotationProjects.filter(p=>String(p.id)===String(id)):cache.quotationProjects;
  if(status)rows=rows.filter(p=>p.status===status);
  return rows;
}
function quotationProfit(q){return Number(q.quoted_amount||0)-Number(q.estimated_cost||0)}
function quotationMargin(q){const qamt=Number(q.quoted_amount||0);return qamt?quotationProfit(q)/qamt*100:0}

function renderPending(){
  if(!$('pendingRows'))return;
  const rows=quotationRows(),totalQuoted=rows.reduce((s,q)=>s+Number(q.quoted_amount||0),0),totalCost=rows.reduce((s,q)=>s+Number(q.estimated_cost||0),0),profit=totalQuoted-totalCost;
  $('pendingKPIs').innerHTML=[['Quotation Projects',String(rows.length)],['Running Amount',money(rows.reduce((s,q)=>s+Number(q.running_amount||0),0))],['Total Quoted',money(totalQuoted)],['Projected Profit',money(profit)]].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
  $('pendingAlert').textContent='This workspace is separate from ongoing projects. Use it only for pre-award quotation opportunities.';
  $('pendingRows').innerHTML=rows.length?rows.map(q=>`<tr>
    <td><strong>${esc(q.project_name)}</strong></td><td>${esc(q.client_name||'—')}</td><td>${esc(q.estimator||'—')}</td><td>${q.target_submission||'—'}</td>
    <td>${q.boq_file_name?esc(q.boq_file_name):q.gsheet_link?`<a class="quote-link" href="${esc(q.gsheet_link)}" target="_blank">Google Sheet</a>`:'—'}</td>
    <td>${money(q.estimated_cost)}</td><td>${money(q.quoted_amount)}</td><td class="${quotationProfit(q)>=0?'cost-positive':'cost-negative'}">${money(quotationProfit(q))}<br><small>${quotationMargin(q).toFixed(2)}% margin</small></td>
    <td><span class="status-pill">${esc(q.status)}</span></td>
    <td><div class="row-actions"><button class="icon-action" onclick="selectQuotation('${q.id}')">Open</button><button class="danger-link" onclick="deleteQuotation('${q.id}')">Delete</button></div></td>
  </tr>`).join(''):'<tr><td colspan="10" class="empty">No quotation projects yet.</td></tr>';
  renderQuotationDashboard();
}
if($('pendingStatusFilter'))$('pendingStatusFilter').onchange=renderPending;
if($('pendingProject'))$('pendingProject').onchange=()=>{renderPending();loadQuotationIntoPanel($('pendingProject').value)};

$('addPendingBtn').onclick=()=>{$('pendingForm').reset();$('pendingDialog').showModal()};
$('pendingForm').onsubmit=async e=>{
  e.preventDefault();
  const row={project_name:$('pwWorkItem').value.trim(),client_name:$('pwClient')?.value.trim()||'',estimator:$('pwAssignedTo').value.trim(),target_submission:$('pwTargetDate').value||null,status:$('pwStatus').value,notes:$('pwNotes').value.trim(),created_by:currentUser.id,updated_at:new Date().toISOString()};
  const{error}=await sb.from('quotation_projects').insert(row);if(error)return alert(error.message);
  $('pendingDialog').close();await refreshAll();renderPending();renderDashboard();toast('Quotation project added.');
};

window.selectQuotation=id=>{if($('pendingProject')){$('pendingProject').value=id;loadQuotationIntoPanel(id);renderPending()}};
window.deleteQuotation=async id=>{if(!confirm('Delete this quotation project?'))return;const{error}=await sb.from('quotation_projects').delete().eq('id',id);if(error)return alert(error.message);await refreshAll();renderPending();renderDashboard()};

function loadQuotationIntoPanel(id){
  const q=cache.quotationProjects.find(x=>String(x.id)===String(id));if(!q)return;
  if($('quotationGsheetLink'))$('quotationGsheetLink').value=q.gsheet_link||'';
  if($('quotationQuotedAmount'))$('quotationQuotedAmount').value=q.quoted_amount||0;
  if($('quotationRunningAmount'))$('quotationRunningAmount').value=q.running_amount||0;
}
if($('saveQuotationDataBtn'))$('saveQuotationDataBtn').onclick=async()=>{
  const id=$('pendingProject')?.value;if(!id)return alert('Select a quotation project first.');
  const q=cache.quotationProjects.find(x=>String(x.id)===String(id));if(!q)return;
  let path=q.boq_storage_path||null,fileName=q.boq_file_name||null;
  const file=$('quotationBoqFile')?.files?.[0];
  if(file){
    const safe=file.name.replace(/[^a-zA-Z0-9._-]+/g,'_');path=`quotation/${q.id}/${Date.now()}-${safe}`;
    const up=await sb.storage.from('project-files').upload(path,file,{upsert:false});if(up.error)return alert(up.error.message);fileName=file.name;
  }
  const quoted=Number($('quotationQuotedAmount')?.value||0),running=Number($('quotationRunningAmount')?.value||0);
  // Until parser is added, running amount is treated as current estimated cost / running costing total.
  const values={boq_file_name:fileName,boq_storage_path:path,gsheet_link:$('quotationGsheetLink')?.value.trim()||null,estimated_cost:running,running_amount:running,quoted_amount:quoted,projected_profit:quoted-running,updated_at:new Date().toISOString()};
  const{error}=await sb.from('quotation_projects').update(values).eq('id',id);if(error)return alert(error.message);
  await refreshAll();renderPending();renderDashboard();toast('Quotation data updated.');
};

// Ongoing projects schedule health cards
function projectScheduleHealth(pid){
  const planned=plannedForProject(pid),actual=actualForProject(pid),variance=actual-planned;
  return {planned,actual,variance,status:variance<-2?'Behind':variance>2?'Ahead':'On Track'};
}
function miniSCurveSvg(pid){
  const rows=scheduleData(pid);if(!rows.length)return '<div class="empty">No schedule imported.</div>';
  const min=new Date(Math.min(...rows.map(r=>new Date(r.start_date)))),max=new Date(Math.max(...rows.map(r=>new Date(r.end_date))));
  const span=Math.max(1,(max-min)/86400000),points=18,dates=[...Array(points)].map((_,i)=>new Date(min.getTime()+span*86400000*i/(points-1)));
  const pAt=d=>rows.reduce((sum,r)=>{const s=new Date(r.start_date),e=new Date(r.end_date),w=Number(r.weight||0),f=d<=s?0:d>=e?1:(d-s)/(e-s||1);return sum+w*f},0);
  const hist=cache.progressHistory.filter(h=>String(h.project_id)===String(pid)),pr=progressForProject(pid);
  const aAt=d=>pr.reduce((sum,p)=>{const hs=hist.filter(h=>h.activity===p.activity&&new Date(h.recorded_at)<=d).sort((a,b)=>new Date(b.recorded_at)-new Date(a.recorded_at));const a=hs[0]?.actual_percent??(d>=new Date()?Number(p.actual_percent||0):0);return sum+Number(p.weight||0)*Number(a||0)/100},0);
  const W=300,H=120,pad=10,x=i=>pad+i*(W-pad*2)/(points-1),y=v=>H-pad-Math.max(0,Math.min(100,v))*(H-pad*2)/100;
  const pp=dates.map((d,i)=>`${x(i)},${y(pAt(d))}`).join(' '),ap=dates.map((d,i)=>`${x(i)},${y(aAt(d))}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%"><polyline fill="none" stroke="#2563eb" stroke-width="3" points="${pp}"/><polyline fill="none" stroke="#16a34a" stroke-width="3" points="${ap}"/></svg>`;
}
function renderOngoingScheduleDashboard(){
  const box=$('ongoingScheduleDashboard');if(!box)return;
  const rows=cache.projects.filter(p=>['On-going','On going','Ongoing'].includes(p.status));
  box.innerHTML=rows.length?rows.map(p=>{const h=projectScheduleHealth(p.id),cls=h.status==='Ahead'?'status-ahead':h.status==='Behind'?'status-behind':'status-ontrack';return `<div class="schedule-health-card">
    <h3>${esc(p.project_name)}</h3><div class="schedule-health-meta"><span>${esc(p.client_name||'')}</span><span>${esc(p.location||'')}</span></div>
    <div class="mini-scurve">${miniSCurveSvg(p.id)}</div>
    <div class="health-row"><div class="health-metric"><span>Projected</span><strong>${pct(h.planned)}</strong></div><div class="health-metric"><span>Actual</span><strong>${pct(h.actual)}</strong></div><div class="health-metric"><span>Status</span><strong class="${cls}">${h.status}<br>${h.variance>=0?'+':''}${h.variance.toFixed(2)}%</strong></div></div>
  </div>`}).join(''):'<div class="empty">No ongoing projects.</div>';
}
function renderQuotationDashboard(){
  const box=$('quotationDashboardSnapshot');if(!box)return;
  const rows=cache.quotationProjects,quoted=rows.reduce((s,q)=>s+Number(q.quoted_amount||0),0),cost=rows.reduce((s,q)=>s+Number(q.estimated_cost||0),0),profit=quoted-cost;
  box.innerHTML=[['Opportunities',String(rows.length)],['Running Cost',money(cost)],['Quoted Amount',money(quoted)],['Projected Profit',money(profit)]].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
}

const oldRenderDashboardV142=renderDashboard;
renderDashboard=function(){oldRenderDashboardV142();renderOngoingScheduleDashboard();renderQuotationDashboard();};

const oldShowV142=show;
show=function(id){oldShowV142(id);if(id==='quotation'){renderPending()}};

document.querySelectorAll('[data-jump="quotation"]').forEach(b=>b.onclick=()=>show('quotation'));

setTimeout(async()=>{if(!currentUser)return;try{await refreshAll();renderPending();renderOngoingScheduleDashboard();renderQuotationDashboard();renderDashboard()}catch(e){console.warn('v14.2 init',e)}},800);
