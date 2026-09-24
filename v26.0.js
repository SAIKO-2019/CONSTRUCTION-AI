// SAIKO Construction AI v26.0
// True date-aligned Projected vs Actual S-Curve.
(function(){
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0};

  function projectId(){
    return $('workspaceProject')?.value||cache.projects?.[0]?.id||'';
  }

  function projectedSeries(pid){
    return (cache.projectedSeries||[])
      .filter(r=>String(r.project_id)===String(pid))
      .map(r=>({date:String(r.progress_date).slice(0,10),value:Math.max(0,Math.min(100,n(r.cumulative_percent)))}))
      .sort((a,b)=>a.date.localeCompare(b.date));
  }

  function actualSeries(pid){
    return (cache.actualSeries||[])
      .filter(r=>String(r.project_id)===String(pid))
      .map(r=>({date:String(r.progress_date).slice(0,10),value:Math.max(0,Math.min(100,n(r.cumulative_percent)))}))
      .sort((a,b)=>a.date.localeCompare(b.date));
  }

  function projectedAtDate(pid,date){
    const rows=projectedSeries(pid);
    let out=0;
    for(const r of rows){
      if(r.date<=date)out=r.value;
      else break;
    }
    return out;
  }
  window.projectedAtDate=projectedAtDate;

  function latestActualPoint(pid){
    const rows=actualSeries(pid);
    return rows.length?rows[rows.length-1]:null;
  }

  // Override Dashboard KPI comparison so Projected is evaluated on the Actual snapshot date.
  const oldDashboard=window.renderDashboard;
  window.renderDashboard=function(){
    oldDashboard();

    const active=cache.projects.filter(p=>!['Completed'].includes(p.status));
    if($('dashProjects')){
      $('dashProjects').innerHTML=active.length?active.map(p=>{
        const a=latestActualPoint(p.id);
        const actual=a?a.value:actualForProject(p.id);
        const compareDate=a?.date||new Date().toISOString().slice(0,10);
        const planned=projectedAtDate(p.id,compareDate);
        const variance=actual-planned;
        const label=variance<-2?'Behind':variance>2?'Ahead':'On Track';
        return `<tr>
          <td><strong>${esc(p.project_name)}</strong><br><small class="muted">${label} • ${compareDate}</small></td>
          <td>${esc(p.status)}</td>
          <td>${pct(actual)}</td>
          <td>${pct(planned)}</td>
          <td class="${variance<0?'negative':'positive'}">${pct(variance)}</td>
        </tr>`;
      }).join(''):'<tr><td colspan="5" class="empty">No projects yet.</td></tr>';
    }

    renderDateAlignedCurve();
  };

  function renderDateAlignedCurve(){
    const pid=projectId();
    const chart=$('dashboardMatchedSCurve');
    if(!chart||!pid)return;

    const p=projectedSeries(pid);
    const a=actualSeries(pid);
    if(!p.length){
      chart.innerHTML='<div class="empty">Sync the Projected Google Sheet to load the cumulative date series.</div>';
      return;
    }

    const dates=[...new Set([...p.map(x=>x.date),...a.map(x=>x.date)])].sort();
    const pMap=new Map(p.map(x=>[x.date,x.value]));
    const aMap=new Map(a.map(x=>[x.date,x.value]));

    // Projected uses latest known cumulative value on/before each date.
    let pv=0;
    const combined=dates.map(date=>{
      if(pMap.has(date))pv=pMap.get(date);
      return {date,projected:pv,actual:aMap.has(date)?aMap.get(date):null};
    });

    const W=920,H=280,padL=46,padR=22,padT=18,padB=48;
    const x=i=>combined.length===1?(padL+(W-padL-padR)/2):padL+i*(W-padL-padR)/(combined.length-1);
    const y=v=>H-padB-Math.max(0,Math.min(100,v))*(H-padT-padB)/100;
    const grid=[0,25,50,75,100].map(v=>`<line x1="${padL}" y1="${y(v)}" x2="${W-padR}" y2="${y(v)}" stroke="rgba(100,116,139,.18)"/><text x="4" y="${y(v)+4}" font-size="11" fill="#64748b">${v}%</text>`).join('');
    const pp=combined.map((r,i)=>`${x(i)},${y(r.projected)}`).join(' ');

    const actualPts=combined.map((r,i)=>r.actual==null?null:{i,v:r.actual,date:r.date}).filter(Boolean);
    const ap=actualPts.map(o=>`${x(o.i)},${y(o.v)}`).join(' ');

    const labelStep=Math.max(1,Math.ceil(combined.length/8));
    const labels=combined.map((r,i)=>i%labelStep===0||i===combined.length-1
      ? `<text x="${x(i)}" y="${H-14}" text-anchor="middle" font-size="9" fill="#64748b">${r.date.slice(5)}</text>`
      :'').join('');

    chart.innerHTML=`
      <svg class="scurve-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        ${grid}
        <polyline fill="none" stroke="#2563eb" stroke-width="3" points="${pp}"/>
        ${actualPts.length>1?`<polyline fill="none" stroke="#16a34a" stroke-width="3" points="${ap}"/>`:''}
        ${actualPts.map(o=>`<circle cx="${x(o.i)}" cy="${y(o.v)}" r="4.5" fill="#16a34a"/>`).join('')}
        ${labels}
      </svg>
      <div class="chart-legend">
        <span><i class="legend-dot" style="background:#2563eb"></i>Projected cumulative % by date</span>
        <span><i class="legend-dot" style="background:#16a34a"></i>Actual STATUS total by date</span>
      </div>`;
  }

  window.renderDateAlignedCurve=renderDateAlignedCurve;
})();
