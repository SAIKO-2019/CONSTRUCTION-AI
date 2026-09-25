// SAIKO Construction AI v14.4 - Automatic Project Reports

function syncReportSelectors(){
  const rp=$('reportProject'); if(rp){
    const old=rp.value;
    rp.innerHTML='<option value="">Select project</option>'+cache.projects.map(p=>`<option value="${p.id}">${esc(p.project_name)}</option>`).join('');
    if(cache.projects.some(p=>String(p.id)===String(old)))rp.value=old;
    else if($('workspaceProject')?.value)rp.value=$('workspaceProject').value;
  }
  refreshReportTemplates();
  if($('reportPreparedBy')&&!$('reportPreparedBy').value)$('reportPreparedBy').value=profileName();
  if($('reportDate')&&!$('reportDate').value)$('reportDate').value=new Date().toISOString().slice(0,10);
}
function refreshReportTemplates(){
  const sel=$('reportTemplate'); if(!sel)return;
  const type=$('reportType')?.value||'Project Presentation Report';
  const matched=cache.templates.filter(t=>{
    const tt=String(t.template_type||'').toLowerCase();
    if(type==='Weekly Progress Report') return tt.includes('weekly')||tt.includes('progress report')||tt.includes('presentation');
    if(type==='Monthly Progress Report') return tt.includes('monthly')||tt.includes('progress report')||tt.includes('presentation');
    return tt.includes('presentation')||tt.includes('progress report');
  });
  sel.innerHTML=matched.length?matched.map(t=>`<option value="${t.id}">${esc(t.template_name)} — ${esc(t.template_type)}</option>`).join(''):'<option value="">No matching template uploaded</option>';
}
if($('reportType'))$('reportType').onchange=refreshReportTemplates;

function reportSections(){return [...document.querySelectorAll('.report-section:checked')].map(x=>x.value)}
function reportScheduleData(pid){
  const rows=scheduleData(pid),planned=plannedForProject(pid),actual=actualForProject(pid),variance=actual-planned;
  return{planned,actual,variance,status:variance<-2?'Behind / Slippage':variance>2?'Ahead':'On Track'};
}
function buildSCurveData(pid){
  const rows=scheduleData(pid); if(!rows.length)return{labels:[],planned:[],actual:[]};
  const min=new Date(Math.min(...rows.map(r=>new Date(r.start_date)))),max=new Date(Math.max(...rows.map(r=>new Date(r.end_date))));
  const span=Math.max(1,(max-min)/86400000),points=12;
  const dates=[...Array(points)].map((_,i)=>new Date(min.getTime()+span*86400000*i/(points-1)));
  const plannedAt=d=>rows.reduce((sum,r)=>{const s=new Date(r.start_date),e=new Date(r.end_date),w=Number(r.weight||0);const f=d<=s?0:d>=e?1:(d-s)/(e-s||1);return sum+w*f},0);
  const history=cache.progressHistory.filter(h=>String(h.project_id)===String(pid)),pr=progressForProject(pid);
  const actualAt=d=>pr.reduce((sum,p)=>{const hs=history.filter(h=>h.activity===p.activity&&new Date(h.recorded_at)<=d).sort((a,b)=>new Date(b.recorded_at)-new Date(a.recorded_at));const a=hs[0]?.actual_percent??(d>=new Date()?Number(p.actual_percent||0):0);return sum+Number(p.weight||0)*Number(a||0)/100},0);
  return{labels:dates.map(d=>d.toLocaleDateString('en-PH',{month:'short',day:'numeric'})),planned:dates.map(d=>Number(plannedAt(d).toFixed(2))),actual:dates.map(d=>Number(actualAt(d).toFixed(2)))};
}
function reportRecovery(pid){
  const s=reportScheduleData(pid),items=[];
  if(s.variance<-2){
    items.push(`Project is behind schedule by ${Math.abs(s.variance).toFixed(2)} percentage points.`);
    const overdue=scheduleData(pid).filter(r=>new Date(r.end_date)<new Date()).filter(r=>{const ap=progressForProject(pid).find(x=>x.activity.toLowerCase()===r.activity.toLowerCase());return Number(ap?.actual_percent||0)<100});
    if(overdue.length)items.push(`Prioritize overdue high-impact activities: ${overdue.slice(0,5).map(x=>x.activity).join(', ')}.`);
    const pending=inventoryForProject(pid).filter(i=>i.date_request&&!i.date_purchase);
    if(pending.length)items.push(`${pending.length} requested procurement item(s) have no purchase date; expedite procurement.`);
    items.push('Consider parallel workfronts, additional manpower/shift, and resource reallocation only where technically feasible and safe.');
  }else if(s.variance>2)items.push(`Project is ahead by ${s.variance.toFixed(2)} percentage points. Protect the gain through procurement and manpower continuity.`);
  else items.push('Project is within ±2% of the projected schedule. Continue daily monitoring of critical activities.');
  return items;
}
function buildReportPayload(){
  const pid=$('reportProject')?.value||$('workspaceProject')?.value,p=currentProject(pid); if(!p)return null;
  const b=budgetData(pid),s=reportScheduleData(pid),sc=buildSCurveData(pid);
  const progress=progressForProject(pid).map(r=>({...r,actual_cost:actualCostForProgress(r)}));
  const template=cache.templates.find(t=>String(t.id)===String($('reportTemplate')?.value));
  return{
    meta:{reportType:$('reportType').value,reportDate:$('reportDate').value,preparedBy:$('reportPreparedBy').value,period:$('reportPeriod').value,templateName:template?.template_name||''},
    sections:reportSections(),
    data:{project:p,schedule:s,sCurve:sc,budget:b,progress,billings:cache.billings.filter(x=>String(x.project_id)===String(pid)),recovery:reportRecovery(pid)}
  };
}
function reportMetric(label,value){return `<div class="report-metric"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`}
function previewSCurve(sc){
  if(!sc.labels.length)return'<div class="empty">No schedule data available.</div>';
  const W=900,H=250,pad=36,n=sc.labels.length,x=i=>pad+i*(W-pad*2)/(n-1||1),y=v=>H-pad-Math.max(0,Math.min(100,v))*(H-pad*2)/100;
  const p=sc.planned.map((v,i)=>`${x(i)},${y(v)}`).join(' '),a=sc.actual.map((v,i)=>`${x(i)},${y(v)}`).join(' ');
  return `<svg class="report-scurve" viewBox="0 0 ${W} ${H}" width="100%"><polyline fill="none" stroke="#2563eb" stroke-width="4" points="${p}"/><polyline fill="none" stroke="#16a34a" stroke-width="4" points="${a}"/></svg><div class="chart-legend"><span><i class="legend-dot" style="background:#2563eb"></i>Projected</span><span><i class="legend-dot" style="background:#16a34a"></i>Actual</span></div>`;
}
function renderReportPreview(){
  const payload=buildReportPayload(); if(!payload)return alert('Select a project.');
  const {data:d,meta,sections}=payload,p=d.project;
  $('reportPreviewMeta').textContent=`${p.project_name} • ${meta.reportType} • ${meta.reportDate}`;
  const pages=[];
  pages.push(`<div class="report-page"><div class="report-title"><div><small>CONSTRUCTION MONITORING</small><h1>${esc(meta.reportType)}</h1><h2>${esc(p.project_name)}</h2></div><div><small>Report Date</small><strong>${esc(meta.reportDate)}</strong><br><small>Prepared By</small><strong>${esc(meta.preparedBy)}</strong></div></div><p>${esc(p.client_name||'')}<br>${esc(p.location||'')}</p><div class="report-grid">${reportMetric('Net Contract',money(d.budget.contract))}${reportMetric('Actual Progress',pct(d.schedule.actual))}${reportMetric('Projected',pct(d.schedule.planned))}${reportMetric('Status',d.schedule.status)}</div></div>`);
  if(sections.includes('schedule'))pages.push(`<div class="report-page"><h2 class="report-section-title">Schedule / S-Curve</h2><div class="report-grid">${reportMetric('Projected',pct(d.schedule.planned))}${reportMetric('Actual',pct(d.schedule.actual))}${reportMetric('Variance',(d.schedule.variance>=0?'+':'')+pct(d.schedule.variance))}${reportMetric('Status',d.schedule.status)}</div>${previewSCurve(d.sCurve)}</div>`);
  if(sections.includes('budget')||sections.includes('costs')){
    const cat=Object.entries(d.budget.categories||{}).map(([k,v])=>`<tr><td>${esc(k)}</td><td>${money(v)}</td></tr>`).join('');
    pages.push(`<div class="report-page"><h2 class="report-section-title">Budget & Cost Monitoring</h2><div class="report-grid">${reportMetric('Running Cost',money(d.budget.runningCost))}${reportMetric('Earned Value',money(d.budget.earned))}${reportMetric('Running Profit',money(d.budget.runningProfit))}${reportMetric('Projected Profit',money(d.budget.projectedProfit))}</div><table class="report-table"><thead><tr><th>Cost Folder</th><th>Amount</th></tr></thead><tbody>${cat}</tbody></table></div>`);
  }
  if(sections.includes('progress')){
    const rows=d.progress.slice(0,20).map(r=>`<tr><td>${esc(r.activity)}</td><td>${pct(r.weight)}</td><td>${pct(r.actual_percent)}</td><td>${money(r.budget_amount)}</td><td>${money(r.actual_cost)}</td></tr>`).join('');
    pages.push(`<div class="report-page"><h2 class="report-section-title">Actual Progress</h2><table class="report-table"><thead><tr><th>Scope</th><th>Weight</th><th>Actual</th><th>BOQ Budget</th><th>Actual Cost</th></tr></thead><tbody>${rows}</tbody></table></div>`);
  }
  if(sections.includes('billing')){
    const rows=d.billings.slice(0,20).map(b=>`<tr><td>${esc(b.billing_type||'Client Billing')}</td><td>${esc(b.variation_no||b.billing_no||'')}</td><td>${money(b.gross_amount)}</td><td>${money(b.retention_amount)}</td><td>${money(b.recoupment_amount)}</td><td>${money(b.received_amount)}</td><td>${money(b.outstanding_amount)}</td></tr>`).join('');
    pages.push(`<div class="report-page"><h2 class="report-section-title">Billing / Subcontractor Summary</h2><table class="report-table"><thead><tr><th>Type</th><th>Record</th><th>Gross</th><th>Retention</th><th>Recoupment</th><th>Paid / Received</th><th>Balance</th></tr></thead><tbody>${rows}</tbody></table></div>`);
  }
  if(sections.includes('risks'))pages.push(`<div class="report-page"><h2 class="report-section-title">Schedule Status & Recovery Guidance</h2>${d.recovery.map(x=>`<div class="report-note">${esc(x)}</div>`).join('')}</div>`);
  $('reportPreview').innerHTML=pages.join('');
}
if($('previewReportBtn'))$('previewReportBtn').onclick=renderReportPreview;
if($('printReportBtn'))$('printReportBtn').onclick=()=>{renderReportPreview();setTimeout(()=>window.print(),150)};
if($('downloadReportPptxBtn'))$('downloadReportPptxBtn').onclick=async()=>{
  const payload=buildReportPayload(); if(!payload)return alert('Select a project.');
  const btn=$('downloadReportPptxBtn'),old=btn.textContent;btn.disabled=true;btn.textContent='Generating...';
  try{
    const r=await fetch('/api/generate-report',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    if(!r.ok)throw new Error(await r.text());
    const blob=await r.blob(),a=document.createElement('a'),name=(payload.meta.templateName||`${payload.data.project.project_name}_${payload.meta.reportType}`).replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9._-]/g,'_');
    a.href=URL.createObjectURL(blob);a.download=`${name}_${payload.meta.reportDate}.pptx`;a.click();URL.revokeObjectURL(a.href);
  }catch(e){alert('Report generation failed: '+e.message)}
  finally{btn.disabled=false;btn.textContent=old}
};
if($('reportProject'))$('reportProject').onchange=renderReportPreview;

const refreshV144Base=refreshAll;
refreshAll=async function(){await refreshV144Base();syncReportSelectors()};

const showV144Base=show;
show=function(id){showV144Base(id);if(id==='reports'){syncReportSelectors();renderReportPreview()}};

setTimeout(()=>{try{syncReportSelectors()}catch(e){console.warn('v14.4 init',e)}},1000);
