// SAIKO Construction AI v27.3
// 1) Projected page is Planned-only.
// 2) Dashboard Actual line is visually smoothed between real saved STATUS points.
//    No synthetic Actual values are written to the database.
(function(){
  const n=v=>{
    const x=Number(v);
    return Number.isFinite(x)?x:0;
  };

  function schedulePid(){
    return $('scheduleProject')?.value||$('workspaceProject')?.value||cache.projects?.[0]?.id||'';
  }

  function projectedSeries(pid){
    return (cache.projectedSeries||[])
      .filter(r=>String(r.project_id)===String(pid))
      .map(r=>({
        date:String(r.progress_date).slice(0,10),
        value:Math.max(0,Math.min(100,n(r.cumulative_percent)))
      }))
      .sort((a,b)=>a.date.localeCompare(b.date));
  }

  function plannedAt(rows,date){
    let v=0;
    for(const r of rows){
      if(r.date<=date)v=r.value;
      else break;
    }
    return v;
  }

  function todayIso(){
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  // ---------------- Projected page: Planned only ----------------
  function renderProjectedOnly(){
    const pid=schedulePid();
    const rows=projectedSeries(pid);
    const summary=$('scheduleSummary');
    const chart=$('sCurveChart');
    const guide=$('recoveryPlan');
    const badge=$('scheduleHealthBadge');

    if(!rows.length){
      if(summary)summary.innerHTML=[
        ['Projected Today','0.00%'],
        ['Remaining Plan','100.00%'],
        ['Start','—'],
        ['Finish','—']
      ].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
      if(chart)chart.innerHTML='<div class="empty">Upload the fixed Projected schedule to generate the Planned curve.</div>';
      if(guide)guide.innerHTML='<div class="empty">No fixed baseline loaded.</div>';
      if(badge)badge.textContent='WAITING';
      return;
    }

    const today=todayIso();
    const planned=plannedAt(rows,today);
    const start=rows[0].date;
    const finish=rows[rows.length-1].date;

    if(summary){
      summary.innerHTML=[
        ['Projected Today',`${planned.toFixed(2)}%`],
        ['Remaining Plan',`${Math.max(0,100-planned).toFixed(2)}%`],
        ['Plan Start',start],
        ['Plan Finish',finish]
      ].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
    }

    if(badge)badge.textContent='FIXED PLAN';
    if(guide){
      guide.innerHTML=`
        <div class="recovery-item"><strong>Fixed Baseline</strong>
          <p>The uploaded Projected schedule is the official Planned curve. The system automatically reads the correct cumulative percentage for each date.</p>
        </div>
        <div class="recovery-item"><strong>Comparison</strong>
          <p>Actual is intentionally removed from this page. Planned vs Actual comparison is shown only on the Dashboard.</p>
        </div>`;
    }

    if(chart){
      const W=900,H=250,L=42,R=18,T=16,B=38;
      const x=i=>rows.length===1?(L+(W-L-R)/2):L+i*(W-L-R)/(rows.length-1);
      const y=v=>H-B-Math.max(0,Math.min(100,v))*(H-T-B)/100;
      const pts=rows.map((r,i)=>`${x(i)},${y(r.value)}`).join(' ');
      const grid=[0,25,50,75,100].map(v=>
        `<line x1="${L}" y1="${y(v)}" x2="${W-R}" y2="${y(v)}" stroke="rgba(100,116,139,.18)"/>
         <text x="3" y="${y(v)+4}" font-size="10" fill="#64748b">${v}%</text>`
      ).join('');
      chart.innerHTML=`
        <svg class="scurve-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
          ${grid}
          <polyline fill="none" stroke="#2563eb" stroke-width="3" points="${pts}"/>
        </svg>
        <div class="chart-legend">
          <span><i class="legend-dot" style="background:#2563eb"></i>Projected cumulative</span>
        </div>`;
    }
  }

  // ---------------- Smooth Actual dashboard rendering ----------------
  function timeValue(date){
    const d=new Date(`${date}T00:00:00`);
    return Number.isNaN(d.getTime())?0:d.getTime();
  }

  function svgXForDate(date,startDate,endDate,L,W,R){
    const s=timeValue(startDate),e=timeValue(endDate),t=timeValue(date);
    if(e<=s)return L+(W-L-R)/2;
    return L+((t-s)/(e-s))*(W-L-R);
  }

  // Smooth path through actual known points. With two points this produces a gentle
  // S-shaped interpolation rather than a flat line followed by a vertical jump.
  function smoothPath(points){
    if(!points.length)return '';
    if(points.length===1)return `M ${points[0].x} ${points[0].y}`;
    if(points.length===2){
      const [a,b]=points;
      const dx=b.x-a.x;
      return `M ${a.x} ${a.y} C ${a.x+dx*0.32} ${a.y}, ${a.x+dx*0.68} ${b.y}, ${b.x} ${b.y}`;
    }

    let d=`M ${points[0].x} ${points[0].y}`;
    for(let i=0;i<points.length-1;i++){
      const p0=points[i-1]||points[i];
      const p1=points[i];
      const p2=points[i+1];
      const p3=points[i+2]||p2;

      const cp1x=p1.x+(p2.x-p0.x)/6;
      const cp1y=p1.y+(p2.y-p0.y)/6;
      const cp2x=p2.x-(p3.x-p1.x)/6;
      const cp2y=p2.y-(p3.y-p1.y)/6;
      d+=` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }

  function actualSeries(pid){
    if(typeof window.alignedActualSeries==='function'){
      return window.alignedActualSeries(pid).map(r=>({date:r.date,value:r.value}));
    }
    return (cache.actualSeries||[])
      .filter(r=>String(r.project_id)===String(pid))
      .map(r=>({date:String(r.progress_date).slice(0,10),value:Math.max(0,Math.min(100,n(r.cumulative_percent)))}))
      .sort((a,b)=>a.date.localeCompare(b.date));
  }

  function plannedAtDate(rows,date){
    let v=0;
    for(const r of rows){
      if(r.date<=date)v=r.value;
      else break;
    }
    return v;
  }

  function smoothProjectCard(project){
    const p=projectedSeries(project.id);
    const a=actualSeries(project.id);

    if(!p.length){
      return `<article class="project-curve-card">
        <div class="project-curve-head">
          <div><h3>${esc(project.project_name)}</h3><small>${esc(project.status||'')}</small></div>
          <span class="project-health neutral">NO PLAN</span>
        </div>
        <div class="empty">Upload the fixed Projected schedule.</div>
      </article>`;
    }

    const start=p[0].date;
    const finish=p[p.length-1].date;
    const latestActual=a.length?a[a.length-1].date:start;
    const actual=a.length?a[a.length-1].value:0;
    const planned=plannedAtDate(p,latestActual);
    const variance=actual-planned;
    const condition=variance<-0.25?'SLIPPAGE':variance>0.25?'AHEAD':'ON TRACK';

    const W=420,H=150,L=28,R=10,T=10,B=26;
    const y=v=>H-B-Math.max(0,Math.min(100,v))*(H-T-B)/100;

    // Planned uses full official daily curve.
    const pPts=p.map(r=>({
      x:svgXForDate(r.date,start,finish,L,W,R),
      y:y(r.value)
    }));
    const pLine=pPts.map(o=>`${o.x},${o.y}`).join(' ');

    // Actual uses only REAL saved points + the 0% project-start baseline.
    // We smooth only the visual path; the data values themselves remain unchanged.
    const aPts=a
      .filter(r=>r.date>=start)
      .map(r=>({
        x:svgXForDate(r.date,start,finish,L,W,R),
        y:y(r.value),
        date:r.date,
        value:r.value
      }));

    const aPath=smoothPath(aPts);

    return `<article class="project-curve-card">
      <div class="project-curve-head">
        <div>
          <h3>${esc(project.project_name)}</h3>
          <small>Start ${start} • Actual as of ${latestActual}</small>
        </div>
        <span class="project-health ${condition==='SLIPPAGE'?'behind':condition==='AHEAD'?'ahead':'track'}">${condition}</span>
      </div>
      <div class="project-curve-kpis">
        <div><span>Planned</span><strong>${planned.toFixed(2)}%</strong></div>
        <div><span>Actual</span><strong>${actual.toFixed(2)}%</strong></div>
        <div><span>Variance</span><strong class="${variance<0?'negative':'positive'}">${variance.toFixed(2)}%</strong></div>
      </div>
      <svg class="project-mini-scurve" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <line x1="${L}" y1="${y(0)}" x2="${W-R}" y2="${y(0)}" stroke="rgba(100,116,139,.18)"/>
        <line x1="${L}" y1="${y(50)}" x2="${W-R}" y2="${y(50)}" stroke="rgba(100,116,139,.12)"/>
        <line x1="${L}" y1="${y(100)}" x2="${W-R}" y2="${y(100)}" stroke="rgba(100,116,139,.18)"/>
        <polyline fill="none" stroke="#2563eb" stroke-width="3" points="${pLine}"/>
        ${aPath?`<path d="${aPath}" fill="none" stroke="#16a34a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`:''}
        ${aPts.map(o=>`<circle cx="${o.x}" cy="${o.y}" r="2.7" fill="#16a34a"/>`).join('')}
      </svg>
      <div class="project-curve-legend">
        <span><i class="planned-dot"></i>Planned fixed daily curve</span>
        <span><i class="actual-dot"></i>Actual STATUS history • smooth display</span>
      </div>
    </article>`;
  }

  function renderSmoothDashboardCurves(){
    const host=$('dashboardProjectCurves');
    if(!host)return;
    const projects=(cache.projects||[]).filter(p=>p.status!=='Completed');
    host.innerHTML=projects.length
      ?projects.map(smoothProjectCard).join('')
      :'<div class="empty">No ongoing projects.</div>';
  }

  // Final render overrides.
  const oldSchedule=window.renderSchedule;
  window.renderSchedule=function(){
    let out;
    try{out=oldSchedule.apply(this,arguments)}catch(err){console.warn('projected legacy render',err)}
    renderProjectedOnly();
    return out;
  };

  const oldDashboard=window.renderDashboard;
  window.renderDashboard=function(){
    let out;
    try{out=oldDashboard.apply(this,arguments)}catch(err){console.warn('dashboard legacy render',err)}
    renderSmoothDashboardCurves();
    return out;
  };

  if($('scheduleProject')){
    $('scheduleProject').addEventListener('change',()=>setTimeout(renderProjectedOnly,20),{passive:true});
  }

  setTimeout(()=>{
    renderProjectedOnly();
    renderSmoothDashboardCurves();
  },500);

  window.renderProjectedOnlyV273=renderProjectedOnly;
  window.renderSmoothDashboardCurves=renderSmoothDashboardCurves;
})();
