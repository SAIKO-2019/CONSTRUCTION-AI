// SAIKO Construction AI v26.1
// Projected timeline is converted into the same canonical scope/% format as Actual STATUS.
(function(){
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
  const SCOPES=[
    'CEILING WORKS',
    'CABINETRY WORKS',
    'WALL FINISHING WORKS',
    'FLOORING WORKS',
    'ELECTRICAL WORKS',
    'PLUMBING WORKS',
    'GLASS WORKS',
    'GENERAL REQUIREMENTS'
  ];

  function pidFrom(id){
    return $(id)?.value||$('workspaceProject')?.value||cache.projects?.[0]?.id||'';
  }

  function latestActualDate(pid){
    const h=(cache.actualSeries||[])
      .filter(r=>String(r.project_id)===String(pid))
      .sort((a,b)=>String(a.progress_date).localeCompare(String(b.progress_date)));
    if(h.length)return String(h[h.length-1].progress_date).slice(0,10);
    return new Date().toISOString().slice(0,10);
  }

  function projectedScopeAt(pid,scope,date){
    const rows=(cache.projectedScopeSeries||[])
      .filter(r=>String(r.project_id)===String(pid)&&String(r.scope_name)===String(scope))
      .sort((a,b)=>String(a.progress_date).localeCompare(String(b.progress_date)));
    let value=0;
    for(const r of rows){
      const d=String(r.progress_date).slice(0,10);
      if(d<=date)value=n(r.cumulative_percent);
      else break;
    }
    return value;
  }

  function actualScopeMap(pid){
    const map=new Map();
    for(const r of (cache.progress||[]).filter(r=>String(r.project_id)===String(pid))){
      map.set(String(r.activity).toUpperCase(),n(r.actual_percent));
    }
    return map;
  }

  function renderProjectedScopeStatus(){
    const tbody=$('projectedScopeStatusRows');
    if(!tbody)return;
    const pid=pidFrom('scheduleProject');
    if(!pid)return;
    const date=latestActualDate(pid);
    const has=(cache.projectedScopeSeries||[]).some(r=>String(r.project_id)===String(pid));
    if(!has){
      tbody.innerHTML='<tr><td colspan="3" class="empty">Sync the Projected Google Sheet.</td></tr>';
      return;
    }
    tbody.innerHTML=SCOPES.map(scope=>`
      <tr>
        <td><strong>${scope}</strong></td>
        <td>${pct(projectedScopeAt(pid,scope,date))}</td>
        <td>${date}</td>
      </tr>`).join('');
  }

  function renderScopeComparison(){
    const tbody=$('dashboardScopeCompareRows');
    const badge=$('scopeCompareOverallBadge');
    if(!tbody)return;
    const pid=pidFrom('workspaceProject');
    if(!pid)return;

    const date=latestActualDate(pid);
    const actual=actualScopeMap(pid);
    const hasP=(cache.projectedScopeSeries||[]).some(r=>String(r.project_id)===String(pid));
    const hasA=actual.size>0;

    if(!hasP||!hasA){
      tbody.innerHTML='<tr><td colspan="5" class="empty">Sync both Projected and Actual Google Sheets.</td></tr>';
      if(badge)badge.textContent='WAITING';
      return;
    }

    let totalP=0,totalA=0;
    tbody.innerHTML=SCOPES.map(scope=>{
      const p=projectedScopeAt(pid,scope,date);
      const a=actual.get(scope)||0;
      const variance=a-p;
      totalP+=p; totalA+=a;
      const condition=variance<-0.25?'Behind':variance>0.25?'Ahead':'On Track';
      return `<tr>
        <td><strong>${scope}</strong></td>
        <td>${pct(p)}</td>
        <td>${pct(a)}</td>
        <td class="${variance<0?'negative':'positive'}">${pct(variance)}</td>
        <td><span class="scope-condition ${condition==='Behind'?'behind':condition==='Ahead'?'ahead':'track'}">${condition}</span></td>
      </tr>`;
    }).join('');

    const variance=totalA-totalP;
    const condition=variance<-0.25?'BEHIND':variance>0.25?'AHEAD':'ON TRACK';
    if(badge)badge.textContent=`${condition} • ${date}`;
  }

  const oldSchedule=window.renderSchedule;
  window.renderSchedule=function(){
    const out=oldSchedule.apply(this,arguments);
    renderProjectedScopeStatus();
    return out;
  };

  const oldDash=window.renderDashboard;
  window.renderDashboard=function(){
    const out=oldDash.apply(this,arguments);
    renderScopeComparison();
    return out;
  };

  window.renderProjectedScopeStatus=renderProjectedScopeStatus;
  window.renderScopeComparison=renderScopeComparison;
})();
